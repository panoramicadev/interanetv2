import mssql from 'mssql';

const config: mssql.config = {
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

async function checkStructure() {
  try {
    const pool = new mssql.ConnectionPool(config);
    await pool.connect();
    
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MAEVEN'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 ESTRUCTURA DE MAEVEN:');
    console.log('========================');
    result.recordset.forEach(col => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length}`);
    });
    
    await pool.close();
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkStructure();
