import mssql from 'mssql';
import { db } from './db';
import { sql, desc, eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { 
  stgMaeedo, 
  stgMaeddo, 
  stgMaeen, 
  stgMaepr, 
  stgMaeven, 
  stgTabbo,
  stgTabru, 
  stgTabpp,
  factVentas,
  weeklyVentasCliente,
  etlExecutionLog,
  etlConfig
} from '../shared/schema';
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

// Circuit Breaker para SQL Server - protege contra fallas en cascada
const sqlServerBreaker = new CircuitBreaker({
  failureThreshold: 12,      // 12 fallos antes de abrir circuito (apropiado para ETL)
  successThreshold: 3,        // 3 éxitos para cerrar desde half-open
  timeout: 120000,            // 2 minutos antes de intentar half-open
  name: 'SQLServer-ETL'
});

// Exportar circuit breaker para health checks
export { sqlServerBreaker };

interface ETLResult {
  success: boolean;
  recordsProcessed: number;
  executionTimeMs: number;
  period: string;
  watermarkDate: Date;
  error?: string;
}

interface ETLProgressEvent {
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
  percentage: number;
}

// Event emitter para progreso del ETL
export const etlProgressEmitter = new EventEmitter();

// Función helper para emitir progreso
function emitProgress(step: number, totalSteps: number, message: string, details?: string) {
  const percentage = Math.round((step / totalSteps) * 100);
  const event: ETLProgressEvent = {
    step,
    totalSteps,
    message,
    details,
    percentage,
  };
  etlProgressEmitter.emit('progress', event);
  console.log(`📊 [${percentage}%] Paso ${step}/${totalSteps}: ${message}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

// Función helper para batch insert con manejo de errores robusto y logging
async function batchInsert<T>(
  table: any, 
  records: T[], 
  tableName: string,
  logger: ReturnType<typeof createETLLogger>,
  batchSize: number = 1000
) {
  if (records.length === 0) return 0;
  
  let inserted = 0;
  let failedCount = 0;
  const errors: string[] = [];
  
  logger.info(`Iniciando batch insert en ${tableName}`, { 
    totalRecords: records.length, 
    batchSize 
  });
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      await db.insert(table).values(batch).onConflictDoNothing();
      inserted += batch.length;
      logger.info(`Batch insertado exitosamente en ${tableName}`, { 
        batchNumber: Math.floor(i / batchSize) + 1,
        recordsInserted: batch.length,
        totalInserted: inserted
      });
    } catch (error: any) {
      // Si falla un batch grande, intentar con batches más pequeños
      logger.warn(`Error en batch grande de ${tableName}, intentando batches más pequeños`, { 
        batchSize: batch.length,
        error: error.message,
        sampleRecord: batch[0]
      }, error);
      
      const smallerBatchSize = Math.max(100, Math.floor(batchSize / 10));
      
      for (let j = 0; j < batch.length; j += smallerBatchSize) {
        const smallBatch = batch.slice(j, j + smallerBatchSize);
        try {
          await db.insert(table).values(smallBatch).onConflictDoNothing();
          inserted += smallBatch.length;
        } catch (smallError: any) {
          const errorMsg = `Error insertando batch pequeño (${smallBatch.length} registros): ${smallError.message}`;
          errors.push(errorMsg);
          failedCount += smallBatch.length;
          
          logger.critical(`Batch insert fallido en ${tableName}`, { 
            tableName,
            batchSize: smallBatch.length,
            failedCount,
            totalErrors: errors.length,
            errorMessage: smallError.message,
            sampleRecord: JSON.stringify(smallBatch[0]),
            allRecordKeys: Object.keys(smallBatch[0] as any)
          }, smallError);
          
          // Propagar el error para que el ETL falle en lugar de perder datos silenciosamente
          throw new Error(`Batch insert failed: ${failedCount} registros fallaron. Errores: ${errors.join('; ')}`);
        }
      }
    }
  }
  
  // Si hubo errores en el fallback, reportarlos
  if (errors.length > 0) {
    logger.warn(`Fallback activado en ${tableName}`, { errorsCount: errors.length });
  }
  
  logger.info(`Batch insert completado en ${tableName}`, { 
    totalInserted: inserted,
    totalFailed: failedCount 
  });
  
  return inserted;
}

function cleanNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

async function getLastWatermark(etlName: string = 'ventas_incremental'): Promise<Date> {
  // Verificar si hay configuración personalizada
  const config = await db
    .select()
    .from(etlConfig)
    .where(eq(etlConfig.etlName, etlName))
    .limit(1);

  // Si hay configuración personalizada activa, usarla
  if (config.length > 0 && config[0].useCustomWatermark && config[0].customWatermark) {
    console.log(`📍 Usando watermark personalizado: ${new Date(config[0].customWatermark).toISOString()}`);
    return new Date(config[0].customWatermark);
  }

  // Obtener el último watermark de ejecución exitosa
  const lastExecution = await db
    .select()
    .from(etlExecutionLog)
    .where(sql`status = 'success' AND etl_name = ${etlName}`)
    .orderBy(desc(etlExecutionLog.watermarkDate))
    .limit(1);

  if (lastExecution.length > 0 && lastExecution[0].watermarkDate) {
    return new Date(lastExecution[0].watermarkDate);
  }

  // Si no hay ejecuciones previas, comenzar desde 2025-01-01
  return new Date('2025-01-01');
}

export async function getETLConfig(etlName: string = 'ventas_incremental') {
  const config = await db
    .select()
    .from(etlConfig)
    .where(eq(etlConfig.etlName, etlName))
    .limit(1);

  if (config.length > 0) {
    return config[0];
  }

  // Crear configuración por defecto si no existe
  const [newConfig] = await db.insert(etlConfig).values({
    etlName,
    useCustomWatermark: false,
    timeoutMinutes: 10,
    intervalMinutes: 15,
  }).returning();

  return newConfig;
}

export async function executeIncrementalETL(etlName: string = 'ventas_incremental'): Promise<ETLResult> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 FUNCIÓN executeIncrementalETL LLAMADA                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`📝 ETL Name: ${etlName}`);
  console.log(`⏰ Start Time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const logger = createETLLogger(etlName);
  logger.info('ETL iniciado', { etlName, startTime: new Date().toISOString() });
  
  let pool: mssql.ConnectionPool | null = null;
  const tiposDoc = ['FCV', 'GDV', 'FVL', 'NCV', 'BLV', 'FDV'];
  const sucursales = ['004', '006', '007'];
  let timeoutHandle: NodeJS.Timeout | null = null;
  let timedOut = false;
  let executionLogId: string | null = null; // ID del registro de ejecución

  try {
    console.log('🔍 Verificando credenciales SQL Server...');
    console.log(`   Host: ${sqlServerConfig.server ? '✅ Configurado' : '❌ FALTA'}`);
    console.log(`   Port: ${sqlServerConfig.port}`);
    console.log(`   Database: ${sqlServerConfig.database ? '✅ Configurado' : '❌ FALTA'}`);
    console.log(`   User: ${sqlServerConfig.user ? '✅ Configurado' : '❌ FALTA'}`);
    console.log(`   Password: ${sqlServerConfig.password ? '✅ Configurado' : '❌ FALTA'}\n`);

    // 🔒 LOCK: Verificar si ya hay una ejecución en curso
    console.log('🔒 Verificando si hay ETL en ejecución...');
    const runningETL = await db
      .select()
      .from(etlExecutionLog)
      .where(sql`status = 'running' AND etl_name = ${etlName}`)
      .limit(1);

    if (runningETL.length > 0) {
      console.log(`\n⚠️  ETL ya en ejecución (ID: ${runningETL[0].id}). Cancelando solicitud duplicada.`);
      return {
        success: false,
        recordsProcessed: 0,
        executionTimeMs: Date.now() - startTime,
        period: '',
        watermarkDate: new Date(),
        error: 'ETL ya en ejecución. Por favor espera a que termine la ejecución actual.'
      };
    }
    console.log('✅ No hay ETL en ejecución. Procediendo...\n');

    console.log('\n🔄 INICIANDO ETL');
    console.log('═══════════════════════════════════════════════════');

    // Obtener configuración ETL (incluye timeout)
    const config = await getETLConfig(etlName);
    const timeoutMs = config.timeoutMinutes * 60 * 1000;

    // Obtener el último watermark
    const lastWatermark = await getLastWatermark(etlName);
    const currentWatermark = new Date();
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 CONFIGURACIÓN DEL WATERMARK                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`📍 Watermark inicial: ${lastWatermark.toISOString()}`);
    console.log(`📍 Watermark actual: ${currentWatermark.toISOString()}`);
    console.log(`📅 Fecha inicio (formato SQL): ${lastWatermark.toISOString().split('T')[0]}`);
    console.log(`📅 Fecha fin (formato SQL): ${currentWatermark.toISOString().split('T')[0]}`);
    console.log(`🔧 ¿Watermark personalizado activo?: ${config.useCustomWatermark ? 'SÍ' : 'NO'}`);
    if (config.useCustomWatermark && config.customWatermark) {
      console.log(`🎯 Watermark personalizado configurado: ${new Date(config.customWatermark).toISOString()}`);
    }
    console.log('');
    
    // Configurar timeout automático
    timeoutHandle = setTimeout(async () => {
      timedOut = true;
      console.log(`\n⏱️  TIMEOUT: ETL excedió el límite de ${config.timeoutMinutes} minutos`);
      
      // Marcar ejecución como cancelada por timeout
      try {
        const runningExecution = await db
          .select()
          .from(etlExecutionLog)
          .where(sql`status = 'running' AND etl_name = ${etlName}`)
          .orderBy(desc(etlExecutionLog.executionDate))
          .limit(1);

        if (runningExecution.length > 0) {
          await db.update(etlExecutionLog)
            .set({
              status: 'error',
              errorMessage: `Cancelado automáticamente por timeout (${config.timeoutMinutes} minutos)`,
              executionTimeMs: Date.now() - startTime,
            })
            .where(sql`id = ${runningExecution[0].id}`);
        }
      } catch (timeoutError) {
        console.error('Error al marcar timeout:', timeoutError);
      }
      
      // Cerrar conexión SQL Server si está abierta
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('Error cerrando pool por timeout:', closeError);
        }
      }
    }, timeoutMs);

    console.log(`⏱️  Timeout configurado: ${config.timeoutMinutes} minutos`);
    
    console.log(`📅 Período incremental:`);
    console.log(`   ETL: ${etlName}`);
    console.log(`   Desde: ${lastWatermark.toISOString()}`);
    console.log(`   Hasta: ${currentWatermark.toISOString()}`);
    console.log(`   Tipos documento: ${tiposDoc.join(', ')}`);
    console.log(`   Sucursales: ${sucursales.join(', ')}\n`);

    // Conectar a SQL Server con circuit breaker y retry
    console.log('🔄 Conectando a SQL Server...');
    pool = await executeWithResilience(
      async () => mssql.connect(sqlServerConfig),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log('✅ Conectado a SQL Server\n');

    // Registrar inicio de ejecución
    const periodLabel = `${lastWatermark.toISOString().split('T')[0]} to ${currentWatermark.toISOString().split('T')[0]}`;
    const [executionLog] = await db.insert(etlExecutionLog).values({
      etlName,
      status: 'running',
      period: periodLabel,
      documentTypes: tiposDoc.join(','),
      branches: sucursales.join(','),
      watermarkDate: currentWatermark,
    }).returning();
    
    // Guardar ID para usarlo en el catch block si hay error
    executionLogId = executionLog.id;

    // Limpiar tablas staging
    console.log('🧹 Limpiando tablas staging...');
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeedo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeddo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeen CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maepr CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeven CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_tabbo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_tabpp CASCADE`);
    console.log('✅ Tablas staging limpias\n');

    // 1. EXTRAER MAEEDO (solo registros con fecha de emisión desde el último watermark)
    console.log('1️⃣  Extrayendo MAEEDO (Encabezados por fecha de emisión)...');
    const startDateSQL = lastWatermark.toISOString().split('T')[0];
    const endDateSQL = currentWatermark.toISOString().split('T')[0];
    const startYear = lastWatermark.getFullYear();
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  📝 QUERY SQL MAEEDO - FILTROS APLICADOS                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`🔍 TIDO IN: ${tiposDoc.join(', ')}`);
    console.log(`🔍 SUDO IN: ${sucursales.join(', ')}`);
    console.log(`🔍 FEEMDO >= '${startDateSQL}' (Fecha de emisión del documento)`);
    console.log(`🔍 FEEMDO <= '${endDateSQL}' (Fecha de emisión del documento)`);
    console.log(`🔍 YEAR(FEEMDO) >= ${startYear} (dinámico según watermark)`);
    console.log('');
    
    const maeedo = await executeWithResilience(
      async () => pool.request().query(`
        SELECT *
        FROM dbo.MAEEDO
        WHERE TIDO IN (${tiposDoc.map(t => `'${t}'`).join(',')})
          AND SUDO IN (${sucursales.map(s => `'${s}'`).join(',')})
          AND YEAR(FEEMDO) >= ${startYear}
          AND FEEMDO >= '${startDateSQL}'
          AND FEEMDO <= '${endDateSQL}'
        ORDER BY FEEMDO
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    
    if (maeedo.recordset.length === 0) {
      console.log('\n⚠️  No hay registros nuevos para procesar en el período especificado');
      console.log(`   Fecha inicio: ${startDateSQL}`);
      console.log(`   Fecha fin: ${endDateSQL}\n`);
      
      await db.update(etlExecutionLog)
        .set({
          status: 'success',
          recordsProcessed: 0,
          executionTimeMs: Date.now() - startTime,
        })
        .where(sql`id = ${executionLog.id}`);

      await pool.close();
      
      return {
        success: true,
        recordsProcessed: 0,
        executionTimeMs: Date.now() - startTime,
        period: periodLabel,
        watermarkDate: currentWatermark,
      };
    }

    const TOTAL_STEPS = 10;
    emitProgress(1, TOTAL_STEPS, 'Extrayendo MAEEDO', `${maeedo.recordset.length} registros encontrados`);
    
    console.log(`\n📊 Resumen de extracción MAEEDO:`);
    console.log(`   ✅ ${maeedo.recordset.length} registros encontrados`);
    if (maeedo.recordset.length > 0) {
      const firstDate = maeedo.recordset[0].FEEMDO;
      const lastDate = maeedo.recordset[maeedo.recordset.length - 1].FEEMDO;
      console.log(`   📅 Primer documento: ${firstDate}`);
      console.log(`   📅 Último documento: ${lastDate}`);
    }
    console.log('');

    // Cargar MAEEDO a staging (BATCH INSERT - optimizado)
    const maeedo_records = maeedo.recordset.map(row => ({
      idmaeedo: cleanNumeric(row.IDMAEEDO),
      empresa: row.EMPRESA?.trim() || null,
      tido: row.TIDO?.trim() || null,
      nudo: row.NUDO?.trim() || null,
      endo: row.ENDO?.trim() || null,
      suendo: row.SUENDO?.trim() || null,
      endofi: row.ENDOFI?.trim() || null,
      tigedo: row.TIGEDO?.trim() || null,
      sudo: row.SUDO?.trim() || null,
      luvtdo: row.LUVTDO?.trim() || null,
      feemdo: row.FEEMDO || null,
      kofudo: row.KOFUDO?.trim() || null,
      esdo: row.ESDO?.trim() || null,
      espgdo: row.ESPGDO?.trim() || null,
      suli: row.SULI?.trim() || null,
      bosulido: row.BOSULIDO?.trim() || null,
      feer: row.FEER || null,
      vanedo: cleanNumeric(row.VANEDO),
      vaivdo: cleanNumeric(row.VAIVDO),
      vabrdo: cleanNumeric(row.VABRDO),
      lilg: row.LILG?.trim() || null,
      modo: row.MODO?.trim() || null,
      timodo: row.TIMODO?.trim() || null,
      tamodo: cleanNumeric(row.TAMODO),
      ocdo: row.OCDO?.trim() || null,
    }));
    await batchInsert(stgMaeedo, maeedo_records, 'stg_maeedo', logger);
    emitProgress(2, TOTAL_STEPS, 'Cargando MAEEDO a staging', `${maeedo_records.length} registros insertados en batch`)

    // 2. EXTRAER MAEDDO (detalles de los documentos modificados)
    emitProgress(3, TOTAL_STEPS, 'Extrayendo MAEDDO', 'Consultando SQL Server...');
    console.log('2️⃣  Extrayendo MAEDDO (Detalles)...');
    const idmaeedos = maeedo.recordset.map(r => r.IDMAEEDO);
    const maeddo = await executeWithResilience(
      async () => pool.request().query(`
        SELECT *
        FROM dbo.MAEDDO
        WHERE IDMAEEDO IN (${idmaeedos.join(',')})
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log(`   ✅ ${maeddo.recordset.length} registros encontrados`);

    // Cargar MAEDDO (BATCH INSERT - optimizado)
    const maeddo_records = maeddo.recordset.map(row => ({
      idmaeddo: cleanNumeric(row.IDMAEDDO),
      idmaeedo: cleanNumeric(row.IDMAEEDO),
      koprct: row.KOPRCT?.trim() || null,
      nokopr: row.NOKOPR?.trim() || null,
      udtrpr: row.UDTRPR ? String(row.UDTRPR).trim() : null,
      caprco1: cleanNumeric(row.CAPRCO1 !== undefined ? row.CAPRCO1 : row.CAPRCO),
      caprco2: cleanNumeric(row.CAPRCO2),
      // CORREGIDO: VANELI contiene el valor neto ya calculado (con signo correcto para NCV)
      // Calcular preuni retrocompatible usando CAPRCO1 (unidad principal)
      preuni: cleanNumeric(row.CAPRCO1 !== undefined ? row.CAPRCO1 : row.CAPRCO) !== 0 ? cleanNumeric(row.VANELI) / cleanNumeric(row.CAPRCO1 !== undefined ? row.CAPRCO1 : row.CAPRCO) : 0,
      vaneli: cleanNumeric(row.VANELI),
      feemli: row.FEEMLI || null,
      feerli: row.FEERLI || null,
      devol1: cleanNumeric(row.DEVOL1),
      devol2: cleanNumeric(row.DEVOL2),
      stockfis: cleanNumeric(row.STOCKFIS),
    }));
    await batchInsert(stgMaeddo, maeddo_records, 'stg_maeddo', logger);
    emitProgress(4, TOTAL_STEPS, 'Cargando MAEDDO a staging', `${maeddo_records.length} registros insertados`)

    // 3. EXTRAER entidades (clientes únicos) - ENDO en MAEEDO corresponde a KOEN en MAEEN
    emitProgress(5, TOTAL_STEPS, 'Extrayendo tablas maestras', 'MAEEN, MAEPR, MAEVEN, TABRU, TABBO...');
    console.log('3️⃣  Extrayendo MAEEN (Entidades)...');
    const endos = [...new Set(maeedo.recordset.map(r => r.ENDO?.trim()).filter(e => e))];
    let maeen = { recordset: [] };
    
    if (endos.length > 0) {
      maeen = await executeWithResilience(
        async () => pool.request().query(`
          SELECT KOEN, NOKOEN, RUEN, ZOEN, KOFUEN
          FROM dbo.MAEEN
          WHERE LTRIM(RTRIM(KOEN)) IN (${endos.map(e => `'${e}'`).join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${maeen.recordset.length} registros encontrados`);

    const maeen_records = maeen.recordset.map(row => ({
      koen: row.KOEN?.trim() || '',
      nokoen: row.NOKOEN?.trim() || null,
      rut: row.RUEN?.trim() || null,
      ruen: row.RUEN?.trim() || null,
      zona: row.ZOEN?.trim() || null,
      kofuen: row.KOFUEN?.trim() || null,
    }));
    await batchInsert(stgMaeen, maeen_records, 'stg_maeen', logger);

    // 4. EXTRAER productos únicos
    console.log('4️⃣  Extrayendo MAEPR (Productos)...');
    const koprcts = [...new Set(maeddo.recordset.map(r => r.KOPRCT))];
    const maepr = await executeWithResilience(
      async () => pool.request().query(`
        SELECT KOPR, NOKOPR, UD01PR, UD02PR, TIPR
        FROM dbo.MAEPR
        WHERE KOPR IN (${koprcts.map(k => `'${k}'`).join(',')})
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log(`   ✅ ${maepr.recordset.length} registros encontrados`);

    const maepr_records = maepr.recordset.map(row => ({
      kopr: row.KOPR?.trim() || '',
      nomrpr: row.NOKOPR?.trim() || null,
      ud01pr: row.UD01PR?.trim() || null,
      ud02pr: row.UD02PR?.trim() || null,
      tipr: row.TIPR?.trim() || null,
    }));
    await batchInsert(stgMaepr, maepr_records, 'stg_maepr', logger);

    // 5. EXTRAER vendedores (usando KOFUEN de MAEEN)
    console.log('5️⃣  Extrayendo MAEVEN (Vendedores)...');
    const kofuens = [...new Set(maeen.recordset.map(r => r.KOFUEN).filter(k => k))];
    let maeven = { recordset: [] };
    
    if (kofuens.length > 0) {
      maeven = await executeWithResilience(
        async () => pool.request().query(`
          SELECT KOFU, NOKOFU
          FROM dbo.TABFU
          WHERE KOFU IN (${kofuens.map(k => `'${k}'`).join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${maeven.recordset.length} registros encontrados`);

    const maeven_records = maeven.recordset.map(row => ({
      kofu: row.KOFU?.trim() || '',
      nokofu: row.NOKOFU?.trim() || null,
    }));
    await batchInsert(stgMaeven, maeven_records, 'stg_maeven', logger);

    // 6. EXTRAER segmentos/rutas (usando RUEN de MAEEN)
    console.log('6️⃣  Extrayendo TABRU (Segmentos)...');
    const ruens = [...new Set(maeen.recordset.map(r => r.RUEN).filter(r => r))];
    let tabru = { recordset: [] };
    
    if (ruens.length > 0) {
      tabru = await executeWithResilience(
        async () => pool.request().query(`
          SELECT KORU, NOKORU
          FROM dbo.TABRU
          WHERE KORU IN (${ruens.map(r => `'${r}'`).join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${tabru.recordset.length} registros encontrados`);

    const tabru_records = tabru.recordset.map(row => ({
      koru: row.KORU?.trim() || '',
      nokoru: row.NOKORU?.trim() || null,
    }));
    await batchInsert(stgTabru, tabru_records, 'stg_tabru', logger);

    // 7. EXTRAER bodegas únicas
    console.log('7️⃣  Extrayendo TABBO (Bodegas)...');
    const sulis = [...new Set(maeedo.recordset.map(r => r.SULI))];
    const bosulis = [...new Set(maeedo.recordset.map(r => r.BOSULIDO))];
    
    const tabbo = await executeWithResilience(
      async () => pool.request().query(`
        SELECT EMPRESA, KOBO, NOKOBO
        FROM dbo.TABBO
        WHERE EMPRESA IN (${sulis.map(s => `'${s}'`).join(',')})
          AND KOBO IN (${bosulis.map(b => `'${b}'`).join(',')})
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log(`   ✅ ${tabbo.recordset.length} registros encontrados`);

    const tabbo_records = tabbo.recordset.map(row => ({
      suli: row.EMPRESA?.trim() || '',
      bosuli: row.KOBO?.trim() || '',
      nobosuli: row.NOKOBO?.trim() || null,
    }));
    await batchInsert(stgTabbo, tabbo_records, 'stg_tabbo', logger);
    emitProgress(6, TOTAL_STEPS, 'Tablas maestras cargadas', 'MAEEN, MAEPR, MAEVEN, TABRU, TABBO')

    // 8. EXTRAER propiedades de productos desde MAEPR
    emitProgress(7, TOTAL_STEPS, 'Extrayendo TABPP', 'Propiedades de productos...');
    console.log('8️⃣  Extrayendo TABPP (Propiedades Productos desde MAEPR)...');
    const tabpp = await executeWithResilience(
      async () => pool.request().query(`
        SELECT DISTINCT
          pr.KOPR,
          pr.PM as listacost,
          pr.PM as liscosmod
        FROM dbo.MAEPR pr
        WHERE pr.KOPR IN (${koprcts.map(k => `'${k}'`).join(',')})
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log(`   ✅ ${tabpp.recordset.length} registros encontrados`);

    const tabpp_records = tabpp.recordset.map(row => ({
      kopr: row.KOPR?.trim() || '',
      listacost: cleanNumeric(row.listacost),
      liscosmod: cleanNumeric(row.liscosmod),
    }));
    await batchInsert(stgTabpp, tabpp_records, 'stg_tabpp', logger);

    // 9. PROCESAR A FACT_VENTAS (UPSERT - eliminar registros antiguos e insertar nuevos)
    emitProgress(8, TOTAL_STEPS, 'Procesando FACT_VENTAS', 'Aplicando UPSERT...');
    console.log('9️⃣  Procesando FACT_VENTAS (UPSERT)...');
    
    // Contar filas ANTES del proceso para calcular registros nuevos
    const countBeforeResult = await db.execute(sql`SELECT COUNT(*) as count FROM ventas.fact_ventas`);
    const rowsBeforeUpsert = Number(countBeforeResult.rows[0].count);
    
    // UPSERT atómico: DELETE + INSERT en una sola transacción (garantiza integridad)
    const idmaeddosToDelete = maeddo.recordset.map(r => cleanNumeric(r.IDMAEDDO));
    
    await db.transaction(async (tx) => {
      // Primero eliminar registros existentes de los documentos modificados
      if (idmaeddosToDelete.length > 0) {
        await tx.execute(sql`
          DELETE FROM ventas.fact_ventas 
          WHERE idmaeddo IN (${sql.raw(idmaeddosToDelete.join(','))})
        `);
      }

      // Insertar registros actualizados (mismo query, ahora dentro de transacción)
      await tx.execute(sql`
        INSERT INTO ventas.fact_ventas (
        idmaeddo, idmaeedo, tido, nudo, endo, suendo, sudo, feemdo, feulvedo,
        esdo, espgdo, kofudo, modo, timodo, tamodo, caprad, caprex, vanedo, vaivdo, vabrdo,
        lilg, nulido, sulido, luvtlido, bosulido, kofulido, prct, tict, tipr, nusepr,
        koprct, udtrpr, rludpr, caprco1, caprad1, caprex1, caprnc1, ud01pr,
        caprco2, caprad2, caprex2, caprnc2, ud02pr, ppprne, ppprbr, vaneli, vabrli,
        feemli, feerli, ppprpm, ppprpmifrs, logistica, eslido, ppprnere1, ppprnere2,
        fmpr, mrpr, zona, ruen, recaprre, pfpr, hfpr, monto, ocdo,
        nokoprct, nokozo, nosudo, nokofu, nokofudo, nobosuli, nokoen, noruen,
        nomrpr, nofmpr, nopfpr, nohfpr, devol1, devol2, stockfis, listacost, liscosmod,
        last_etl_sync
      )
      SELECT 
        dd.idmaeddo,
        dd.idmaeedo,
        ed.tido,
        CAST(ed.nudo AS NUMERIC(20,0)),
        ed.endo,
        ed.suendo,
        CAST(ed.sudo AS NUMERIC(20,0)),
        ed.feemdo,
        ed.feer,
        ed.esdo,
        ed.espgdo,
        ed.kofudo,
        ed.modo,
        ed.timodo,
        ed.tamodo,
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        ed.vanedo,
        ed.vaivdo,
        ed.vabrdo,
        ed.lilg,
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(ed.bosulido AS NUMERIC(20,0)),
        ed.kofudo,
        false,
        CAST(NULL AS NUMERIC(18,6)),
        pr.tipr,
        CAST(NULL AS NUMERIC(18,6)),
        dd.koprct,
        CAST(dd.udtrpr AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(18,6)),
        dd.caprco1,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        pr.ud01pr,
        dd.caprco2,
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        pr.ud02pr,
        dd.preuni,
        CAST(NULL AS NUMERIC(18,6)),
        dd.vaneli,
        CAST(NULL AS NUMERIC(20,0)),
        dd.feemli,
        dd.feerli,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS TEXT),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        false,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CASE WHEN ed.tido = 'NCV' THEN -ABS(dd.vaneli) ELSE dd.vaneli END,
        ed.ocdo,
        dd.nokopr,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS TEXT),
        ve.nokofu,
        en.nokoen,
        bo.nobosuli,
        en.nokoen,
        ru.nokoru,
        CASE WHEN pr.nomrpr ~ '^[0-9]+\.?[0-9]*$' THEN CAST(pr.nomrpr AS NUMERIC(18,6)) ELSE NULL END,
        CAST(NULL AS TEXT),
        CAST(NULL AS TEXT),
        CAST(NULL AS TEXT),
        dd.devol1,
        dd.devol2,
        dd.stockfis,
        pp.listacost,
        pp.liscosmod,
        ${sql.raw(`'${currentWatermark.toISOString()}'::timestamp`)}
      FROM ventas.stg_maeddo dd
      INNER JOIN ventas.stg_maeedo ed ON dd.idmaeedo = ed.idmaeedo
      LEFT JOIN ventas.stg_maeen en ON ed.endo = en.koen
      LEFT JOIN ventas.stg_maepr pr ON dd.koprct = pr.kopr
      LEFT JOIN ventas.stg_maeven ve ON en.kofuen = ve.kofu
      LEFT JOIN ventas.stg_tabru ru ON en.ruen = ru.koru
      LEFT JOIN ventas.stg_tabbo bo ON ed.suli = bo.suli AND ed.bosulido = bo.bosuli
      LEFT JOIN ventas.stg_tabpp pp ON dd.koprct = pp.kopr
      `);
    });

    // Contar filas DESPUÉS del proceso para calcular registros nuevos
    const countAfterResult = await db.execute(sql`SELECT COUNT(*) as count FROM ventas.fact_ventas`);
    const rowsAfterUpsert = Number(countAfterResult.rows[0].count);
    
    // Calcular registros nuevos netos (después - antes)
    const newRecordsInserted = rowsAfterUpsert - rowsBeforeUpsert;
    const recordsProcessed = maeddo.recordset.length;
    
    console.log(`   ✅ ${recordsProcessed} registros procesados del staging`);
    console.log(`   📊 ${newRecordsInserted} registros nuevos agregados a fact_ventas (${rowsBeforeUpsert} → ${rowsAfterUpsert})\n`);

    // 🔍 VALIDACIÓN POST-ETL: Verificar campos críticos del dashboard
    emitProgress(9, TOTAL_STEPS, 'Validando datos', 'Verificando campos críticos...');
    console.log('🔍 Validando campos críticos del dashboard...');
    const validationResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_registros,
        SUM(CASE WHEN feemdo IS NULL THEN 1 ELSE 0 END) as null_feemdo,
        SUM(CASE WHEN feulvedo IS NULL THEN 1 ELSE 0 END) as null_feulvedo,
        SUM(CASE WHEN sudo IS NULL THEN 1 ELSE 0 END) as null_sudo,
        SUM(CASE WHEN esdo IS NULL THEN 1 ELSE 0 END) as null_esdo,
        SUM(CASE WHEN espgdo IS NULL THEN 1 ELSE 0 END) as null_espgdo,
        SUM(CASE WHEN nokoen IS NULL THEN 1 ELSE 0 END) as null_nokoen,
        SUM(CASE WHEN nokofu IS NULL THEN 1 ELSE 0 END) as null_nokofu,
        SUM(CASE WHEN noruen IS NULL THEN 1 ELSE 0 END) as null_noruen
      FROM ventas.fact_ventas
      WHERE idmaeddo IN (${sql.raw(idmaeddosToDelete.join(','))})
    `);

    const validation = validationResult.rows[0];
    const hasCriticalNulls = 
      Number(validation.null_nokoen) > 0 || 
      Number(validation.null_nokofu) > 0 || 
      Number(validation.null_noruen) > 0;

    const hasOtherNulls = 
      Number(validation.null_feemdo) > 0 || 
      Number(validation.null_feulvedo) > 0 || 
      Number(validation.null_sudo) > 0 || 
      Number(validation.null_esdo) > 0 || 
      Number(validation.null_espgdo) > 0;

    if (hasCriticalNulls) {
      console.log('   🔴 CRÍTICO: Campos esenciales del dashboard NULL:');
      if (Number(validation.null_nokoen) > 0) console.log(`      - nokoen (cliente): ${validation.null_nokoen} registros`);
      if (Number(validation.null_nokofu) > 0) console.log(`      - nokofu (vendedor): ${validation.null_nokofu} registros`);
      if (Number(validation.null_noruen) > 0) console.log(`      - noruen (segmento): ${validation.null_noruen} registros`);
    } else {
      console.log(`   ✅ Campos del dashboard OK: nokoen, nokofu, noruen (${validation.total_registros} registros)`);
    }

    if (hasOtherNulls) {
      console.log('   ⚠️  Campos secundarios NULL:');
      if (Number(validation.null_feemdo) > 0) console.log(`      - feemdo: ${validation.null_feemdo} registros`);
      if (Number(validation.null_feulvedo) > 0) console.log(`      - feulvedo: ${validation.null_feulvedo} registros`);
      if (Number(validation.null_sudo) > 0) console.log(`      - sudo: ${validation.null_sudo} registros`);
      if (Number(validation.null_esdo) > 0) console.log(`      - esdo: ${validation.null_esdo} registros`);
      if (Number(validation.null_espgdo) > 0) console.log(`      - espgdo: ${validation.null_espgdo} registros`);
    }
    
    console.log('');

    // 10. ACTUALIZAR WEEKLY_VENTAS_CLIENTE (Agregación para promesas de compra)
    emitProgress(10, TOTAL_STEPS + 1, 'Actualizando agregados semanales', 'Calculando ventas por cliente y semana...');
    console.log('🔄 Actualizando weekly_ventas_cliente (agregados para promesas)...');
    
    try {
      // Identificar las semanas afectadas por los documentos procesados (usando semana ISO consistente)
      const weeksAffectedResult = await db.execute(sql`
        SELECT DISTINCT
          TO_CHAR(feemdo, 'IYYY-IW') as semana,
          EXTRACT(ISOYEAR FROM feemdo)::INTEGER as anio,
          EXTRACT(WEEK FROM feemdo)::INTEGER as numero_semana,
          DATE_TRUNC('week', feemdo)::DATE as fecha_inicio,
          (DATE_TRUNC('week', feemdo) + INTERVAL '6 days')::DATE as fecha_fin
        FROM ventas.fact_ventas
        WHERE idmaeddo IN (${sql.raw(idmaeddosToDelete.join(','))})
        AND feemdo IS NOT NULL
      `);

      if (weeksAffectedResult.rows.length > 0) {
        console.log(`   📅 ${weeksAffectedResult.rows.length} semanas afectadas, re-calculando agregados...`);

        for (const week of weeksAffectedResult.rows) {
          // Re-agregar ventas para esta semana (transacción atómica para evitar gaps)
          await db.transaction(async (tx) => {
            await tx.execute(sql`
              DELETE FROM ventas.weekly_ventas_cliente
              WHERE semana = ${week.semana}
            `);

            await tx.execute(sql`
              INSERT INTO ventas.weekly_ventas_cliente (
                cliente_id,
                vendedor_id,
                semana,
                anio,
                numero_semana,
                fecha_inicio,
                fecha_fin,
                total_ventas,
                cantidad_transacciones,
                ultima_actualizacion
              )
              SELECT
                nokoen as cliente_id,
                nokofu as vendedor_id,
                ${week.semana} as semana,
                ${week.anio} as anio,
                ${week.numero_semana} as numero_semana,
                ${week.fecha_inicio} as fecha_inicio,
                ${week.fecha_fin} as fecha_fin,
                SUM(monto) as total_ventas,
                COUNT(*) as cantidad_transacciones,
                NOW() as ultima_actualizacion
              FROM ventas.fact_ventas
              WHERE TO_CHAR(feemdo, 'IYYY-IW') = ${week.semana}
                AND nokoen IS NOT NULL
                AND monto IS NOT NULL
              GROUP BY nokoen, nokofu
            `);
          });
        }

        console.log(`   ✅ Agregados semanales actualizados para ${weeksAffectedResult.rows.length} semanas\n`);
      } else {
        console.log(`   ℹ️  No hay semanas para actualizar\n`);
      }
    } catch (aggregationError: any) {
      console.error(`   ⚠️  Error actualizando agregados semanales: ${aggregationError.message}`);
      logger.warn('Error en agregación semanal (no crítico)', { error: aggregationError.message }, aggregationError);
      // No fallar el ETL por esto, es una feature auxiliar
    }

    // Actualizar log de ejecución
    await db.update(etlExecutionLog)
      .set({
        status: 'success',
        recordsProcessed: newRecordsInserted, // Solo registros NUEVOS agregados
        executionTimeMs: Date.now() - startTime,
        watermarkDate: currentWatermark,
      })
      .where(sql`id = ${executionLog.id}`);

    // Desactivar watermark personalizado solo si keepCustomWatermark es false
    if (!config.keepCustomWatermark) {
      await db.update(etlConfig)
        .set({
          useCustomWatermark: false,
          updatedAt: new Date(),
        })
        .where(eq(etlConfig.etlName, etlName));
    }

    // Limpiar timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    await pool.close();

    emitProgress(10, TOTAL_STEPS, 'ETL Completado', `${newRecordsInserted} registros nuevos agregados`);
    
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║     ✅ ETL INCREMENTAL COMPLETADO                 ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    console.log(`📊 Registros procesados del staging: ${recordsProcessed}`);
    console.log(`✨ Registros nuevos agregados: ${newRecordsInserted}`);
    console.log(`⏱️  Tiempo de ejecución: ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    return {
      success: true,
      recordsProcessed: newRecordsInserted, // Retornar solo registros nuevos
      executionTimeMs: Date.now() - startTime,
      period: periodLabel,
      watermarkDate: currentWatermark,
    };

  } catch (error: any) {
    console.error('\n❌ ERROR EN ETL INCREMENTAL:', error.message);
    logger.critical('ETL falló con error crítico', {
      etlName,
      executionTimeMs: Date.now() - startTime,
      timedOut,
      errorMessage: error.message,
      errorStack: error.stack
    }, error);
    
    const executionTimeMs = Date.now() - startTime;
    
    // Limpiar timeout si hubo error
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    
    // Actualizar el registro existente con el error (NO insertar uno nuevo)
    if (!timedOut) {
      try {
        if (executionLogId) {
          // Actualizar el registro existente con status 'error' usando el ID guardado
          await db.update(etlExecutionLog)
            .set({
              status: 'error',
              executionTimeMs,
              errorMessage: error.message,
            })
            .where(sql`id = ${executionLogId}`);
          
          logger.info('Registro de ejecución actualizado con error', {
            executionLogId,
            errorMessage: error.message
          });
        } else {
          // Si no tenemos el ID (error antes de insertar el log), crear uno nuevo
          await db.insert(etlExecutionLog).values({
            etlName,
            status: 'error',
            period: 'incremental',
            documentTypes: tiposDoc.join(','),
            branches: sucursales.join(','),
            executionTimeMs,
            errorMessage: error.message,
          });
          
          logger.warn('Registro de ejecución creado después del error', {
            etlName,
            errorMessage: error.message
          });
        }
      } catch (logError) {
        console.error('Error registrando fallo:', logError);
        logger.error('Error al registrar fallo en base de datos', {
          originalError: error.message
        }, logError as Error);
      }
    }

    if (pool) {
      await pool.close();
    }

    return {
      success: false,
      recordsProcessed: 0,
      executionTimeMs,
      period: 'incremental',
      watermarkDate: new Date(),
      error: timedOut ? `Timeout: Proceso cancelado automáticamente` : error.message,
    };
  }
}

export async function updateETLConfig(
  etlName: string,
  customWatermark?: Date | null,
  useCustomWatermark?: boolean,
  keepCustomWatermark?: boolean,
  timeoutMinutes?: number,
  intervalMinutes?: number
) {
  const startTime = Date.now();
  try {
    console.log(`[ETL-CONFIG] Starting config update for ${etlName}`);
    
    // Verificar si existe configuración
    console.log('[ETL-CONFIG] Checking for existing config...');
    const existing = await db
      .select()
      .from(etlConfig)
      .where(eq(etlConfig.etlName, etlName))
      .limit(1);

    console.log(`[ETL-CONFIG] Existing config found: ${existing.length > 0}`);

    if (existing.length > 0) {
      // Actualizar configuración existente
      const updateData: any = { updatedAt: new Date() };
      if (customWatermark !== undefined) updateData.customWatermark = customWatermark;
      if (useCustomWatermark !== undefined) updateData.useCustomWatermark = useCustomWatermark;
      if (keepCustomWatermark !== undefined) updateData.keepCustomWatermark = keepCustomWatermark;
      if (timeoutMinutes !== undefined) updateData.timeoutMinutes = timeoutMinutes;
      if (intervalMinutes !== undefined) updateData.intervalMinutes = intervalMinutes;

      console.log('[ETL-CONFIG] Updating existing config with:', updateData);
      
      const [updated] = await db.update(etlConfig)
        .set(updateData)
        .where(eq(etlConfig.etlName, etlName))
        .returning();

      console.log(`[ETL-CONFIG] Config updated successfully in ${Date.now() - startTime}ms`);
      return updated;
    } else {
      // Crear nueva configuración
      const newConfigData = {
        etlName,
        customWatermark: customWatermark || null,
        useCustomWatermark: useCustomWatermark || false,
        timeoutMinutes: timeoutMinutes || 10,
        intervalMinutes: intervalMinutes || 15,
      };
      
      console.log('[ETL-CONFIG] Creating new config with:', newConfigData);
      
      const [newConfig] = await db.insert(etlConfig).values(newConfigData).returning();

      console.log(`[ETL-CONFIG] Config created successfully in ${Date.now() - startTime}ms`);
      return newConfig;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[ETL-CONFIG] Error updating ETL config after ${duration}ms:`, {
      etlName,
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
      errorStack: error.stack,
      customWatermark,
      useCustomWatermark,
      keepCustomWatermark,
      timeoutMinutes,
      intervalMinutes
    });
    
    // Re-throw con más contexto
    const enhancedError = new Error(`Failed to update ETL config for ${etlName}: ${error.message}`);
    enhancedError.stack = error.stack;
    throw enhancedError;
  }
}

export async function getETLStatus(
  etlName: string = 'ventas_incremental',
  startDate?: string,
  endDate?: string
) {
  try {
    // 🔀 ROUTER: Consultar la tabla de logs correcta según etlName
    let lastExecutions: any[] = [];
    let totalExecutionsResult: any[] = [];
    let successfulExecutionsResult: any[] = [];
    let failedExecutionsResult: any[] = [];

    if (etlName === 'nvv') {
      // Consultar nvv.nvv_sync_log
      const nvvLogs = await db.execute(sql`
        SELECT id, execution_date as "executionDate", status, 
               records_processed as "recordsProcessed", 
               records_inserted as "recordsInserted",
               records_updated as "recordsUpdated",
               status_changes as "statusChanges",
               execution_time_ms as "executionTimeMs",
               error_message as "errorMessage",
               watermark_date as "watermarkDate",
               period, branches
        FROM nvv.nvv_sync_log
        ORDER BY execution_date DESC
        LIMIT 100
      `);
      lastExecutions = (nvvLogs as any).rows || [];

      const totalCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM nvv.nvv_sync_log`);
      totalExecutionsResult = [(totalCount as any).rows?.[0] || { count: 0 }];

      const successCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM nvv.nvv_sync_log WHERE status = 'success'`);
      successfulExecutionsResult = [(successCount as any).rows?.[0] || { count: 0 }];

      const failCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM nvv.nvv_sync_log WHERE status IN ('failed', 'error')`);
      failedExecutionsResult = [(failCount as any).rows?.[0] || { count: 0 }];

    } else if (etlName === 'gdv') {
      // Consultar gdv.gdv_sync_log
      const gdvLogs = await db.execute(sql`
        SELECT id, execution_date as "executionDate", status, 
               records_processed as "recordsProcessed",
               records_inserted as "recordsInserted",
               records_updated as "recordsUpdated",
               status_changes as "statusChanges",
               execution_time_ms as "executionTimeMs",
               error_message as "errorMessage",
               watermark_date as "watermarkDate",
               period, branches
        FROM gdv.gdv_sync_log
        ORDER BY execution_date DESC
        LIMIT 100
      `);
      lastExecutions = (gdvLogs as any).rows || [];

      const totalCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM gdv.gdv_sync_log`);
      totalExecutionsResult = [(totalCount as any).rows?.[0] || { count: 0 }];

      const successCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM gdv.gdv_sync_log WHERE status = 'success'`);
      successfulExecutionsResult = [(successCount as any).rows?.[0] || { count: 0 }];

      const failCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM gdv.gdv_sync_log WHERE status IN ('failed', 'error')`);
      failedExecutionsResult = [(failCount as any).rows?.[0] || { count: 0 }];

    } else {
      // Default: Consultar ventas.etl_execution_log
      let whereConditions = eq(etlExecutionLog.etlName, etlName);
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        whereConditions = sql`${etlExecutionLog.etlName} = ${etlName} 
          AND ${etlExecutionLog.executionDate} >= ${start.toISOString()} 
          AND ${etlExecutionLog.executionDate} <= ${end.toISOString()}`;
      }

      lastExecutions = await db
        .select()
        .from(etlExecutionLog)
        .where(whereConditions)
        .orderBy(desc(etlExecutionLog.executionDate))
        .limit(100);

      totalExecutionsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(etlExecutionLog)
        .where(eq(etlExecutionLog.etlName, etlName));

      successfulExecutionsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(etlExecutionLog)
        .where(sql`etl_name = ${etlName} AND status = 'success'`);

      failedExecutionsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(etlExecutionLog)
        .where(sql`etl_name = ${etlName} AND (status = 'failed' OR status = 'error')`);
    }

    // Get total records in fact table - wrap in try-catch for safety
    let totalFactRecordsCount = 0;
    try {
      if (etlName === 'nvv') {
        // Query nvv.fact_nvv table
        const totalFactResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM nvv.fact_nvv`);
        totalFactRecordsCount = (totalFactResult as any)[0]?.count || 0;
      } else if (etlName === 'gdv') {
        // Query gdv.fact_gdv table
        const totalFactResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM gdv.fact_gdv`);
        totalFactRecordsCount = (totalFactResult as any)[0]?.count || 0;
      } else {
        // Default: query ventas.fact_ventas table
        const totalFactVentasResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(factVentas);
        totalFactRecordsCount = totalFactVentasResult[0]?.count || 0;
      }
    } catch (factTableError) {
      console.warn(`⚠️  Could not query fact table for ${etlName}:`, factTableError);
      // Continue without failing - this table might not exist yet
    }

    const lastExecution = lastExecutions[0] || null;
    const isRunning = lastExecution?.status === 'running';

    // Add totalFactRecords to lastExecution if it exists
    const enrichedLastExecution = lastExecution ? {
      ...lastExecution,
      totalFactVentasRecords: totalFactRecordsCount
    } : null;

    // Get ETL configuration
    const config = await getETLConfig(etlName);

    return {
      lastExecution: enrichedLastExecution,
      isRunning,
      history: lastExecutions,
      totalExecutions: totalExecutionsResult[0]?.count || 0,
      successfulExecutions: successfulExecutionsResult[0]?.count || 0,
      failedExecutions: failedExecutionsResult[0]?.count || 0,
      totalFactVentasRecords: totalFactRecordsCount,
      config, // Include configuration
    };
  } catch (error: any) {
    console.error('❌ Error in getETLStatus:', error);
    // Return safe default values instead of throwing
    return {
      lastExecution: null,
      isRunning: false,
      history: [],
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalFactVentasRecords: 0,
      error: error.message,
    };
  }
}
