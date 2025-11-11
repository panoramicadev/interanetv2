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
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

async function testNVVStructure() {
  let pool: mssql.ConnectionPool | null = null;
  
  try {
    console.log('🔍 Conectando a SQL Server...');
    pool = await mssql.connect(sqlServerConfig);
    console.log('✅ Conexión exitosa\n');
    
    // Query 1: Ver estructura de MAEEDO para NVV
    console.log('📋 ESTRUCTURA DE MAEEDO (Encabezados NVV):');
    const maeedoQuery = `
      SELECT TOP 5
        IDMAEEDO, TIDO, NUDO, ENDO, SUDO, FEEMDO, FEER
      FROM MAEEDO
      WHERE TIDO = 'NVV'
        AND SUDO IN ('004', '006', '007')
      ORDER BY FEEMDO DESC
    `;
    const maeedoResult = await pool.request().query(maeedoQuery);
    console.log(JSON.stringify(maeedoResult.recordset, null, 2));
    console.log(`\n✅ ${maeedoResult.recordset.length} registros de encabezados\n`);
    
    // Query 2: Ver estructura de MAEDDO para NVV con ESLIDO
    console.log('📋 ESTRUCTURA DE MAEDDO (Líneas NVV) con ESLIDO:');
    const maeddoQuery = `
      SELECT TOP 10
        DD.IDMAEDDO, DD.IDMAEEDO, DD.KOPRCT, DD.NOKOPR,
        DD.CAPRCO1, DD.CAPRAD1, DD.CAPREX1,
        DD.CAPRCO2, DD.CAPRAD2, DD.CAPREX2,
        DD.ESLIDO,
        DO.NUDO, DO.SUDO
      FROM MAEDDO DD
      INNER JOIN MAEEDO DO ON DD.IDMAEEDO = DO.IDMAEEDO
      WHERE DO.TIDO = 'NVV'
        AND DO.SUDO IN ('004', '006', '007')
      ORDER BY DO.FEEMDO DESC
    `;
    const maeddoResult = await pool.request().query(maeddoQuery);
    console.log(JSON.stringify(maeddoResult.recordset, null, 2));
    console.log(`\n✅ ${maeddoResult.recordset.length} registros de líneas\n`);
    
    // Query 3: Contar NVV abiertas vs cerradas
    console.log('📊 CONTEO DE NVV POR ESTADO (ESLIDO):');
    const estadoQuery = `
      SELECT 
        CASE 
          WHEN DD.ESLIDO IS NULL OR DD.ESLIDO = '' THEN 'ABIERTO'
          WHEN DD.ESLIDO = 'C' THEN 'CERRADO'
          ELSE 'OTRO: ' + DD.ESLIDO
        END AS Estado,
        COUNT(DISTINCT DO.IDMAEEDO) AS Documentos,
        COUNT(*) AS Lineas
      FROM MAEDDO DD
      INNER JOIN MAEEDO DO ON DD.IDMAEEDO = DO.IDMAEEDO
      WHERE DO.TIDO = 'NVV'
        AND DO.SUDO IN ('004', '006', '007')
        AND DO.FEEMDO >= '2025-10-01'
      GROUP BY 
        CASE 
          WHEN DD.ESLIDO IS NULL OR DD.ESLIDO = '' THEN 'ABIERTO'
          WHEN DD.ESLIDO = 'C' THEN 'CERRADO'
          ELSE 'OTRO: ' + DD.ESLIDO
        END
      ORDER BY Estado
    `;
    const estadoResult = await pool.request().query(estadoQuery);
    console.log(JSON.stringify(estadoResult.recordset, null, 2));
    console.log(`\n✅ Conteo por estado completado\n`);
    
    // Query 4: Ver cantidades pendientes
    console.log('📊 CANTIDADES PENDIENTES (últimos 10 documentos):');
    const cantidadesQuery = `
      SELECT TOP 10
        DO.NUDO,
        DO.SUDO,
        DD.KOPRCT,
        DD.CAPRCO1,
        DD.CAPRAD1,
        DD.CAPREX1,
        DD.CAPRCO2,
        DD.CAPRAD2,
        DD.CAPREX2,
        (DD.CAPRCO1 - DD.CAPRAD1 - DD.CAPREX1) AS Pend1,
        (DD.CAPRCO2 - DD.CAPRAD2 - DD.CAPREX2) AS Pend2,
        DD.ESLIDO,
        DD.PPPRNE,
        (DD.CAPRCO2 - DD.CAPRAD2 - DD.CAPREX2) * DD.PPPRNE AS MontoPendiente
      FROM MAEDDO DD
      INNER JOIN MAEEDO DO ON DD.IDMAEEDO = DO.IDMAEEDO
      WHERE DO.TIDO = 'NVV'
        AND DO.SUDO IN ('004', '006', '007')
        AND DO.FEEMDO >= '2025-10-01'
      ORDER BY DO.FEEMDO DESC
    `;
    const cantidadesResult = await pool.request().query(cantidadesQuery);
    console.log(JSON.stringify(cantidadesResult.recordset, null, 2));
    console.log(`\n✅ Análisis de cantidades completado\n`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.originalError) {
      console.error('Detalles:', error.originalError.message);
    }
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexión cerrada');
    }
  }
}

testNVVStructure();
