import mssql from 'mssql';
import { db } from './db';
import { sql, desc, eq, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { 
  stgMaeedoGdv, 
  stgMaeddoGdv,
  stgMaeenGdv,
  stgMaeprGdv,
  stgMaevenGdv,
  stgTabruGdv,
  stgTabboGdv,
  factGdv,
  gdvSyncLog
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
  watermarkDate?: Date;
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

// Función helper para batch insert con manejo de errores
async function batchInsert<T>(
  table: any, 
  records: T[], 
  tableName: string,
  logger: ReturnType<typeof createETLLogger>,
  batchSize: number = 1000
) {
  if (records.length === 0) return 0;
  
  let inserted = 0;
  
  logger.info(`Iniciando batch insert en ${tableName}`, { 
    totalRecords: records.length, 
    batchSize 
  });
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      await db.insert(table).values(batch).onConflictDoNothing();
      inserted += batch.length;
    } catch (error: any) {
      logger.critical(`Error en batch insert de ${tableName}`, { 
        batchSize: batch.length,
        errorMessage: error.message
      }, error);
      throw error;
    }
  }
  
  return inserted;
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

// Obtener último watermark de GDV
async function getLastWatermark(): Promise<Date> {
  const lastExecution = await db
    .select()
    .from(gdvSyncLog)
    .where(sql`status = 'success'`)
    .orderBy(desc(gdvSyncLog.watermarkDate))
    .limit(1);

  if (lastExecution.length > 0 && lastExecution[0].watermarkDate) {
    return new Date(lastExecution[0].watermarkDate);
  }

  // Si no hay ejecuciones previas, comenzar desde 2025-01-01
  return new Date('2025-01-01');
}

export async function executeGDVETL(): Promise<GDVETLResult> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📦 ETL DE GUÍAS DE DESPACHO (GDV) - SINCRONIZACIÓN COMPLETA ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const logger = createETLLogger('gdv_etl');
  logger.info('ETL de GDV iniciado (full_sync)', { startTime: new Date().toISOString() });
  
  let pool: mssql.ConnectionPool | null = null;
  const sucursales = ['004', '006', '007'];
  const TOTAL_STEPS = 10;

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

    // Para sincronización completa, usamos timestamp actual
    const currentTimestamp = new Date();
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  📋 ESTRATEGIA: SINCRONIZACIÓN COMPLETA (SNAPSHOT)           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('📋 Modo: DELETE ALL + INSERT ALL');
    console.log('📋 Filtro: Solo GDV abiertas (ESLIDO IS NULL o vacío)');
    console.log(`📅 Timestamp: ${currentTimestamp.toISOString()}`);
    console.log('');

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
      period: 'full_sync',
      branches: sucursales.join(','),
      watermarkDate: currentTimestamp,
    }).returning();

    // Limpiar tablas staging de GDV (propias, no compartidas con ventas)
    console.log('🧹 Limpiando tablas staging de GDV...');
    await db.execute(sql`TRUNCATE TABLE gdv.stg_maeedo_gdv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE gdv.stg_maeddo_gdv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE gdv.stg_maeen_gdv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE gdv.stg_maepr_gdv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE gdv.stg_maeven_gdv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE gdv.stg_tabru_gdv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE gdv.stg_tabbo_gdv CASCADE`);
    console.log('✅ Tablas staging limpias (aisladas de ETL ventas)\n');

    // 1. EXTRAER MAEEDO (encabezados GDV) - TODAS LAS GDV ABIERTAS (sin filtro de fecha)
    emitProgress(2, TOTAL_STEPS, 'Extrayendo MAEEDO (GDV abiertas)', 'Consultando SQL Server...');
    console.log('1️⃣  Extrayendo MAEEDO (Encabezados GDV abiertas)...');
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  📝 QUERY SQL MAEEDO - SINCRONIZACIÓN COMPLETA               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`🔍 TIDO = 'GDV'`);
    console.log(`🔍 SUDO IN: ${sucursales.join(', ')}`);
    console.log(`🔍 ESDO IS NULL OR ESDO = '' (Solo documentos abiertos)`);
    console.log('');
    
    const maeedo = await executeWithResilience(
      async () => pool!.request().query(`
        SELECT *
        FROM dbo.MAEEDO
        WHERE TIDO = 'GDV'
          AND SUDO IN (${sucursales.map(s => `'${s}'`).join(',')})
          AND (ESDO IS NULL OR ESDO = '' OR ESDO NOT IN ('C', 'A'))
        ORDER BY FEEMDO DESC
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    
    console.log(`   ✅ ${maeedo.recordset.length} documentos GDV abiertos encontrados`);

    if (maeedo.recordset.length === 0) {
      console.log('\n⚠️  No hay GDV abiertas en el sistema\n');
      
      // En sincronización completa, si no hay GDV abiertas, limpiamos fact_gdv
      console.log('🧹 Limpiando fact_gdv (no hay GDV abiertas)...');
      await db.execute(sql`TRUNCATE TABLE gdv.fact_gdv`);
      
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
        watermarkDate: currentTimestamp,
      };
    }

    // Cargar MAEEDO a staging
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
      feulvedo: row.FEER || null,
    }));
    await batchInsert(stgMaeedoGdv, maeedo_records, 'stg_maeedo_gdv', logger);
    emitProgress(3, TOTAL_STEPS, 'Cargando MAEEDO a staging', `${maeedo_records.length} registros`);

    // 2. EXTRAER MAEDDO (detalles) con CHUNKING para evitar límite de parámetros SQL Server
    emitProgress(4, TOTAL_STEPS, 'Extrayendo MAEDDO (Detalles)', 'Consultando SQL Server...');
    console.log('2️⃣  Extrayendo MAEDDO (Detalles)...');
    const idmaeedos = maeedo.recordset.map(r => r.IDMAEEDO);
    
    // Chunking para evitar límite de 2100 parámetros en SQL Server
    const chunkSize = 2000;
    let allMaeddo: any[] = [];
    
    for (let i = 0; i < idmaeedos.length; i += chunkSize) {
      const chunk = idmaeedos.slice(i, i + chunkSize);
      console.log(`   Procesando chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(idmaeedos.length / chunkSize)} (${chunk.length} IDs)...`);
      
      const maeddoChunk = await executeWithResilience(
        async () => pool!.request().query(`
          SELECT *
          FROM dbo.MAEDDO
          WHERE IDMAEEDO IN (${chunk.join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
      
      allMaeddo = allMaeddo.concat(maeddoChunk.recordset);
    }
    
    const maeddo = { recordset: allMaeddo };
    console.log(`   ✅ ${maeddo.recordset.length} líneas de detalle encontradas`);

    // Cargar MAEDDO a staging - INCLUYE KOFULIDO DEL DETALLE, CAMPOS DE CANTIDAD Y ESLIDO
    const maeddo_records = maeddo.recordset.map(row => ({
      idmaeddo: cleanNumeric(row.IDMAEDDO),
      idmaeedo: cleanNumeric(row.IDMAEEDO),
      koprct: row.KOPRCT?.trim() || null,
      nokopr: row.NOKOPR?.trim() || null,
      udtrpr: row.UDTRPR ? String(row.UDTRPR).trim() : null,
      caprco1: cleanNumeric(row.CAPRCO1),
      caprco2: cleanNumeric(row.CAPRCO2),
      caprad1: cleanNumeric(row.CAPRAD1),
      caprad2: cleanNumeric(row.CAPRAD2),
      caprnc1: cleanNumeric(row.CAPRNC1),
      caprnc2: cleanNumeric(row.CAPRNC2),
      eslido: row.ESLIDO?.trim() || null, // CAMPO CRÍTICO: Estado de línea ('C' = cerrado, '' = abierto)
      preuni: cleanNumeric(row.PREUNI),
      vaneli: cleanNumeric(row.VANELI),
      feemli: row.FEEMLI || null,
      feerli: row.FEERLI || null,
      devol1: cleanNumeric(row.DEVOL1),
      devol2: cleanNumeric(row.DEVOL2),
      stockfis: cleanNumeric(row.STOCKFIS),
      kofulido: row.KOFULIDO?.trim() || null, // CORRECCIÓN: Usar KOFULIDO del detalle
      nulido: row.NULIDO?.trim() || null,
      sulido: row.SULIDO?.trim() || null,
      luvtlido: row.LUVTLIDO?.trim() || null,
      bosulido: row.BOSULIDO?.trim() || null,
    }));
    await batchInsert(stgMaeddoGdv, maeddo_records, 'stg_maeddo_gdv', logger);
    emitProgress(5, TOTAL_STEPS, 'Cargando MAEDDO a staging', `${maeddo_records.length} registros`);

    // 3-6. EXTRAER TABLAS MAESTRAS (reutilizamos las del esquema ventas)
    emitProgress(6, TOTAL_STEPS, 'Extrayendo tablas maestras', 'MAEEN, MAEPR, TABFU, TABRU, TABBO...');
    
    // MAEEN (Clientes)
    console.log('3️⃣  Extrayendo MAEEN (Entidades)...');
    const endos = Array.from(new Set(maeedo.recordset.map(r => r.ENDO?.trim()).filter(e => e)));
    let maeen: any = { recordset: [] };
    
    if (endos.length > 0) {
      maeen = await executeWithResilience(
        async () => pool!.request().query(`
          SELECT KOEN, NOKOEN, RUEN, ZOEN, KOFUEN
          FROM dbo.MAEEN
          WHERE LTRIM(RTRIM(KOEN)) IN (${endos.map(e => `'${e}'`).join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${maeen.recordset.length} entidades encontradas`);

    const maeen_records = maeen.recordset.map((row: any) => ({
      koen: row.KOEN?.trim() || '',
      nokoen: row.NOKOEN?.trim() || null,
      rut: row.RUEN?.trim() || null,
      ruen: row.RUEN?.trim() || null,
      zona: row.ZOEN?.trim() || null,
      kofuen: row.KOFUEN?.trim() || null,
    }));
    await batchInsert(stgMaeenGdv, maeen_records, 'stg_maeen_gdv', logger);

    // MAEPR (Productos)
    console.log('4️⃣  Extrayendo MAEPR (Productos)...');
    const koprcts = Array.from(new Set(maeddo.recordset.map(r => r.KOPRCT)));
    const maepr = await executeWithResilience(
      async () => pool!.request().query(`
        SELECT KOPR, NOKOPR, UD01PR, UD02PR, TIPR
        FROM dbo.MAEPR
        WHERE KOPR IN (${koprcts.map(k => `'${k}'`).join(',')})
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log(`   ✅ ${maepr.recordset.length} productos encontrados`);

    const maepr_records = maepr.recordset.map(row => ({
      kopr: row.KOPR?.trim() || '',
      nomrpr: row.NOKOPR?.trim() || null,
      ud01pr: row.UD01PR?.trim() || null,
      ud02pr: row.UD02PR?.trim() || null,
      tipr: row.TIPR?.trim() || null,
    }));
    await batchInsert(stgMaeprGdv, maepr_records, 'stg_maepr_gdv', logger);

    // TABFU (Vendedores) - Extraer tanto KOFUDO de encabezado como KOFULIDO de detalle
    console.log('5️⃣  Extrayendo TABFU (Vendedores)...');
    const kofudos = Array.from(new Set([
      ...maeedo.recordset.map(r => r.KOFUDO?.trim()).filter(k => k),
      ...maeddo.recordset.map(r => r.KOFULIDO?.trim()).filter(k => k)
    ]));
    let tabfu: any = { recordset: [] };
    
    if (kofudos.length > 0) {
      tabfu = await executeWithResilience(
        async () => pool!.request().query(`
          SELECT KOFU, NOKOFU
          FROM dbo.TABFU
          WHERE KOFU IN (${kofudos.map(k => `'${k}'`).join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${tabfu.recordset.length} vendedores encontrados`);

    const tabfu_records = tabfu.recordset.map((row: any) => ({
      kofu: row.KOFU?.trim() || '',
      nokofu: row.NOKOFU?.trim() || null,
    }));
    await batchInsert(stgMaevenGdv, tabfu_records, 'stg_maeven_gdv', logger);

    // TABRU (Segmentos)
    console.log('6️⃣  Extrayendo TABRU (Segmentos)...');
    const ruens = Array.from(new Set(maeen.recordset.map((r: any) => r.RUEN).filter((r: any) => r)));
    let tabru: any = { recordset: [] };
    
    if (ruens.length > 0) {
      tabru = await executeWithResilience(
        async () => pool!.request().query(`
          SELECT KORU, NOKORU
          FROM dbo.TABRU
          WHERE KORU IN (${ruens.map(r => `'${r}'`).join(',')})
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${tabru.recordset.length} segmentos encontrados`);

    const tabru_records = tabru.recordset.map((row: any) => ({
      koru: row.KORU?.trim() || '',
      nokoru: row.NOKORU?.trim() || null,
    }));
    await batchInsert(stgTabruGdv, tabru_records, 'stg_tabru_gdv', logger);

    // TABBO (Bodegas)
    console.log('7️⃣  Extrayendo TABBO (Bodegas)...');
    const bodegas = Array.from(new Set(maeedo.recordset.map(r => {
      const suli = r.SULI?.trim();
      const bosulido = r.BOSULIDO?.trim();
      return suli && bosulido ? `${suli}|${bosulido}` : null;
    }).filter(b => b)));
    
    let tabbo: any = { recordset: [] };
    
    if (bodegas.length > 0) {
      const bodegaConditions = bodegas.map(b => {
        const [suli, bosulido] = b!.split('|');
        return `(EMPRESA = '${suli}' AND KOBO = '${bosulido}')`;
      }).join(' OR ');
      
      tabbo = await executeWithResilience(
        async () => pool!.request().query(`
          SELECT EMPRESA as SULI, KOBO as BOSULI, NOKOBO as NOBOSULI
          FROM dbo.TABBO
          WHERE ${bodegaConditions}
        `),
        sqlServerBreaker,
        { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
      );
    }
    console.log(`   ✅ ${tabbo.recordset.length} bodegas encontradas`);

    const tabbo_records = tabbo.recordset.map((row: any) => ({
      suli: row.SULI?.trim() || '',
      bosuli: row.BOSULI?.trim() || '',
      nobosuli: row.NOBOSULI?.trim() || null,
    }));
    await batchInsert(stgTabboGdv, tabbo_records, 'stg_tabbo_gdv', logger);

    // 7. SINCRONIZACIÓN COMPLETA: DELETE ALL + INSERT ALL
    emitProgress(7, TOTAL_STEPS, 'Preparando sincronización', 'Contando registros existentes...');
    console.log('\n8️⃣  Preparando sincronización completa...');
    
    // Contar registros antes (para calcular eliminados)
    const countBeforeResult = await db.execute(sql`SELECT COUNT(*) as count FROM gdv.fact_gdv`);
    const rowsBeforeSync = Number(countBeforeResult.rows[0].count);
    console.log(`   📊 Registros actuales en fact_gdv: ${rowsBeforeSync}`);

    // 8. SINCRONIZACIÓN COMPLETA: DELETE ALL + INSERT ALL
    emitProgress(8, TOTAL_STEPS, 'Sincronizando', 'Reemplazando todos los registros en fact_gdv...');
    console.log('9️⃣  Procesando SINCRONIZACIÓN COMPLETA a fact_gdv...');
    console.log('   📋 Estrategia: DELETE ALL + INSERT ALL (snapshot)');

    await db.transaction(async (tx) => {
      // TRUNCATE fact_gdv (eliminar todos los registros)
      console.log('   🗑️  Eliminando todos los registros existentes...');
      await tx.execute(sql`TRUNCATE TABLE gdv.fact_gdv`);

      // INSERT con JOINs a staging tables - solo líneas abiertas
      console.log('   ➕ Insertando GDV abiertas desde staging...');
      await tx.execute(sql`
        INSERT INTO gdv.fact_gdv (
          idmaeddo, idmaeedo, tido, nudo, endo, suendo, sudo, feemdo, feulvedo,
          esdo, espgdo, kofudo, modo, timodo, tamodo,
          vanedo, vaivdo, vabrdo, lilg, bosulido, kofulido,
          koprct, ud01pr, ud02pr, 
          caprco1, caprco2, caprad1, caprad2, caprnc1, caprnc2,
          vaneli, feemli, feerli,
          devol1, devol2, stockfis, ocdo,
          nokoprct, nosudo, nokofu, nobosuli, nokoen, noruen,
          monto, eslido, cantidad_pendiente, last_etl_sync, data_source
        )
        SELECT 
          dd.idmaeddo,
          dd.idmaeedo,
          'GDV' as tido,
          CAST(ed.nudo AS NUMERIC),
          ed.endo,
          ed.suendo,
          CAST(ed.sudo AS NUMERIC),
          ed.feemdo,
          ed.feulvedo,
          ed.esdo,
          ed.espgdo,
          ed.kofudo,
          ed.modo,
          ed.timodo,
          ed.tamodo,
          ed.vanedo,
          ed.vaivdo,
          ed.vabrdo,
          ed.lilg,
          CAST(ed.bosulido AS NUMERIC),
          dd.kofulido, -- CORRECCIÓN: Usar kofulido del detalle
          dd.koprct,
          pr.ud01pr,
          pr.ud02pr,
          dd.caprco1,
          dd.caprco2,
          dd.caprad1,
          dd.caprad2,
          dd.caprnc1,
          dd.caprnc2,
          dd.vaneli,
          dd.feemli,
          dd.feerli,
          dd.devol1,
          dd.devol2,
          dd.stockfis,
          ed.ocdo,
          pr.nomrpr as nokoprct,
          'Sucursal ' || ed.sudo as nosudo,
          fu.nokofu,
          bo.nobosuli,
          en.nokoen,
          ru.nokoru as noruen,
          dd.vaneli as monto,
          dd.eslido,
          -- Calcular si tiene cantidad pendiente de despacho (CRITERIO CORRECTO + FILTRO DE MONTO)
          -- Solo si: (1) tiene cantidades pendientes Y (2) la línea NO está cerrada Y (3) monto >= $1,000
          CASE 
            WHEN (
              ((COALESCE(dd.caprco1, 0) - COALESCE(dd.caprad1, 0) - COALESCE(dd.caprnc1, 0)) > 0) OR
              ((COALESCE(dd.caprco2, 0) - COALESCE(dd.caprad2, 0) - COALESCE(dd.caprnc2, 0)) > 0)
            ) AND (dd.eslido IS NULL OR dd.eslido = '')
              AND dd.vaneli >= 1000
            THEN TRUE
            ELSE FALSE
          END as cantidad_pendiente,
          NOW() as last_etl_sync,
          'etl_gdv' as data_source
        FROM gdv.stg_maeddo_gdv dd
        INNER JOIN gdv.stg_maeedo_gdv ed ON dd.idmaeedo = ed.idmaeedo
        LEFT JOIN gdv.stg_maeen_gdv en ON ed.endo = en.koen
        LEFT JOIN gdv.stg_maepr_gdv pr ON dd.koprct = pr.kopr
        LEFT JOIN gdv.stg_maeven_gdv fu ON dd.kofulido = fu.kofu
        LEFT JOIN gdv.stg_tabru_gdv ru ON en.ruen = ru.koru
        LEFT JOIN gdv.stg_tabbo_gdv bo ON ed.suli = bo.suli AND ed.bosulido = bo.bosuli
        WHERE dd.eslido IS NULL OR dd.eslido = ''
      `);
    });

    // Contar registros después
    const countAfterResult = await db.execute(sql`SELECT COUNT(*) as count FROM gdv.fact_gdv`);
    const rowsAfterSync = Number(countAfterResult.rows[0].count);
    
    // En sincronización completa, todos son inserts nuevos
    const recordsInserted = rowsAfterSync;
    const recordsRemoved = Math.max(0, rowsBeforeSync - rowsAfterSync);

    console.log(`\n📊 Resultados de la SINCRONIZACIÓN COMPLETA:`);
    console.log(`   Registros anteriores: ${rowsBeforeSync}`);
    console.log(`   Registros actuales: ${rowsAfterSync}`);
    console.log(`   GDV cerradas/eliminadas: ${recordsRemoved}`);
    console.log(`   Total líneas procesadas: ${maeddo.recordset.length}\n`);

    // Actualizar log de ejecución
    emitProgress(10, TOTAL_STEPS, 'Finalizando', 'Actualizando log de sincronización...');
    
    await db.update(gdvSyncLog)
      .set({
        status: 'success',
        recordsProcessed: maeddo.recordset.length,
        recordsInserted,
        recordsUpdated: 0,
        statusChanges: recordsRemoved,
        executionTimeMs: Date.now() - startTime,
      })
      .where(sql`id = ${executionLog.id}`);

    await pool.close();

    const executionTime = Date.now() - startTime;
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ETL DE GDV COMPLETADO EXITOSAMENTE (SYNC COMPLETA)       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`⏱️  Tiempo de ejecución: ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📦 Documentos GDV abiertos: ${maeedo.recordset.length}`);
    console.log(`📋 Líneas procesadas: ${maeddo.recordset.length}`);
    console.log(`➕ Registros en fact_gdv: ${rowsAfterSync}`);
    console.log(`🗑️  GDV cerradas/eliminadas: ${recordsRemoved}\n`);

    logger.info('ETL de GDV completado exitosamente (full_sync)', {
      documentsProcessed: maeedo.recordset.length,
      linesProcessed: maeddo.recordset.length,
      recordsInserted,
      recordsRemoved,
      executionTimeMs: executionTime
    });

    return {
      success: true,
      recordsProcessed: maeddo.recordset.length,
      recordsInserted,
      recordsUpdated: 0,
      statusChanges: recordsRemoved,
      executionTimeMs: executionTime,
      watermarkDate: currentTimestamp,
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
