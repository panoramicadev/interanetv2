import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { ObjectStorageService } from './objectStorage';

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
    
    // fact_gdv (Tabla de hechos)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gdv.fact_gdv (
        id SERIAL PRIMARY KEY,
        idmaeedo NUMERIC(20, 0),
        idmaeddo NUMERIC(20, 0),
        tido TEXT,
        nudo TEXT,
        feemdo DATE,
        endo TEXT,
        nokoen TEXT,
        ruen TEXT,
        koprct TEXT,
        nokopr TEXT,
        kofulido TEXT,
        nokofu TEXT,
        suli TEXT,
        bosulido TEXT,
        nobosuli TEXT,
        esdo TEXT,
        eslido TEXT,
        vaneli NUMERIC(18, 4),
        monto NUMERIC(18, 4),
        cantidad_pendiente NUMERIC(18, 4),
        "cantidadPendiente" BOOLEAN DEFAULT false,
        sync_timestamp TIMESTAMP DEFAULT NOW()
      )
    `);
    
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
    
    // 4. Crear índices importantes
    console.log('  🔍 Creando índices...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeddo_kofulido ON ventas.stg_maeddo(kofulido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_idmaeedo ON gdv.stg_maeddo_gdv(idmaeedo)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeddo_gdv_kofulido ON gdv.stg_maeddo_gdv(kofulido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stg_maeen_gdv_rut ON gdv.stg_maeen_gdv(rut)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_gdv_kofulido ON gdv.fact_gdv(kofulido)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fact_gdv_feemdo ON gdv.fact_gdv(feemdo)`);
    
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

interface Migration {
  filename: string;
  number: number;
}

/**
 * Migra las URLs de imágenes de productos del sistema de archivos local
 * a Object Storage persistente.
 * 
 * Convierte URLs como: /product-images/SKU_123.png
 * A URLs como: /public-objects/product-images/SKU_123.png
 */
export async function migrateProductImageUrls(): Promise<{ migrated: number }> {
  console.log('🖼️  Verificando URLs de imágenes de productos...');
  
  try {
    const result = await db.execute(sql`
      UPDATE ecommerce_products 
      SET imagen_url = '/public-objects' || imagen_url
      WHERE imagen_url IS NOT NULL 
        AND imagen_url LIKE '/product-images/%'
        AND imagen_url NOT LIKE '/public-objects/%'
      RETURNING id
    `);
    
    const migrated = result.rowCount || 0;
    
    if (migrated > 0) {
      console.log(`✅ ${migrated} URLs de imágenes migradas a Object Storage`);
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
