import sql from 'mssql';

const config: sql.config = {
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
  requestTimeout: 30000,
};

async function exploreInventoryTables() {
  try {
    console.log('🔄 Conectando a SQL Server...');
    const pool = await sql.connect(config);
    console.log('✅ Conexión exitosa\n');

    // Buscar tablas relacionadas con inventario/stock/productos/bodegas
    console.log('📋 Buscando tablas de inventario, stock y productos...\n');
    const tablesResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%MAEP%'
         OR TABLE_NAME LIKE '%EXIST%'
         OR TABLE_NAME LIKE '%STOCK%'
         OR TABLE_NAME LIKE '%INVENTA%'
         OR TABLE_NAME LIKE '%BODE%'
         OR TABLE_NAME LIKE '%TABBO%'
         OR TABLE_NAME LIKE '%TABPR%'
      ORDER BY TABLE_NAME
    `);

    if (tablesResult.recordset && tablesResult.recordset.length > 0) {
      console.log('📊 Tablas encontradas:');
      tablesResult.recordset.forEach((table: any) => {
        console.log(`   ✓ ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
      });
      console.log('');

      // Para cada tabla encontrada, mostrar sus columnas
      for (const table of tablesResult.recordset) {
        console.log(`\n🔍 Columnas de ${table.TABLE_NAME}:`);
        const columnsResult = await pool.request().query(`
          SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table.TABLE_NAME}'
          ORDER BY ORDINAL_POSITION
        `);

        if (columnsResult.recordset && columnsResult.recordset.length > 0) {
          columnsResult.recordset.forEach((col: any) => {
            const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`   - ${col.COLUMN_NAME.padEnd(20)} ${col.DATA_TYPE}${length.padEnd(10)} ${nullable}`);
          });

          // Si es una tabla de productos o stock, mostrar algunos datos de ejemplo
          if (table.TABLE_NAME.includes('MAEP') || table.TABLE_NAME.includes('EXIST') || table.TABLE_NAME.includes('STOCK')) {
            try {
              const sampleResult = await pool.request().query(`
                SELECT TOP 3 *
                FROM ${table.TABLE_SCHEMA}.${table.TABLE_NAME}
              `);
              
              if (sampleResult.recordset && sampleResult.recordset.length > 0) {
                console.log(`\n   📝 Ejemplo de datos (primeros 3 registros):`);
                sampleResult.recordset.forEach((row: any, idx: number) => {
                  console.log(`\n   Registro ${idx + 1}:`);
                  Object.keys(row).slice(0, 10).forEach(key => {
                    console.log(`      ${key}: ${row[key]}`);
                  });
                });
              }
            } catch (err) {
              console.log(`   ⚠️ No se pudo obtener datos de ejemplo: ${(err as Error).message}`);
            }
          }
        }
      }
    } else {
      console.log('⚠️ No se encontraron tablas relacionadas con inventario');
    }

    // Buscar específicamente la tabla MAEDDO para ver precios promedio
    console.log('\n\n🔍 Explorando MAEDDO (Detalle documentos) para ver precios promedio...');
    try {
      const maeddoSample = await pool.request().query(`
        SELECT TOP 5
          KOPRCT,
          NOKOPR,
          BOSULIDO,
          CAPRCO1,
          UD01PR,
          PPPRPM,
          PPPRNE,
          FEEMLI
        FROM MAEDDO
        WHERE PPPRPM > 0 AND KOPRCT IS NOT NULL
        ORDER BY FEEMLI DESC
      `);

      if (maeddoSample.recordset && maeddoSample.recordset.length > 0) {
        console.log('\n📊 Ejemplos de MAEDDO con precio promedio ponderado:');
        maeddoSample.recordset.forEach((row: any, idx: number) => {
          console.log(`\n${idx + 1}. Producto: ${row.KOPRCT} - ${row.NOKOPR}`);
          console.log(`   Bodega: ${row.BOSULIDO}`);
          console.log(`   Cantidad: ${row.CAPRCO1} ${row.UD01PR}`);
          console.log(`   Precio Promedio Ponderado: $${row.PPPRPM}`);
          console.log(`   Precio Neto: $${row.PPPRNE}`);
          console.log(`   Fecha: ${row.FEEMLI}`);
        });
      }
    } catch (err) {
      console.log(`⚠️ Error al consultar MAEDDO: ${(err as Error).message}`);
    }

    await pool.close();
    console.log('\n\n✅ Exploración completada');
    return true;
  } catch (error: any) {
    console.error('\n❌ Error al explorar tablas:');
    console.error(`   Código: ${error.code || 'N/A'}`);
    console.error(`   Mensaje: ${error.message}`);
    return false;
  }
}

exploreInventoryTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
