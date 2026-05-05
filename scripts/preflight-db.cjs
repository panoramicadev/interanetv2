#!/usr/bin/env node
// Preflight DB script: corre ANTES de drizzle-kit push para evitar prompts
// interactivos y reparar estado dañado por renames incorrectos previos.
//
// Idempotente: cada paso revisa el estado actual y solo actúa si hace falta.
//
// Pasos:
//   1. Si inventario_marketing_movimientos existe con la firma de
//      gri_price_history (columna snapshot_at), revierte el rename:
//        - DROP TABLE gri_price_history (la copia vacía creada por el bootstrap)
//        - ALTER TABLE inventario_marketing_movimientos RENAME TO gri_price_history
//        Recupera los datos de costos perdidos por el deploy roto.
//
//   2. Pre-crea inventario_marketing_movimientos con su schema correcto si
//      todavía no existe. Esto evita que drizzle-kit push pregunte si la
//      tabla nueva es un rename de alguna tabla existente.

/* eslint-disable no-console */
const { Client } = require('pg');

if (!process.env.DATABASE_URL) {
  console.log('[preflight] DATABASE_URL no configurada, salteando preflight.');
  process.exit(0);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log('[preflight] Conectado a la base de datos.');

    // ── Paso 1: Detectar y revertir rename incorrecto ───────────────────
    const inventarioCols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventario_marketing_movimientos'
    `);
    const colNames = new Set(inventarioCols.rows.map(r => r.column_name));

    if (colNames.has('snapshot_at') && colNames.has('sku') && colNames.has('price')) {
      console.log('[preflight] ⚠️  Detectado rename incorrecto: inventario_marketing_movimientos tiene firma de gri_price_history.');

      const griExists = await client.query(`
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'gri_price_history'
        LIMIT 1
      `);

      const griRowCount = griExists.rows.length > 0
        ? (await client.query(`SELECT COUNT(*)::int AS count FROM gri_price_history`)).rows[0].count
        : null;

      console.log(`[preflight] gri_price_history existente: ${griExists.rows.length > 0 ? `sí (${griRowCount} filas)` : 'no'}`);

      // Solo actuamos si gri_price_history no existe O está vacía. Si tiene
      // filas, abortamos para no perder datos por accidente.
      if (griExists.rows.length === 0 || griRowCount === 0) {
        await client.query('BEGIN');
        try {
          if (griExists.rows.length > 0) {
            await client.query('DROP TABLE gri_price_history');
            console.log('[preflight] ✅ Drop de gri_price_history vacía.');
          }
          await client.query('ALTER TABLE inventario_marketing_movimientos RENAME TO gri_price_history');
          console.log('[preflight] ✅ Rename inventario_marketing_movimientos → gri_price_history. Datos restaurados.');
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('[preflight] ❌ Error en recuperación, transacción revertida:', err.message);
          throw err;
        }
      } else {
        console.warn(`[preflight] ⚠️  gri_price_history tiene ${griRowCount} filas. No reverso el rename automáticamente — requiere intervención manual.`);
      }
    } else if (colNames.has('item_id') && colNames.has('tipo') && colNames.has('cantidad')) {
      console.log('[preflight] inventario_marketing_movimientos en su forma legítima. OK.');
    } else if (colNames.size > 0) {
      console.log(`[preflight] inventario_marketing_movimientos existe con columnas: ${[...colNames].join(', ')}. Sin acción.`);
    }

    // ── Paso 2: Pre-crear inventario_marketing_movimientos si falta ─────
    // Si la tabla no existe, la creamos vacía con su schema correcto. Así
    // drizzle-kit push no preguntará "¿es rename?" sobre tablas huérfanas.
    const stillMissing = await client.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'inventario_marketing_movimientos'
      LIMIT 1
    `);

    if (stillMissing.rows.length === 0) {
      console.log('[preflight] inventario_marketing_movimientos no existe — creándola con schema correcto para evitar prompt de rename.');
      await client.query(`
        CREATE TABLE inventario_marketing_movimientos (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          item_id VARCHAR NOT NULL,
          tipo VARCHAR(50) NOT NULL,
          cantidad INTEGER NOT NULL,
          usuario_id VARCHAR,
          usuario_nombre VARCHAR,
          nota TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('[preflight] ✅ inventario_marketing_movimientos creada vacía.');
    }

    console.log('[preflight] Preflight completado correctamente.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[preflight] ❌ Error fatal:', err.message);
  // No fallar el deploy si el preflight falla — la app puede arrancar igual
  // y arreglarse manualmente. El bootstrap registra los problemas.
  process.exit(0);
});
