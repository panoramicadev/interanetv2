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

interface VerificationResult {
  csvColumn: string;
  table: string;
  sqlColumn: string;
  exists: boolean;
  hasData: boolean;
  sampleValue: any;
  joinWorks: boolean;
  notes: string;
}

async function verify100Percent() {
  const results: VerificationResult[] = [];
  
  try {
    console.log('🔍 VERIFICACIÓN 100% DE CERTEZA - INICIANDO...\n');
    console.log('='.repeat(120));
    const pool = await mssql.connect(sqlServerConfig);

    // Definir todas las verificaciones
    const verifications = [
      { csv: 'NOKOPRCT', table: 'MAEPR', keyCol: 'KOPR', nameCol: 'NOKOPR', description: 'Nombre producto' },
      { csv: 'NOKOEN', table: 'MAEEN', keyCol: 'KOEN', nameCol: 'NOKOEN', description: 'Nombre cliente' },
      { csv: 'NOKOFU', table: 'TABFU', keyCol: 'KOFU', nameCol: 'NOKOFU', description: 'Nombre funcionario' },
      { csv: 'NOKOFUDO', table: 'TABFU', keyCol: 'KOFU', nameCol: 'NOKOFU', description: 'Nombre funcionario línea (mismo que NOKOFU)' },
      { csv: 'NOSUDO', table: 'TABSU', keyCol: 'KOSU', nameCol: 'NOKOSU', description: 'Nombre sucursal' },
      { csv: 'NOBOSULI', table: 'TABBO', keyCol: 'KOBO', nameCol: 'NOKOBO', description: 'Nombre bodega' },
      { csv: 'NOKOZO', table: 'TABZO', keyCol: 'KOZO', nameCol: 'NOKOZO', description: 'Nombre zona' },
      { csv: 'NORUEN', table: 'TABRU', keyCol: 'KORU', nameCol: 'NOKORU', description: 'Nombre ruta/segmento' },
      { csv: 'NOMRPR', table: 'TABMR', keyCol: 'KOMR', nameCol: 'NOKOMR', description: 'Nombre marca' },
      { csv: 'NOFMPR', table: 'TABFM', keyCol: 'KOFM', nameCol: 'NOKOFM', description: 'Nombre familia' },
      { csv: 'NOPFPR', table: 'TABPF', keyCol: 'KOPF', nameCol: 'NOKOPF', description: 'Nombre sub-familia' },
      { csv: 'NOHFPR', table: 'TABHF', keyCol: 'KOHF', nameCol: 'NOKOHF', description: 'Nombre marca comercial' },
      { csv: 'ZONA', table: 'MAEPR', keyCol: 'KOPR', nameCol: 'ZONAPR', description: 'Código de zona producto' },
    ];

    for (const verify of verifications) {
      console.log(`\n📋 Verificando: ${verify.csv} → ${verify.table}.${verify.nameCol}`);
      console.log('─'.repeat(120));

      let result: VerificationResult = {
        csvColumn: verify.csv,
        table: verify.table,
        sqlColumn: verify.nameCol,
        exists: false,
        hasData: false,
        sampleValue: null,
        joinWorks: false,
        notes: ''
      };

      try {
        // 1. Verificar que la columna existe
        const colCheck = await pool.request().query(`
          SELECT COUNT(*) as cnt
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${verify.table}'
            AND COLUMN_NAME = '${verify.nameCol}'
        `);
        
        result.exists = colCheck.recordset[0].cnt > 0;
        console.log(`   ✓ Columna existe: ${result.exists ? '✅ SÍ' : '❌ NO'}`);

        if (!result.exists) {
          // Buscar columnas similares
          const similarCols = await pool.request().query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${verify.table}'
            ORDER BY COLUMN_NAME
          `);
          result.notes = `Columnas disponibles: ${similarCols.recordset.map(c => c.COLUMN_NAME).join(', ')}`;
          results.push(result);
          continue;
        }

        // 2. Verificar que tiene datos
        const dataCheck = await pool.request().query(`
          SELECT TOP 1 ${verify.keyCol}, ${verify.nameCol}
          FROM ${verify.table}
          WHERE ${verify.nameCol} IS NOT NULL
            AND ${verify.nameCol} != ''
        `);

        result.hasData = dataCheck.recordset.length > 0;
        result.sampleValue = result.hasData ? dataCheck.recordset[0][verify.nameCol] : null;
        
        console.log(`   ✓ Tiene datos: ${result.hasData ? '✅ SÍ' : '⚠️  NO (tabla vacía)'}`);
        if (result.hasData) {
          console.log(`   ✓ Valor ejemplo: "${result.sampleValue}"`);
        }

        // 3. Verificar que el JOIN funciona (solo si es una tabla de lookup)
        if (verify.table !== 'MAEPR' && verify.table !== 'MAEEN') {
          try {
            let joinQuery = '';
            
            // Determinar la tabla fuente y campo de relación
            if (verify.table === 'TABFU') {
              if (verify.csv === 'NOKOFU') {
                joinQuery = `
                  SELECT TOP 1 e.KOFUDO, fu.NOKOFU
                  FROM MAEEDO e
                  LEFT JOIN ${verify.table} fu ON e.KOFUDO = fu.${verify.keyCol}
                  WHERE e.KOFUDO IS NOT NULL AND fu.NOKOFU IS NOT NULL
                `;
              } else {
                joinQuery = `
                  SELECT TOP 1 d.KOFULIDO, fu.NOKOFU
                  FROM MAEDDO d
                  LEFT JOIN ${verify.table} fu ON d.KOFULIDO = fu.${verify.keyCol}
                  WHERE d.KOFULIDO IS NOT NULL AND fu.NOKOFU IS NOT NULL
                `;
              }
            } else if (verify.table === 'TABSU') {
              joinQuery = `
                SELECT TOP 1 e.SUDO, su.NOKOSU
                FROM MAEEDO e
                LEFT JOIN ${verify.table} su ON e.SUDO = su.${verify.keyCol}
                WHERE e.SUDO IS NOT NULL AND su.NOKOSU IS NOT NULL
              `;
            } else if (verify.table === 'TABBO') {
              joinQuery = `
                SELECT TOP 1 d.BOSULIDO, bo.NOKOBO
                FROM MAEDDO d
                LEFT JOIN ${verify.table} bo ON d.BOSULIDO = bo.${verify.keyCol}
                WHERE d.BOSULIDO IS NOT NULL AND bo.NOKOBO IS NOT NULL
              `;
            } else if (verify.table === 'TABZO') {
              joinQuery = `
                SELECT TOP 1 pr.ZONAPR, zo.NOKOZO
                FROM MAEPR pr
                LEFT JOIN ${verify.table} zo ON pr.ZONAPR = zo.${verify.keyCol}
                WHERE pr.ZONAPR IS NOT NULL AND zo.NOKOZO IS NOT NULL
              `;
            } else if (verify.table === 'TABRU') {
              joinQuery = `
                SELECT TOP 1 pr.RUPR, ru.NOKORU
                FROM MAEPR pr
                LEFT JOIN ${verify.table} ru ON pr.RUPR = ru.${verify.keyCol}
                WHERE pr.RUPR IS NOT NULL AND ru.NOKORU IS NOT NULL
              `;
            } else if (verify.table === 'TABMR') {
              joinQuery = `
                SELECT TOP 1 pr.MRPR, mr.NOKOMR
                FROM MAEPR pr
                LEFT JOIN ${verify.table} mr ON pr.MRPR = mr.${verify.keyCol}
                WHERE pr.MRPR IS NOT NULL AND mr.NOKOMR IS NOT NULL
              `;
            } else if (verify.table === 'TABFM') {
              joinQuery = `
                SELECT TOP 1 pr.FMPR, fm.NOKOFM
                FROM MAEPR pr
                LEFT JOIN ${verify.table} fm ON pr.FMPR = fm.${verify.keyCol}
                WHERE pr.FMPR IS NOT NULL AND fm.NOKOFM IS NOT NULL
              `;
            } else if (verify.table === 'TABPF') {
              joinQuery = `
                SELECT TOP 1 pr.PFPR, pf.NOKOPF
                FROM MAEPR pr
                LEFT JOIN ${verify.table} pf ON pr.PFPR = pf.${verify.keyCol}
                WHERE pr.PFPR IS NOT NULL AND pf.NOKOPF IS NOT NULL
              `;
            } else if (verify.table === 'TABHF') {
              joinQuery = `
                SELECT TOP 1 pr.HFPR, hf.NOKOHF
                FROM MAEPR pr
                LEFT JOIN ${verify.table} hf ON pr.HFPR = hf.${verify.keyCol}
                WHERE pr.HFPR IS NOT NULL AND hf.NOKOHF IS NOT NULL
              `;
            }

            if (joinQuery) {
              const joinCheck = await pool.request().query(joinQuery);
              result.joinWorks = joinCheck.recordset.length > 0;
              console.log(`   ✓ JOIN funciona: ${result.joinWorks ? '✅ SÍ' : '⚠️  NO (sin datos relacionados)'}`);
              if (result.joinWorks) {
                const firstCol = Object.keys(joinCheck.recordset[0])[1];
                console.log(`   ✓ Valor JOIN: "${joinCheck.recordset[0][firstCol]}"`);
              }
            }
          } catch (joinError: any) {
            console.log(`   ⚠️  Error en JOIN: ${joinError.message}`);
            result.notes += ` JOIN error: ${joinError.message}`;
          }
        } else {
          // Para MAEPR y MAEEN, el JOIN es directo
          result.joinWorks = result.hasData;
          console.log(`   ✓ JOIN directo: ✅ SÍ (tabla principal)`);
        }

      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        result.notes = `Error: ${error.message}`;
      }

      results.push(result);
    }

    await pool.close();

    // Imprimir resumen final
    console.log('\n\n');
    console.log('='.repeat(120));
    console.log('📊 REPORTE FINAL - 100% CERTEZA');
    console.log('='.repeat(120));
    console.log('\n');

    const fullyVerified = results.filter(r => r.exists && r.hasData && (r.joinWorks || r.table === 'MAEPR' || r.table === 'MAEEN'));
    const partiallyVerified = results.filter(r => r.exists && !r.hasData);
    const notFound = results.filter(r => !r.exists);

    console.log(`✅ VERIFICADO AL 100% (existe + tiene datos + JOIN funciona): ${fullyVerified.length}/13`);
    console.log(`⚠️  EXISTE PERO SIN DATOS (tabla vacía): ${partiallyVerified.length}/13`);
    console.log(`❌ NO ENCONTRADO: ${notFound.length}/13`);
    console.log('\n');

    // Tabla detallada
    console.log('COLUMNA CSV'.padEnd(15) + 'TABLA'.padEnd(10) + 'COLUMNA SQL'.padEnd(15) + 'EXISTE'.padEnd(10) + 'DATOS'.padEnd(10) + 'JOIN'.padEnd(10) + 'ESTADO');
    console.log('─'.repeat(120));
    
    results.forEach(r => {
      const status = r.exists && r.hasData && (r.joinWorks || r.table === 'MAEPR' || r.table === 'MAEEN') 
        ? '✅ 100% VERIFICADO'
        : r.exists && !r.hasData
        ? '⚠️  EXISTE (sin datos)'
        : '❌ NO ENCONTRADO';
      
      console.log(
        r.csvColumn.padEnd(15) +
        r.table.padEnd(10) +
        r.sqlColumn.padEnd(15) +
        (r.exists ? '✅' : '❌').padEnd(10) +
        (r.hasData ? '✅' : '⚠️ ').padEnd(10) +
        (r.joinWorks ? '✅' : '⚠️ ').padEnd(10) +
        status
      );
    });

    console.log('\n');
    console.log('='.repeat(120));
    console.log(`🎯 NIVEL DE CERTEZA FINAL: ${Math.round((fullyVerified.length / results.length) * 100)}%`);
    console.log('='.repeat(120));
    console.log('\n');

    // Detalles de verificación parcial
    if (partiallyVerified.length > 0) {
      console.log('\n⚠️  COLUMNAS QUE EXISTEN PERO NO TIENEN DATOS:');
      console.log('─'.repeat(120));
      partiallyVerified.forEach(r => {
        console.log(`   • ${r.csvColumn} → ${r.table}.${r.sqlColumn}`);
        console.log(`     Razón: La tabla existe, la columna existe, pero no hay registros con datos`);
      });
    }

    if (notFound.length > 0) {
      console.log('\n❌ COLUMNAS NO ENCONTRADAS:');
      console.log('─'.repeat(120));
      notFound.forEach(r => {
        console.log(`   • ${r.csvColumn} → ${r.table}.${r.sqlColumn}`);
        if (r.notes) console.log(`     ${r.notes}`);
      });
    }

    console.log('\n✅ Verificación exhaustiva completada\n');

  } catch (error: any) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

verify100Percent();
