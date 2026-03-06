import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('=== ETL EXECUTION LOG (last 10) ===');
  const logs = await db.execute(sql`
    SELECT id, etl_name, status, start_time, end_time, records_processed, error_message, watermark_date
    FROM ventas.etl_execution_log
    ORDER BY start_time DESC
    LIMIT 10
  `);
  console.table(logs.rows.map((r: any) => ({
    etl: r.etl_name,
    status: r.status,
    start: r.start_time ? new Date(r.start_time).toLocaleString('es-CL') : null,
    records: r.records_processed,
    watermark: r.watermark_date ? new Date(r.watermark_date).toISOString() : null,
    error: r.error_message ? r.error_message.substring(0, 60) : null
  })));

  console.log('\n=== FACT_VENTAS: Most recent doc dates ===');
  const recentVentas = await db.execute(sql`
    SELECT feemdo::date as fecha, tido, COUNT(*) as count, SUM(monto)::numeric as total_monto
    FROM ventas.fact_ventas
    WHERE feemdo >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY feemdo::date, tido
    ORDER BY feemdo::date DESC, tido
  `);
  console.table(recentVentas.rows);

  console.log('\n=== NVV FACT_NVV: Most recent NVV entries ===');
  const recentNvv = await db.execute(sql`
    SELECT feemdo::date as fecha, esdo as estado_linea, COUNT(*) as count, SUM(monto)::numeric as total_monto
    FROM nvv.fact_nvv
    WHERE feemdo >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY feemdo::date, esdo
    ORDER BY feemdo::date DESC
  `);
  console.table(recentNvv.rows);

  console.log('\n=== FACT_VENTAS: Segments this month ===');
  const segments = await db.execute(sql`
    SELECT noruen as segmento, SUM(monto)::numeric as total, COUNT(*) as docs
    FROM ventas.fact_ventas
    WHERE EXTRACT(MONTH FROM feemdo) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM feemdo) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND tido != 'GDV'
    GROUP BY noruen
    ORDER BY total DESC
    LIMIT 15
  `);
  console.table(segments.rows);

  console.log('\n=== FACT_VENTAS: Salespeople this month ===');
  const salespeople = await db.execute(sql`
    SELECT nokofu as vendedor, SUM(monto)::numeric as total, COUNT(*) as docs
    FROM ventas.fact_ventas
    WHERE EXTRACT(MONTH FROM feemdo) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM feemdo) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND tido != 'GDV'
    GROUP BY nokofu
    ORDER BY total DESC
    LIMIT 15
  `);
  console.table(salespeople.rows);

  console.log('\n=== ETL CONFIG ===');
  const config = await db.execute(sql`SELECT * FROM ventas.etl_config`);
  console.table(config.rows);

  process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
