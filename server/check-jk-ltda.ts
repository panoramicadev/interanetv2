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

async function checkJKLtda() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    // Buscar nombre exacto del cliente en SQL Server
    console.log('\n📋 Buscando cliente JK en SQL Server...');
    const clientSearch = await pool.request().query(`
      SELECT DISTINCT KOEN, NOKOEN
      FROM MAEEN
      WHERE NOKOEN LIKE '%JK%'
    `);
    
    console.log('Clientes encontrados con "JK":');
    console.log(clientSearch.recordset);
    
    if (clientSearch.recordset.length === 0) {
      console.log('❌ No se encontró ningún cliente con "JK" en el nombre');
      return;
    }
    
    const jkCliente = clientSearch.recordset[0];
    console.log(`\n✅ Cliente encontrado: ${jkCliente.KOEN} - ${jkCliente.NOKOEN}`);
    
    // Verificar en nuestro PostgreSQL cuál es el código de Osvaldo
    console.log('\n📋 Consultando código de OSVALDO desde PostgreSQL...');
    // El código del vendedor en fact_ventas es 'OSVALDO ANTONIO ACUÑA MARTINEZ'
    // Pero en SQL Server puede ser solo un código como 'OAA' o similar
    
    // Buscar todos los códigos de vendedor únicos en SQL Server que tienen ventas a JK LTDA en noviembre
    const vendedoresJK = await pool.request().query(`
      SELECT DISTINCT e.KOFUDO, COUNT(*) as docs
      FROM MAEEDO e
      WHERE e.ENDO = '${jkCliente.KOEN.trim()}'
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 11
        AND e.TIDO IN ('FCV', 'GDV', 'NCV')
      GROUP BY e.KOFUDO
      ORDER BY docs DESC
    `);
    
    console.log('Vendedores que vendieron a JK LTDA en noviembre:');
    console.log(vendedoresJK.recordset);
    
    if (vendedoresJK.recordset.length === 0) {
      console.log('❌ No hay ventas a JK LTDA en noviembre 2025');
      return;
    }
    
    // Usar el vendedor principal (el que más vendió)
    const osvaldoVendedor = vendedoresJK.recordset[0].KOFUDO;
    console.log(`\n✅ Vendedor principal: ${osvaldoVendedor} (${vendedoresJK.recordset[0].docs} documentos)`);
    
    // Consultar ventas de OSVALDO a JK LTDA en noviembre 2025
    console.log('\n📊 Consultando ventas de OSVALDO a JK LTDA en Noviembre 2025...');
    const ventasQuery = await pool.request().query(`
      SELECT 
        e.TIDO,
        COUNT(*) as cantidad_docs,
        SUM(d.VABRLI) as total_monto
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.ENDO = '${jkCliente.KOEN.trim()}'
        AND e.KOFUDO = '${osvaldoVendedor.trim()}'
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 11
        AND e.TIDO IN ('FCV', 'GDV', 'NCV')
      GROUP BY e.TIDO
      ORDER BY cantidad_docs DESC
    `);
    
    console.log('\n📊 Resumen por tipo de documento (SQL Server):');
    console.log(ventasQuery.recordset);
    
    const totalSqlServer = ventasQuery.recordset.reduce((sum: number, row: any) => sum + (row.total_monto || 0), 0);
    console.log(`\n💰 Total SQL Server: $${totalSqlServer.toLocaleString()}`);
    
    // Detalle de documentos
    console.log('\n📄 Detalle de documentos (primeros 50):');
    const detalleQuery = await pool.request().query(`
      SELECT TOP 50
        e.NUDO,
        e.TIDO,
        e.FEEMDO,
        d.KOPRCT,
        d.NOKOPR,
        d.VABRLI as monto,
        d.CAPRCO1 as cantidad
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.ENDO = '${jkCliente.KOEN.trim()}'
        AND e.KOFUDO = '${osvaldoVendedor.trim()}'
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 11
        AND e.TIDO IN ('FCV', 'GDV', 'NCV')
      ORDER BY e.FEEMDO DESC, e.NUDO DESC
    `);
    
    console.log(detalleQuery.recordset);
    
    // Contar total de líneas de detalle
    const totalLineasQuery = await pool.request().query(`
      SELECT 
        COUNT(*) as total_lineas,
        COUNT(DISTINCT e.NUDO) as total_documentos
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.ENDO = '${jkCliente.KOEN.trim()}'
        AND e.KOFUDO = '${osvaldoVendedor.trim()}'
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 11
        AND e.TIDO IN ('FCV', 'GDV', 'NCV')
    `);
    
    console.log('\n📊 Estadísticas SQL Server:');
    console.log(`   Total líneas de detalle: ${totalLineasQuery.recordset[0].total_lineas}`);
    console.log(`   Total documentos: ${totalLineasQuery.recordset[0].total_documentos}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
    console.log('\n✅ Conexión cerrada');
  }
}

checkJKLtda().catch(console.error);
