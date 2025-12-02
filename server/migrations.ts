import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { ObjectStorageService } from './objectStorage';

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
