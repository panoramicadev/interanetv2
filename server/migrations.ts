import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface Migration {
  filename: string;
  number: number;
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
