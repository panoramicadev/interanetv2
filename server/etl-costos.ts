import mssql from 'mssql';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { etlExecutionLog } from '../shared/schema';

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
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

export const costosEtlProgressEmitter = new EventEmitter();

interface CostosETLResult {
  success: boolean;
  recordsProcessed: number;
  newSnapshots: number;
  unchanged: number;
  executionTimeMs: number;
  error?: string;
}

function emitProgress(step: number, totalSteps: number, message: string, details?: string) {
  const percentage = Math.round((step / totalSteps) * 100);
  costosEtlProgressEmitter.emit('progress', { step, totalSteps, message, details, percentage });
  console.log(`📊 [Costos ${percentage}%] Paso ${step}/${totalSteps}: ${message}`);
  if (details) console.log(`   ${details}`);
}

/**
 * ETL de Costos: extrae el último precio unitario de GRI (Bodega 006) por SKU.
 * Excluye los códigos de concepto (ZZ*: fletes, servicios, descuentos): no son
 * mercadería y su "precio" contamina el costo — ZZSERVICIOS llegó a arrastrar
 * un costo de $1.547.550 por unidad desde una recepción de 2022.
 * desde SQL Server, persiste el snapshot actual en gri_prices_cache (latest)
 * y agrega un nuevo registro a gri_price_history (historial) cuando el precio
 * cambia respecto al último snapshot. Cada snapshot se muestra como columna
 * en el panel.
 */
