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

async function checkGDVStatus() {
  let pool: mssql.ConnectionPool | null = null;

  try {
    console.log('🔍 INVESTIGACIÓN DE ESTADOS GDV vs FCV');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Conectar a SQL Server
    console.log('🔄 Conectando a SQL Server...');
    pool = new mssql.ConnectionPool(sqlServerConfig);
    await pool.connect();
    console.log('✅ Conectado\n');

    // 1. Ver estructura de MAEEDO para identificar campos de estado
    console.log('1️⃣  ESTRUCTURA DE MAEEDO (campos relacionados con estado):');
    console.log('─────────────────────────────────────────────────────────────');
    
    const structure = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.MAEEDO WHERE TIDO = 'GDV'
    `);
    
    if (structure.recordset.length > 0) {
      const gdvSample = structure.recordset[0];
      console.log('Campos disponibles en un documento GDV:');
      Object.keys(gdvSample).forEach(key => {
        if (key.includes('ES') || key.includes('ESTADO') || key.includes('ST')) {
          console.log(`  ${key}: ${gdvSample[key]}`);
        }
      });
    }
    console.log('');

    // 2. Comparar GDV vs FCV - campos de estado
    console.log('2️⃣  COMPARACIÓN GDV vs FCV - Campos de Estado:');
    console.log('─────────────────────────────────────────────────────────────');
    
    const comparison = await pool.request().query(`
      SELECT 
        TIDO,
        ESDO,
        ESPGDO,
        COUNT(*) as Cantidad,
        COUNT(DISTINCT NUDO) as Documentos
      FROM dbo.MAEEDO
      WHERE TIDO IN ('GDV', 'FCV')
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
      GROUP BY TIDO, ESDO, ESPGDO
      ORDER BY TIDO, ESDO, ESPGDO
    `);

    console.log('TIDO  ESDO  ESPGDO  Cantidad  Documentos');
    console.log('─────────────────────────────────────────');
    comparison.recordset.forEach((row: any) => {
      console.log(
        `${row.TIDO}   ${(row.ESDO || 'NULL').padEnd(5)} ${(row.ESPGDO || 'NULL').padEnd(7)} ` +
        `${String(row.Cantidad).padEnd(9)} ${row.Documentos}`
      );
    });
    console.log('');

    // 3. Ver ejemplos de GDV con diferentes estados
    console.log('3️⃣  EJEMPLOS DE DOCUMENTOS GDV (últimos 10):');
    console.log('─────────────────────────────────────────────────────────────');
    
    const gdvExamples = await pool.request().query(`
      SELECT TOP 10
        NUDO,
        FEEMDO,
        ESDO,
        ESPGDO,
        TIGEDO,
        KOFUDO,
        VANEDO,
        SUDO
      FROM dbo.MAEEDO
      WHERE TIDO = 'GDV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
      ORDER BY FEEMDO DESC, NUDO DESC
    `);

    console.log('NUDO         Fecha      ESDO  ESPGDO  TIGEDO  Vendedor  Monto      Suc');
    console.log('─────────────────────────────────────────────────────────────────────────');
    gdvExamples.recordset.forEach((row: any) => {
      const fecha = new Date(row.FEEMDO).toISOString().split('T')[0];
      console.log(
        `${row.NUDO}  ${fecha}  ${(row.ESDO || '').padEnd(4)}  ` +
        `${(row.ESPGDO || '').padEnd(6)}  ${(row.TIGEDO || '').padEnd(6)}  ` +
        `${(row.KOFUDO || '').padEnd(8)}  ${String(row.VANEDO || 0).padEnd(10)} ${row.SUDO}`
      );
    });
    console.log('');

    // 4. Ver ejemplos de FCV con diferentes estados
    console.log('4️⃣  EJEMPLOS DE DOCUMENTOS FCV (últimos 10):');
    console.log('─────────────────────────────────────────────────────────────');
    
    const fcvExamples = await pool.request().query(`
      SELECT TOP 10
        NUDO,
        FEEMDO,
        ESDO,
        ESPGDO,
        TIGEDO,
        KOFUDO,
        VANEDO,
        SUDO
      FROM dbo.MAEEDO
      WHERE TIDO = 'FCV'
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
      ORDER BY FEEMDO DESC, NUDO DESC
    `);

    console.log('NUDO         Fecha      ESDO  ESPGDO  TIGEDO  Vendedor  Monto      Suc');
    console.log('─────────────────────────────────────────────────────────────────────────');
    fcvExamples.recordset.forEach((row: any) => {
      const fecha = new Date(row.FEEMDO).toISOString().split('T')[0];
      console.log(
        `${row.NUDO}  ${fecha}  ${(row.ESDO || '').padEnd(4)}  ` +
        `${(row.ESPGDO || '').padEnd(6)}  ${(row.TIGEDO || '').padEnd(6)}  ` +
        `${(row.KOFUDO || '').padEnd(8)}  ${String(row.VANEDO || 0).padEnd(10)} ${row.SUDO}`
      );
    });
    console.log('');

    // 5. Entender los estados
    console.log('5️⃣  INTERPRETACIÓN DE ESTADOS:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('ESDO (Estado Documento):');
    console.log('  C = Cerrado/Completado');
    console.log('  N = Nulo/Anulado');
    console.log('  (vacío) = Pendiente/Abierto');
    console.log('');
    console.log('ESPGDO (Estado Pago Documento):');
    console.log('  S = Sin Pagar (típico de GDV)');
    console.log('  C = Cerrado/Completado (típico de FCV)');
    console.log('  P = Pendiente de pago (típico de FCV)');
    console.log('');
    console.log('💡 CONCLUSIÓN:');
    console.log('   GDV (Guías de Venta) son documentos SIN PAGAR (ESPGDO=S)');
    console.log('   FCV (Facturas de Venta) son documentos CERRADOS (ESPGDO=C/P)');
    console.log('   Los GDV se convierten en FCV cuando se facturan/pagan.');
    console.log('');

    // 6. Contar totales por estado
    console.log('6️⃣  TOTALES 2025 POR TIPO Y ESTADO:');
    console.log('─────────────────────────────────────────────────────────────');
    
    const totals = await pool.request().query(`
      SELECT 
        TIDO,
        CASE 
          WHEN ESDO IS NULL OR ESDO = '' THEN 'SIN_ESTADO'
          ELSE ESDO
        END as Estado,
        COUNT(*) as Total_Encabezados,
        COUNT(DISTINCT NUDO) as Documentos_Unicos,
        SUM(VANEDO) as Monto_Total
      FROM dbo.MAEEDO
      WHERE TIDO IN ('GDV', 'FCV')
        AND SUDO IN ('004', '006', '007')
        AND YEAR(FEEMDO) = 2025
      GROUP BY TIDO, 
        CASE 
          WHEN ESDO IS NULL OR ESDO = '' THEN 'SIN_ESTADO'
          ELSE ESDO
        END
      ORDER BY TIDO, Estado
    `);

    console.log('TIDO  Estado        Encabezados  Documentos  Monto Total');
    console.log('─────────────────────────────────────────────────────────');
    totals.recordset.forEach((row: any) => {
      console.log(
        `${row.TIDO}   ${row.Estado.padEnd(12)} ${String(row.Total_Encabezados).padEnd(12)} ` +
        `${String(row.Documentos_Unicos).padEnd(11)} ${String(Math.round(row.Monto_Total || 0)).padStart(15)}`
      );
    });
    console.log('');

    await pool.close();
    console.log('✅ Análisis completado\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (pool) await pool.close();
    throw error;
  }
}

checkGDVStatus()
  .then(() => {
    console.log('🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en el proceso:', error.message);
    process.exit(1);
  });
