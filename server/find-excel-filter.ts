import mssql from 'mssql';

const sqlServerConfig: mssql.config = {
  server: process.env.SQL_SERVER_HOST!,
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  database: process.env.SQL_SERVER_DATABASE!,
  user: process.env.SQL_SERVER_USER!,
  password: process.env.SQL_SERVER_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

async function findExcelFilter() {
  let pool: mssql.ConnectionPool | null = null;

  try {
    console.log('🔍 BUSCANDO FILTRO DE GDV EN ARCHIVO EXCEL');
    console.log('═══════════════════════════════════════════════════════════\n');

    pool = new mssql.ConnectionPool(sqlServerConfig);
    await pool.connect();

    // NUDOs que están en el Excel
    const excelNudos = [
      '0000090549', '0000090579', '0000090580', '0000090614',
      '0000090622', '0000090623', '0000090625', '0000090626',
      '0000090627', '0000090628', '0000090629', '0000090630', '0000090643'
    ];

    console.log(`📋 Analizando ${excelNudos.length} GDV del archivo Excel...\n`);

    // 1. Obtener info completa de estos documentos
    console.log('1️⃣  DOCUMENTOS GDV EN EXCEL:');
    console.log('─────────────────────────────────────────────────────────────');
    
    const excelDocs = await pool.request().query(`
      SELECT 
        e.NUDO,
        e.FEEMDO,
        e.ESDO,
        e.ESPGDO,
        e.TIGEDO,
        e.SUDO,
        e.VANEDO,
        d.ESLIDO
      FROM dbo.MAEEDO e
      LEFT JOIN dbo.MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      WHERE e.TIDO = 'GDV'
        AND e.NUDO IN (${excelNudos.map(n => `'${n}'`).join(',')})
      ORDER BY e.NUDO
    `);

    console.log('NUDO         Fecha      ESDO  ESPGDO  ESLIDO  SUDO  Monto');
    console.log('──────────────────────────────────────────────────────────────');
    excelDocs.recordset.forEach((row: any) => {
      const fecha = new Date(row.FEEMDO).toISOString().split('T')[0];
      console.log(
        `${row.NUDO}  ${fecha}  ${(row.ESDO || '').padEnd(4)}  ` +
        `${(row.ESPGDO || '').padEnd(6)}  ${(row.ESLIDO || '').padEnd(6)}  ` +
        `${row.SUDO}   ${row.VANEDO}`
      );
    });
    console.log('');

    // 2. Ver qué tienen en común estos documentos vs los que NO están
    console.log('2️⃣  COMPARACIÓN: GDV EN EXCEL vs GDV NO EN EXCEL (Octubre):');
    console.log('─────────────────────────────────────────────────────────────');
    
    const comparison = await pool.request().query(`
      SELECT 
        CASE WHEN NUDO IN (${excelNudos.map(n => `'${n}'`).join(',')}) THEN 'EN_EXCEL' ELSE 'NO_EXCEL' END as Grupo,
        COUNT(DISTINCT ESDO) as Estados_ESDO,
        COUNT(DISTINCT ESPGDO) as Estados_ESPGDO,
        COUNT(*) as Cantidad,
        MIN(ESDO) as ESDO_Min,
        MAX(ESDO) as ESDO_Max,
        MIN(ESPGDO) as ESPGDO_Min,
        MAX(ESPGDO) as ESPGDO_Max
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
        AND MONTH(FEEMDO) = 10
      GROUP BY CASE WHEN NUDO IN (${excelNudos.map(n => `'${n}'`).join(',')}) THEN 'EN_EXCEL' ELSE 'NO_EXCEL' END
    `);

    console.log('Grupo      Cantidad  ESDO_Min  ESDO_Max  ESPGDO_Min  ESPGDO_Max');
    console.log('───────────────────────────────────────────────────────────────');
    comparison.recordset.forEach((row: any) => {
      console.log(
        `${row.Grupo.padEnd(10)} ${String(row.Cantidad).padEnd(8)}  ` +
        `${(row.ESDO_Min || 'NULL').padEnd(8)}  ${(row.ESDO_Max || 'NULL').padEnd(8)}  ` +
        `${(row.ESPGDO_Min || 'NULL').padEnd(10)}  ${(row.ESPGDO_Max || 'NULL').padEnd(10)}`
      );
    });
    console.log('');

    // 3. Ver los primeros 5 GDV que NO están en Excel (octubre)
    console.log('3️⃣  EJEMPLOS DE GDV NO EN EXCEL (Octubre):');
    console.log('─────────────────────────────────────────────────────────────');
    
    const notInExcel = await pool.request().query(`
      SELECT TOP 5
        e.NUDO,
        e.FEEMDO,
        e.ESDO,
        e.ESPGDO,
        e.TIGEDO,
        e.SUDO,
        e.VANEDO
      FROM dbo.MAEEDO e
      WHERE e.TIDO = 'GDV'
        AND e.SUDO IN ('004', '006', '007')
        AND YEAR(e.FEEMDO) = 2025
        AND MONTH(e.FEEMDO) = 10
        AND e.NUDO NOT IN (${excelNudos.map(n => `'${n}'`).join(',')})
      ORDER BY e.FEEMDO DESC
    `);

    console.log('NUDO         Fecha      ESDO  ESPGDO  SUDO  Monto');
    console.log('────────────────────────────────────────────────────');
    notInExcel.recordset.forEach((row: any) => {
      const fecha = new Date(row.FEEMDO).toISOString().split('T')[0];
      console.log(
        `${row.NUDO}  ${fecha}  ${(row.ESDO || '').padEnd(4)}  ` +
        `${(row.ESPGDO || '').padEnd(6)}  ${row.SUDO}   ${row.VANEDO}`
      );
    });
    console.log('');

    // 4. Analizar campos de estado con más detalle
    console.log('4️⃣  ANÁLISIS DETALLADO DE CAMPOS EN GDV EXCEL:');
    console.log('─────────────────────────────────────────────────────────────');
    
    const detailedExcel = await pool.request().query(`
      SELECT DISTINCT
        e.ESDO,
        e.ESPGDO,
        e.TIGEDO,
        COUNT(*) as Cantidad
      FROM dbo.MAEEDO e
      WHERE e.TIDO = 'GDV'
        AND e.NUDO IN (${excelNudos.map(n => `'${n}'`).join(',')})
      GROUP BY e.ESDO, e.ESPGDO, e.TIGEDO
    `);

    console.log('ESDO  ESPGDO  TIGEDO  Cantidad');
    console.log('─────────────────────────────────');
    detailedExcel.recordset.forEach((row: any) => {
      console.log(
        `${(row.ESDO || 'NULL').padEnd(4)}  ${(row.ESPGDO || 'NULL').padEnd(6)}  ` +
        `${(row.TIGEDO || 'NULL').padEnd(6)}  ${row.Cantidad}`
      );
    });
    console.log('');

    console.log('💡 CONCLUSIÓN:');
    console.log('   Los GDV del Excel tienen ESDO y ESPGDO vacíos/NULL');
    console.log('   Esto significa que son documentos PENDIENTES (no cerrados)');
    console.log('   El filtro debería ser: TIDO=\'GDV\' AND (ESDO IS NULL OR ESDO = \'\')');
    console.log('');

    await pool.close();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (pool) await pool.close();
    throw error;
  }
}

findExcelFilter()
  .then(() => {
    console.log('🎉 Análisis completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
