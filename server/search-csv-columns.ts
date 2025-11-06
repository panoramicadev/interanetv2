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
  requestTimeout: 30000,
};

// Columnas del CSV de ventas
const csvColumns = [
  'IDMAEEDO', 'TIDO', 'NUDO', 'ENDO', 'SUENDO', 'SUDO', 'FEEMDO', 'FEULVEDO', 
  'KOFUDO', 'MODO', 'TIMODO', 'TAMODO', 'CAPRAD', 'CAPREX', 'VANEDO', 'VAIVDO', 
  'VABRDO', 'LILG', 'NULIDO', 'SULIDO', 'LUVTLIDO', 'BOSULIDO', 'KOFULIDO', 
  'PRCT', 'TICT', 'TIPR', 'NUSEPR', 'KOPRCT', 'UDTRPR', 'RLUDPR', 'CAPRCO1', 
  'CAPRAD1', 'CAPREX1', 'CAPRNC1', 'UD01PR', 'CAPRCO2', 'CAPRAD2', 'CAPREX2', 
  'CAPRNC2', 'UD02PR', 'PPPRNE', 'PPPRBR', 'VANELI', 'VABRLI', 'FEEMLI', 
  'FEERLI', 'PPPRPM', 'PPPRPMIFRS', 'LOGISTICA', 'ESLIDO', 'PPPRNERE1', 
  'PPPRNERE2', 'IDMAEDDO', 'FMPR', 'MRPR', 'ZONA', 'RUEN', 'RECAPRRE', 
  'PFPR', 'HFPR', 'MONTO', 'OCDO', 'NOKOPRCT', 'NOKOZO', 'NOSUDO', 'NOKOFU', 
  'NOKOFUDO', 'NOBOSULI', 'NOKOEN', 'NORUEN', 'NOMRPR', 'NOFMPR', 'NOPFPR', 
  'NOHFPR', 'DEVOL1', 'DEVOL2', 'STOCKFIS', 'LISTACOST', 'LISCOSMOD'
];

async function searchColumnsInSqlServer() {
  try {
    console.log('🔍 Conectando a SQL Server...');
    const pool = await mssql.connect(sqlServerConfig);
    console.log('✅ Conectado exitosamente\n');

    console.log('📊 Buscando columnas en las tablas del sistema...\n');

    // Query para buscar en qué tablas están estas columnas
    const query = `
      SELECT 
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.COLUMN_NAME IN (${csvColumns.map(col => `'${col}'`).join(', ')})
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `;

    const result = await pool.request().query(query);

    // Agrupar por tabla
    const tableMap = new Map<string, any[]>();
    
    result.recordset.forEach((row: any) => {
      if (!tableMap.has(row.TABLE_NAME)) {
        tableMap.set(row.TABLE_NAME, []);
      }
      tableMap.get(row.TABLE_NAME)!.push(row);
    });

    console.log(`📋 Encontradas ${result.recordset.length} columnas en ${tableMap.size} tablas\n`);
    console.log('=' .repeat(100));

    // Mostrar resultados por tabla
    for (const [tableName, columns] of tableMap.entries()) {
      console.log(`\n📁 TABLA: ${tableName}`);
      console.log('─'.repeat(100));
      console.log(`Total columnas encontradas: ${columns.length}\n`);
      
      columns.forEach((col: any) => {
        const dataType = col.CHARACTER_MAXIMUM_LENGTH 
          ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
          : col.NUMERIC_PRECISION 
          ? `${col.DATA_TYPE}(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE || 0})`
          : col.DATA_TYPE;
        
        console.log(`  - ${col.COLUMN_NAME.padEnd(20)} : ${dataType}`);
      });
    }

    // Verificar columnas no encontradas
    const foundColumns = new Set(result.recordset.map((row: any) => row.COLUMN_NAME));
    const notFoundColumns = csvColumns.filter(col => !foundColumns.has(col));

    if (notFoundColumns.length > 0) {
      console.log('\n\n⚠️  COLUMNAS NO ENCONTRADAS EN SQL SERVER:');
      console.log('─'.repeat(100));
      notFoundColumns.forEach(col => console.log(`  ❌ ${col}`));
    }

    // Crear query sugerida basada en la tabla principal
    console.log('\n\n💡 QUERY SUGERIDA:');
    console.log('─'.repeat(100));
    
    // Buscar tabla principal (probablemente MAEEDO + MAEDDO para encabezado y detalle)
    const mainTables = Array.from(tableMap.keys()).filter(t => 
      t.includes('MAE') || t.includes('LIDO')
    );
    
    if (mainTables.length > 0) {
      console.log('\nTablas principales identificadas:', mainTables.join(', '));
      console.log('\nEjemplo de query para extraer estos datos:\n');
      
      if (mainTables.includes('MAEEDO') && mainTables.includes('MAEDDO')) {
        console.log(`SELECT`);
        const maeedo = tableMap.get('MAEEDO') || [];
        const maeddo = tableMap.get('MAEDDO') || [];
        
        maeedo.forEach((col: any, idx: number) => {
          console.log(`  e.${col.COLUMN_NAME}${idx < maeedo.length - 1 || maeddo.length > 0 ? ',' : ''}`);
        });
        maeddo.forEach((col: any, idx: number) => {
          console.log(`  d.${col.COLUMN_NAME}${idx < maeddo.length - 1 ? ',' : ''}`);
        });
        console.log(`FROM MAEEDO e`);
        console.log(`LEFT JOIN MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO`);
      }
    }

    await pool.close();
    console.log('\n✅ Análisis completado\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

searchColumnsInSqlServer();
