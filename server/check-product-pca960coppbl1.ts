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

async function checkProduct() {
  console.log('🔄 Conectando a SQL Server...');
  const pool = await mssql.connect(sqlServerConfig);
  
  try {
    // Verificar el producto PCA960COPPBL1 en el documento 199214
    console.log('\n📋 VERIFICANDO PRODUCTO PCA960COPPBL1 EN DOCUMENTO 199214:\n');
    
    const productDetail = await pool.request().query(`
      SELECT 
        e.NUDO,
        e.TIDO,
        e.FEEMDO,
        d.KOPRCT,
        d.NOKOPR,
        d.CAPRCO1,
        d.VABRLI,
        d.VANELI
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.NUDO = '0000199214'
        AND d.KOPRCT = 'PCA960COPPBL1'
    `);
    
    if (productDetail.recordset.length === 0) {
      console.log('❌ NO ENCONTRADO: El producto PCA960COPPBL1 NO existe en el documento 199214 en SQL Server');
      console.log('   Esto significa que tu Excel del Random está correcto y nuestro sistema tiene datos incorrectos.');
    } else {
      console.log('✅ ENCONTRADO: El producto SÍ existe en SQL Server');
      console.log('\nDETALLES DEL PRODUCTO:');
      const prod = productDetail.recordset[0];
      console.log(`  Código: ${prod.KOPRCT}`);
      console.log(`  Nombre: ${prod.NOKOPR?.trim()}`);
      console.log(`  Cantidad: ${prod.CAPRCO1}`);
      console.log(`  Valor Bruto: $${prod.VABRLI.toLocaleString()}`);
      console.log(`  Valor Neto: $${prod.VANELI.toLocaleString()}`);
      console.log(`  Documento: ${prod.NUDO}`);
      console.log(`  Tipo: ${prod.TIDO}`);
      console.log(`  Fecha: ${prod.FEEMDO?.toISOString().split('T')[0]}`);
      
      console.log('\n🔍 POSIBLES RAZONES POR LAS QUE NO APARECE EN TU EXCEL:');
      console.log('  1. El producto está en SQL Server pero tu filtro de exportación lo excluye');
      console.log('  2. El Random tiene filtros por defecto que ocultan ciertos productos');
      console.log('  3. Problema de permisos en el ERP Random');
    }
    
    // Verificar todos los productos del documento para comparar
    console.log('\n\n📊 TODOS LOS PRODUCTOS DEL DOCUMENTO 199214:\n');
    const allProducts = await pool.request().query(`
      SELECT 
        d.KOPRCT,
        d.NOKOPR,
        d.CAPRCO1,
        d.VABRLI,
        p.TIPR as tipo_producto
      FROM MAEEDO e
      INNER JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      LEFT JOIN MAEPR p ON d.KOPRCT = p.KOPR
      WHERE e.NUDO = '0000199214'
      ORDER BY d.VABRLI DESC
    `);
    
    console.log('Código         | Nombre                                   | Tipo | Cant  | V.Bruto');
    console.log('---------------|------------------------------------------|------|-------|----------');
    allProducts.recordset.forEach((prod: any) => {
      const marker = prod.KOPRCT === 'PCA960COPPBL1' ? '👉' : '  ';
      console.log(
        `${marker} ${prod.KOPRCT.padEnd(14)} | ${prod.NOKOPR?.trim().substring(0, 40).padEnd(40)} | ${(prod.tipo_producto?.trim() || 'N/A').padEnd(4)} | ${prod.CAPRCO1.toString().padStart(5)} | $${prod.VABRLI.toLocaleString()}`
      );
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.close();
  }
}

checkProduct().catch(console.error);