export async function executeCostosETL(): Promise<CostosETLResult> {
  const startTime = Date.now();
  const ETL_NAME = 'costos';
  const TOTAL_STEPS = 5;

  let pool: mssql.ConnectionPool | null = null;
  let executionLogId: string | null = null;

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  💰 ETL COSTOS INICIADO                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    // ── PASO 0: Verificar lock ────────────────────────────────────────────
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
        console.log('⚠️  ETL Costos ya en ejecución. Cancelando solicitud duplicada.');
        return {
          success: false,
          recordsProcessed: 0,
          newSnapshots: 0,
          unchanged: 0,
          executionTimeMs: Date.now() - startTime,
          error: 'ETL Costos ya en ejecución',
        };
      }
    }

    // ── PASO 1: Conectar a SQL Server ────────────────────────────────────
    emitProgress(1, TOTAL_STEPS, 'Conectando a SQL Server', 'Estableciendo conexión...');

    if (!sqlServerConfig.server || !sqlServerConfig.user) {
      throw new Error('SQL Server no configurado (SQL_SERVER_HOST / SQL_SERVER_USER vacíos)');
    }

    pool = await mssql.connect(sqlServerConfig);
    console.log('✅ Conectado a SQL Server\n');

    // Registrar inicio de ejecución
    const [executionLog] = await db.insert(etlExecutionLog).values({
      etlName: ETL_NAME,
      startTime: new Date(),
      status: 'running',
      period: 'full-sync',
      documentTypes: 'GRI',
      branches: '006',
    }).returning();
    executionLogId = executionLog.id;

    // ── PASO 2: Extraer último precio GRI por SKU ────────────────────────
    emitProgress(2, TOTAL_STEPS, 'Extrayendo precios GRI', 'Bodega 006...');

    const result = await pool.request().query(`
      WITH RankedGRI AS (
        SELECT
          LTRIM(RTRIM(d.KOPRCT)) AS sku,
          d.PPPRNE AS precio_unitario,
          e.FEEMDO AS fecha,
          ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(d.KOPRCT)) ORDER BY e.FEEMDO DESC, d.IDMAEDDO DESC) AS rn
        FROM dbo.MAEDDO d
        INNER JOIN dbo.MAEEDO e ON d.IDMAEEDO = e.IDMAEEDO
        WHERE e.TIDO = 'GRI'
          AND d.BOSULIDO = '006'
          AND d.KOPRCT IS NOT NULL
          AND d.KOPRCT NOT LIKE 'ZZ%'
          AND d.PPPRNE > 0
      )
      SELECT sku, precio_unitario, fecha
      FROM RankedGRI
      WHERE rn = 1
    `);

    const erpPrices: Array<{ sku: string; price: number; fecha: string | null }> = [];
    for (const row of result.recordset) {
      if (row.sku && row.precio_unitario) {
        const fecha = row.fecha ? new Date(row.fecha).toISOString().split('T')[0] : null;
        erpPrices.push({
          sku: String(row.sku).toUpperCase(),
          price: Number(row.precio_unitario),
          fecha,
        });
      }
    }

    console.log(`   ✅ ${erpPrices.length} precios extraídos desde SQL Server`);

    if (erpPrices.length === 0) {
      await db.update(etlExecutionLog)
        .set({
          status: 'success',
          endTime: new Date(),
          recordsProcessed: 0,
          executionTimeMs: Date.now() - startTime,
        })
        .where(sql`id = ${executionLog.id}`);
      return {
        success: true,
        recordsProcessed: 0,
        newSnapshots: 0,
        unchanged: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // ── PASO 3: Comparar contra último snapshot ──────────────────────────
    emitProgress(3, TOTAL_STEPS, 'Comparando con último snapshot', `${erpPrices.length} SKUs`);

    const lastSnapshotResult = await db.execute(sql`
      SELECT sku, price::TEXT AS price
      FROM gri_prices_cache
    `);
    const lastPriceBySku = new Map<string, number>();
    for (const row of (lastSnapshotResult as any).rows) {
      lastPriceBySku.set(String(row.sku).toUpperCase(), Number(row.price));
    }

    const changed: Array<{ sku: string; price: number; fecha: string | null }> = [];
    let unchanged = 0;
    const PRICE_EPSILON = 0.01; // diferencias <1 centavo se consideran iguales
    for (const p of erpPrices) {
      const last = lastPriceBySku.get(p.sku);
      if (last === undefined || Math.abs(last - p.price) > PRICE_EPSILON) {
        changed.push(p);
      } else {
        unchanged++;
      }
    }

    console.log(`   📊 Cambios detectados: ${changed.length} | Sin cambio: ${unchanged}`);

    // ── PASO 4: Persistir cache (latest) e historial (sólo cambios) ──────
    emitProgress(4, TOTAL_STEPS, 'Persistiendo snapshots', `${changed.length} nuevos`);

    const BATCH_SIZE = 1000;

    // 4a. Upsert en gri_prices_cache (siempre, mantiene "último valor")
    for (let i = 0; i < erpPrices.length; i += BATCH_SIZE) {
      const batch = erpPrices.slice(i, i + BATCH_SIZE);
      const values = batch.map(p => sql`(${p.sku}, ${p.price}, ${p.fecha}, NOW())`);
      await db.execute(sql`
        INSERT INTO gri_prices_cache (sku, price, fecha, updated_at)
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT (sku) DO UPDATE SET
          price = EXCLUDED.price,
          fecha = EXCLUDED.fecha,
          updated_at = EXCLUDED.updated_at
      `);
    }

    // 4b. Append en gri_price_history (sólo cambios — un snapshot por cambio)
    if (changed.length > 0) {
      for (let i = 0; i < changed.length; i += BATCH_SIZE) {
        const batch = changed.slice(i, i + BATCH_SIZE);
        const values = batch.map(p =>
          sql`(${p.sku}, NOW(), ${p.price}, ${p.fecha}, ${executionLog.id})`
        );
        await db.execute(sql`
          INSERT INTO gri_price_history (sku, snapshot_at, price, fecha, execution_id)
          VALUES ${sql.join(values, sql`, `)}
        `);
      }
    }

    // ── PASO 5: Cerrar ejecución exitosa ────────────────────────────────
    emitProgress(5, TOTAL_STEPS, 'ETL Costos completado', `${changed.length} cambios, ${unchanged} sin cambio`);

    await db.update(etlExecutionLog)
      .set({
        status: 'success',
        endTime: new Date(),
        recordsProcessed: erpPrices.length,
        executionTimeMs: Date.now() - startTime,
        statistics: JSON.stringify({
          totalErp: erpPrices.length,
          newSnapshots: changed.length,
          unchanged,
        }),
      })
      .where(sql`id = ${executionLog.id}`);

    console.log(`\n✅ ETL Costos: ${changed.length} nuevos snapshots, ${unchanged} sin cambio`);
    console.log(`⏱️  Tiempo: ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    return {
      success: true,
      recordsProcessed: erpPrices.length,
      newSnapshots: changed.length,
      unchanged,
      executionTimeMs: Date.now() - startTime,
    };

  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    console.error('\n❌ ERROR EN ETL COSTOS:', error.message);

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
      newSnapshots: 0,
      unchanged: 0,
      executionTimeMs,
      error: error.message,
    };
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error('❌ Error cerrando pool:', closeError);
      }
    }
  }
}
