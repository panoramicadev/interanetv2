import sql from 'mssql';

const config: sql.config = {
  server: process.env.SQLSERVER_HOST || 'sql14.vitglobal.net',
  port: parseInt(process.env.SQLSERVER_PORT || '1837'),
  user: process.env.SQLSERVER_USER || 'PANORAMICA_APP',
  password: process.env.SQLSERVER_PASSWORD || '',
  database: process.env.SQLSERVER_DATABASE || 'PANORAMICA',
  options: {
    encrypt: true,
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT === 'true',
    enableArithAbort: true,
    requestTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

console.log(`🔧 SQL Server config: ${config.server}:${config.port} (${config.user}@${config.database})`);

class SQLServerConnection {
  private pool: sql.ConnectionPool | null = null;

  async connect(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    this.pool = await sql.connect(config);
    console.log('✅ Connected to SQL Server successfully');
    return this.pool;
  }

  async query<T = any>(queryText: string): Promise<sql.IResult<T>> {
    const pool = await this.connect();
    return pool.request().query<T>(queryText);
  }

  async reset(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
    await this.connect();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('✅ SQL Server connection closed');
    }
  }
}

export default new SQLServerConnection();
