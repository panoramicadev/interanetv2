import mssql from 'mssql';
import { db } from './db';
import { sql, desc, eq, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { factGdv, gdvSyncLog } from '../shared/schema';
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

// Circuit Breaker para SQL Server
const sqlServerBreaker = new CircuitBreaker({
  failureThreshold: 12,
  successThreshold: 3,
  timeout: 120000,
  name: 'SQLServer-GDV-ETL'
});

// Exportar circuit breaker para health checks
export { sqlServerBreaker as gdvSqlServerBreaker };

interface GDVETLResult {
  success: boolean;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  statusChanges: number;
  executionTimeMs: number;
  error?: string;
}

interface GDVProgressEvent {
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
  percentage: number;
}

// Event emitter para progreso del ETL de GDV
export const gdvEtlProgressEmitter = new EventEmitter();

// Función helper para emitir progreso
function emitProgress(step: number, totalSteps: number, message: string, details?: string) {
  const percentage = Math.round((step / totalSteps) * 100);
  const event: GDVProgressEvent = {
    step,
    totalSteps,
    message,
    details,
    percentage,
  };
  gdvEtlProgressEmitter.emit('progress', event);
  console.log(`📊 [${percentage}%] Paso ${step}/${totalSteps}: ${message}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

function cleanNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function cleanText(value: any): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned === '' ? null : cleaned;
}

// Helper para IDs grandes - mantiene precisión usando strings
function cleanBigIntId(value: any): string {
  if (value === null || value === undefined) return '0';
  return String(value).trim();
}

export async function executeGDVETL(): Promise<GDVETLResult> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📦 ETL DE GUÍAS DE DESPACHO (GDV)                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const logger = createETLLogger('gdv_etl');
  logger.info('ETL de GDV iniciado', { startTime: new Date().toISOString() });
  
  let pool: mssql.ConnectionPool | null = null;
  const sucursales = ['004', '006', '007'];
  const TOTAL_STEPS = 5;

  try {
    console.log('\n🔍 Verificando credenciales SQL Server...');
    console.log(`   Host: ${sqlServerConfig.server ? '✅' : '❌'}`);
    console.log(`   Database: ${sqlServerConfig.database ? '✅' : '❌'}`);
    console.log(`   User: ${sqlServerConfig.user ? '✅' : '❌'}`);

    // Verificar si ya hay una ejecución en curso
    console.log('\n🔒 Verificando ejecuciones activas...');
    const runningGDV = await db
      .select()
      .from(gdvSyncLog)
      .where(sql`status = 'running'`)
      .limit(1);

    if (runningGDV.length > 0) {
      console.log(`⚠️  ETL de GDV ya en ejecución (ID: ${runningGDV[0].id})`);
      return {
        success: false,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        statusChanges: 0,
        executionTimeMs: Date.now() - startTime,
        error: 'ETL de GDV ya en ejecución'
      };
    }
    console.log('✅ No hay ejecuciones activas\n');

    // Conectar a SQL Server
    emitProgress(1, TOTAL_STEPS, 'Conectando a SQL Server', 'Estableciendo conexión...');
    console.log('🔄 Conectando a SQL Server...');
    pool = await executeWithResilience(
      async () => mssql.connect(sqlServerConfig),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log('✅ Conectado a SQL Server\n');

    // Registrar inicio de ejecución
    const [executionLog] = await db.insert(gdvSyncLog).values({
      status: 'running',
      period: 'Todas las GDV',
      branches: sucursales.join(','),
    }).returning();

    // Extraer GDV de SQL Server
    emitProgress(2, TOTAL_STEPS, 'Extrayendo GDV', `Sucursales: ${sucursales.join(', ')}...`);
    console.log('\n📦 Extrayendo GDV de SQL Server...');
    console.log(`   Filtros: TIDO = 'GDV' AND SUDO IN (${sucursales.join(', ')})`);
    
    const gdvData = await executeWithResilience(
      async () => pool.request().query(`
        SELECT 
          d.IDMAEDDO,
          d.IDMAEEDO,
          e.TIDO,
          e.NUDO,
          e.ENDO,
          e.SUENDO,
          e.SUDO,
          e.FEEMDO,
          e.FEER as FEULVEDO,
          e.ESDO,
          e.ESPGDO,
          e.KOFUDO,
          e.MODO,
          e.TIMODO,
          e.TAMODO,
          e.VANEDO,
          e.VAIVDO,
          e.VABRDO,
          e.LILG,
          e.BOSULIDO,
          e.OCDO,
          d.KOPRCT,
          d.NOKOPR,
          d.UDTRPR,
          d.CAPRCO1,
          d.CAPRCO2,
          d.PREUNI,
          d.VANELI,
          d.FEEMLI,
          d.FEERLI,
          d.DEVOL1,
          d.DEVOL2,
          d.STOCKFIS,
          -- Tablas relacionadas
          en.NOKOEN,
          en.RUEN,
          fu.NOKOFU,
          ru.NOKORU,
          bo.NOKOBO as NOBOSULI,
          pr.UD01PR,
          pr.UD02PR,
          pr.TIPR,
          pr.PM as LISTACOST
        FROM dbo.MAEDDO d
        INNER JOIN dbo.MAEEDO e ON d.IDMAEEDO = e.IDMAEEDO
        LEFT JOIN dbo.MAEEN en ON e.ENDO = en.KOEN
        LEFT JOIN dbo.TABFU fu ON en.KOFUEN = fu.KOFU
        LEFT JOIN dbo.TABRU ru ON en.RUEN = ru.KORU
        LEFT JOIN dbo.TABBO bo ON e.SULI = bo.EMPRESA AND e.BOSULIDO = bo.KOBO
        LEFT JOIN dbo.MAEPR pr ON d.KOPRCT = pr.KOPR
        WHERE e.TIDO = 'GDV'
          AND e.SUDO IN (${sucursales.map(s => `'${s}'`).join(',')})
        ORDER BY e.FEEMDO, d.IDMAEDDO
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );

    const totalRecords = gdvData.recordset.length;
    console.log(`   ✅ ${totalRecords} líneas de GDV extraídas\n`);

    if (totalRecords === 0) {
      console.log('⚠️  No se encontraron GDV para procesar\n');
      
      await db.update(gdvSyncLog)
        .set({
          status: 'success',
          recordsProcessed: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          statusChanges: 0,
          executionTimeMs: Date.now() - startTime,
        })
        .where(sql`id = ${executionLog.id}`);

      await pool.close();
      
      return {
        success: true,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        statusChanges: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Obtener registros existentes para detectar cambios de estado
    emitProgress(3, TOTAL_STEPS, 'Detectando cambios', 'Comparando con registros existentes...');
    console.log('🔍 Obteniendo registros existentes para detectar cambios...');
    
    const idmaeddosToProcess = gdvData.recordset.map(r => cleanBigIntId(r.IDMAEDDO));
    
    const existingGDVs = await db
      .select()
      .from(factGdv)
      .where(inArray(factGdv.idmaeddo, idmaeddosToProcess))
      .execute();

    // Map para detección rápida de cambios (O(1) lookup)
    const existingMap = new Map(
      existingGDVs.map(gdv => [gdv.idmaeddo?.toString() || '0', gdv])
    );

    // Procesar UPSERT con detección de cambios de estado
    emitProgress(4, TOTAL_STEPS, 'Procesando UPSERT', 'Insertando/actualizando registros...');
    console.log('\n📝 Procesando UPSERT en fact_gdv...');
    
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let statusChanges = 0;
    
    // Contar registros antes del UPSERT
    const countBeforeResult = await db.execute(sql`SELECT COUNT(*) as count FROM ventas.fact_gdv`);
    const rowsBeforeUpsert = Number(countBeforeResult.rows[0].count);

    await db.transaction(async (tx) => {
      // Detectar cambios de estado usando el Map (O(1) lookup)
      for (const row of gdvData.recordset) {
        const idmaeddo = cleanBigIntId(row.IDMAEDDO);
        const existingRecord = existingMap.get(idmaeddo);
        
        if (existingRecord) {
          const oldStatus = existingRecord.esdo;
          const newStatus = cleanText(row.ESDO);
          
          // Detectar cambio de estado a cerrado
          if (!oldStatus && newStatus === 'C') {
            statusChanges++;
            logger.info(`Cambio de estado detectado: GDV ${existingRecord.nudo}`, {
              idmaeedo: existingRecord.idmaeedo?.toString(),
              oldStatus: 'ABIERTO',
              newStatus: 'CERRADO',
              monto: existingRecord.monto?.toString()
            });
            console.log(`   ✅ Estado cambiado: GDV #${existingRecord.nudo} (${oldStatus || 'ABIERTO'} → ${newStatus})`);
          }
        }
      }

      // Eliminar registros existentes que serán actualizados (usa índice PK)
      if (idmaeddosToProcess.length > 0) {
        await tx.delete(factGdv).where(inArray(factGdv.idmaeddo, idmaeddosToProcess));
      }

      // Insertar todos los registros (nuevos y actualizados)
      const records = gdvData.recordset.map(row => ({
        idmaeddo: cleanBigIntId(row.IDMAEDDO),
        idmaeedo: cleanBigIntId(row.IDMAEEDO),
        tido: cleanText(row.TIDO),
        nudo: cleanNumeric(row.NUDO),
        endo: cleanText(row.ENDO),
        suendo: cleanText(row.SUENDO),
        sudo: cleanNumeric(row.SUDO),
        feemdo: row.FEEMDO || null,
        feulvedo: row.FEULVEDO || null,
        esdo: cleanText(row.ESDO),
        espgdo: cleanText(row.ESPGDO),
        kofudo: cleanText(row.KOFUDO),
        modo: cleanText(row.MODO),
        timodo: cleanText(row.TIMODO),
        tamodo: cleanNumeric(row.TAMODO),
        caprad: null,
        caprex: null,
        vanedo: cleanNumeric(row.VANEDO),
        vaivdo: cleanNumeric(row.VAIVDO),
        vabrdo: cleanNumeric(row.VABRDO),
        lilg: cleanText(row.LILG),
        nulido: null,
        sulido: null,
        luvtlido: null,
        bosulido: cleanNumeric(row.BOSULIDO),
        kofulido: cleanText(row.KOFUDO),
        prct: false,
        tict: null,
        tipr: cleanText(row.TIPR),
        nusepr: null,
        koprct: cleanText(row.KOPRCT),
        udtrpr: cleanNumeric(row.UDTRPR),
        rludpr: null,
        caprco1: cleanNumeric(row.CAPRCO1),
        caprad1: null,
        caprex1: null,
        caprnc1: null,
        ud01pr: cleanText(row.UD01PR),
        caprco2: cleanNumeric(row.CAPRCO2),
        caprad2: null,
        caprex2: null,
        caprnc2: null,
        ud02pr: cleanText(row.UD02PR),
        ppprne: cleanNumeric(row.PREUNI),
        ppprbr: null,
        vaneli: cleanNumeric(row.VANELI),
        vabrli: null,
        feemli: row.FEEMLI || null,
        feerli: row.FEERLI || null,
        ppprpm: null,
        ppprpmifrs: null,
        logistica: null,
        eslido: null,
        ppprnere1: null,
        ppprnere2: null,
        fmpr: null,
        mrpr: null,
        zona: null,
        ruen: null,
        recaprre: false,
        pfpr: null,
        hfpr: null,
        monto: cleanNumeric(row.VANELI),
        ocdo: cleanText(row.OCDO),
        nokoprct: cleanText(row.NOKOPR),
        nokozo: null,
        nosudo: `Sucursal ${row.SUDO}`,
        nokofu: cleanText(row.NOKOFU),
        nokofudo: null,
        nobosuli: cleanText(row.NOBOSULI),
        nokoen: cleanText(row.NOKOEN),
        noruen: cleanText(row.NOKORU),
        nomrpr: null,
        nofmpr: null,
        nopfpr: null,
        nohfpr: null,
        devol1: cleanNumeric(row.DEVOL1),
        devol2: cleanNumeric(row.DEVOL2),
        stockfis: cleanNumeric(row.STOCKFIS),
        listacost: cleanNumeric(row.LISTACOST),
        liscosmod: cleanNumeric(row.LISTACOST),
        lastEtlSync: new Date(),
      }));

      // Insertar en batches de 1000
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await tx.insert(factGdv).values(batch);
      }
    });

    // Calcular métricas
    const countAfterResult = await db.execute(sql`SELECT COUNT(*) as count FROM ventas.fact_gdv`);
    const rowsAfterUpsert = Number(countAfterResult.rows[0].count);
    
    recordsInserted = rowsAfterUpsert - rowsBeforeUpsert;
    recordsUpdated = idmaeddosToProcess.length - recordsInserted;

    console.log(`\n📊 Resultados del UPSERT:`);
    console.log(`   Total procesado: ${totalRecords} líneas`);
    console.log(`   Nuevos registros: ${recordsInserted}`);
    console.log(`   Registros actualizados: ${recordsUpdated}`);
    console.log(`   Cambios de estado: ${statusChanges}`);
    console.log(`   Total en fact_gdv: ${rowsAfterUpsert}\n`);

    // Actualizar log de ejecución
    emitProgress(5, TOTAL_STEPS, 'Finalizando', 'Actualizando log de sincronización...');
    
    await db.update(gdvSyncLog)
      .set({
        status: 'success',
        recordsProcessed: totalRecords,
        recordsInserted,
        recordsUpdated,
        statusChanges,
        executionTimeMs: Date.now() - startTime,
      })
      .where(sql`id = ${executionLog.id}`);

    await pool.close();

    const executionTime = Date.now() - startTime;
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ETL DE GDV COMPLETADO EXITOSAMENTE                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`⏱️  Tiempo de ejecución: ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📦 Registros procesados: ${totalRecords}`);
    console.log(`➕ Nuevos: ${recordsInserted}`);
    console.log(`🔄 Actualizados: ${recordsUpdated}`);
    console.log(`🔀 Cambios de estado: ${statusChanges}\n`);

    logger.info('ETL de GDV completado exitosamente', {
      recordsProcessed: totalRecords,
      recordsInserted,
      recordsUpdated,
      statusChanges,
      executionTimeMs: executionTime
    });

    return {
      success: true,
      recordsProcessed: totalRecords,
      recordsInserted,
      recordsUpdated,
      statusChanges,
      executionTimeMs: executionTime,
    };

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error.message || 'Error desconocido';
    
    console.error('\n❌ ERROR EN ETL DE GDV:');
    console.error(`   Mensaje: ${errorMessage}`);
    console.error(`   Tipo: ${error.name || 'Unknown'}`);
    
    logger.critical('Error en ETL de GDV', { errorMessage, error }, error);

    // Actualizar log de ejecución con error
    try {
      const runningLog = await db
        .select()
        .from(gdvSyncLog)
        .where(sql`status = 'running'`)
        .orderBy(desc(gdvSyncLog.executionDate))
        .limit(1);

      if (runningLog.length > 0) {
        await db.update(gdvSyncLog)
          .set({
            status: 'failed',
            errorMessage: errorMessage.substring(0, 500),
            executionTimeMs: executionTime,
          })
          .where(sql`id = ${runningLog[0].id}`);
      }
    } catch (logError) {
      console.error('Error actualizando log de error:', logError);
    }

    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error('Error cerrando conexión:', closeError);
      }
    }

    return {
      success: false,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      statusChanges: 0,
      executionTimeMs: executionTime,
      error: errorMessage,
    };
  }
}
