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

async function queryLastFCV() {
  try {
    console.log('🔄 Conectando a SQL Server...');
    const pool = await sql.connect(config);
    console.log('✅ Conectado\n');
    
    // Primero, obtener la estructura de la tabla
    console.log('📋 ESTRUCTURA DE LA TABLA MAEEDO:');
    console.log('=====================================');
    const columnsResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MAEEDO'
      ORDER BY ORDINAL_POSITION
    `);
    
    if (columnsResult.recordset && columnsResult.recordset.length > 0) {
      columnsResult.recordset.forEach(col => {
        const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}`);
      });
    }
    console.log('=====================================\n');
    
    // Consultar el último registro FCV
    const result = await pool.request().query(`
      SELECT TOP 1 *
      FROM dbo.MAEEDO
      WHERE TIDO = 'FCV'
      ORDER BY FEEMDO DESC, NUDO DESC
    `);
    
    if (result.recordset && result.recordset.length > 0) {
      const registro = result.recordset[0];
      
      console.log('📄 ÚLTIMO REGISTRO FCV EN MAEEDO:');
      console.log('=====================================');
      console.log('📋 TODOS LOS CAMPOS:');
      console.log('-------------------------------------');
      Object.keys(registro).forEach(key => {
        const valor = registro[key];
        if (valor instanceof Date) {
          console.log(`${key}: ${valor.toISOString()}`);
        } else {
          console.log(`${key}: ${valor}`);
        }
      });
      console.log('=====================================');
    } else {
      console.log('❌ No se encontraron registros con TIDO = "FCV"');
    }
    
    await pool.close();
    console.log('\n✅ Conexión cerrada');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

queryLastFCV()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
