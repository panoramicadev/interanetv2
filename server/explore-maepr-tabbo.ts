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

async function exploreMaeprAndTabbo() {
  try {
    console.log('🔄 Conectando a SQL Server...\n');
    const pool = await sql.connect(config);

    // Explorar MAEPR (Maestro de Productos)
    console.log('📊 TABLA: MAEPR (Maestro de Productos)');
    console.log('='.repeat(80));
    const maeprCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MAEPR'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColumnas importantes:');
    maeprCols.recordset.forEach((col: any) => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.DATA_TYPE}${length}`);
    });

    // Muestra de MAEPR
    console.log('\n📝 Muestra de productos (TOP 5):');
    const maeprSample = await pool.request().query(`
      SELECT TOP 5 *
      FROM MAEPR
    `);
    
    if (maeprSample.recordset.length > 0) {
      maeprSample.recordset.forEach((row: any, idx: number) => {
        console.log(`\n${idx + 1}. ${JSON.stringify(row, null, 2).substring(0, 800)}...`);
      });
    }

    // Explorar TABBO (Bodegas)
    console.log('\n\n📊 TABLA: TABBO (Bodegas)');
    console.log('='.repeat(80));
    const tabboCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'TABBO'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColumnas:');
    tabboCols.recordset.forEach((col: any) => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.DATA_TYPE}${length}`);
    });

    const tabboSample = await pool.request().query(`SELECT * FROM TABBO`);
    console.log(`\n📝 Total de bodegas: ${tabboSample.recordset.length}`);
    console.log('\nBodegas encontradas:');
    tabboSample.recordset.forEach((row: any) => {
      console.log(`   ${row.KOBO || row.CODIGO} - ${row.NOBO || row.NOMBRE}`);
    });

    // Buscar tabla de stock/existencias
    console.log('\n\n🔍 Buscando tabla de STOCK/EXISTENCIAS...');
    const stockTables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%STK%'
         OR TABLE_NAME LIKE '%STKPR%'
         OR TABLE_NAME LIKE '%EXIST%'
         OR TABLE_NAME LIKE '%MAEST%'
      ORDER BY TABLE_NAME
    `);

    if (stockTables.recordset.length > 0) {
      console.log('\nTablas de stock encontradas:');
      for (const table of stockTables.recordset) {
        console.log(`\n   ✓ ${table.TABLE_NAME}`);
        
        const cols = await pool.request().query(`
          SELECT TOP 5 COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table.TABLE_NAME}'
        `);
        cols.recordset.forEach((col: any) => {
          console.log(`      - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
      }
    } else {
      console.log('   ⚠️ No se encontraron tablas específicas de stock');
    }

    // Query para obtener stock actual calculado desde MAEDDO
    console.log('\n\n📊 Calculando stock actual desde MAEDDO...');
    const stockQuery = await pool.request().query(`
      SELECT TOP 10
        d.KOPRCT,
        d.NOKOPR,
        d.BOSULIDO,
        SUM(d.CAPRCO1) as StockTotal,
        d.UD01PR,
        AVG(d.PPPRPM) as PrecioMedio,
        AVG(d.PPPRNE) as PrecioNeto
      FROM MAEDDO d
      WHERE d.KOPRCT IS NOT NULL 
        AND d.CAPRCO1 > 0
        AND d.PPPRPM > 0
      GROUP BY d.KOPRCT, d.NOKOPR, d.BOSULIDO, d.UD01PR
      ORDER BY SUM(d.CAPRCO1) DESC
    `);

    console.log('\nStock calculado por producto y bodega:');
    stockQuery.recordset.forEach((row: any, idx: number) => {
      console.log(`\n${idx + 1}. Producto: ${row.KOPRCT} - ${row.NOKOPR}`);
      console.log(`   Bodega: ${row.BOSULIDO}`);
      console.log(`   Stock Total: ${row.StockTotal} ${row.UD01PR}`);
      console.log(`   Precio Medio: $${Math.round(row.PrecioMedio)}`);
      console.log(`   Valor Inventario: $${Math.round(row.StockTotal * row.PrecioMedio)}`);
    });

    await pool.close();
    console.log('\n\n✅ Exploración completada');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

exploreMaeprAndTabbo()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
