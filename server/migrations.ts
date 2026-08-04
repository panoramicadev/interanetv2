import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { ObjectStorageService } from './objectStorage';

/**
 * Mapa aproximado nombre→hex para sembrar color_palette desde ep.color.
 * Solo es el valor inicial; el admin puede ajustar cada color en /colores-paleta.
 * Patrones ordenados de más específico a más general.
 */
const COLOR_HEX_CASE_SQL = sql`
  CASE
    WHEN ep.color ILIKE '%hueso%' THEN '#f5f0e1'
    WHEN ep.color ILIKE '%marfil%' THEN '#fbf7e4'
    WHEN ep.color ILIKE '%blanco%' THEN '#fafafa'
    WHEN ep.color ILIKE '%negro%' THEN '#1e293b'
    WHEN ep.color ILIKE '%gris perla%' THEN '#d1d5db'
    WHEN ep.color ILIKE '%plomo%' THEN '#6b7280'
    WHEN ep.color ILIKE '%gris%' THEN '#94a3b8'
    WHEN ep.color ILIKE '%crema%' THEN '#f5e6c8'
    WHEN ep.color ILIKE '%beige%' OR ep.color ILIKE '%arena%' THEN '#e8d8b0'
    WHEN ep.color ILIKE '%topacio%' THEN '#f4c430'
    WHEN ep.color ILIKE '%amarillo%' THEN '#facc15'
    WHEN ep.color ILIKE '%oro%' OR ep.color ILIKE '%dorado%' THEN '#d4af37'
    WHEN ep.color ILIKE '%naran%' THEN '#f97316'
    WHEN ep.color ILIKE '%terracota%' OR ep.color ILIKE '%teja%' THEN '#c1654a'
    WHEN ep.color ILIKE '%bermell%' THEN '#e34234'
    WHEN ep.color ILIKE '%colonial%' THEN '#a52a2a'
    WHEN ep.color ILIKE '%burdeo%' OR ep.color ILIKE '%bordo%' OR ep.color ILIKE '%vino%' THEN '#7b1f2b'
    WHEN ep.color ILIKE '%rojo%' THEN '#dc2626'
    WHEN ep.color ILIKE '%fucsia%' OR ep.color ILIKE '%magenta%' THEN '#d6336c'
    WHEN ep.color ILIKE '%rosa%' OR ep.color ILIKE '%rosado%' THEN '#f9a8d4'
    WHEN ep.color ILIKE '%lila%' THEN '#c4b5fd'
    WHEN ep.color ILIKE '%morado%' OR ep.color ILIKE '%violeta%' OR ep.color ILIKE '%purpura%' OR ep.color ILIKE '%púrpura%' THEN '#7c3aed'
    WHEN ep.color ILIKE '%celeste%' THEN '#7dd3fc'
    WHEN ep.color ILIKE '%turquesa%' OR ep.color ILIKE '%aqua%' OR ep.color ILIKE '%agua marina%' THEN '#2dd4bf'
    WHEN ep.color ILIKE '%marino%' THEN '#1e3a8a'
    WHEN ep.color ILIKE '%azul rey%' OR ep.color ILIKE '%azul el%' THEN '#1d4ed8'
    WHEN ep.color ILIKE '%azul%' THEN '#2563eb'
    WHEN ep.color ILIKE '%verde lim%' THEN '#84cc16'
    WHEN ep.color ILIKE '%verde agua%' THEN '#99f6e4'
    WHEN ep.color ILIKE '%oliva%' OR ep.color ILIKE '%militar%' THEN '#556b2f'
    WHEN ep.color ILIKE '%verde%' THEN '#16a34a'
    WHEN ep.color ILIKE '%cobre%' OR ep.color ILIKE '%copper%' THEN '#b87333'
    WHEN ep.color ILIKE '%bronce%' THEN '#cd7f32'
    WHEN ep.color ILIKE '%plata%' OR ep.color ILIKE '%plateado%' OR ep.color ILIKE '%aluminio%' THEN '#c0c0c0'
    WHEN ep.color ILIKE '%chocolate%' OR ep.color ILIKE '%cafe%' OR ep.color ILIKE '%café%' OR ep.color ILIKE '%marron%' OR ep.color ILIKE '%marrón%' OR ep.color ILIKE '%caoba%' OR ep.color ILIKE '%nogal%' THEN '#7b4b2a'
    WHEN ep.color ILIKE '%madera%' OR ep.color ILIKE '%roble%' OR ep.color ILIKE '%cedro%' OR ep.color ILIKE '%pino%' OR ep.color ILIKE '%natural%' THEN '#c19a6b'
    WHEN ep.color ILIKE '%transparente%' OR ep.color ILIKE '%incoloro%' OR ep.color ILIKE '%cristal%' THEN '#e2e8f0'
    ELSE '#cbd5e1'
  END
`;

/**
 * Bootstrap de base de datos - Se ejecuta ANTES de las migraciones
 * Crea esquemas y tablas base que son prerrequisitos para las migraciones
 * Es idempotente y seguro de ejecutar múltiples veces
 */
