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

async function checkModifications() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    // Buscar TODOS los documentos de JK LTDA en noviembre 2025
    console.log('\n📋 DOCUMENTOS DE ELECTRICIDAD JK LTDA - NOVIEMBRE 2025:\n');
    const docs = await pool.request().query(`
      SELECT 
        e.NUDO,
        e.TIDO,
        e.FEEMDO as fecha_emision,
        e.ENDO as cliente_codigo,
        e.KOFUDO as vendedor_codigo,
        e.FEER as fecha_recepcion,
        e.VABRDO as valor_bruto_documento
      FROM MAEEDO e
      WHERE e.ENDO = '76941915-2'
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 11
        AND e.TIDO = 'FCV'
      ORDER BY e.FEEMDO, e.NUDO
    `);
    
    console.log(`Total documentos encontrados: ${docs.recordset.length}\n`);
    console.log('NUDO       | Tipo | Fecha Emisión | Fecha Recepción | Vendedor | Valor Bruto');
    console.log('-----------|------|---------------|-----------------|----------|-------------');
    
    let totalBruto = 0;
    docs.recordset.forEach((doc: any) => {
      const fechaEmision = doc.fecha_emision ? doc.fecha_emision.toISOString().split('T')[0] : 'N/A';
      const fechaRecep = doc.fecha_recepcion ? doc.fecha_recepcion.toISOString().split('T')[0] : 'N/A';
      console.log(
        `${doc.NUDO} | ${doc.TIDO}  | ${fechaEmision}  | ${fechaRecep}  | ${doc.vendedor_codigo?.trim().padEnd(8)} | $${doc.valor_bruto_documento.toLocaleString()}`
      );
      totalBruto += doc.valor_bruto_documento;
    });
    
    console.log(`\n💰 TOTAL VALOR BRUTO: $${totalBruto.toLocaleString()}`);
    
    // Ahora verificar el detalle de cada documento
    console.log('\n\n📊 DETALLE DE LÍNEAS POR DOCUMENTO:\n');
    
    for (const doc of docs.recordset) {
      console.log(`\n═══ DOCUMENTO ${doc.NUDO} (${doc.TIDO}) ═══`);
      
      const lines = await pool.request().query(`
        SELECT 
          d.KOPRCT,
          d.CAPRCO1,
          d.VABRLI,
          d.VANELI
        FROM MAEEDO e
        INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
        WHERE e.NUDO = '${doc.NUDO}'
        ORDER BY d.VABRLI DESC
      `);
      
      console.log(`Líneas: ${lines.recordset.length}`);
      console.log('Código         | Cant  | V.Bruto  | V.Neto');
      console.log('---------------|-------|----------|--------');
      
      let sumBruto = 0;
      let sumNeto = 0;
      lines.recordset.forEach((line: any) => {
        console.log(
          `${line.KOPRCT.padEnd(14)} | ${line.CAPRCO1.toString().padStart(5)} | $${line.VABRLI.toLocaleString().padStart(7)} | $${line.VANELI.toLocaleString().padStart(6)}`
        );
        sumBruto += line.VABRLI;
        sumNeto += line.VANELI;
      });
      
      console.log(`\nSUBTOTAL: Bruto=$${sumBruto.toLocaleString()} | Neto=$${sumNeto.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
  }
}

checkModifications().catch(console.error);
