import sql from 'mssql';

const config: sql.config = {
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
  requestTimeout: 30000,
};

export async function testSqlServerConnection() {
  try {
    console.log('🔄 Intentando conectar a SQL Server...');
    console.log(`   Servidor: ${config.server}:${config.port}`);
    console.log(`   Base de datos: ${config.database}`);
    console.log(`   Usuario: ${config.user}`);
    
    const pool = await sql.connect(config);
    
    console.log('✅ Conexión exitosa a SQL Server');
    
    // Probar una consulta simple
    const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as database_name, @@SERVERNAME as server_name');
    
    if (result.recordset && result.recordset.length > 0) {
      console.log('\n📊 Información del servidor:');
      console.log(`   Nombre del servidor: ${result.recordset[0].server_name}`);
      console.log(`   Base de datos: ${result.recordset[0].database_name}`);
      console.log(`   Versión: ${result.recordset[0].version?.substring(0, 100)}...`);
    }
    
    // Verificar tablas disponibles
    const tablesResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('MAEEDO', 'MAEDDO', 'MAEEN', 'MAEPR', 'MAEVEN', 'TABBO', 'TABPP')
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n📋 Tablas encontradas para ETL:');
    if (tablesResult.recordset && tablesResult.recordset.length > 0) {
      tablesResult.recordset.forEach(table => {
        console.log(`   ✓ ${table.TABLE_SCHEMA}.${table.TABLE_NAME} (${table.TABLE_TYPE})`);
      });
    } else {
      console.log('   ⚠️  No se encontraron las tablas esperadas');
    }
    
    await pool.close();
    console.log('\n✅ Conexión cerrada correctamente');
    
    return true;
  } catch (error: any) {
    console.error('\n❌ Error al conectar a SQL Server:');
    console.error(`   Código: ${error.code || 'N/A'}`);
    console.error(`   Mensaje: ${error.message}`);
    
    if (error.code === 'ESOCKET') {
      console.error('\n💡 Sugerencia: Verifica que:');
      console.error('   - El servidor SQL Server está accesible desde este entorno');
      console.error('   - El puerto 1837 está abierto');
      console.error('   - Las credenciales son correctas');
    }
    
    return false;
  }
}

// Ejecutar la prueba
testSqlServerConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
