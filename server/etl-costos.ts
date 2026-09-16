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
 * El filtro que define qué es un costo de mercadería, en un solo lugar.
 *
 * Los `ZZ*` son códigos de concepto —fletes, servicios, descuentos—: no son
 * mercadería y su "precio" contamina el costo. ZZSERVICIOS llegó a arrastrar
 * $1.547.550 por unidad desde una recepción de 2022.
 *
 * Estaba escrito sólo en el ETL. El endpoint `/api/inventory/gri-prices` corría
 * la misma consulta SIN el filtro y volvía a meter los conceptos en la caché,
 * que es la que leen Margen, Lista de Precios e Inventario.
 */
export const CONSULTA_PRECIOS_GRI = `
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
`;

export type PrecioGri = { sku: string; price: number; fecha: string | null };

/** Diferencias menores a un centavo se consideran el mismo precio. */
const PRICE_EPSILON = 0.01;

/**
 * Guardar los precios: historial primero, caché después.
 *
 * ── Por qué esto existe ──────────────────────────────────────────────────────
 * `gri_prices_cache` tenía DOS escritores: este ETL, que además anota en
 * `gri_price_history` cuando el precio cambió, y el endpoint
 * `/api/inventory/gri-prices`, que la refrescaba sin anotar nada. Ese endpoint
 * lo pegan cinco pantallas con un TTL de 10 minutos, así que la caché estaba
 * siempre al día con el ERP **antes** de que el ETL corriera.
 *
 * Resultado: el ETL comparaba contra una caché ya idéntica al ERP, el diff daba
 * vacío, y reportaba éxito sin guardar nada. En producción fueron 17 corridas
 * seguidas desde mayo con `newSnapshots: 0` y `gri_price_history` en 0 filas.
 *
 * La solución no es dejar un solo escritor —eso costaría frescura en Margen y
 * Lista de Precios—: es que los dos caminos pasen por acá. Así un cambio de
 * precio queda registrado lo detecte quien lo detecte, y el historial no depende
 * de que el ETL gane la carrera.
 */
export async function persistirPreciosGri(
  precios: PrecioGri[],
  executionId: string | null = null,
): Promise<{ cambios: number; sinCambio: number }> {
  if (precios.length === 0) return { cambios: 0, sinCambio: 0 };

  const anterior = await db.execute(sql`SELECT sku, price::TEXT AS price FROM gri_prices_cache`);
  const ultimoPorSku = new Map<string, number>();
  for (const row of (anterior as any).rows) {
    ultimoPorSku.set(String(row.sku).toUpperCase(), Number(row.price));
  }

  const cambiados: PrecioGri[] = [];
  let sinCambio = 0;
  for (const p of precios) {
    const ultimo = ultimoPorSku.get(p.sku);
    if (ultimo === undefined || Math.abs(ultimo - p.price) > PRICE_EPSILON) cambiados.push(p);
    else sinCambio++;
  }

  const BATCH = 1000;

  // El historial va PRIMERO. Si algo falla entre los dos pasos, se pierde
  // frescura en la caché —que se rehace sola en la próxima pasada— y no un
  // cambio de precio, que no se puede reconstruir.
  for (let i = 0; i < cambiados.length; i += BATCH) {
    const lote = cambiados.slice(i, i + BATCH);
    const values = lote.map((p) => sql`(${p.sku}, NOW(), ${p.price}, ${p.fecha}, ${executionId})`);
    await db.execute(sql`
      INSERT INTO gri_price_history (sku, snapshot_at, price, fecha, execution_id)
      VALUES ${sql.join(values, sql`, `)}
    `);
  }

  for (let i = 0; i < precios.length; i += BATCH) {
    const lote = precios.slice(i, i + BATCH);
    const values = lote.map((p) => sql`(${p.sku}, ${p.price}, ${p.fecha}, NOW())`);
    await db.execute(sql`
      INSERT INTO gri_prices_cache (sku, price, fecha, updated_at)
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (sku) DO UPDATE SET
        price = EXCLUDED.price,
        fecha = EXCLUDED.fecha,
        updated_at = EXCLUDED.updated_at
    `);
  }

  return { cambios: cambiados.length, sinCambio };
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

    const result = await pool.request().query(CONSULTA_PRECIOS_GRI);

    const erpPrices: PrecioGri[] = [];
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

    // ── PASOS 3 y 4: comparar y persistir ────────────────────────────────
    // La comparación y la escritura viven en `persistirPreciosGri` porque el
    // endpoint /api/inventory/gri-prices hace exactamente lo mismo. Cuando eran
    // dos copias, la del endpoint no anotaba historial y dejaba este diff en
    // cero para siempre.
    emitProgress(3, TOTAL_STEPS, 'Comparando con último snapshot', `${erpPrices.length} SKUs`);
    const { cambios: changedCount, sinCambio: unchanged } = await persistirPreciosGri(erpPrices, executionLog.id);
    console.log(`   📊 Cambios detectados: ${changedCount} | Sin cambio: ${unchanged}`);
    emitProgress(4, TOTAL_STEPS, 'Snapshots persistidos', `${changedCount} nuevos`);

    // ── PASO 5: Cerrar ejecución exitosa ────────────────────────────────
    emitProgress(5, TOTAL_STEPS, 'ETL Costos completado', `${changedCount} cambios, ${unchanged} sin cambio`);

    await db.update(etlExecutionLog)
      .set({
        status: 'success',
        endTime: new Date(),
        recordsProcessed: erpPrices.length,
        executionTimeMs: Date.now() - startTime,
        statistics: JSON.stringify({
          totalErp: erpPrices.length,
          newSnapshots: changedCount,
          unchanged,
        }),
      })
      .where(sql`id = ${executionLog.id}`);

    console.log(`\n✅ ETL Costos: ${changedCount} nuevos snapshots, ${unchanged} sin cambio`);
    console.log(`⏱️  Tiempo: ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    return {
      success: true,
      recordsProcessed: erpPrices.length,
      newSnapshots: changedCount,
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
