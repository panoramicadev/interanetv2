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

// Todas las columnas del CSV
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

async function searchAllColumns() {
  try {
    console.log('🔍 Conectando a SQL Server...');
    const pool = await mssql.connect(sqlServerConfig);
    console.log('✅ Conectado exitosamente\n');

    console.log('📊 Buscando TODAS las columnas en el sistema...\n');

    // Buscar cada columna individualmente
    const results = new Map<string, any[]>();
    
    for (const columnName of csvColumns) {
      const query = `
        SELECT 
          c.TABLE_SCHEMA,
          c.TABLE_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.NUMERIC_PRECISION,
          c.NUMERIC_SCALE,
          c.IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.COLUMN_NAME = @columnName
        ORDER BY c.TABLE_NAME
      `;

      const result = await pool.request()
        .input('columnName', mssql.NVarChar, columnName)
        .query(query);

      if (result.recordset.length > 0) {
        results.set(columnName, result.recordset);
      }
    }

    console.log(`✅ Encontradas ${results.size} de ${csvColumns.length} columnas\n`);
    console.log('='.repeat(120));

    // Mostrar resultados agrupados por columna
    const foundColumns: string[] = [];
    for (const [columnName, tables] of results.entries()) {
      foundColumns.push(columnName);
      console.log(`\n📌 COLUMNA: ${columnName}`);
      console.log('─'.repeat(120));
      console.log(`   Encontrada en ${tables.length} tabla(s):\n`);
      
      tables.forEach((col: any) => {
        const dataType = col.CHARACTER_MAXIMUM_LENGTH 
          ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
          : col.NUMERIC_PRECISION 
          ? `${col.DATA_TYPE}(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE || 0})`
          : col.DATA_TYPE;
        
        console.log(`   • ${col.TABLE_SCHEMA}.${col.TABLE_NAME.padEnd(25)} → ${dataType.padEnd(20)} ${col.IS_NULLABLE === 'YES' ? '(nullable)' : '(not null)'}`);
      });
    }

    // Verificar columnas NO encontradas
    const notFoundColumns = csvColumns.filter(col => !results.has(col));

    console.log('\n\n');
    console.log('='.repeat(120));
    console.log('⚠️  COLUMNAS NO ENCONTRADAS EN SQL SERVER');
    console.log('='.repeat(120));
    console.log(`Total: ${notFoundColumns.length} columnas\n`);

    if (notFoundColumns.length > 0) {
      // Buscar columnas similares para cada una que falta
      for (const missingCol of notFoundColumns) {
        console.log(`\n❌ ${missingCol}`);
        
        // Buscar columnas con nombres similares
        const similarQuery = `
          SELECT TOP 5
            TABLE_NAME,
            COLUMN_NAME,
            DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE COLUMN_NAME LIKE '%${missingCol.substring(0, 4)}%'
             OR COLUMN_NAME LIKE '%${missingCol.substring(missingCol.length - 4)}%'
          ORDER BY 
            CASE 
              WHEN COLUMN_NAME = '${missingCol}' THEN 0
              WHEN COLUMN_NAME LIKE '${missingCol}%' THEN 1
              WHEN COLUMN_NAME LIKE '%${missingCol}' THEN 2
              ELSE 3
            END,
            TABLE_NAME
        `;

        try {
          const similarResult = await pool.request().query(similarQuery);
          if (similarResult.recordset.length > 0) {
            console.log('   Columnas similares encontradas:');
            similarResult.recordset.forEach((row: any) => {
              console.log(`   → ${row.TABLE_NAME}.${row.COLUMN_NAME} (${row.DATA_TYPE})`);
            });
          }
        } catch (err) {
          // Ignorar errores de búsqueda de similares
        }
      }
    }

    // Resumen de tablas principales
    console.log('\n\n');
    console.log('='.repeat(120));
    console.log('📋 RESUMEN DE TABLAS PRINCIPALES');
    console.log('='.repeat(120));
    
    const tableCount = new Map<string, number>();
    for (const [_, tables] of results.entries()) {
      tables.forEach((col: any) => {
        const tableName = col.TABLE_NAME;
        tableCount.set(tableName, (tableCount.get(tableName) || 0) + 1);
      });
    }

    const sortedTables = Array.from(tableCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('\nTop 10 tablas con más columnas del CSV:\n');
    sortedTables.forEach(([table, count]) => {
      console.log(`   ${count.toString().padStart(2)} columnas → ${table}`);
    });

    await pool.close();
    console.log('\n✅ Análisis exhaustivo completado\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

searchAllColumns();
