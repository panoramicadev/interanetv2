import mssql from 'mssql';

const sqlServerConfig: mssql.config = {
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
  connectionTimeout: 90000,
  requestTimeout: 180000,
};

async function compareProducts() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    console.log('\n📊 DOCUMENTO 199214 - SQL SERVER:');
    const sqlServerLines = await pool.request().query(`
      SELECT 
        d.KOPRCT,
        d.CAPRCO1
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.NUDO = '0000199214'
      ORDER BY d.KOPRCT
    `);
    
    console.log(`\nTotal líneas en SQL Server: ${sqlServerLines.recordset.length}\n`);
    console.log('Código Producto       | Cantidad');
    console.log('----------------------|----------');
    
    sqlServerLines.recordset.forEach((line: any) => {
      console.log(`${line.KOPRCT.padEnd(21)} | ${line.CAPRCO1}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
  }
}

compareProducts().catch(console.error);
