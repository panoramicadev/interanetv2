import mssql from 'mssql';
import { db } from './db';
import { sql, desc, eq, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { 
  stgMaeedoNvv, 
  stgMaeddoNvv,
  stgMaeenNvv,
  stgMaeprNvv,
  stgMaevenNvv,
  stgTabboNvv,
  factNvv,
  nvvSyncLog,
  nvvSyncChanges,
  etlConfigs
} from '../shared/schema';
import { CircuitBreaker, executeWithResilience } from './etl-resilience';
import { createETLLogger } from './production-logger';

// Función para verificar si el ETL de NVV fue cancelado
async function checkIfCancelled(executionId: string): Promise<boolean> {
  try {
    const result = await db
      .select({ status: nvvSyncLog.status })
      .from(nvvSyncLog)
      .where(sql`id = ${executionId}`)
      .limit(1);
    
    if (result.length > 0 && result[0].status === 'cancelled') {
      console.log('🛑 ETL de NVV cancelado por el usuario');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error verificando estado de cancelación NVV:', error);
    return false;
  }
}

// Error personalizado para cancelación de NVV
class NVVETLCancelledException extends Error {
  constructor() {
    super('ETL de NVV cancelado por el usuario');
    this.name = 'NVVETLCancelledException';
  }
}

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
  name: 'SQLServer-NVV-ETL'
});

// Exportar circuit breaker para health checks
export { sqlServerBreaker as nvvSqlServerBreaker };

interface NVVETLResult {
  success: boolean;
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  status_changes: number;
  execution_time_ms: number;
  watermarkDate?: Date;
  error?: string;
}

interface NVVProgressEvent {
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
  percentage: number;
}

// Event emitter para progreso del ETL de NVV
export const nvvEtlProgressEmitter = new EventEmitter();

// Replay buffer para eventos SSE (almacena últimos eventos por execution ID)
const progressReplayBuffer = new Map<string, NVVProgressEvent[]>();
const MAX_BUFFER_SIZE = 50;

// REFACTOR: Separar concerns de mutual exclusion guard vs replay pointer
let activeExecutionId: string | null = null;  // Guard: se limpia INMEDIATAMENTE en finally
let lastReplayExecutionId: string | null = null;  // Replay: se limpia después de 60s

// Función para obtener eventos históricos de una ejecución
export function getNVVProgressHistory(executionId?: string): NVVProgressEvent[] {
  const id = executionId || lastReplayExecutionId;
  if (!id) return [];
  return progressReplayBuffer.get(id) || [];
}

// Función para limpiar el buffer de una ejecución
export function clearNVVProgressHistory(executionId: string) {
  progressReplayBuffer.delete(executionId);
}

// Función helper para emitir progreso
function emitProgress(step: number, totalSteps: number, message: string, details?: string) {
  const percentage = Math.round((step / totalSteps) * 100);
  const event: NVVProgressEvent = {
    step,
    totalSteps,
    message,
    details,
    percentage,
  };
  
  // Almacenar evento en replay buffer usando lastReplayExecutionId
  if (lastReplayExecutionId) {
    const buffer = progressReplayBuffer.get(lastReplayExecutionId) || [];
    buffer.push(event);
    
    // Limitar tamaño del buffer (mantener solo los últimos MAX_BUFFER_SIZE eventos)
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }
    
    progressReplayBuffer.set(lastReplayExecutionId, buffer);
  }
  
  nvvEtlProgressEmitter.emit('progress', event);
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
        error_message: error.message
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

// Obtener último watermark de NVV (usa watermark_end de la última ejecución exitosa)
// Fallback a watermarkDate para compatibilidad con ejecuciones previas a Migration 010
async function getLastWatermark(): Promise<Date> {
  const lastExecution = await db
    .select()
    .from(nvvSyncLog)
    .where(sql`status = 'success'`)
    .orderBy(desc(sql`COALESCE(${nvvSyncLog.watermarkEnd}, ${nvvSyncLog.watermarkDate})`))
    .limit(1);

  if (lastExecution.length > 0) {
    const watermark = lastExecution[0].watermarkEnd || lastExecution[0].watermarkDate;
    if (watermark) {
      return new Date(watermark);
    }
  }

  // Si no hay ejecuciones previas, comenzar desde 2025-01-01
  return new Date('2025-01-01');
}

