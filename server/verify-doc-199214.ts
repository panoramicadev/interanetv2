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

async function verifyDoc() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    // Buscar TODOS los documentos 199214, 199215, 199216 para JK LTDA
    console.log('\n📊 BUSCANDO DOCUMENTOS PARA ELECTRICIDAD JK LTDA:');
    const docs = await pool.request().query(`
      SELECT 
        e.TIDO,
        e.NUDO,
        e.FEEMDO,
        e.NUKOEN,
        e.NOKOEN,
        e.NUKOFU,
        e.NOKOFU,
        e.VABRTO,
        e.VANETO
      FROM MAEEDO e
      WHERE e.NOKOEN LIKE '%JK LTDA%'
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 11
      ORDER BY e.NUDO DESC
    `);
    
    console.log(`\nEncontrados ${docs.recordset.length} documentos:\n`);
    docs.recordset.forEach((doc: any) => {
      console.log(`Doc: ${doc.NUDO} | Tipo: ${doc.TIDO} | Fecha: ${doc.FEEMDO.toISOString().split('T')[0]} | Cliente: ${doc.NOKOEN.trim()} | Vendedor: ${doc.NOKOFU.trim()} | Bruto: $${doc.VABRTO.toLocaleString()} | Neto: $${doc.VANETO.toLocaleString()}`);
    });
    
    // Ahora obtener las LINEAS del documento 199214
    console.log('\n\n📋 LÍNEAS DEL DOCUMENTO 199214:');
    const lines = await pool.request().query(`
      SELECT 
        d.KOPRCT as codigo,
        d.NOKOPR as nombre,
        d.CAPRCO1 as cantidad,
        d.PPPRBR as precio_unitario_bruto,
        d.PPPRNEBR as precio_unitario_neto,
        d.VABRLI as valor_bruto_linea,
        d.VABRNE as valor_neto_linea
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.NUDO = '0000199214'
      ORDER BY d.VABRLI DESC
    `);
    
    console.log(`\nTotal líneas: ${lines.recordset.length}\n`);
    console.log('Código         | Nombre                                   | Cant | P.Unit.Bruto | P.Unit.Neto | V.Bruto   | V.Neto');
    console.log('---------------|------------------------------------------|------|--------------|-------------|-----------|----------');
    
    let totalBruto = 0;
    let totalNeto = 0;
    lines.recordset.forEach((line: any) => {
      console.log(
        `${line.codigo.padEnd(14)} | ${line.nombre.trim().substring(0, 40).padEnd(40)} | ${line.cantidad.toString().padStart(4)} | $${line.precio_unitario_bruto.toLocaleString().padStart(10)} | $${line.precio_unitario_neto.toLocaleString().padStart(9)} | $${line.valor_bruto_linea.toLocaleString().padStart(8)} | $${line.valor_neto_linea.toLocaleString().padStart(8)}`
      );
      totalBruto += line.valor_bruto_linea;
      totalNeto += line.valor_neto_linea;
    });
    
    console.log(`\n💰 TOTALES: Bruto=$${totalBruto.toLocaleString()} | Neto=$${totalNeto.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
  }
}

verifyDoc().catch(console.error);
