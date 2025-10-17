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

async function checkLILG() {
  let pool: mssql.ConnectionPool | null = null;

  try {
    console.log('🔍 ANÁLISIS DEL CAMPO LILG EN GDV');
    console.log('═══════════════════════════════════════════════════════════\n');

    pool = new mssql.ConnectionPool(sqlServerConfig);
    await pool.connect();

    // 1. Ver distribución de GDV por LILG
    console.log('1️⃣  DISTRIBUCIÓN DE GDV POR CAMPO LILG:');
    console.log('─────────────────────────────────────────────────────────────');
    
    const byLILG = await pool.request().query(`
      SELECT 
        LILG,
        ESDO,
        ESPGDO,
        COUNT(*) as Cantidad,
        SUM(VANEDO) as Monto_Total
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
      GROUP BY LILG, ESDO, ESPGDO
      ORDER BY LILG, ESDO, ESPGDO
    `);

    console.log('LILG  ESDO  ESPGDO  Cantidad  Monto Total');
    console.log('───────────────────────────────────────────────');
    byLILG.recordset.forEach((row: any) => {
      console.log(
        `${(row.LILG || 'NULL').padEnd(4)}  ${(row.ESDO || '').padEnd(4)}  ` +
        `${(row.ESPGDO || '').padEnd(6)}  ${String(row.Cantidad).padEnd(8)}  ` +
        `${Math.round(row.Monto_Total || 0)}`
      );
    });
    console.log('');

    // 2. Ver GDV con LILG='SI' y ESDO vacío
    console.log('2️⃣  GDV con LILG=\'SI\' (deberían aparecer en Excel):');
    console.log('─────────────────────────────────────────────────────────────');
    
    const withLILG = await pool.request().query(`
      SELECT 
        COUNT(*) as Total_GDV_LILG_SI,
        COUNT(DISTINCT NUDO) as Documentos_Unicos,
        MIN(FEEMDO) as Fecha_Min,
        MAX(FEEMDO) as Fecha_Max
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
        AND LILG = 'SI'
    `);

    const stats = withLILG.recordset[0];
    console.log(`Total GDV con LILG='SI': ${stats.Total_GDV_LILG_SI}`);
    console.log(`Documentos únicos: ${stats.Documentos_Unicos}`);
    console.log(`Rango fechas: ${new Date(stats.Fecha_Min).toISOString().split('T')[0]} → ${new Date(stats.Fecha_Max).toISOString().split('T')[0]}`);
    console.log('');

    // 3. Ver distribución mensual de GDV con LILG='SI'
    console.log('3️⃣  DISTRIBUCIÓN MENSUAL DE GDV CON LILG=\'SI\':');
    console.log('─────────────────────────────────────────────────────────────');
    
    const monthly = await pool.request().query(`
      SELECT 
        CONVERT(VARCHAR(7), FEEMDO, 120) as Mes,
        COUNT(*) as Cantidad,
        SUM(VANEDO) as Monto
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
        AND LILG = 'SI'
      GROUP BY CONVERT(VARCHAR(7), FEEMDO, 120)
      ORDER BY Mes
    `);

    console.log('Mes        Cantidad  Monto');
    console.log('─────────────────────────────────');
    monthly.recordset.forEach((row: any) => {
      console.log(`${row.Mes}    ${String(row.Cantidad).padEnd(8)}  ${Math.round(row.Monto || 0)}`);
    });
    console.log('');

    // 4. Ver últimos GDV con LILG='SI'
    console.log('4️⃣  ÚLTIMOS GDV CON LILG=\'SI\':');
    console.log('─────────────────────────────────────────────────────────────');
    
    const recent = await pool.request().query(`
      SELECT TOP 15
        NUDO,
        FEEMDO,
        ESDO,
        ESPGDO,
        LILG,
        VANEDO,
        SUDO
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
        AND LILG = 'SI'
      ORDER BY FEEMDO DESC, NUDO DESC
    `);

    console.log('NUDO         Fecha      ESDO  ESPGDO  Monto      Suc');
    console.log('────────────────────────────────────────────────────────');
    recent.recordset.forEach((row: any) => {
      const fecha = new Date(row.FEEMDO).toISOString().split('T')[0];
      console.log(
        `${row.NUDO}  ${fecha}  ${(row.ESDO || '').padEnd(4)}  ` +
        `${(row.ESPGDO || '').padEnd(6)}  ${String(row.VANEDO || 0).padEnd(10)} ${row.SUDO}`
      );
    });
    console.log('');

    // 5. Comparar con total de GDV
    console.log('5️⃣  COMPARACIÓN TOTAL:');
    console.log('─────────────────────────────────────────────────────────────');
    
    const totals = await pool.request().query(`
      SELECT 
        COUNT(*) FILTER (WHERE LILG = 'SI') as Con_LILG_SI,
        COUNT(*) FILTER (WHERE LILG IS NULL OR LILG != 'SI') as Sin_LILG_SI,
        COUNT(*) as Total_GDV
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
    `);

    const total = totals.recordset[0];
    console.log(`GDV con LILG='SI': ${total.Con_LILG_SI}`);
    console.log(`GDV sin LILG='SI': ${total.Sin_LILG_SI}`);
    console.log(`Total GDV: ${total.Total_GDV}`);
    console.log('');

    console.log('💡 CONCLUSIÓN:');
    if (total.Con_LILG_SI === 14) {
      console.log('   ✅ LILG=\'SI\' es el filtro correcto para las GDV del Excel');
    } else {
      console.log(`   ⚠️  LILG='SI' tiene ${total.Con_LILG_SI} registros, pero Excel tiene 14`);
      console.log('   Puede haber otro filtro adicional (fecha, estado, etc.)');
    }
    console.log('');

    await pool.close();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (pool) await pool.close();
    throw error;
  }
}

checkLILG()
  .then(() => {
    console.log('🎉 Análisis completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
