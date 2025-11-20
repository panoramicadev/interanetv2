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

async function compareDoc199214() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    // Obtener todas las líneas del documento 199214 desde SQL Server
    console.log('\n📊 DOCUMENTO 199214 - SQL SERVER (FUENTE ORIGINAL):');
    const sqlServerLines = await pool.request().query(`
      SELECT 
        d.KOPRCT as codigo_producto,
        d.NOKOPR as nombre_producto,
        d.VABRLI as monto,
        d.CAPRCO1 as cantidad
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.NUDO = '0000199214'
      ORDER BY d.VABRLI DESC
    `);
    
    console.log(`Total líneas en SQL Server: ${sqlServerLines.recordset.length}\n`);
    console.log('Código Producto       | Nombre Producto                          | Monto     | Cantidad');
    console.log('----------------------|------------------------------------------|-----------|----------');
    
    let totalSqlServer = 0;
    sqlServerLines.recordset.forEach((line: any) => {
      console.log(
        `${line.codigo_producto.padEnd(21)} | ${line.nombre_producto.trim().substring(0, 40).padEnd(40)} | $${line.monto.toLocaleString().padStart(8)} | ${line.cantidad}`
      );
      totalSqlServer += line.monto;
    });
    console.log(`\n💰 TOTAL SQL SERVER: $${totalSqlServer.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
    console.log('\n✅ Conexión cerrada');
  }
}

compareDoc199214().catch(console.error);