export async function executeNVVETL(): Promise<NVVETLResult> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📦 ETL DE NOTAS DE VENTA (NVV) - SINCRONIZACIÓN COMPLETA     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  console.log('📋 Modo: Snapshot completo (elimina NVV cerradas/facturadas)');
  
  const startTime = Date.now();
  const logger = createETLLogger('nvv_etl');
  logger.info('ETL de NVV iniciado', { startTime: new Date().toISOString() });
  
  let pool: mssql.ConnectionPool | null = null;
  const sucursales = ['004', '005', '006', '007'];
  const TOTAL_STEPS = 10;

  try {
    console.log('\n🔍 Verificando credenciales SQL Server...');
    console.log(`   Host: ${sqlServerConfig.server ? '✅' : '❌'}`);
    console.log(`   Database: ${sqlServerConfig.database ? '✅' : '❌'}`);
    console.log(`   User: ${sqlServerConfig.user ? '✅' : '❌'}`);

    // 🔒 GUARD IN-MEMORY: Verificar si ya hay una ejecución en curso (previene race conditions)
    console.log('\n🔒 Verificando ejecuciones activas...');
    
    if (activeExecutionId !== null) {
      console.log(`⚠️  ETL de NVV ya en ejecución (in-memory guard: ${activeExecutionId})`);
      return {
        success: false,
        records_processed: 0,
        records_inserted: 0,
        records_updated: 0,
        status_changes: 0,
        execution_time_ms: Date.now() - startTime,
        error: 'ETL de NVV ya en ejecución'
      };
    }
    
    const runningNVV = await db
      .select()
      .from(nvvSyncLog)
      .where(sql`status = 'running'`)
      .limit(1);

    if (runningNVV.length > 0) {
      console.log(`⚠️  ETL de NVV ya en ejecución (DB: ${runningNVV[0].id})`);
      return {
        success: false,
        records_processed: 0,
        records_inserted: 0,
        records_updated: 0,
        status_changes: 0,
        execution_time_ms: Date.now() - startTime,
        error: 'ETL de NVV ya en ejecución'
      };
    }
    console.log('✅ No hay ejecuciones activas\n');

    // ✅ Generar execution ID y establecer AMBOS guards/pointers atómicamente
    const executionId = nanoid();
    activeExecutionId = executionId;  // Guard de mutual exclusion
    
    // 🧹 Limpiar buffer de ejecución PREVIA antes de empezar nueva ejecución
    if (lastReplayExecutionId && lastReplayExecutionId !== executionId) {
      clearNVVProgressHistory(lastReplayExecutionId);
    }
    
    lastReplayExecutionId = executionId;  // Establecer nuevo pointer para replay buffer

    // Para sincronización completa no usamos watermark incremental
    // Extraemos TODAS las NVV actuales y eliminamos las que ya no existen
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 MODO SINCRONIZACIÓN COMPLETA (SNAPSHOT)                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('📍 Extrayendo TODAS las NVV pendientes actuales');
    console.log('📍 Las NVV que ya no existen serán eliminadas de la BD');
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

    // Timestamp de ejecución actual
    const currentTimestamp = new Date();
    console.log(`📍 Timestamp de ejecución: ${currentTimestamp.toISOString()}`);
    console.log('');

    // Registrar inicio de ejecución
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('es-CL', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
      });
    };
    
    const periodDisplay = `Sincronización completa - ${currentTimestamp.toLocaleDateString('es-CL')} ${formatTime(currentTimestamp)}`;
    
    const [executionLog] = await db.insert(nvvSyncLog).values({
      id: executionId,
      startTime: new Date(),
      status: 'running',
      period: 'full_sync', // Indicar sincronización completa
      periodDisplay: periodDisplay, // Formatted for UI
      branches: sucursales.join(','),
      watermarkDate: currentTimestamp, // Timestamp de ejecución
      watermarkStart: null, // No aplica para sync completa
      watermarkEnd: currentTimestamp,
    }).returning();

    // Limpiar tablas staging de NVV (propias, no compartidas con ventas)
    console.log('🧹 Limpiando tablas staging de NVV...');
    await db.execute(sql`TRUNCATE TABLE nvv.stg_maeedo_nvv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nvv.stg_maeddo_nvv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nvv.stg_maeen_nvv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nvv.stg_maepr_nvv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nvv.stg_maeven_nvv CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nvv.stg_tabbo_nvv CASCADE`);
    console.log('✅ Tablas staging limpias (aisladas de ETL ventas)\n');

    // 1. EXTRAER MAEEDO (encabezados NVV) - SINCRONIZACIÓN COMPLETA
    // Extraer TODAS las NVV pendientes actuales (sin filtro de watermark)
    emitProgress(2, TOTAL_STEPS, 'Extrayendo MAEEDO (NVV)', 'Sincronización completa...');
    console.log('1️⃣  Extrayendo MAEEDO (Encabezados NVV) - TODAS las NVV pendientes...');
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  📝 QUERY SQL MAEEDO - SINCRONIZACIÓN COMPLETA                ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`🔍 TIDO = 'NVV'`);
    console.log(`🔍 SUDO IN: ${sucursales.join(', ')}`);
    console.log(`🔍 FEEMDO >= '2025-01-01' (Solo docs de 2025 en adelante)`);
    console.log(`📋 Extrayendo TODAS las NVV actuales (sin filtro de fecha FEER)`);
    console.log('');
    
    const maeedo = await executeWithResilience(
      async () => pool!.request().query(`
        SELECT *
        FROM dbo.MAEEDO
        WHERE TIDO = 'NVV'
          AND SUDO IN (${sucursales.map(s => `'${s}'`).join(',')})
          AND FEEMDO >= '2025-01-01'
        ORDER BY FEEMDO DESC
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    
    console.log(`   ✅ ${maeedo.recordset.length} documentos NVV encontrados en la fuente`);

    // Checkpoint de cancelación después de extraer encabezados
    if (await checkIfCancelled(executionId)) {
      throw new NVVETLCancelledException();
    }

    if (maeedo.recordset.length === 0) {
      console.log('\n⚠️  No hay NVV en la fuente - eliminando todas las NVV existentes\n');
      
      // Sincronización completa: si no hay NVV en la fuente, eliminar todas de fact_nvv
      const deleteResult = await db.execute(sql`DELETE FROM nvv.fact_nvv`);
      const deletedCount = deleteResult.rowCount || 0;
      console.log(`   🗑️  ${deletedCount} registros eliminados de fact_nvv`);
      
      await db.update(nvvSyncLog)
        .set({
          status: 'success',
          recordsProcessed: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          statusChanges: deletedCount, // Registrar eliminaciones como cambios
          executionTimeMs: Date.now() - startTime,
          watermarkDate: currentTimestamp,
          watermarkStart: null,
          watermarkEnd: currentTimestamp,
          endTime: new Date(),
        })
        .where(sql`id = ${executionLog.id}`);

      await pool.close();
      
      return {
        success: true,
        records_processed: 0,
        records_inserted: 0,
        records_updated: 0,
        status_changes: deletedCount,
        execution_time_ms: Date.now() - startTime,
        watermarkDate: currentTimestamp,
      };
    }

    // Cargar MAEEDO a staging
    const normalizeStatus = (value: any): string => (value || '').trim();
    
    const maeedo_records = maeedo.recordset.map(row => ({
      idmaeedo: cleanNumeric(row.IDMAEEDO),
      tido: row.TIDO?.trim() || null,
      nudo: row.NUDO?.trim() || null,
      endo: row.ENDO?.trim() || null,
      suendo: row.SUENDO?.trim() || null,
      sudo: row.SUDO?.trim() || null,
      feemdo: row.FEEMDO || null,
      feer: row.FEER || null,
      modo: row.MODO?.trim() || null,
      timodo: row.TIMODO?.trim() || null,
      tideve: row.TIDEVE?.trim() || null,
      tidevefe: row.TIDEVEFE || null,
      tideveho: row.TIDEVEHO?.trim() || null,
      // Campos para fallback vendor/warehouse
      empresa: row.EMPRESA?.trim() || null,
      kofudo: row.KOFUDO?.trim() || null,
      suli: row.SULI?.trim() || null,
      bosulido: row.BOSULIDO?.trim() || null,
    }));
    await batchInsert(stgMaeedoNvv, maeedo_records, 'stg_maeedo_nvv', logger);
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
      lilg: row.LILG?.trim() || null,
      prct: cleanNumeric(row.PRCT),
      nulido: row.NULIDO?.trim() || null,
      feerli: row.FEERLI || null,
      sulido: row.SULIDO?.trim() || null,
      bosulido: row.BOSULIDO?.trim() || null,
      luvtlido: (() => {
        if (!row.LUVTLIDO) return null;
        const val = parseInt(String(row.LUVTLIDO).trim());
        return isNaN(val) ? null : val;
      })(),
      ud01pr: row.UD01PR?.trim() || null,
      nokozo: row.NOKOZO?.trim() || null,
      nusepr: row.NUSEPR?.trim() || null,
      caprco1: cleanNumeric(row.CAPRCO1),
      caprad1: cleanNumeric(row.CAPRAD1),
      caprex1: cleanNumeric(row.CAPREX1),
      ud02pr: row.UD02PR?.trim() || null,
      caprco2: cleanNumeric(row.CAPRCO2),
      caprad2: cleanNumeric(row.CAPRAD2),
      caprex2: cleanNumeric(row.CAPREX2),
      ppprne: cleanNumeric(row.PPPRNE),
      tamopppr: cleanNumeric(row.TAMOPPPR),
      vaneli: cleanNumeric(row.VANELI),
      feemli: row.FEEMLI || null,
      kofulido: row.KOFULIDO?.trim() || null, // CAMPO CRÍTICO: Vendedor línea
      eslido: normalizeStatus(row.ESLIDO), // CAMPO CRÍTICO: Estado de línea ('C' = cerrado, '' = abierto)
      ocdo: row.OCDO?.trim() || null,
    }));
    await batchInsert(stgMaeddoNvv, maeddo_records, 'stg_maeddo_nvv', logger);
    emitProgress(5, TOTAL_STEPS, 'Cargando MAEDDO a staging', `${maeddo_records.length} registros`);

    // Checkpoint de cancelación después de cargar staging
    if (await checkIfCancelled(executionId)) {
      throw new NVVETLCancelledException();
    }

    // 3-6. EXTRAER TABLAS MAESTRAS (reutilizamos las del esquema ventas)
    emitProgress(6, TOTAL_STEPS, 'Extrayendo tablas maestras', 'MAEEN, MAEPR, TABFU, TABRU, TABBO...');
    
    // MAEEN (Clientes)
    console.log('3️⃣  Extrayendo MAEEN (Entidades)...');
    const endos = Array.from(new Set(maeedo.recordset.map(r => r.ENDO?.trim()).filter(e => e)));
    let maeen: any = { recordset: [] };
    
    if (endos.length > 0) {
      maeen = await executeWithResilience(
        async () => pool!.request().query(`
          SELECT KOEN, NOKOEN, RUEN, KOFUEN, ZOEN, DIEN, FOEN, CPEN, CMEN
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
      ruen: row.RUEN?.trim() || null, // Segmento del cliente
      kofuen: row.KOFUEN?.trim() || null, // Vendedor asociado al cliente
      dien: row.DIEN?.trim() || null,
      zoen: row.ZOEN?.trim() || null,
      foen: row.FOEN?.trim() || null,
      cpen: row.CPEN?.trim() || null,
      cmen: row.CMEN?.trim() || null,
    }));
    await batchInsert(stgMaeenNvv, maeen_records, 'stg_maeen_nvv', logger);

    // MAEPR (Productos)
    console.log('4️⃣  Extrayendo MAEPR (Productos)...');
    const koprcts = Array.from(new Set(maeddo.recordset.map(r => r.KOPRCT)));
    const maepr = await executeWithResilience(
      async () => pool!.request().query(`
        SELECT KOPR, NOKOPR, UD01PR, UD02PR, TIPR, PFPR, FMPR, RUPR, MRPR
        FROM dbo.MAEPR
        WHERE KOPR IN (${koprcts.map(k => `'${k}'`).join(',')})
      `),
      sqlServerBreaker,
      { maxRetries: 3, initialDelay: 2000, onlyIdempotent: true }
    );
    console.log(`   ✅ ${maepr.recordset.length} productos encontrados`);

    const maepr_records = maepr.recordset.map(row => ({
      kopr: row.KOPR?.trim() || '',
      nokopr: row.NOKOPR?.trim() || null,
      ud01pr: row.UD01PR?.trim() || null,
      ud02pr: row.UD02PR?.trim() || null,
      tipr: row.TIPR?.trim() || null,
      pfpr: row.PFPR?.trim() || null,
      fmpr: row.FMPR?.trim() || null,
      rupr: row.RUPR?.trim() || null,
      mrpr: row.MRPR?.trim() || null,
    }));
    await batchInsert(stgMaeprNvv, maepr_records, 'stg_maepr_nvv', logger);

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
      kofuven: row.KOFU?.trim() || '',
      nokofuven: row.NOKOFU?.trim() || null,
    }));
    await batchInsert(stgMaevenNvv, tabfu_records, 'stg_maeven_nvv', logger);

    // NOTA: No extraemos TABRU - usamos ventas.stg_tabru directamente en el MERGE

    // TABBO (Bodegas) - Extraer tanto del header (MAEEDO) como del detail (MAEDDO)
    console.log('6️⃣  Extrayendo TABBO (Bodegas)...');
    const bodegasHeader = maeedo.recordset.map(r => {
      const suli = r.SULI?.trim();
      const bosulido = r.BOSULIDO?.trim();
      return suli && bosulido ? `${suli}|${bosulido}` : null;
    });
    const bodegasDetail = maeddo.recordset.map(r => {
      const sulido = r.SULIDO?.trim();
      const bosulido = r.BOSULIDO?.trim();
      return sulido && bosulido ? `${sulido}|${bosulido}` : null;
    });
    const bodegas = Array.from(new Set([...bodegasHeader, ...bodegasDetail].filter(b => b)));
    
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
    await batchInsert(stgTabboNvv, tabbo_records, 'stg_tabbo_nvv', logger);

    // 7. DETECTAR CAMBIOS Y CALCULAR ELIMINACIONES REALES
    emitProgress(7, TOTAL_STEPS, 'Detectando cambios', 'Comparando con registros existentes...');
    console.log('\n8️⃣  Detectando cambios y eliminaciones...');
    
    // Conjunto de IDs de la fuente actual
    const sourceIdSet = new Set(maeddo.recordset.map(r => cleanBigIntId(r.IDMAEDDO)));
    console.log(`   📋 IDs únicos en fuente: ${sourceIdSet.size}`);
    
    // Obtener TODOS los IDs existentes en fact_nvv (para contar eliminaciones)
    const allExistingResult = await db.execute(sql`
      SELECT idmaeddo, eslido FROM nvv.fact_nvv
    `);
    const allExistingIds = new Set(
      allExistingResult.rows.map((row: any) => row.idmaeddo?.toString() || '0')
    );
    console.log(`   📋 IDs existentes en BD: ${allExistingIds.size}`);
    
    // Calcular NVV que ya no existen en fuente (eliminaciones reales)
    let nvv_eliminadas = 0;
    for (const existingId of allExistingIds) {
      if (!sourceIdSet.has(existingId)) {
        nvv_eliminadas++;
      }
    }
    console.log(`   🗑️  NVV que serán eliminadas (no en fuente): ${nvv_eliminadas}`);
    
    // Mapa de existentes para detección de cambios de estado (solo los que coinciden)
    const existingMap = new Map(
      allExistingResult.rows.map((row: any) => [row.idmaeddo?.toString() || '0', row])
    );

    let status_changes = 0;

    // Detectar cambios de estado antes del merge
    for (const row of maeddo.recordset) {
      const idmaeddo = cleanBigIntId(row.IDMAEDDO);
      const existingRecord = existingMap.get(idmaeddo);
      
      if (existingRecord) {
        // Normalizar: null/'' = abierto, 'C' = cerrado
        const oldStatus = normalizeStatus(existingRecord.eslido);
        const newStatus = normalizeStatus(row.ESLIDO);
        
        // Detectar cambio de estado a cerrado ('' → 'C')
        if (oldStatus === '' && newStatus === 'C') {
          status_changes++;
          logger.info(`Cambio de estado detectado: Línea NVV cerrada`, {
            idmaeddo: idmaeddo,
            oldStatus: 'ABIERTO',
            newStatus: 'CERRADO'
          });
          console.log(`   ✅ Estado cambiado a CERRADO: IDMAEDDO ${idmaeddo}`);
        }
      }
    }
    console.log(`   Total cambios de estado: ${status_changes}\n`);

    // Checkpoint de cancelación antes del MERGE
    if (await checkIfCancelled(executionId)) {
      throw new NVVETLCancelledException();
    }

    // 8. SINCRONIZACIÓN COMPLETA: DELETE ALL + INSERT ALL
    emitProgress(8, TOTAL_STEPS, 'Sincronizando', 'Reemplazando todos los registros en fact_nvv...');
    console.log('9️⃣  Procesando SINCRONIZACIÓN COMPLETA a fact_nvv...');
    console.log('   📋 Estrategia: DELETE ALL + INSERT ALL (snapshot)');
    
    // Contar registros antes
    const countBeforeResult = await db.execute(sql`SELECT COUNT(*) as count FROM nvv.fact_nvv`);
    const rowsBeforeSync = Number(countBeforeResult.rows[0].count);
    console.log(`   📊 Registros existentes antes: ${rowsBeforeSync}`);
    
    await db.transaction(async (tx) => {
      // PASO 1: Eliminar TODOS los registros existentes
      console.log('   🗑️  Eliminando todos los registros existentes...');
      await tx.execute(sql`DELETE FROM nvv.fact_nvv`);

      // PASO 2: Insertar TODOS los registros actuales desde staging
      console.log('   ➕ Insertando registros actuales desde staging...');
      // INSERT con JOINs a staging tables
      await tx.execute(sql`
        INSERT INTO nvv.fact_nvv (
          idmaeddo, idmaeedo, nudo, tido, endo, sudo, nosudo, feemdo, feer,
          koprct, nokopr, rupr, nombre_segmento,
          caprco1, caprad1, caprex1, ud01pr,
          caprco2, caprad2, caprex2, ud02pr,
          ppprne, vaneli, monto,
          nokoen, ruen, nombre_segmento_cliente,
          kofulido, nombre_vendedor,
          bosulido, nombre_bodega,
          eslido,
          feerli, feemli,
          ocdo, lilg, luvtlido,
          cantidad_pendiente, last_etl_sync, data_source,
          last_etl_execution_id, last_status
        )
        SELECT 
          dd.idmaeddo,
          dd.idmaeedo,
          ed.nudo,
          'NVV' as tido,
          ed.endo,
          ed.sudo,
          'Sucursal ' || ed.sudo as nosudo,
          ed.feemdo,
          ed.feer,
          dd.koprct,
          dd.nokopr,
          pr.rupr, -- Código de segmento del producto
          ru_prod.nokoru as nombre_segmento, -- Nombre de segmento del producto (desde ventas.stg_tabru)
          dd.caprco1,
          dd.caprad1,
          dd.caprex1,
          dd.ud01pr,
          dd.caprco2,
          dd.caprad2,
          dd.caprex2,
          dd.ud02pr,
          dd.ppprne,
          dd.vaneli,
          dd.vaneli as monto,
          en.nokoen,
          en.ruen, -- Código de segmento del cliente
          ru_cli.nokoru as nombre_segmento_cliente, -- Nombre de segmento del cliente (desde ventas.stg_tabru)
          COALESCE(dd.kofulido, ed.kofudo) as kofulido, -- Fallback: detalle → cabecera
          fu.nokofuven as nombre_vendedor,
          COALESCE(dd.bosulido, ed.bosulido) as bosulido, -- Fallback: detalle → cabecera
          bo.nobosuli as nombre_bodega,
          dd.eslido,
          dd.feerli,
          dd.feemli,
          dd.ocdo,
          dd.lilg,
          dd.luvtlido,
          -- Calcular cantidad_pendiente: (eslido NULL/'') AND ((CAPRCO2 - CAPREX2) × PPPRNE >= 1000)
          -- Usa UD2 según fórmula especificada por el usuario
          CASE 
            WHEN (dd.eslido IS NULL OR dd.eslido = '')
              AND (((COALESCE(dd.caprco2, 0) - COALESCE(dd.caprex2, 0)) * COALESCE(dd.ppprne, 0)) >= 1000)
            THEN TRUE
            ELSE FALSE
          END as cantidad_pendiente,
          NOW() as last_etl_sync,
          'etl_nvv' as data_source,
          ${executionId} as last_etl_execution_id,
          dd.eslido as last_status
        FROM nvv.stg_maeddo_nvv dd
        INNER JOIN nvv.stg_maeedo_nvv ed ON dd.idmaeedo = ed.idmaeedo
        LEFT JOIN nvv.stg_maeen_nvv en ON ed.endo = en.koen
        LEFT JOIN nvv.stg_maeven_nvv fu ON COALESCE(dd.kofulido, ed.kofudo) = fu.kofuven
        LEFT JOIN nvv.stg_tabbo_nvv bo ON COALESCE(dd.sulido, ed.suli) = bo.suli 
                                        AND COALESCE(dd.bosulido, ed.bosulido) = bo.bosuli
        LEFT JOIN nvv.stg_maepr_nvv pr ON dd.koprct = pr.kopr
        LEFT JOIN ventas.stg_tabru ru_prod ON pr.rupr = ru_prod.koru -- Segmento del producto
        LEFT JOIN ventas.stg_tabru ru_cli ON en.ruen = ru_cli.koru -- Segmento del cliente
        WHERE dd.eslido IS NULL OR dd.eslido = '' -- Solo insertar líneas pendientes (no cerradas)
      `);
    });

    // Contar registros después de la sincronización
    const countAfterResult = await db.execute(sql`SELECT COUNT(*) as count FROM nvv.fact_nvv`);
    const rowsAfterSync = Number(countAfterResult.rows[0].count);
    
    // Calcular estadísticas de sincronización
    const records_inserted = rowsAfterSync; // Todos los actuales fueron insertados
    const net_change = rowsAfterSync - rowsBeforeSync;

    console.log(`\n📊 Resultados de SINCRONIZACIÓN COMPLETA:`);
    console.log(`   Registros antes: ${rowsBeforeSync}`);
    console.log(`   Registros en fuente: ${maeddo.recordset.length}`);
    console.log(`   Registros insertados: ${records_inserted}`);
    console.log(`   NVV eliminadas (cerradas/facturadas): ${nvv_eliminadas}`);
    console.log(`   Cambios de estado detectados: ${status_changes}`);
    console.log(`   Cambio neto: ${net_change >= 0 ? '+' : ''}${net_change}`);
    console.log(`   Total en fact_nvv: ${rowsAfterSync}\n`);

    // Actualizar log de ejecución
    emitProgress(10, TOTAL_STEPS, 'Finalizando', 'Actualizando log de sincronización...');
    
    await db.update(nvvSyncLog)
      .set({
        status: 'success',
        recordsProcessed: maeddo.recordset.length,
        recordsInserted: records_inserted,
        recordsUpdated: nvv_eliminadas, // NVV que ya no existen en fuente (cerradas/facturadas)
        statusChanges: status_changes, // Cambios de estado detectados (abierto→cerrado)
        executionTimeMs: Date.now() - startTime,
        watermarkStart: null,
        watermarkEnd: currentTimestamp,
        endTime: new Date(),
      })
      .where(sql`id = ${executionLog.id}`);

    await pool.close();

    const executionTime = Date.now() - startTime;
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ SINCRONIZACIÓN COMPLETA DE NVV EXITOSA                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`⏱️  Tiempo de ejecución: ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📦 Registros en fuente: ${maeddo.recordset.length}`);
    console.log(`➕ Insertados: ${records_inserted}`);
    console.log(`🗑️  NVV eliminadas: ${nvv_eliminadas}`);
    console.log(`🔀 Cambios de estado: ${status_changes}`);
    console.log(`📊 Total actual: ${rowsAfterSync}\n`);

    logger.info('Sincronización completa de NVV exitosa', {
      records_processed: maeddo.recordset.length,
      records_inserted,
      nvv_eliminadas,
      status_changes,
      total_after: rowsAfterSync,
      execution_time_ms: executionTime
    });

    // Buffer persiste para clientes tardíos hasta que la PRÓXIMA ejecución lo limpie
    return {
      success: true,
      records_processed: maeddo.recordset.length,
      records_inserted,
      records_updated: nvv_eliminadas, // NVV que ya no existen en fuente
      status_changes, // Cambios de estado reales detectados
      execution_time_ms: executionTime,
      watermarkDate: currentTimestamp,
    };

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const isCancellation = error instanceof NVVETLCancelledException || error.name === 'NVVETLCancelledException';
    const error_message = isCancellation ? 'ETL cancelado por el usuario' : (error.message || 'Error desconocido');
    
    if (isCancellation) {
      console.log('\n🛑 ETL DE NVV CANCELADO POR EL USUARIO');
      console.log(`⏱️  Tiempo hasta cancelación: ${(executionTime / 1000).toFixed(2)}s`);
      
      emitProgress(TOTAL_STEPS, TOTAL_STEPS, 'ETL Cancelado', 'Proceso cancelado por el usuario');
      
      logger.info('ETL de NVV cancelado por el usuario', { execution_time_ms: executionTime });
    } else {
      console.error('\n❌ ERROR EN ETL DE NVV:');
      console.error(`   Mensaje: ${error_message}`);
      console.error(`   Tipo: ${error.name || 'Unknown'}`);
      
      logger.critical('Error en ETL de NVV', { error_message, error }, error);
    }

    // Actualizar log de ejecución con estado apropiado
    try {
      const runningLog = await db
        .select()
        .from(nvvSyncLog)
        .where(sql`status = 'running'`)
        .orderBy(desc(nvvSyncLog.startTime))
        .limit(1);

      if (runningLog.length > 0) {
        await db.update(nvvSyncLog)
          .set({
            status: isCancellation ? 'cancelled' : 'failed',
            errorMessage: error_message.substring(0, 500),
            executionTimeMs: executionTime,
            endTime: new Date(),
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

    // Buffer persiste para clientes tardíos hasta que la PRÓXIMA ejecución lo limpie
    // activeExecutionId se limpia en finally block
    return {
      success: false,
      records_processed: 0,
      records_inserted: 0,
      records_updated: 0,
      status_changes: 0,
      execution_time_ms: executionTime,
      error: error_message,
    };
  } finally {
    // ✅ FINALLY BLOCK: Liberar guard de mutual exclusion INMEDIATAMENTE
    // Garantiza que el guard nunca quede "stuck", sin importar qué excepción ocurra
    activeExecutionId = null;
  }
}
