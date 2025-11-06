import mssql from 'mssql';

const sqlServerConfig: mssql.config = {
  server: process.env.SQL_SERVER_HOST!,
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  user: process.env.SQL_SERVER_USER!,
  password: process.env.SQL_SERVER_PASSWORD!,
  database: process.env.SQL_SERVER_DATABASE!,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

async function verifyMasterTables() {
  try {
    console.log('🔍 Verificando tablas maestras...\n');
    const pool = await mssql.connect(sqlServerConfig);

    // Verificar tabla de productos (MAEPR)
    console.log('📦 TABLA MAEPR (Productos):');
    const maepr = await pool.request().query(`
      SELECT TOP 3
        KOPR, NOKOPR, MRPR, FMPR, PFPR, HFPR, RUPR, ZONAPR
      FROM MAEPR
      WHERE NOKOPR IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(maepr.recordset[0]).join(', '));
    console.log('   ✅ NOKOPR existe (nombre producto)');
    console.log('   ✅ MRPR, FMPR, PFPR, HFPR existen (clasificaciones)');
    console.log('   ✅ RUPR existe (ruta/segmento)');
    console.log('   ✅ ZONAPR existe (zona)\n');

    // Verificar tabla de entidades (MAEEN)
    console.log('🏢 TABLA MAEEN (Entidades/Clientes):');
    const maeen = await pool.request().query(`
      SELECT TOP 3
        KOEN, NOKOEN, RUEN
      FROM MAEEN
      WHERE NOKOEN IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(maeen.recordset[0]).join(', '));
    console.log('   ✅ NOKOEN existe (nombre cliente)');
    console.log('   ✅ RUEN existe (ruta/segmento del cliente)\n');

    // Verificar tabla de funcionarios (TABFU)
    console.log('👤 TABLA TABFU (Funcionarios):');
    const tabfu = await pool.request().query(`
      SELECT TOP 3
        KOFU, NOKOFU
      FROM TABFU
      WHERE NOKOFU IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabfu.recordset[0]).join(', '));
    console.log('   ✅ NOKOFU existe (nombre funcionario)\n');

    // Verificar tabla de bodegas (TABBO)
    console.log('🏭 TABLA TABBO (Bodegas):');
    const tabbo = await pool.request().query(`
      SELECT TOP 3
        KOBO, NOKOBO
      FROM TABBO
      WHERE NOKOBO IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabbo.recordset[0]).join(', '));
    console.log('   ✅ NOKOBO existe (nombre bodega)\n');

    // Verificar tabla de sucursales (TABSU)
    console.log('🏪 TABLA TABSU (Sucursales):');
    const tabsu = await pool.request().query(`
      SELECT TOP 3 *
      FROM TABSU
    `);
    console.log('   Columnas:', Object.keys(tabsu.recordset[0]).join(', '));
    const hasSuName = tabsu.recordset[0].hasOwnProperty('NOKOSU') || 
                      tabsu.recordset[0].hasOwnProperty('NOKOEN');
    console.log(hasSuName ? '   ✅ Tiene columna de nombre' : '   ⚠️  Verificar columna de nombre\n');

    // Verificar tabla de zonas (TABZO)
    console.log('🗺️  TABLA TABZO (Zonas):');
    const tabzo = await pool.request().query(`
      SELECT TOP 3
        KOZO, NOKOZO
      FROM TABZO
      WHERE NOKOZO IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabzo.recordset[0]).join(', '));
    console.log('   ✅ NOKOZO existe (nombre zona)\n');

    // Verificar tabla de rutas (TABRU)
    console.log('🛣️  TABLA TABRU (Rutas/Segmentos):');
    const tabru = await pool.request().query(`
      SELECT TOP 3 *
      FROM TABRU
    `);
    console.log('   Columnas:', Object.keys(tabru.recordset[0]).join(', '));
    const hasRuName = tabru.recordset[0].hasOwnProperty('NOKOEN');
    console.log(hasRuName ? '   ✅ NOKOEN existe (nombre ruta)' : '   ⚠️  Verificar columna de nombre\n');

    // Verificar tablas de clasificación de productos
    console.log('🏷️  TABLA TABMR (Marcas):');
    const tabmr = await pool.request().query(`
      SELECT TOP 3
        KOMR, NOKOMR
      FROM TABMR
      WHERE NOKOMR IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabmr.recordset[0]).join(', '));
    console.log('   ✅ NOKOMR existe (nombre marca)\n');

    console.log('📁 TABLA TABFM (Familias):');
    const tabfm = await pool.request().query(`
      SELECT TOP 3
        KOFM, NOKOFM
      FROM TABFM
      WHERE NOKOFM IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabfm.recordset[0]).join(', '));
    console.log('   ✅ NOKOFM existe (nombre familia)\n');

    console.log('📂 TABLA TABPF (Sub-familias):');
    const tabpf = await pool.request().query(`
      SELECT TOP 3
        KOPF, NOKOPF
      FROM TABPF
      WHERE NOKOPF IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabpf.recordset[0]).join(', '));
    console.log('   ✅ NOKOPF existe (nombre sub-familia)\n');

    console.log('🔖 TABLA TABHF (Marcas Comerciales):');
    const tabhf = await pool.request().query(`
      SELECT TOP 3
        KOHF, NOKOHF
      FROM TABHF
      WHERE NOKOHF IS NOT NULL
    `);
    console.log('   Columnas:', Object.keys(tabhf.recordset[0]).join(', '));
    console.log('   ✅ NOKOHF existe (nombre marca comercial)\n');

    // Verificar MAEDDO para campos adicionales
    console.log('📋 TABLA MAEDDO (Detalle) - Campos Especiales:');
    const maeddo = await pool.request().query(`
      SELECT TOP 1 *
      FROM MAEDDO
    `);
    const maeddoCols = Object.keys(maeddo.recordset[0]);
    console.log(`   Total columnas: ${maeddoCols.length}`);
    
    const specialFields = ['LOGISTICA', 'MONTO', 'DEVOL1', 'DEVOL2', 'STOCKFIS', 'LISTACOST', 'LISCOSMOD'];
    specialFields.forEach(field => {
      const exists = maeddoCols.includes(field);
      console.log(`   ${exists ? '✅' : '❌'} ${field}`);
    });

    await pool.close();
    console.log('\n✅ Verificación completada\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyMasterTables();
