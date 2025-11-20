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

async function checkDoc() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    // 1. Buscar todos los documentos 199214 (sin importar ceros iniciales)
    console.log('\n📋 PASO 1: Buscando todos los documentos que contengan "199214"...\n');
    const allDocs = await pool.request().query(`
      SELECT 
        TIDO,
        NUDO,
        FEEMDO,
        ENDO,
        KOFUDO
      FROM MAEEDO
      WHERE NUDO LIKE '%199214%'
      ORDER BY NUDO
    `);
    
    console.log(`Encontrados ${allDocs.recordset.length} documentos:\n`);
    allDocs.recordset.forEach((doc: any) => {
      console.log(`  NUDO: ${doc.NUDO} | TIDO: ${doc.TIDO} | Fecha: ${doc.FEEMDO?.toISOString().split('T')[0]} | Cliente: ${doc.ENDO} | Vendedor: ${doc.KOFUDO?.trim()}`);
    });
    
    // 2. Obtener las líneas del documento 0000199214
    console.log('\n\n📊 PASO 2: LÍNEAS DEL DOCUMENTO 0000199214 (con TODOS los campos de monto):\n');
    const lines = await pool.request().query(`
      SELECT 
        d.KOPRCT,
        d.NOKOPR,
        d.CAPRCO1,
        d.PPPRBR,
        d.PPPRNEBR,
        d.VABRLI,
        d.VABRNE,
        d.VANELI,
        d.VAIVLI
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.NUDO = '0000199214'
      ORDER BY d.VABRLI DESC
    `);
    
    console.log(`Total líneas: ${lines.recordset.length}\n`);
    console.log('Código         | Nombre                                   | Cant  | P.Bruto  | P.Neto   | V.Bruto  | V.BrutoNeto | V.Neto   | V.IVA');
    console.log('---------------|------------------------------------------|-------|----------|----------|----------|-------------|----------|--------');
    
    let totalVaBrLi = 0;
    let totalVaBrNe = 0;
    let totalVaNeLi = 0;
    let totalVaIvLi = 0;
    
    lines.recordset.forEach((line: any) => {
      console.log(
        `${line.KOPRCT.padEnd(14)} | ${line.NOKOPR?.trim().substring(0, 40).padEnd(40)} | ${line.CAPRCO1.toString().padStart(5)} | $${line.PPPRBR.toLocaleString().padStart(7)} | $${line.PPPRNEBR.toLocaleString().padStart(7)} | $${line.VABRLI.toLocaleString().padStart(7)} | $${line.VABRNE.toLocaleString().padStart(10)} | $${line.VANELI.toLocaleString().padStart(7)} | $${line.VAIVLI.toLocaleString().padStart(6)}`
      );
      totalVaBrLi += line.VABRLI;
      totalVaBrNe += line.VABRNE;
      totalVaNeLi += line.VANELI;
      totalVaIvLi += line.VAIVLI;
    });
    
    console.log('\n💰 TOTALES:');
    console.log(`   VABRLI (Valor Bruto Línea):       $${totalVaBrLi.toLocaleString()}`);
    console.log(`   VABRNE (Valor Bruto Neto):        $${totalVaBrNe.toLocaleString()}`);
    console.log(`   VANELI (Valor Neto Línea):        $${totalVaNeLi.toLocaleString()}`);
    console.log(`   VAIVLI (Valor IVA Línea):         $${totalVaIvLi.toLocaleString()}`);
    
    console.log('\n🔍 INTERPRETACIÓN:');
    console.log(`   - VABRLI es el monto BRUTO (incluye IVA)`);
    console.log(`   - VANELI es el monto NETO (sin IVA)`);
    console.log(`   - El ETL actual está usando VANELI ($${totalVaNeLi.toLocaleString()})`);
    console.log(`   - El usuario espera VABRLI ($${totalVaBrLi.toLocaleString()})`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
  }
}

checkDoc().catch(console.error);