export async function bootstrapDatabase(): Promise<void> {
  console.log('🚀 Ejecutando bootstrap de base de datos...');
  
  try {
    // 1. Crear esquemas necesarios
    console.log('  📁 Creando esquemas...');
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ventas`);
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS gdv`);
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS nvv`);
    
    // 1.5. Crear tabla de sesiones (CRÍTICO para autenticación)
    console.log('  🔐 Verificando tabla de sesiones...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) PRIMARY KEY NOT NULL,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)`);
    
    // 2. Crear tablas staging de VENTAS con todas las columnas necesarias
    console.log('  📋 Verificando tablas de ventas...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ventas.stg_maeddo (
        idmaeddo NUMERIC(20, 0) PRIMARY KEY,
        idmaeedo NUMERIC(20, 0),
        koprct TEXT,
        sulido TEXT,
        bosulido TEXT,
        kofulido TEXT,
        eslido TEXT,
        caprco1 NUMERIC(18, 4),
        caprco2 NUMERIC(18, 4),
        caprad1 NUMERIC(18, 4),
        caprad2 NUMERIC(18, 4),
        caprnc1 NUMERIC(18, 4),
        caprnc2 NUMERIC(18, 4),
        vaneli NUMERIC(18, 4),
        feemli DATE,
        feerli TIMESTAMP
      )
    `);
    await db.execute(sql`ALTER TABLE ventas.stg_maeddo ADD COLUMN IF NOT EXISTS kofulido TEXT`);
    
    // 2.1 Crear tabla fact_ventas (tabla principal de ventas para análisis)
    console.log('  📋 Verificando tabla fact_ventas...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ventas.fact_ventas (
        id SERIAL PRIMARY KEY,
        idmaeedo NUMERIC(20, 0),
        idmaeddo NUMERIC(20, 0),
        empresa TEXT,
        tido TEXT,
        nudo TEXT,
        feemdo DATE,
        nokoen TEXT,
        koen TEXT,
        endo TEXT,
        koprct TEXT,
        nombre_producto TEXT,
        cantidad1 NUMERIC(18, 4),
        cantidad2 NUMERIC(18, 4),
        vaneli NUMERIC(18, 4),
        feemli DATE,
        nokofu TEXT,
        kofudo TEXT,
        bosulido TEXT,
        noruen TEXT,
        vakoen TEXT,
        vavven TEXT,
        eslido TEXT,
        esdo TEXT,
        feulvedo DATE,
        data_source TEXT,
        last_etl_sync TIMESTAMP
      )
    `);
    
    // Cartera / cuentas por cobrar: abonado + primer vencimiento (saldo = vabrdo - vaabdo).
    // El ETL ya trae estas columnas desde MAEEDO via SELECT *; antes se descartaban.
    // Tolerante a fallos: stg_maeedo/fact_ventas se gestionan vía drizzle push; esto es red de seguridad.
    try {
      await db.execute(sql`ALTER TABLE ventas.stg_maeedo ADD COLUMN IF NOT EXISTS vaabdo NUMERIC(18, 4)`);
      await db.execute(sql`ALTER TABLE ventas.stg_maeedo ADD COLUMN IF NOT EXISTS fe01vedo DATE`);
      await db.execute(sql`ALTER TABLE ventas.fact_ventas ADD COLUMN IF NOT EXISTS vaabdo NUMERIC(20, 0)`);
      await db.execute(sql`ALTER TABLE ventas.fact_ventas ADD COLUMN IF NOT EXISTS fe01vedo DATE`);
    } catch (e: any) {
      console.warn('  ⚠️  Columnas de cartera no agregadas (se crearán vía drizzle push):', e?.message);
    }

    // Agregar índices importantes para fact_ventas
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_ventas_feemdo ON ventas.fact_ventas(feemdo)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_ventas_nokoen ON ventas.fact_ventas(nokoen)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_ventas_koprct ON ventas.fact_ventas(koprct)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_ventas_kofudo ON ventas.fact_ventas(kofudo)`);
    // Composite indexes for dashboard performance (date + filter columns)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_fact_ventas_feemdo_tido ON ventas.fact_ventas(feemdo, tido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_fact_ventas_feemdo_nokofu_tido ON ventas.fact_ventas(feemdo, nokofu, tido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_fact_ventas_feemdo_noruen_tido ON ventas.fact_ventas(feemdo, noruen, tido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_fact_ventas_nokoen_feemdo ON ventas.fact_ventas(nokoen, feemdo)`);

    // 2.2 Tabla cache de precios GRI (costo real desde SQL Server, usado por análisis de margen)
    console.log('  📋 Verificando tabla gri_prices_cache...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gri_prices_cache (
        sku VARCHAR(100) PRIMARY KEY,
        price NUMERIC(18, 6) NOT NULL,
        fecha DATE,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_gri_prices_cache_sku ON gri_prices_cache(sku)`);

    // 2.3 Historial de costos GRI — cada ejecución del ETL Costos agrega un snapshot
    // por SKU; el panel pivota (sku) × (snapshot_at) para mostrar cada precio nuevo
    // como una columna. Solo se inserta si el precio cambió respecto al último snapshot,
    // para no inflar la tabla con duplicados.
    console.log('  📋 Verificando tabla gri_price_history...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gri_price_history (
        id BIGSERIAL PRIMARY KEY,
        sku VARCHAR(100) NOT NULL,
        snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
        price NUMERIC(18, 6) NOT NULL,
        fecha DATE,
        execution_id VARCHAR(100)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_gri_price_history_sku ON gri_price_history(sku)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ix_gri_price_history_snapshot ON gri_price_history(snapshot_at DESC)`);

    // 3. Crear tablas staging de GDV
    console.log('  📋 Verificando tablas de GDV...');
    
    // stg_maeedo_gdv (Encabezados)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_maeedo_gdv (
        idmaeedo NUMERIC(20, 0) PRIMARY KEY,
        empresa TEXT,
        tido TEXT,
        nudo TEXT,
        endo TEXT,
        suendo TEXT,
        endofi TEXT,
        tigedo TEXT,
        sudo TEXT,
        luvtdo TEXT,
        feemdo DATE,
        kofudo TEXT,
        esdo TEXT,
        espgdo TEXT,
        suli TEXT,
        bosulido TEXT,
        feer DATE,
        vanedo NUMERIC(18, 4),
        vaivdo NUMERIC(18, 4),
        vabrdo NUMERIC(18, 4),
        lilg TEXT,
        modo TEXT,
        timodo TEXT,
        tamodo NUMERIC(18, 4),
        ocdo TEXT,
        feulvedo DATE
      )
    `);
    
    // stg_maeddo_gdv (Detalles de líneas)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_maeddo_gdv (
        idmaeddo NUMERIC(20, 0) PRIMARY KEY,
        idmaeedo NUMERIC(20, 0),
        koprct TEXT,
        sulido TEXT,
        bosulido TEXT,
        kofulido TEXT,
        eslido TEXT,
        caprco1 NUMERIC(18, 4),
        caprco2 NUMERIC(18, 4),
        caprad1 NUMERIC(18, 4),
        caprad2 NUMERIC(18, 4),
        caprnc1 NUMERIC(18, 4),
        caprnc2 NUMERIC(18, 4),
        vaneli NUMERIC(18, 4),
        feemli DATE,
        feerli TIMESTAMP,
        devol1 NUMERIC(18, 4),
        devol2 NUMERIC(18, 4),
        stockfis NUMERIC(18, 4),
        nokopr TEXT,
        udtrpr TEXT,
        nulido TEXT,
        luvtlido TEXT,
        preuni NUMERIC(18, 6)
      )
    `);
    // Agregar columnas faltantes por si la tabla ya existía sin ellas
    await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS nokopr TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS udtrpr TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS nulido TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS luvtlido TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS preuni NUMERIC(18, 6)`);
    
    // stg_maeen_gdv (Entidades/Clientes) - TODAS las columnas del esquema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_maeen_gdv (
        koen TEXT PRIMARY KEY,
        nokoen TEXT,
        rut TEXT,
        ruen TEXT,
        zona TEXT,
        kofuen TEXT
      )
    `);
    await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS rut TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS ruen TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS zona TEXT`);
    await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS kofuen TEXT`);
    
    // stg_maepr_gdv (Productos)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_maepr_gdv (
        kopr TEXT PRIMARY KEY,
        nomrpr TEXT,
        nokopr TEXT,
        rupr TEXT,
        ud01pr TEXT,
        ud02pr TEXT,
        tipr TEXT
      )
    `);
    
    // stg_maeven_gdv (Vendedores)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_maeven_gdv (
        kofu TEXT PRIMARY KEY,
        nokofu TEXT
      )
    `);
    
    // stg_tabbo_gdv (Bodegas)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_tabbo_gdv (
        suli TEXT NOT NULL,
        bosuli TEXT NOT NULL,
        nobosuli TEXT,
        PRIMARY KEY (suli, bosuli)
      )
    `);
    
    // stg_tabru_gdv (Segmentos)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.stg_tabru_gdv (
        koru TEXT PRIMARY KEY,
        nokoru TEXT
      )
    `);
    
    // fact_gdv (Tabla de hechos) - TODAS las columnas usadas por ETL
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.fact_gdv (
        idmaeddo NUMERIC(20, 0) PRIMARY KEY,
        idmaeedo NUMERIC(20, 0),
        tido TEXT,
        nudo NUMERIC(20, 0),
        endo TEXT,
        suendo TEXT,
        sudo NUMERIC(20, 0),
        feemdo DATE,
        feulvedo DATE,
        esdo TEXT,
        espgdo TEXT,
        kofudo TEXT,
        modo TEXT,
        timodo TEXT,
        tamodo NUMERIC(18, 6),
        vanedo NUMERIC(18, 4),
        vaivdo NUMERIC(18, 4),
        vabrdo NUMERIC(18, 4),
        lilg TEXT,
        bosulido NUMERIC(20, 0),
        kofulido TEXT,
        koprct TEXT,
        ud01pr TEXT,
        ud02pr TEXT,
        caprco1 NUMERIC(18, 4),
        caprco2 NUMERIC(18, 4),
        caprad1 NUMERIC(18, 4),
        caprad2 NUMERIC(18, 4),
        caprnc1 NUMERIC(18, 4),
        caprnc2 NUMERIC(18, 4),
        vaneli NUMERIC(18, 4),
        feemli TIMESTAMP,
        feerli TIMESTAMP,
        devol1 NUMERIC(18, 4),
        devol2 NUMERIC(18, 4),
        stockfis NUMERIC(18, 4),
        ocdo TEXT,
        nokoprct TEXT,
        nosudo TEXT,
        nokofu TEXT,
        nobosuli TEXT,
        nokoen TEXT,
        noruen TEXT,
        monto NUMERIC(18, 4),
        eslido TEXT,
        cantidad_pendiente BOOLEAN DEFAULT FALSE,
        last_etl_sync TIMESTAMP,
        data_source TEXT
      )
    `);
    // Agregar columnas faltantes si la tabla ya existe
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS suendo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS feulvedo DATE`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS espgdo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS kofudo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS modo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS timodo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS tamodo NUMERIC(18, 6)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS vanedo NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS vaivdo NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS vabrdo NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS ud01pr TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS ud02pr TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprco1 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprco2 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprad1 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprad2 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprnc1 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprnc2 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS feemli TIMESTAMP`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS feerli TIMESTAMP`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS devol1 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS devol2 NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS stockfis NUMERIC(18, 4)`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS ocdo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nokoprct TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nosudo TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nokofu TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nobosuli TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nokoen TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS noruen TEXT`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS cantidad_pendiente BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS last_etl_sync TIMESTAMP`);
    await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS data_source TEXT`);
    
    // gdv_sync_log (Log de sincronización)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.gdv_sync_log (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        status TEXT DEFAULT 'running',
        records_processed INTEGER DEFAULT 0,
        error_message TEXT
      )
    `);
    
    // Migración NVV: Agregar columnas cantidad_pendiente_ud2 y monto_pendiente (reemplaza boolean cantidad_pendiente)
    console.log('  📊 Verificando columnas de cantidad/monto pendiente en NVV...');
    await db.execute(sql`ALTER TABLE nvv.fact_nvv ADD COLUMN IF NOT EXISTS cantidad_pendiente_ud2 NUMERIC(15, 2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE nvv.fact_nvv ADD COLUMN IF NOT EXISTS monto_pendiente NUMERIC(15, 2) DEFAULT 0`);
    
    // 4. Crear índices importantes
    console.log('  🔍 Creando índices...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeddo_kofulido ON ventas.stg_maeddo(kofulido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_idmaeedo ON gdv.stg_maeddo_gdv(idmaeedo)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_kofulido ON gdv.stg_maeddo_gdv(kofulido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeen_gdv_rut ON gdv.stg_maeen_gdv(rut)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_gdv_kofulido ON gdv.fact_gdv(kofulido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_gdv_feemdo ON gdv.fact_gdv(feemdo)`);
    
    // 7. Agregar columnas de firma a visitas_tecnicas si no existen
    console.log('  ✏️ Verificando columnas de firmas en visitas técnicas...');
    await db.execute(sql`ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS firma_tecnico_nombre TEXT`);
    await db.execute(sql`ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS firma_tecnico_data TEXT`);
    await db.execute(sql`ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS firma_recepcionista_data TEXT`);
    await db.execute(sql`ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS fecha_firma TIMESTAMP`);
    
    // 8. Crear tabla loyalty_tiers si no existe (Panoramica Market)
    console.log('  🏆 Verificando tabla de tiers de lealtad...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS loyalty_tiers (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(255) NOT NULL,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        descripcion TEXT,
        monto_minimo NUMERIC(15, 2) NOT NULL DEFAULT 0,
        periodo_evaluacion_dias INTEGER NOT NULL DEFAULT 90,
        color_primario VARCHAR(20),
        color_secundario VARCHAR(20),
        icono VARCHAR(50),
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Crear tabla loyalty_tier_benefits si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS loyalty_tier_benefits (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        tier_id VARCHAR(255) NOT NULL REFERENCES loyalty_tiers(id) ON DELETE CASCADE,
        titulo VARCHAR(255) NOT NULL,
        descripcion TEXT,
        tipo VARCHAR(50) NOT NULL DEFAULT 'beneficio',
        valor VARCHAR(255),
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 9. Seed loyalty tiers (Panoramica Market) if they don't exist
    console.log('  🏆 Verificando datos de tiers de Panoramica Market...');
    const existingTiers = await db.execute(sql`SELECT COUNT(*) as count FROM loyalty_tiers`);
    const tierCount = Number(existingTiers.rows[0]?.count) || 0;
    
    if (tierCount === 0) {
      console.log('  🏆 Creando tiers de Panoramica Market...');
      await db.execute(sql`
        INSERT INTO loyalty_tiers (id, nombre, codigo, descripcion, monto_minimo, periodo_evaluacion_dias, color_primario, color_secundario, icono, orden, activo)
        VALUES 
          (gen_random_uuid(), 'Panoramica Lider', 'lider', 'Clientes con compras de al menos $1.500.000 en los últimos 90 días', 1500000.00, 90, '#3B82F6', '#DBEAFE', 'Award', 1, true),
          (gen_random_uuid(), 'Panoramica Gold', 'gold', 'Clientes con compras de al menos $5.000.000 en los últimos 90 días', 5000000.00, 90, '#F59E0B', '#FEF3C7', 'Star', 2, true),
          (gen_random_uuid(), 'Panoramica Platinum', 'platinum', 'Clientes con compras de al menos $15.000.000 en los últimos 90 días', 15000000.00, 90, '#8B5CF6', '#EDE9FE', 'Crown', 3, true)
      `);
      console.log('  ✅ Tiers de Panoramica Market creados');
    } else {
      console.log('  ✓ Tiers de Panoramica Market ya existen');
    }
    
    // 10. Crear tabla productos_monitoreo para precios de competencia
    console.log('  📊 Verificando tabla de productos a monitorear...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS productos_monitoreo (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre_producto VARCHAR(255) NOT NULL,
        formato VARCHAR(100),
        precio_lista NUMERIC(15, 2),
        activo BOOLEAN DEFAULT true,
        created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_productos_monitoreo_nombre" ON productos_monitoreo (nombre_producto)`);
    
    // Agregar columna producto_monitoreo_id a precios_competencia si no existe
    await db.execute(sql`ALTER TABLE precios_competencia ADD COLUMN IF NOT EXISTS producto_monitoreo_id VARCHAR(255) REFERENCES productos_monitoreo(id) ON DELETE CASCADE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_precios_competencia_producto" ON precios_competencia (producto_monitoreo_id)`);
    // Actualizar la tabla para usar el nuevo sistema: sku opcional, productoMonitoreoId obligatorio
    await db.execute(sql`ALTER TABLE precios_competencia ALTER COLUMN sku DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE precios_competencia ALTER COLUMN producto_monitoreo_id SET NOT NULL`);
    // Agregar columnas de precios por canal (Web, Ferretería, Construcción)
    await db.execute(sql`ALTER TABLE precios_competencia ADD COLUMN IF NOT EXISTS precio_web NUMERIC(15, 2)`);
    await db.execute(sql`ALTER TABLE precios_competencia ADD COLUMN IF NOT EXISTS precio_ferreteria NUMERIC(15, 2)`);
    await db.execute(sql`ALTER TABLE precios_competencia ADD COLUMN IF NOT EXISTS precio_construccion NUMERIC(15, 2)`);
    
    // Tabla de fondos recurrentes
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fund_recurring_configs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        assigned_to_id VARCHAR NOT NULL,
        assigned_by_id VARCHAR NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        monto_mensual NUMERIC(15, 2) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_processed_month VARCHAR(7),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_fund_recurring_assigned_to" ON fund_recurring_configs (assigned_to_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_fund_recurring_active" ON fund_recurring_configs (is_active)`);
    await db.execute(sql`ALTER TABLE fund_allocations ADD COLUMN IF NOT EXISTS recurring_config_id VARCHAR`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_fund_allocations_recurring_config" ON fund_allocations (recurring_config_id)`);

    // 11. Crear tabla price_list_mix (Lista de Precios Mix - solo SKU + precio)
    console.log('  💲 Verificando tabla price_list_mix...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS price_list_mix (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        codigo VARCHAR NOT NULL UNIQUE,
        precio NUMERIC(15, 2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_price_list_mix_codigo ON price_list_mix(codigo)`);

    // 11b. Crear tablas custom_price_lists y custom_price_list_items (sistema multi-lista generalizado)
    console.log('  💲 Verificando tablas custom_price_lists...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS custom_price_lists (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR NOT NULL UNIQUE,
        name VARCHAR NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS custom_price_list_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        list_code VARCHAR NOT NULL,
        codigo VARCHAR NOT NULL,
        precio NUMERIC(15, 2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(list_code, codigo)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cpli_list_code ON custom_price_list_items(list_code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cpli_codigo ON custom_price_list_items(codigo)`);

    // Asegurar que existe la lista LP02 (Lista Mix) y migrar datos desde price_list_mix si existen
    await db.execute(sql`
      INSERT INTO custom_price_lists (code, name, active)
      SELECT 'LP02', 'Lista Mix', true
      WHERE NOT EXISTS (SELECT 1 FROM custom_price_lists WHERE code = 'LP02')
    `);
    // Migrar items de price_list_mix a custom_price_list_items si no se ha hecho
    await db.execute(sql`
      INSERT INTO custom_price_list_items (list_code, codigo, precio)
      SELECT 'LP02', codigo, precio FROM price_list_mix
      ON CONFLICT (list_code, codigo) DO NOTHING
    `);

    // 12. Add client_rut and client_id to salespeople_users for linking client users to business entities
    console.log('  🔗 Verificando columnas client_rut y client_id en salespeople_users...');
    await db.execute(sql`ALTER TABLE salespeople_users ADD COLUMN IF NOT EXISTS client_rut VARCHAR`);
    await db.execute(sql`ALTER TABLE salespeople_users ADD COLUMN IF NOT EXISTS client_id VARCHAR`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_salespeople_client_id ON salespeople_users(client_id)`);

    // 12b. Ensure clients table has all schema-defined columns (parent_client_id, branch_label, pickup_warehouse_id)
    console.log('  🔗 Verificando columnas adicionales en clients...');
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_client_id VARCHAR`);
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_label VARCHAR`);
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS pickup_warehouse_id VARCHAR`);
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_salesperson_user_id VARCHAR`);
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id VARCHAR`);
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS purchasing_contact_name TEXT`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_clients_parent" ON clients(parent_client_id)`);

    // 13. Ensure store_config has all required columns (ad_settings, checkout_settings)
    console.log('  🛒 Verificando columnas de store_config...');
    await db.execute(sql`ALTER TABLE store_config ADD COLUMN IF NOT EXISTS ad_settings JSONB DEFAULT '{"desktopFrequency": 6, "mobileFrequency": 4}'::jsonb`);
    await db.execute(sql`ALTER TABLE store_config ADD COLUMN IF NOT EXISTS checkout_settings JSONB DEFAULT '{}'::jsonb`);

    // 14. Create ecommerce_coupons table if not exists
    console.log('  🎟️ Verificando tabla ecommerce_coupons...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ecommerce_coupons (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR NOT NULL UNIQUE,
        description VARCHAR,
        discount_type VARCHAR NOT NULL,
        discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
        applies_to VARCHAR NOT NULL DEFAULT 'cart',
        product_sku VARCHAR,
        min_order_amount NUMERIC(10, 2) DEFAULT 0,
        max_uses INTEGER DEFAULT NULL,
        times_used INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        expires_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ecommerce_coupons_code ON ecommerce_coupons(UPPER(code))`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ecommerce_coupons_active ON ecommerce_coupons(is_active)`);
    // Asegurar columnas en ecommerce_coupons (idempotente: cubre tablas creadas con esquema antiguo)
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS description VARCHAR`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS discount_type VARCHAR`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS applies_to VARCHAR NOT NULL DEFAULT 'cart'`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS product_sku VARCHAR`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT NULL`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS times_used INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT NULL`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    // discount_type debe ser NOT NULL — si quedó nullable de un esquema previo, forzar default y NOT NULL
    await db.execute(sql`UPDATE ecommerce_coupons SET discount_type = 'percentage' WHERE discount_type IS NULL`);
    await db.execute(sql`ALTER TABLE ecommerce_coupons ALTER COLUMN discount_type SET NOT NULL`);
    // 15. Crear tabla crm_ayuda_memoria si no existe
    console.log('  📝 Verificando tabla crm_ayuda_memoria...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_ayuda_memoria (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        cliente_seguimiento_id VARCHAR,
        cliente_nombre TEXT NOT NULL,
        rut VARCHAR,
        giro TEXT,
        direccion TEXT,
        ciudad VARCHAR,
        tipo_cliente VARCHAR,
        contacto_principal TEXT,
        telefono_contacto VARCHAR,
        email_contacto VARCHAR,
        productos_interes TEXT,
        frecuencia_compra VARCHAR,
        condiciones_pago TEXT,
        competencia TEXT,
        fortalezas TEXT,
        debilidades TEXT,
        oportunidades TEXT,
        observaciones TEXT,
        creado_por VARCHAR NOT NULL,
        creado_por_nombre TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_cliente" ON crm_ayuda_memoria (cliente_seguimiento_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_creado_por" ON crm_ayuda_memoria (creado_por)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ayuda_mem_created" ON crm_ayuda_memoria (created_at)`);

    // 15.05. Módulo de Campañas de Marketing (mailing masivo con Resend).
    // Ver migrations/064_email_campaigns.sql — se replica acá porque el runner
    // de migraciones no es confiable en producción.
    console.log('  📧 Verificando tablas de Campañas (mailing)...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_campaign_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        subject VARCHAR,
        preheader VARCHAR,
        body_html TEXT NOT NULL,
        created_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaign_templates_name" ON email_campaign_templates (name)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        subject VARCHAR NOT NULL,
        preheader VARCHAR,
        from_name VARCHAR,
        reply_to VARCHAR,
        body_html TEXT NOT NULL DEFAULT '',
        status VARCHAR NOT NULL DEFAULT 'draft',
        scheduled_at TIMESTAMP,
        total_recipients INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        register_in_crm BOOLEAN NOT NULL DEFAULT false,
        created_by VARCHAR,
        started_at TIMESTAMP,
        sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_status" ON email_campaigns (status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_scheduled_at" ON email_campaigns (scheduled_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_created_at" ON email_campaigns (created_at)`);
    // Ver migrations/066_email_campaigns_archived.sql — archivar saca la campaña
    // de la lista sin borrar su historial. Mismo motivo que source_detail:
    // Drizzle la enumera en cada SELECT, tiene que existir sí o sí.
    await db.execute(sql`ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaigns_archived" ON email_campaigns (archived)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_campaign_recipients (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id VARCHAR NOT NULL,
        email VARCHAR NOT NULL,
        name VARCHAR,
        source VARCHAR NOT NULL DEFAULT 'manual',
        source_id VARCHAR,
        status VARCHAR NOT NULL DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaign_recipients_campaign" ON email_campaign_recipients (campaign_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaign_recipients_status" ON email_campaign_recipients (status)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "email_campaign_recipients_campaign_email_unique" ON email_campaign_recipients (campaign_id, email)`);
    // Ver migrations/065_campaign_recipient_source_detail.sql — evidencia del
    // origen de cada destinatario. Drizzle enumera todas las columnas en cada
    // SELECT, así que debe existir antes de servir tráfico de campañas.
    await db.execute(sql`ALTER TABLE email_campaign_recipients ADD COLUMN IF NOT EXISTS source_detail VARCHAR`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_email_campaign_recipients_source" ON email_campaign_recipients (source)`);

    // 15.1. Etiquetas libres del cliente en seguimiento (JSON array en texto).
    // Drizzle enumera todas las columnas del schema en cada SELECT, así que
    // esta columna DEBE existir antes de servir tráfico del CRM.
    console.log('  🏷️  Verificando columna etiquetas en crm_seguimiento_clientes...');
    await db.execute(sql`ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS etiquetas TEXT`);

    // 15.1.b Cotizador web: segmento del visitante + lead ruteado al CRM.
    // Ver migrations/072_quote_requests_segmento.sql — se replica acá porque
    // Drizzle enumera todas las columnas del schema en cada SELECT y el
    // cotizador público sirve tráfico desde el primer request. IF EXISTS
    // porque quote_requests se crea auto-sanándose en su propio service.
    console.log('  🧾 Verificando columnas segmento/crm en quote_requests...');
    await db.execute(sql`ALTER TABLE IF EXISTS quote_requests ADD COLUMN IF NOT EXISTS segmento VARCHAR`);
    await db.execute(sql`ALTER TABLE IF EXISTS quote_requests ADD COLUMN IF NOT EXISTS crm_seguimiento_id VARCHAR`);

    // 15.2. Hitos/bitácora agendados en calendario (card Actividad del CRM).
    // Mismo motivo que etiquetas: Drizzle enumera todas las columnas del
    // schema en cada SELECT, así que deben existir antes de servir tráfico.
    console.log('  📅 Verificando columna fecha_programada en hitos y bitácora...');
    await db.execute(sql`ALTER TABLE crm_seguimiento_hitos ADD COLUMN IF NOT EXISTS fecha_programada TIMESTAMP`);
    await db.execute(sql`ALTER TABLE pedido_bitacora ADD COLUMN IF NOT EXISTS fecha_programada TIMESTAMP`);

    // 16. Crear tabla user_branch_assignments (relación muchos-a-muchos usuario ↔ sucursal)
    console.log('  🔗 Verificando tabla user_branch_assignments...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_branch_assignments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        client_id VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_uba_user" ON user_branch_assignments (user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_uba_client" ON user_branch_assignments (client_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_uba_user_client" ON user_branch_assignments (user_id, client_id)`);

    // Seed: poblar desde salespeople_users.client_id existentes (migrar relación 1:1 a muchos-a-muchos)
    await db.execute(sql`
      INSERT INTO user_branch_assignments (user_id, client_id)
      SELECT id, client_id FROM salespeople_users
      WHERE client_id IS NOT NULL AND role = 'client'
      ON CONFLICT (user_id, client_id) DO NOTHING
    `);

    // Asegurar columnas de ingreso en ecommerce_orders (recepción)
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS ingresado_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS ingresado_by_id VARCHAR`);
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS ingresado_notes TEXT`);

    // Migración 051: descarte de pedido con motivo (recepción/admin)
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS rejected_by_id VARCHAR`);
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS rejected_reason TEXT`);

    // Migración 045: descuento de sucursal y lista de precios usada en cada pedido eCommerce
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS branch_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE ecommerce_orders ADD COLUMN IF NOT EXISTS price_list_used VARCHAR`);

    // Asegurar columna destacado en crm_seguimiento_clientes (migración 044 — idempotente)
    await db.execute(sql`ALTER TABLE crm_seguimiento_clientes ADD COLUMN IF NOT EXISTS destacado BOOLEAN DEFAULT FALSE NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_crm_seg_destacado" ON crm_seguimiento_clientes (destacado) WHERE destacado = TRUE`);

    // tracking_settings en store_config (Google Ads / Meta Pixel para catálogo)
    await db.execute(sql`ALTER TABLE store_config ADD COLUMN IF NOT EXISTS tracking_settings JSONB DEFAULT '{}'::jsonb`);

    // slug en ecommerce_products (URL única por producto)
    await db.execute(sql`ALTER TABLE ecommerce_products ADD COLUMN IF NOT EXISTS slug VARCHAR`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ecommerce_products_slug" ON ecommerce_products(slug) WHERE slug IS NOT NULL`);

    // Migración 046: galería de fotos promocionales por producto (catálogo público)
    await db.execute(sql`ALTER TABLE product_content ADD COLUMN IF NOT EXISTS fotos_promocionales JSONB DEFAULT '[]'::jsonb`);

    // Migración 047: metadata de envío de cotización + tracking de ingreso a ERP por recepción
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_to_finance_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS oc_number VARCHAR`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS segment VARCHAR`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_method VARCHAR`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS scope TEXT`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assigned_salesperson_id VARCHAR`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_entered BOOLEAN DEFAULT FALSE NOT NULL`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_entered_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_entered_by_id VARCHAR`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS erp_notes TEXT`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_quotes_sent_to_finance_at" ON quotes (sent_to_finance_at) WHERE sent_to_finance_at IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_quotes_erp_entered" ON quotes (erp_entered) WHERE erp_entered = FALSE AND sent_to_finance_at IS NOT NULL`);

    // Migración 057: pallet como oferta. Extiende price_list_offers para soportar
    // ofertas de pallet (cantidad + % descuento). Migra los SKUs con
    // ecommerce_products.pallet_enabled=true a filas de oferta tipo 'pallet'.
    await db.execute(sql`ALTER TABLE price_list_offers ADD COLUMN IF NOT EXISTS offer_type VARCHAR NOT NULL DEFAULT 'regular'`);
    await db.execute(sql`ALTER TABLE price_list_offers ADD COLUMN IF NOT EXISTS units_per_pallet INTEGER`);
    await db.execute(sql`ALTER TABLE price_list_offers ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2)`);
    await db.execute(sql`ALTER TABLE price_list_offers DROP CONSTRAINT IF EXISTS price_list_offers_offer_type_check`);
    await db.execute(sql`ALTER TABLE price_list_offers ADD CONSTRAINT price_list_offers_offer_type_check CHECK (offer_type IN ('regular','pallet'))`);
    await db.execute(sql`ALTER TABLE price_list_offers DROP CONSTRAINT IF EXISTS price_list_offers_discount_pct_range`);
    await db.execute(sql`ALTER TABLE price_list_offers ADD CONSTRAINT price_list_offers_discount_pct_range CHECK (discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100))`);
    // Reemplazar UNIQUE(codigo) por UNIQUE(codigo, offer_type) para permitir
    // que un SKU tenga una oferta regular y una de pallet en paralelo.
    await db.execute(sql`ALTER TABLE price_list_offers DROP CONSTRAINT IF EXISTS price_list_offers_codigo_unique`);
    await db.execute(sql`ALTER TABLE price_list_offers DROP CONSTRAINT IF EXISTS price_list_offers_codigo_key`);
    await db.execute(sql`ALTER TABLE price_list_offers DROP CONSTRAINT IF EXISTS price_list_offers_codigo_type_unique`);
    await db.execute(sql`ALTER TABLE price_list_offers ADD CONSTRAINT price_list_offers_codigo_type_unique UNIQUE (codigo, offer_type)`);

    // Backfill idempotente: para cada SKU con pallet_enabled=true en
    // ecommerce_products que NO tenga ya una fila pallet en offers, crear una.
    // Hereda all_clients=true (la implementación previa no tenía targeting).
    await db.execute(sql`
      INSERT INTO price_list_offers (codigo, offer_type, units_per_pallet, discount_pct, paused, all_clients)
      SELECT
        pl.codigo,
        'pallet',
        COALESCE(ep.packaging_amount_per_pallet, NULL),
        ep.pallet_discount_pct,
        false,
        true
      FROM ecommerce_products ep
      JOIN price_list pl ON pl.id = ep.price_list_id
      WHERE ep.pallet_enabled = true
        AND pl.codigo IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM price_list_offers o
          WHERE o.codigo = pl.codigo AND o.offer_type = 'pallet'
        )
    `);

    // Paleta de colores del catálogo (hex por nombre de color).
    // Se crea en runtime porque el runner de migraciones no es confiable en prod.
    console.log('  🎨 Verificando paleta de colores...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS color_palette (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre_color TEXT NOT NULL,
        hex VARCHAR(32) NOT NULL DEFAULT '#cbd5e1',
        updated_by VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Único case-insensitive para que "Blanco" y "BLANCO" no dupliquen.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_color_palette_nombre"
      ON color_palette (UPPER(TRIM(nombre_color)))
    `);
    // Auto-puebla la paleta con los colores reales del catálogo, asignando un
    // hex aproximado por nombre. Es idempotente (ON CONFLICT DO NOTHING): solo
    // agrega colores nuevos, nunca pisa lo que el admin haya editado.
    await db.execute(sql`
      INSERT INTO color_palette (nombre_color, hex)
      SELECT DISTINCT ON (UPPER(TRIM(ep.color))) TRIM(ep.color), ${COLOR_HEX_CASE_SQL}
      FROM ecommerce_products ep
      WHERE ep.color IS NOT NULL AND TRIM(ep.color) <> ''
      ORDER BY UPPER(TRIM(ep.color))
      ON CONFLICT DO NOTHING
    `);

    // Vínculo gasto de marketing → ítem de presupuesto (comparar presupuestado
    // vs. real). Additive e idempotente; el runner de migraciones no es
    // confiable en prod, por eso se aplica en runtime.
    console.log('  🔗 Verificando vínculo gastos_marketing → presupuesto...');
    await db.execute(sql`
      ALTER TABLE gastos_marketing
      ADD COLUMN IF NOT EXISTS presupuesto_item_id VARCHAR(255)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_gastos_marketing_presupuesto_item"
      ON gastos_marketing (presupuesto_item_id)
    `);

    // gastos_marketing.creado_por_id tiene un FK a users.id, pero el rol "marketing"
    // (p. ej. Sofía) vive en salespeople_users, cuyo id NO existe en users → al registrar
    // un gasto el INSERT reventaba con violación de FK (500) y el usuario veía "no puedo
    // registrar el gasto". Es el mismo bug que solicitudes_marketing.supervisor_id pero en
    // dirección inversa. El id es un identificador de creador cross-tabla, no una referencia
    // estricta; se elimina el constraint (idempotente; se cubren ambos nombres posibles: el
    // default de Postgres *_fkey y el que genera drizzle *_users_id_fk).
    console.log('  🔗 Soltando FK obsoleto gastos_marketing.creado_por_id...');
    await db.execute(sql`
      ALTER TABLE gastos_marketing
      DROP CONSTRAINT IF EXISTS gastos_marketing_creado_por_id_fkey
    `);
    await db.execute(sql`
      ALTER TABLE gastos_marketing
      DROP CONSTRAINT IF EXISTS gastos_marketing_creado_por_id_users_id_fk
    `);

    // solicitudes_marketing.supervisor_id tenía un FK a salespeople_users.id, pero el
    // "solicitante" (admin/supervisor/encargado) suele vivir en la tabla users, cuyo id
    // NO existe en salespeople_users → el INSERT reventaba con violación de FK (500) y el
    // usuario veía "no se pudo enviar la solicitud". El id es un identificador de solicitante
    // cross-tabla, no una referencia estricta; se elimina el constraint (idempotente).
    console.log('  🔗 Soltando FK obsoleto solicitudes_marketing.supervisor_id...');
    await db.execute(sql`
      ALTER TABLE solicitudes_marketing
      DROP CONSTRAINT IF EXISTS solicitudes_marketing_supervisor_id_salespeople_users_id_fk
    `);

    // Una solicitud de Marketing puede originarse en un vendedor (cuando un cliente le pide
    // algo) además del supervisor/encargado. Guardamos el rol del solicitante y, opcionalmente,
    // el cliente de origen para que Marketing sepa para quién es el pedido.
    console.log('  🏷️  Verificando columnas de origen en solicitudes_marketing...');
    await db.execute(sql`ALTER TABLE solicitudes_marketing ADD COLUMN IF NOT EXISTS solicitante_rol VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE solicitudes_marketing ADD COLUMN IF NOT EXISTS cliente_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE solicitudes_marketing ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255)`);

    // El Panel de Trabajo se navega por ÁREA, pero la bandeja de solicitudes de la pestaña
    // Marketing mostraba TODAS las solicitudes en cualquier área. `segmento` atribuye cada
    // pedido al área desde la que se envió para poder acotarla (ver migración 067).
    await db.execute(sql`ALTER TABLE solicitudes_marketing ADD COLUMN IF NOT EXISTS segmento VARCHAR(255)`);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_solicitudes_marketing_segmento"
      ON solicitudes_marketing (segmento)
    `);
    // Backfill idempotente de las solicitudes previas a la columna: se deduce el área del
    // solicitante (su segmento asignado o, si no tiene, el de su equipo de vendedores).
    // assigned_segment es texto libre ("CONSTRUCCION", "Ferreterías"...) → prefijo sin tildes.
    await db.execute(sql`
      WITH segmento_usuario AS (
        SELECT
          u.id,
          COALESCE(
            CASE
              WHEN LOWER(u.assigned_segment) LIKE '%ferreter%' THEN 'ferreterias'
              WHEN LOWER(u.assigned_segment) LIKE '%construc%' THEN 'construccion'
              WHEN LOWER(u.assigned_segment) LIKE '%digital%'
                OR LOWER(u.assigned_segment) LIKE '%industrial%' THEN 'digital'
            END,
            (
              SELECT CASE
                WHEN LOWER(sp.assigned_segment) LIKE '%ferreter%' THEN 'ferreterias'
                WHEN LOWER(sp.assigned_segment) LIKE '%construc%' THEN 'construccion'
                WHEN LOWER(sp.assigned_segment) LIKE '%digital%'
                  OR LOWER(sp.assigned_segment) LIKE '%industrial%' THEN 'digital'
              END
              FROM salespeople_users sp
              WHERE sp.supervisor_id = u.id
                AND sp.assigned_segment IS NOT NULL
              LIMIT 1
            )
          ) AS segmento
        FROM salespeople_users u
      )
      UPDATE solicitudes_marketing s
      SET segmento = su.segmento
      FROM segmento_usuario su
      WHERE s.supervisor_id = su.id
        AND s.segmento IS NULL
        AND su.segmento IS NOT NULL
    `);

    // Promesas de compra: el cumplimiento se considera desde la NVV, pero nvv.fact_nvv
    // solo conserva líneas abiertas (al facturarse, la NVV desaparece y la GDV puede caer
    // en otra semana) → sin memoria, el vendido de una semana decae a "solo lo facturado".
    // ventas_reales_max guarda el mejor valor calculado y evita ese retroceso.
    console.log('  🤝 Verificando columna ventas_reales_max en promesas_compra...');
    await db.execute(sql`
      ALTER TABLE promesas_compra
      ADD COLUMN IF NOT EXISTS ventas_reales_max NUMERIC(15, 2)
    `);

    // Rutas comerciales (runtime bootstrap — el runner de migraciones no es confiable en prod).
    console.log('  🧭 Verificando tablas de rutas comerciales...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rutas_comerciales (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(255) NOT NULL,
        vendedor_id VARCHAR(255) NOT NULL,
        supervisor_id VARCHAR(255) NOT NULL,
        segmento VARCHAR(255),
        estado VARCHAR(255) NOT NULL DEFAULT 'activa',
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_rutas_comerciales_vendedor" ON rutas_comerciales (vendedor_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_rutas_comerciales_supervisor" ON rutas_comerciales (supervisor_id)`);
    // Fecha planificada del recorrido (columna nueva sobre tablas existentes)
    await db.execute(sql`ALTER TABLE rutas_comerciales ADD COLUMN IF NOT EXISTS fecha TIMESTAMP`);
    // Vendedores asignados a una ruta (N a N)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ruta_vendedores (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        ruta_id VARCHAR(255) NOT NULL,
        vendedor_id VARCHAR(255) NOT NULL,
        vendedor_nombre VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ruta_vendedores_ruta" ON ruta_vendedores (ruta_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ruta_vendedores_vendedor" ON ruta_vendedores (vendedor_id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ruta_clientes (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        ruta_id VARCHAR(255) NOT NULL,
        cliente_id VARCHAR(255) NOT NULL,
        cliente_nombre VARCHAR(255) NOT NULL,
        orden INTEGER DEFAULT 0,
        visitado BOOLEAN DEFAULT FALSE,
        fecha_visita TIMESTAMP,
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ruta_clientes_ruta" ON ruta_clientes (ruta_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ruta_clientes_cliente" ON ruta_clientes (cliente_id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ruta_visitas (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        ruta_id VARCHAR(255) NOT NULL,
        cliente_id VARCHAR(255) NOT NULL,
        cliente_nombre VARCHAR(255),
        fecha TIMESTAMP NOT NULL,
        nota TEXT,
        registrado_por VARCHAR(255),
        registrado_por_nombre VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ruta_visitas_cliente" ON ruta_visitas (cliente_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_ruta_visitas_ruta" ON ruta_visitas (ruta_id)`);
    // Evidencia de la visita al completar la ruta: foto (URL en object storage) + geolocalización.
    await db.execute(sql`ALTER TABLE ruta_visitas ADD COLUMN IF NOT EXISTS imagen_url TEXT`);
    await db.execute(sql`ALTER TABLE ruta_visitas ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7)`);
    await db.execute(sql`ALTER TABLE ruta_visitas ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_actividades (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id VARCHAR(255) NOT NULL,
        tipo VARCHAR(255) NOT NULL,
        descripcion TEXT,
        fecha TIMESTAMP,
        estado VARCHAR(255) NOT NULL DEFAULT 'pendiente',
        responsable_id VARCHAR(255),
        responsable_nombre VARCHAR(255),
        ruta_id VARCHAR(255),
        ruta_nombre VARCHAR(255),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_task_actividades_task" ON task_actividades (task_id)`);
    // Columnas de ruta (idempotente, para tablas ya creadas)
    await db.execute(sql`ALTER TABLE task_actividades ADD COLUMN IF NOT EXISTS ruta_id VARCHAR(255)`);
    await db.execute(sql`ALTER TABLE task_actividades ADD COLUMN IF NOT EXISTS ruta_nombre VARCHAR(255)`);
    // Backfill: los seguimientos de cliente creados antes del cambio "Fecha de Revisión"
    // tienen due_date pero ninguna actividad que la refleje en "Tareas del cliente".
    // Se les crea la actividad 'revision' una sola vez (NOT EXISTS la hace idempotente);
    // los nuevos registros los mantiene sincronizados el endpoint de tareas.
    try {
      await db.execute(sql`
        INSERT INTO task_actividades (task_id, tipo, descripcion, fecha, estado)
        SELECT t.id, 'revision', 'Revisión del cliente', t.due_date, 'pendiente'
        FROM tasks t
        WHERE t.payload->>'kind' = 'seguimiento_cliente'
          AND t.due_date IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM task_actividades a WHERE a.task_id = t.id AND a.tipo = 'revision'
          )
      `);
    } catch (err: any) {
      // No frena el bootstrap: en una BD fresca la tabla tasks puede no existir todavía.
      console.warn('  ⚠️ Backfill de actividades de revisión omitido:', err.message);
    }

    // Inventario de Marketing — estas tablas solo viven en la migración drizzle 0000,
    // que el runner de migraciones roto no aplica en prod. Sin ellas, /api/marketing/inventario
    // y /summary lanzan 500 y el tab se ve vacío ("Sin items en inventario") aún para admin.
    console.log('  📋 Verificando tablas de inventario de marketing...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventario_marketing (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        cantidad INTEGER NOT NULL DEFAULT 0,
        unidad VARCHAR(50) NOT NULL DEFAULT 'unidades',
        ubicacion VARCHAR(255),
        costo_unitario NUMERIC(15, 2),
        proveedor VARCHAR(255),
        estado VARCHAR NOT NULL DEFAULT 'disponible',
        stock_minimo INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventario_marketing_movimientos (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id VARCHAR NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        cantidad INTEGER NOT NULL,
        usuario_id VARCHAR,
        usuario_nombre VARCHAR,
        cliente_nombre VARCHAR(255),
        nota TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Columna cliente_nombre (idempotente, para tablas ya creadas sin la migración 061)
    await db.execute(sql`ALTER TABLE inventario_marketing_movimientos ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(255)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_inv_marketing_mov_item" ON inventario_marketing_movimientos (item_id)`);

    // Panel de Trabajo: change-log por sección + marcadores de visto por usuario
    // (migración 062 — runtime bootstrap porque el runner no es confiable en prod).
    console.log('  🔔 Verificando tablas de cambios del Panel de Trabajo...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS panel_change_log (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        section VARCHAR(30) NOT NULL,
        segmento VARCHAR(30),
        entity_type VARCHAR(40) NOT NULL,
        entity_id VARCHAR,
        action VARCHAR(30) NOT NULL,
        title TEXT NOT NULL,
        user_id VARCHAR NOT NULL,
        user_name VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_panel_change_log_created_at" ON panel_change_log (created_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_panel_change_log_section" ON panel_change_log (section)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS panel_change_seen (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        section VARCHAR(30) NOT NULL,
        segmento VARCHAR(30) NOT NULL DEFAULT '__all',
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT panel_change_seen_unique UNIQUE (user_id, section, segmento)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_panel_change_seen_user_id" ON panel_change_seen (user_id)`);

    // Web Push (PWA): suscripciones por dispositivo para notificaciones push
    // (migración 063 — runtime bootstrap porque el runner no es confiable en prod).
    console.log('  📲 Verificando tabla de suscripciones Web Push...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT now(),
        last_used_at TIMESTAMP DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_user_id" ON push_subscriptions (user_id)`);

    // Obras: control de avance por obra para la pestaña "Obras" del Panel de Trabajo
    // (migración 068 — runtime bootstrap porque el runner no es confiable en prod).
    console.log('  🏗️  Verificando columnas de control de obras...');
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS ciudad TEXT`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS programa VARCHAR(30)`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS temporada VARCHAR(20)`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS viviendas INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_por_vivienda NUMERIC(5, 2) NOT NULL DEFAULT 1.5`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_proyectadas INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS viviendas_pintadas INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_utilizadas_real NUMERIC(10, 2) NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_pedidas INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tinetas_entregadas INTEGER NOT NULL DEFAULT 0`);
    // La obra se identifica por ciudad; la dirección postal suele no existir aún.
    await db.execute(sql`ALTER TABLE obras ALTER COLUMN direccion DROP NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obras_cliente_id" ON obras (cliente_id)`);

    // Detalle de productos por obra (migración 069). Acompaña al control de
    // tinetas: por SKU se lleva proyectado / pedido / entregado / utilizado.
    console.log('  🎨 Verificando tabla de productos por obra...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS obra_productos (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        obra_id VARCHAR NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
        kopr VARCHAR(60),
        nombre TEXT NOT NULL,
        color VARCHAR(80),
        unidad VARCHAR(20) NOT NULL DEFAULT 'tineta',
        cantidad_proyectada NUMERIC(12, 2) NOT NULL DEFAULT 0,
        cantidad_pedida NUMERIC(12, 2) NOT NULL DEFAULT 0,
        cantidad_entregada NUMERIC(12, 2) NOT NULL DEFAULT 0,
        cantidad_utilizada NUMERIC(12, 2) NOT NULL DEFAULT 0,
        notas TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obra_productos_obra_id" ON obra_productos (obra_id)`);

    // Historial de movimientos de cada producto de obra (migración 070): el
    // detalle de pedidos, entregas y consumos detrás del acumulado de arriba.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS obra_producto_movimientos (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        obra_producto_id VARCHAR NOT NULL REFERENCES obra_productos(id) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL,
        cantidad NUMERIC(12, 2) NOT NULL,
        fecha DATE,
        nota TEXT,
        creado_por VARCHAR,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obra_prod_mov_producto" ON obra_producto_movimientos (obra_producto_id)`);

    // Tipo de obra, tipos de vivienda y etapas constructivas (migración 071).
    // Una obra deja de ser "N viviendas": se declara si es casas o edificios y
    // se desglosa en modelos, porque cada uno rinde distinto.
    console.log('  🏘️  Verificando tipos de vivienda y etapas de obra...');
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS tipo_obra VARCHAR(20) NOT NULL DEFAULT 'casas'`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS torres INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS etapa VARCHAR(60)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS obra_tipos_vivienda (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        obra_id VARCHAR NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
        nombre TEXT NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 0,
        metros_cuadrados NUMERIC(8, 2),
        orden INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obra_tipos_vivienda_obra_id" ON obra_tipos_vivienda (obra_id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS obra_etapas (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre TEXT NOT NULL UNIQUE,
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    // Las tres etapas que usa Construcción; el resto las agrega el supervisor.
    await db.execute(sql`
      INSERT INTO obra_etapas (nombre, orden) VALUES
        ('Fundaciones', 1), ('Obra gruesa', 2), ('Terminaciones', 3)
      ON CONFLICT (nombre) DO NOTHING
    `);
    // El avance baja a nivel de producto: cada SKU tiene su rendimiento y sus
    // viviendas pintadas (el sellador no avanza al ritmo de la fachada).
    await db.execute(sql`ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS rendimiento_por_vivienda NUMERIC(8, 2) NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS viviendas_pintadas INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE obra_productos ADD COLUMN IF NOT EXISTS tipo_vivienda_id VARCHAR REFERENCES obra_tipos_vivienda(id) ON DELETE SET NULL`);

    // Estructura Cliente → Obra (migración 076). Ver
    // migrations/076_obras_bitacora_vendedor_cotizacion.sql — se replica acá
    // porque el runner de .sql corre DESPUÉS del bootstrap y la planilla de obras
    // consulta estas columnas apenas arranca el server.
    console.log('  📓 Verificando bitácora y dueño de las obras...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS obra_bitacora (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        obra_id VARCHAR NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
        texto TEXT NOT NULL,
        autor_id VARCHAR,
        autor_nombre TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obra_bitacora_obra" ON obra_bitacora (obra_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obra_bitacora_created" ON obra_bitacora (created_at)`);
    // La obra queda vinculada sola a quien la crea y a su supervisor.
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS vendedor_id VARCHAR`);
    await db.execute(sql`ALTER TABLE obras ADD COLUMN IF NOT EXISTS supervisor_id VARCHAR`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obras_vendedor" ON obras (vendedor_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_obras_supervisor" ON obras (supervisor_id)`);
    // La cotización sabe a qué obra es (una constructora cotiza por proyecto).
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS obra_id VARCHAR`);
    await db.execute(sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS obra_nombre TEXT`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_quotes_obra" ON quotes (obra_id)`);

    // Rendición de gastos v2 (migración 073). Ver migrations/073_rendicion_gastos_v2.sql
    // — se replica acá porque el runner de .sql corre DESPUÉS del bootstrap y las
    // rutas de gastos consultan estas tablas apenas arranca el server.
    console.log('  🧾 Verificando tablas de rendición de gastos v2...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS informes_rendicion (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo VARCHAR(200) NOT NULL,
        periodo VARCHAR(7) NOT NULL,
        user_id VARCHAR NOT NULL,
        creado_por_id VARCHAR NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
        observaciones TEXT,
        motivo_rechazo TEXT,
        comentario_aprobacion TEXT,
        aprobador_id VARCHAR,
        fecha_envio TIMESTAMPTZ,
        fecha_aprobacion TIMESTAMPTZ,
        fecha_pago TIMESTAMPTZ,
        comprobante_pago_url VARCHAR(500),
        segment_code VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_user" ON informes_rendicion (user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_estado" ON informes_rendicion (estado)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_periodo" ON informes_rendicion (periodo)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_informes_rendicion_created" ON informes_rendicion (created_at)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gasto_catalogos (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo VARCHAR(30) NOT NULL,
        nombre VARCHAR(160) NOT NULL,
        codigo VARCHAR(60),
        cuenta_contable VARCHAR(60),
        requiere_rut_proveedor BOOLEAN NOT NULL DEFAULT false,
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_gasto_catalogos_tipo" ON gasto_catalogos (tipo, orden)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gasto_catalogos_tipo_nombre" ON gasto_catalogos (tipo, nombre)`);
    // Semilla con los valores que hoy están hardcodeados en el formulario.
    await db.execute(sql`
      INSERT INTO gasto_catalogos (tipo, nombre, orden) VALUES
        ('categoria', 'Combustibles', 1),
        ('categoria', 'Peaje', 2),
        ('categoria', 'Colación', 3),
        ('categoria', 'Gestión Ventas', 4),
        ('categoria', 'Otros', 99)
      ON CONFLICT (tipo, nombre) DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO gasto_catalogos (tipo, nombre, orden, requiere_rut_proveedor) VALUES
        ('tipo_documento', 'Boleta', 1, false),
        ('tipo_documento', 'Factura', 2, true),
        ('tipo_documento', 'Recibo', 3, false),
        ('tipo_documento', 'Peaje', 4, false),
        ('tipo_documento', 'Otro', 99, false)
      ON CONFLICT (tipo, nombre) DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO gasto_catalogos (tipo, nombre, orden)
      SELECT DISTINCT 'centro_costo', TRIM(centro_costos), 0
      FROM gastos_empresariales
      WHERE centro_costos IS NOT NULL AND TRIM(centro_costos) <> ''
      ON CONFLICT (tipo, nombre) DO NOTHING
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS historial_estados_gasto (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        entidad VARCHAR(20) NOT NULL,
        entidad_id VARCHAR NOT NULL,
        estado_anterior VARCHAR(50),
        estado_nuevo VARCHAR(50) NOT NULL,
        actor_id VARCHAR,
        actor_nombre VARCHAR(255),
        comentario TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_historial_estados_entidad" ON historial_estados_gasto (entidad, entidad_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_historial_estados_created" ON historial_estados_gasto (created_at)`);

    await db.execute(sql`ALTER TABLE gastos_empresariales ADD COLUMN IF NOT EXISTS informe_id VARCHAR`);
    await db.execute(sql`ALTER TABLE gastos_empresariales ADD COLUMN IF NOT EXISTS proyecto VARCHAR(160)`);
    await db.execute(sql`ALTER TABLE gastos_empresariales ADD COLUMN IF NOT EXISTS viaje_detalle JSONB`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_gastos_informe" ON gastos_empresariales (informe_id)`);
    // Al borrar un informe los gastos quedan sueltos, no se pierden.
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_gastos_informe' AND table_name = 'gastos_empresariales'
        ) THEN
          ALTER TABLE gastos_empresariales
            ADD CONSTRAINT fk_gastos_informe
            FOREIGN KEY (informe_id) REFERENCES informes_rendicion(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    console.log('✅ Bootstrap de base de datos completado');

  } catch (error: any) {
    console.error('❌ Error en bootstrap de base de datos:', error.message);
    throw error;
  }
}

// Lista de colores conocidos para pintura
const KNOWN_COLORS = [
  // Colores básicos
  'BLANCO', 'NEGRO', 'GRIS', 'GRIS CLARO', 'GRIS OSCURO', 'GRIS PERLA',
  'ROJO', 'ROJO OXIDO', 'ROJO COLONIAL',
  'AZUL', 'AZUL COLONIAL', 'AZUL MAR', 'AZUL CIELO', 'AZUL NOCHE', 'AZUL ACERO',
  'VERDE', 'VERDE MUSGO', 'VERDE BOSQUE', 'VERDE LIMON', 'VERDE OLIVO',
  'AMARILLO', 'AMARILLO REY', 'AMARILLO TOPACIO', 'AMARILLO OCRE',
  'NARANJA', 'OCRE', 'CAFÉ', 'CAFE', 'MARRON', 'CHOCOLATE', 'TIERRA',
  'BEIGE', 'CREMA', 'HUESO', 'MARFIL', 'ARENA',
  // Maderas (para barnices)
  'ALERCE', 'CAOBA', 'MAPLE', 'NATURAL', 'NOGAL', 'ROBLE', 'CEDRO', 'CEREZO', 'PINO',
  // Colores especiales
  'DAMASCO', 'COLONIAL', 'INVIERNO', 'JAPON', 'GLACIAR AUSTRAL',
  'BOSQUE ENCANTADO', 'BUENAS VIBRAS', 'CALIDA CALMA', 'CENIZA ACTIVA',
  'LINO SUAVE', 'PERLA MARINA', 'SEDA', 'TERRACOTA', 'SALMON',
  // Bases
  'BASE MEDIA', 'BASE OSCURA', 'BASE PASTEL', 'BASE CLARA',
].sort((a, b) => b.length - a.length); // Ordenar por longitud descendente para matchear primero los más específicos

/**
 * Extrae el color de un nombre de producto
 * @param productName Nombre del producto (ej: "ANTICORROSIVO ESTRUCTURAL BLANCO")
 * @returns Color encontrado o null
 */
function extractColorFromProductName(productName: string): string | null {
  const upperName = productName.toUpperCase();
  
  for (const color of KNOWN_COLORS) {
    // Buscar el color como palabra completa al final o en medio del nombre
    const regex = new RegExp(`\\b${color}\\b`, 'i');
    if (regex.test(upperName)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Extrae la familia de producto (nombre sin el color)
 * @param productName Nombre del producto
 * @param color Color a remover
 * @returns Nombre de la familia de producto
 */
function extractProductFamily(productName: string, color: string | null): string {
  if (!color) {
    return productName.trim();
  }
  
  // Remover el color del nombre, manteniendo el resto
  const regex = new RegExp(`\\s*\\b${color}\\b\\s*`, 'gi');
  return productName.replace(regex, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Pobla los campos product_family y color para todos los productos de ecommerce
 * basándose en el análisis del nombre del producto en price_list
 */
export async function populateProductFamilyAndColor(): Promise<{ updated: number; errors: number }> {
  console.log('🏷️  Poblando campos de familia y color de productos...');
  
  let updated = 0;
  let errors = 0;
  
  try {
    // Obtener todos los productos activos con su información de price_list
    const products = await db.execute(sql`
      SELECT 
        ep.id,
        ep.product_family,
        ep.color,
        pl.producto as product_name
      FROM ecommerce_products ep
      JOIN price_list pl ON ep.price_list_id = pl.id
      WHERE ep.activo = true
        AND (ep.product_family IS NULL OR ep.color IS NULL)
    `);
    
    if (products.rows.length === 0) {
      console.log('✅ Todos los productos ya tienen familia y color asignados');
      return { updated: 0, errors: 0 };
    }
    
    console.log(`📦 Procesando ${products.rows.length} productos...`);
    
    for (const product of products.rows as any[]) {
      try {
        const productName = product.product_name as string;
        const color = extractColorFromProductName(productName);
        const family = extractProductFamily(productName, color);
        
        await db.execute(sql`
          UPDATE ecommerce_products 
          SET 
            product_family = ${family},
            color = ${color}
          WHERE id = ${product.id}
        `);
        
        updated++;
      } catch (error: any) {
        console.warn(`⚠️ Error actualizando producto ${product.id}: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`✅ Familia y color asignados: ${updated} productos actualizados, ${errors} errores`);
    
    return { updated, errors };
  } catch (error: any) {
    console.error('❌ Error poblando familias de productos:', error.message);
    return { updated, errors };
  }
}

/**
 * Convierte un string en slug kebab-case sin acentos ni caracteres especiales
 */
function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Genera slugs para productos de ecommerce que aún no los tienen.
 * Usa descripcion → productFamily → priceList.producto como fuente, y añade
 * un sufijo de 4 chars del id para garantizar unicidad.
 */
export async function populateProductSlugs(): Promise<{ updated: number; errors: number }> {
  console.log('🔗 Verificando slugs de productos...');

  let updated = 0;
  let errors = 0;

  try {
    const products = await db.execute(sql`
      SELECT
        ep.id,
        ep.descripcion,
        ep.product_family,
        ep.color,
        ep.variant_generic_display_name,
        pl.producto as pl_producto
      FROM ecommerce_products ep
      LEFT JOIN price_list pl ON ep.price_list_id = pl.id
      WHERE ep.slug IS NULL OR ep.slug = ''
    `);

    if (products.rows.length === 0) {
      console.log('✅ Todos los productos tienen slug asignado');
      return { updated: 0, errors: 0 };
    }

    console.log(`📦 Generando slugs para ${products.rows.length} productos...`);

    for (const product of products.rows as any[]) {
      try {
        const base =
          (product.descripcion as string) ||
          (product.variant_generic_display_name as string) ||
          [product.product_family, product.color].filter(Boolean).join(' ') ||
          (product.pl_producto as string) ||
          'producto';
        const suffix = String(product.id).replace(/-/g, '').slice(-4).toLowerCase();
        const slugBase = toSlug(base);
        const slug = slugBase ? `${slugBase}-${suffix}` : `producto-${suffix}`;

        await db.execute(sql`
          UPDATE ecommerce_products
          SET slug = ${slug}
          WHERE id = ${product.id}
            AND (slug IS NULL OR slug = '')
            AND NOT EXISTS (SELECT 1 FROM ecommerce_products WHERE slug = ${slug})
        `);

        updated++;
      } catch (error: any) {
        console.warn(`⚠️ Error generando slug para producto ${product.id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`✅ Slugs generados: ${updated} productos, ${errors} errores`);
    return { updated, errors };
  } catch (error: any) {
    console.error('❌ Error poblando slugs:', error.message);
    return { updated, errors };
  }
}

interface Migration {
  filename: string;
  number: number;
}

/**
 * Migra las URLs de imágenes de productos de Object Storage (Replit)
 * a sistema de archivos local (Railway).
 * 
 * Convierte URLs como: /public-objects/product-images/SKU_123.png
 * A URLs como: /product-images/SKU_123.png
 */
export async function migrateProductImageUrls(): Promise<{ migrated: number }> {
  console.log('🖼️  Verificando URLs de imágenes de productos...');
  
  try {
    const result = await db.execute(sql`
      UPDATE ecommerce_products 
      SET imagen_url = REPLACE(imagen_url, '/public-objects/product-images/', '/product-images/')
      WHERE imagen_url IS NOT NULL 
        AND imagen_url LIKE '/public-objects/product-images/%'
      RETURNING id
    `);
    
    const migrated = result.rowCount || 0;
    
    if (migrated > 0) {
      console.log(`✅ ${migrated} URLs de imágenes migradas a almacenamiento local`);
    } else {
      console.log('✅ Todas las URLs de imágenes ya están actualizadas');
    }
    
    return { migrated };
  } catch (error: any) {
    console.error('❌ Error migrando URLs de imágenes:', error.message);
    return { migrated: 0 };
  }
}

/**
 * Sube las imágenes locales a Object Storage para que sean persistentes.
 * Sube directamente sin verificar si ya existen (el upload sobrescribe).
 * Usa un flag en la base de datos para evitar re-subir en cada reinicio.
 */
export async function uploadLocalImagesToObjectStorage(): Promise<{ uploaded: number; failed: number; skipped: number }> {
  console.log('☁️  Verificando imágenes locales para subir a Object Storage...');
  
  const localImagesDir = path.join(process.cwd(), 'public', 'product-images');
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;
  
  try {
    // Verificar si ya se ejecutó esta migración
    const migrationCheck = await db.execute(sql`
      SELECT filename FROM migrations_log WHERE filename = 'local_images_to_object_storage'
    `);
    
    if (migrationCheck.rows.length > 0) {
      console.log('✅ Imágenes ya fueron migradas a Object Storage anteriormente');
      return { uploaded: 0, failed: 0, skipped: 0 };
    }
    
    if (!fs.existsSync(localImagesDir)) {
      console.log('📁 No hay directorio de imágenes locales');
      return { uploaded: 0, failed: 0, skipped: 0 };
    }
    
    const files = fs.readdirSync(localImagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    
    if (files.length === 0) {
      console.log('📁 No hay imágenes locales para migrar');
      return { uploaded: 0, failed: 0, skipped: 0 };
    }
    
    console.log(`📷 Encontradas ${files.length} imágenes locales para subir`);
    
    const objectStorageService = new ObjectStorageService();
    
    for (const fileName of files) {
      try {
        const filePath = path.join(localImagesDir, fileName);
        const imageBuffer = fs.readFileSync(filePath);
        
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        const contentType = mimeTypes[ext] || 'image/png';
        
        await objectStorageService.uploadImage(
          `product-images/${fileName}`,
          imageBuffer,
          contentType
        );
        
        uploaded++;
        
        if (uploaded % 50 === 0) {
          console.log(`  ☁️  Subidas ${uploaded}/${files.length} imágenes...`);
        }
      } catch (error: any) {
        console.warn(`  ⚠️ Error subiendo ${fileName}: ${error.message}`);
        failed++;
      }
    }
    
    // Marcar la migración como completada
    if (uploaded > 0) {
      await db.execute(sql`
        INSERT INTO migrations_log (filename) VALUES ('local_images_to_object_storage')
        ON CONFLICT (filename) DO NOTHING
      `);
    }
    
    console.log(`✅ Migración de imágenes completada: ${uploaded} subidas, ${failed} errores`);
    
    return { uploaded, failed, skipped };
  } catch (error: any) {
    console.error('❌ Error migrando imágenes a Object Storage:', error.message);
    return { uploaded, failed, skipped };
  }
}

/**
 * Sistema de migraciones SQL para producción
 * - Lee archivos .sql del directorio migrations/
 * - Ejecuta en orden numérico
 * - Registra migraciones ejecutadas en tabla de control
 */
export async function runProductionMigrations() {
  console.log('🔄 Verificando migraciones de base de datos...');
  
  try {
    // Crear tabla de control de migraciones si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migrations_log (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Obtener migraciones ya ejecutadas
    const executedMigrations = await db.execute(sql`
      SELECT filename FROM migrations_log ORDER BY filename
    `);
    
    const executedSet = new Set(
      executedMigrations.rows.map((row: any) => row.filename)
    );
    
    // Leer archivos de migraciones del directorio
    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  Directorio migrations/ no encontrado');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .filter(f => !f.startsWith('0000_')) // Ignorar migración inicial de Drizzle
      .map(f => ({
        filename: f,
        number: parseInt(f.split('_')[0])
      }))
      .sort((a, b) => a.number - b.number);
    
    if (files.length === 0) {
      console.log('✅ No hay migraciones SQL para ejecutar');
      return;
    }
    
    // Ejecutar migraciones pendientes
    let executed = 0;
    for (const migration of files) {
      if (executedSet.has(migration.filename)) {
        continue;
      }
      
      console.log(`📝 Ejecutando migración: ${migration.filename}`);
      
      const migrationPath = path.join(migrationsDir, migration.filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      try {
        // Ejecutar migración
        await db.execute(sql.raw(migrationSQL));
        
        // Registrar en log
        await db.execute(sql`
          INSERT INTO migrations_log (filename)
          VALUES (${migration.filename})
        `);
        
        console.log(`✅ Migración completada: ${migration.filename}`);
        executed++;
      } catch (error: any) {
        console.error(`❌ Error en migración ${migration.filename}:`, error.message);
        throw error;
      }
    }
    
    if (executed === 0) {
      console.log('✅ Todas las migraciones están actualizadas');
    } else {
      console.log(`✅ ${executed} migración(es) ejecutada(s) exitosamente`);
    }
    
  } catch (error: any) {
    console.error('❌ Error en sistema de migraciones:', error.message);
    throw error;
  }
}

export async function fixReclamosProduccionEstado(): Promise<number> {
  try {
    const result = await db.execute(sql`
      UPDATE reclamos_generales 
      SET estado = 'en_produccion', updated_at = NOW()
      WHERE area_responsable_actual = 'produccion' 
        AND estado = 'en_area_responsable'
    `);
    const count = (result as any).rowCount || 0;
    if (count > 0) {
      console.log(`🔧 Corregidos ${count} reclamos de producción: en_area_responsable → en_produccion`);
    }
    return count;
  } catch (error: any) {
    console.error('Error corrigiendo estados de reclamos de producción:', error.message);
    return 0;
  }
}

export async function syncMissingFundMovements(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const rows = await db.execute(sql`
      SELECT ge.id, ge.monto, ge.estado, ge.descripcion, ge.categoria,
             ge.fund_allocation_id,
             ge.user_id,
             ge.created_at
      FROM gastos_empresariales ge
      INNER JOIN fund_allocations fa ON fa.id = ge.fund_allocation_id
      WHERE ge.fund_allocation_id IS NOT NULL
        AND ge.estado IN ('aprobado', 'rechazado', 'pendiente_rrhh', 'pendiente_supervisor')
        AND NOT EXISTS (
          SELECT 1 FROM fund_movements fm WHERE fm.gasto_id = ge.id
        )
      ORDER BY ge.created_at ASC
    `);

    const expenses = rows.rows as any[];

    if (expenses.length === 0) {
      console.log('✅ Todos los movimientos de fondos están sincronizados');
      return { synced: 0, errors: 0 };
    }

    console.log(`📊 Encontrados ${expenses.length} gastos con fondo sin movimiento registrado`);

    for (const expense of expenses) {
      try {
        let tipoMovimiento: string;
        let descripcionMov: string;

        if (expense.estado === 'aprobado') {
          tipoMovimiento = 'gasto_aprobado';
          descripcionMov = `Movimiento sincronizado desde gasto histórico: ${expense.descripcion || expense.categoria}`;
        } else if (expense.estado === 'rechazado') {
          tipoMovimiento = 'gasto_rechazado';
          descripcionMov = `Movimiento sincronizado desde gasto histórico rechazado: ${expense.descripcion || expense.categoria}`;
        } else {
          tipoMovimiento = 'gasto_pendiente';
          descripcionMov = `Movimiento sincronizado desde gasto pendiente: ${expense.descripcion || expense.categoria}`;
        }

        const montoValue = tipoMovimiento === 'gasto_rechazado'
          ? `${Math.abs(parseFloat(expense.monto))}`
          : `-${Math.abs(parseFloat(expense.monto))}`;

        await db.execute(sql`
          INSERT INTO fund_movements (id, allocation_id, tipo_movimiento, monto, descripcion, gasto_id, creado_por_id, created_at)
          VALUES (
            gen_random_uuid(),
            ${expense.fund_allocation_id},
            ${tipoMovimiento},
            ${montoValue},
            ${descripcionMov},
            ${expense.id},
            ${expense.user_id},
            ${expense.created_at}
          )
        `);

        synced++;
        console.log(`  ✅ Sincronizado: ${expense.descripcion || expense.categoria} (${tipoMovimiento})`);
      } catch (err: any) {
        errors++;
        console.error(`  ❌ Error sincronizando gasto ${expense.id}:`, err.message);
      }
    }

    console.log(`📊 Sincronización completada: ${synced} sincronizados, ${errors} errores`);
  } catch (error: any) {
    console.error('❌ Error en sincronización de movimientos de fondos:', error.message);
  }

  return { synced, errors };
}
