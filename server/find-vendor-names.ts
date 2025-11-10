import mssql from 'mssql';

async function findVendorNames() {
  try {
    console.log('🔄 Conectando a SQL Server...');
    const pool = await mssql.connect({
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
    });

    console.log('✅ Conectado a SQL Server');

    // Mostrar todos los vendedores de TABFU
    console.log('\n📋 Consultando todos los vendedores en TABFU (Tabla de Funcionarios)...\n');
    const allVendors = await pool.request().query(`
      SELECT KOFU, NOKOFU 
      FROM dbo.TABFU 
      WHERE NOKOFU IS NOT NULL AND NOKOFU != ''
      ORDER BY KOFU
    `);
    
    console.log(`✅ Total de vendedores encontrados: ${allVendors.recordset.length}\n`);
    
    console.log('📋 Lista completa de vendedores:');
    allVendors.recordset.forEach(row => {
      console.log(`  ${row.KOFU} -> ${row.NOKOFU}`);
    });

    // Códigos de vendedor que necesitamos mapear de nvv_pending_sales
    const nvvCodes = ['PCH', 'CLC', 'BGB', 'NFL', 'BLP', 'MUG', 'DCG', 'LGM', 'MLT', '004', 'PSV'];
    
    console.log('\n📋 Buscando mapeos para códigos de NVV...\n');
    
    // Crear un mapeo manual basado en iniciales
    const manualMappings: { [key: string]: string | null } = {};
    
    for (const nvvCode of nvvCodes) {
      const match = allVendors.recordset.find(v => v.KOFU === nvvCode);
      if (match) {
        manualMappings[nvvCode] = match.NOKOFU;
        console.log(`✅ ${nvvCode} -> ${match.NOKOFU} (match directo)`);
      } else {
        manualMappings[nvvCode] = null;
        console.log(`❌ ${nvvCode} -> NO ENCONTRADO EN TABFU`);
      }
    }

    await pool.close();
    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findVendorNames();
