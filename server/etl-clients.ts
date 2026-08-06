import mssql from 'mssql';
import { db } from './db';
import { sql, eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { clients, etlExecutionLog, etlConfig } from '../shared/schema';
import { rutMatchKey } from '../shared/rut';
import { CircuitBreaker, executeWithResilience } from './etl-resilience';
import { createETLLogger } from './production-logger';

const sqlServerConfig: mssql.config = {
  server: process.env.SQL_SERVER_HOST || '',
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  user: process.env.SQL_SERVER_USER || '',
  password: process.env.SQL_SERVER_PASSWORD || '',
  database: process.env.SQL_SERVER_DATABASE || '',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 90000,
  requestTimeout: 180000,
};

// Circuit Breaker reutiliza el mismo patrón que los otros ETL
const sqlServerBreaker = new CircuitBreaker({
  failureThreshold: 12,
  successThreshold: 3,
  timeout: 120000,
  name: 'SQLServer-ETL-Clients'
});

// Event emitter para progreso del ETL de clientes
export const clientEtlProgressEmitter = new EventEmitter();

interface ClientETLResult {
  success: boolean;
  recordsProcessed: number;
  newClients: number;
  updatedClients: number;
  executionTimeMs: number;
  error?: string;
}

interface ETLProgressEvent {
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
  percentage: number;
}

function emitProgress(step: number, totalSteps: number, message: string, details?: string) {
  const percentage = Math.round((step / totalSteps) * 100);
  const event: ETLProgressEvent = { step, totalSteps, message, details, percentage };
  clientEtlProgressEmitter.emit('progress', event);
  console.log(`📊 [Clientes ${percentage}%] Paso ${step}/${totalSteps}: ${message}`);
  if (details) console.log(`   ${details}`);
}

// Campos que el ETL NUNCA debe sobreescribir (editados manualmente en CRM)
const PROTECTED_CRM_FIELDS = [
  'purchasingContactName',
  'assignedSalespersonUserId',
  'userId',
  'pickupWarehouseId',
  'parentClientId',
  'branchLabel',
];

// Función helper para limpiar numéricos (retorna string porque drizzle numeric() usa string)
function cleanNumeric(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : String(num);
}

// Función helper para limpiar strings
function cleanString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * ETL de Clientes: Extrae todos los clientes de dbo.MAEEN (SQL Server ERP)
 * y hace UPSERT en la tabla `clients` de PostgreSQL.
 *
 * Solo actualiza campos provenientes del ERP; nunca sobreescribe campos CRM manuales.
 */
export async function executeClientETL(): Promise<ClientETLResult> {
  const startTime = Date.now();
  const ETL_NAME = 'clientes';
  const TOTAL_STEPS = 5;
  const logger = createETLLogger(ETL_NAME);

  let pool: mssql.ConnectionPool | null = null;
  let executionLogId: string | null = null;

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  👥 ETL CLIENTES INICIADO                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`⏰ Start Time: ${new Date().toISOString()}`);

  try {
    // ── PASO 0: Verificar lock (no ejecutar si ya hay uno corriendo) ──────
    const runningETL = await db
      .select()
      .from(etlExecutionLog)
      .where(sql`status = 'running' AND etl_name = ${ETL_NAME}`)
      .limit(1);

    if (runningETL.length > 0) {
      const runningTime = Date.now() - new Date(runningETL[0].startTime!).getTime();
      const STALE_THRESHOLD_MS = 30 * 60 * 1000;

      if (runningTime > STALE_THRESHOLD_MS) {
        console.log(`🧹 Limpiando ejecución colgada (${Math.round(runningTime / 60000)} min)...`);
        await db.execute(sql`
          UPDATE ventas.etl_execution_log
          SET status = 'failed',
              error_message = 'Ejecución colgada - limpiada automáticamente',
              end_time = NOW(),
              execution_time_ms = ${runningTime}
          WHERE id = ${runningETL[0].id}
        `);
      } else {
        console.log('⚠️  ETL Clientes ya en ejecución. Cancelando solicitud duplicada.');
        return {
          success: false,
          recordsProcessed: 0,
          newClients: 0,
          updatedClients: 0,
          executionTimeMs: Date.now() - startTime,
          error: 'ETL Clientes ya en ejecución',
        };
      }
    }

    // ── PASO 1: Conectar a SQL Server ─────────────────────────────────────
    emitProgress(1, TOTAL_STEPS, 'Conectando a SQL Server', 'Estableciendo conexión...');

    pool = await executeWithResilience(
      async () => mssql.connect(sqlServerConfig),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log('✅ Conectado a SQL Server\n');

    // Registrar inicio de ejecución
    const [executionLog] = await db.insert(etlExecutionLog).values({
      etlName: ETL_NAME,
      startTime: new Date(),
      status: 'running',
      period: 'full-sync',
      documentTypes: 'MAEEN',
      branches: 'all',
    }).returning();
    executionLogId = executionLog.id;

    // ── PASO 2: Extraer clientes de SQL Server ───────────────────────────
    emitProgress(2, TOTAL_STEPS, 'Extrayendo clientes del ERP', 'Consultando dbo.MAEEN...');

    const result = await executeWithResilience(
      async () => pool!.request().query(`
        SELECT
          KOEN, NOKOEN, RTEN, TIEN, SUEN,
          SIEN, GIEN,
          PAEN, CIEN, CMEN, DIEN, ZOEN,
          FOEN, FAEN, EMAIL, CNEN, CNEN2,
          KOFUEN, CPEN, RUEN,
          CRLT, CRSD, CRTO, CREN,
          LCEN, LVEN,
          OBEN, FEULTR,
          ACTIEN, BLOQUEADO,
          DIPRVE, EMAILCOMER,
          FEVECREN, NUVECR, DCCR, INCR,
          COBRADOR,
          CONTAB, SUBAUXI,
          NOKOENAMP
        FROM dbo.MAEEN
        WHERE TIEN = 'C'
        ORDER BY KOEN
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );

    const erpClients = result.recordset;
    console.log(`   ✅ ${erpClients.length} clientes extraídos del ERP\n`);

    if (erpClients.length === 0) {
      console.log('⚠️  No se encontraron clientes en el ERP');
      await db.update(etlExecutionLog)
        .set({
          status: 'success',
          endTime: new Date(),
          recordsProcessed: 0,
          executionTimeMs: Date.now() - startTime,
        })
        .where(sql`id = ${executionLog.id}`);

      await pool.close();
      return {
        success: true,
        recordsProcessed: 0,
        newClients: 0,
        updatedClients: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // ── PASO 3: Obtener clientes existentes en PostgreSQL ────────────────
    emitProgress(3, TOTAL_STEPS, 'Comparando con base local', `${erpClients.length} clientes a procesar...`);

    // Obtener todos los KOEN existentes para clasificar inserts vs updates
    const existingResult = await db.execute(sql`
      SELECT koen FROM clients WHERE koen IS NOT NULL
    `);
    const existingKoens = new Set(
      (existingResult as any).rows.map((r: any) => r.koen?.trim())
    );

    console.log(`   📋 ${existingKoens.size} clientes existentes en la base local\n`);

    // Candidatos a CRUCE por RUT: fichas locales que NO corresponden a un código
    // vivo del ERP — o sin código (prospecto manual), o con un código tipeado a
    // mano que el ERP no conoce. Cuando el ERP trae ese mismo RUT bajo su código
    // real, se fusiona sobre esa ficha (queda el nombre del ERP) en vez de crear
    // un duplicado.
    //
    // Las fichas cuyo koen SÍ existe en el ERP quedan fuera a propósito: son
    // sucursales/códigos legítimos y cada una debe seguir su propio registro.
    const erpKoens = new Set(
      erpClients.map((r: any) => cleanString(r.KOEN)).filter(Boolean) as string[]
    );

    const crossableByRut = new Map<string, string>(); // clave de RUT -> client.id
    const crossableResult = await db.execute(sql`
      SELECT id, koen, rten FROM clients
      WHERE rten IS NOT NULL AND rten <> ''
      ORDER BY created_at DESC NULLS LAST, id
    `);
    for (const r of (crossableResult as any).rows) {
      const localKoen = cleanString(r.koen);
      if (localKoen && erpKoens.has(localKoen)) continue; // código vivo del ERP
      // rutMatchKey compara por cuerpo del RUT: el ERP lo guarda sin DV
      // ("77454264") y el alta manual con DV y formato ("77.454.264-7").
      const key = rutMatchKey(r.rten);
      // ORDER BY created_at DESC: se queda la ficha más reciente por RUT.
      if (key && !crossableByRut.has(key)) crossableByRut.set(key, r.id);
    }
    console.log(`   🔗 ${crossableByRut.size} fichas locales disponibles para cruce por RUT\n`);

    // ── PASO 4: UPSERT en lotes ──────────────────────────────────────────
    emitProgress(4, TOTAL_STEPS, 'Sincronizando clientes', 'Insertando y actualizando...');

    let newClients = 0;
    let updatedClients = 0;
    let crossedClients = 0;
    let errorCount = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < erpClients.length; i += BATCH_SIZE) {
      const batch = erpClients.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(erpClients.length / BATCH_SIZE);

      // Emitir progreso parcial
      const subProgress = Math.round(((i + batch.length) / erpClients.length) * 100);
      emitProgress(4, TOTAL_STEPS, 'Sincronizando clientes', `Lote ${batchNum}/${totalBatches} (${subProgress}%)`);

      for (const row of batch) {
        const koen = cleanString(row.KOEN);
        if (!koen) continue;

        const nokoen = cleanString(row.NOKOEN) || 'SIN NOMBRE';

        // Datos del ERP mapeados a la tabla clients
        const erpData: Record<string, any> = {
          nokoen,
          rten: cleanString(row.RTEN),
          tien: cleanString(row.TIEN),
          suen: cleanString(row.SUEN),
          sien: cleanString(row.SIEN),
          gien: cleanString(row.GIEN),
          paen: cleanString(row.PAEN),
          cien: cleanString(row.CIEN),
          cmen: cleanString(row.CMEN),
          dien: cleanString(row.DIEN),
          zoen: cleanString(row.ZOEN),
          foen: cleanString(row.FOEN),
          faen: cleanString(row.FAEN),
          email: cleanString(row.EMAIL),
          cnen: cleanString(row.CNEN),
          cnen2: cleanString(row.CNEN2),
          kofuen: cleanString(row.KOFUEN),
          cpen: cleanString(row.CPEN),
          ruen: cleanString(row.RUEN),
          crlt: cleanNumeric(row.CRLT),
          crsd: cleanNumeric(row.CRSD),
          crto: cleanNumeric(row.CRTO),
          cren: cleanNumeric(row.CREN),
          lcen: cleanString(row.LCEN),
          lven: cleanString(row.LVEN),
          oben: cleanString(row.OBEN),
          feultr: cleanString(row.FEULTR),
          actien: row.ACTIEN != null ? Number(row.ACTIEN) : null,
          bloqueado: row.BLOQUEADO != null ? Number(row.BLOQUEADO) : null,
          diprve: cleanNumeric(row.DIPRVE),
          emailcomer: cleanString(row.EMAILCOMER),
          fevecren: cleanString(row.FEVECREN),
          nuvecr: cleanNumeric(row.NUVECR),
          dccr: cleanNumeric(row.DCCR),
          incr: cleanNumeric(row.INCR),
          cobrador: cleanString(row.COBRADOR),
          contab: cleanString(row.CONTAB),
          subauxi: cleanString(row.SUBAUXI),
          nokoenamp: cleanString(row.NOKOENAMP),
          updatedAt: new Date(),
        };

        try {
          if (existingKoens.has(koen)) {
            // UPDATE: solo campos ERP, proteger campos CRM
            await db.update(clients)
              .set(erpData)
              .where(eq(clients.koen, koen));
            updatedClients++;
          } else {
            // ¿Ya existe una ficha local con este mismo RUT que no sea un código
            // vivo del ERP (prospecto manual o código tipeado a mano)?
            const rutKey = rutMatchKey(erpData.rten);
            const crossId = rutKey ? crossableByRut.get(rutKey) : undefined;
            if (crossId) {
              // CRUCE: asignar el código ERP y volcar datos oficiales sobre esa
              // ficha —incluido el nombre, que es lo que se ve en el listado—
              // preservando sus campos CRM (no vienen en erpData).
              await db.update(clients)
                .set({ koen, ...erpData })
                .where(eq(clients.id, crossId));
              crossableByRut.delete(rutKey);
              existingKoens.add(koen);
              crossedClients++;
            } else {
              // INSERT: nuevo cliente
              await db.insert(clients).values({
                koen,
                nokoen,
                ...erpData,
              } as any);
              newClients++;
              existingKoens.add(koen); // Evitar duplicados dentro del mismo batch
            }
          }
        } catch (rowError: any) {
          errorCount++;
          if (errorCount <= 5) {
            logger.warn(`Error procesando cliente ${koen}`, {
              koen,
              nokoen,
              error: rowError.message,
            });
          }
        }
      }
    }

    const recordsProcessed = newClients + updatedClients + crossedClients;

    console.log(`\n📊 Resultado de sincronización:`);
    console.log(`   ✅ Nuevos clientes: ${newClients}`);
    console.log(`   🔄 Actualizados: ${updatedClients}`);
    if (crossedClients > 0) console.log(`   🔗 Cruzados con carga manual: ${crossedClients}`);
    if (errorCount > 0) console.log(`   ⚠️  Errores: ${errorCount}`);
    console.log(`   📋 Total procesados: ${recordsProcessed}\n`);

    // ── PASO 5: Registrar éxito ──────────────────────────────────────────
    emitProgress(5, TOTAL_STEPS, 'ETL Clientes Completado', `${newClients} nuevos, ${updatedClients} actualizados`);

    await db.update(etlExecutionLog)
      .set({
        status: 'success',
        endTime: new Date(),
        recordsProcessed,
        executionTimeMs: Date.now() - startTime,
        statistics: JSON.stringify({
          newClients,
          updatedClients,
          crossedClients,
          errorCount,
          totalERP: erpClients.length,
          totalLocal: existingKoens.size,
        }),
      })
      .where(sql`id = ${executionLog.id}`);

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     ✅ ETL CLIENTES COMPLETADO                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`⏱️  Tiempo: ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    return {
      success: true,
      recordsProcessed,
      newClients,
      updatedClients,
      executionTimeMs: Date.now() - startTime,
    };

  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    console.error('\n❌ ERROR EN ETL CLIENTES:', error.message);
    logger.critical('ETL Clientes falló', {
      executionTimeMs,
      errorMessage: error.message,
    }, error);

    // Actualizar log con error
    if (executionLogId) {
      try {
        await db.update(etlExecutionLog)
          .set({
            status: 'error',
            endTime: new Date(),
            executionTimeMs,
            errorMessage: error.message,
          })
          .where(sql`id = ${executionLogId}`);
      } catch (logError) {
        console.error('Error registrando fallo:', logError);
      }
    }

    return {
      success: false,
      recordsProcessed: 0,
      newClients: 0,
      updatedClients: 0,
      executionTimeMs,
      error: error.message,
    };

  } finally {
    if (pool) {
      try {
        await pool.close();
        console.log('✅ Conexión SQL Server cerrada');
      } catch (closeError) {
        console.error('❌ Error cerrando pool:', closeError);
      }
      pool = null;
    }
  }
}
