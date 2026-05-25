import mssql from 'mssql';

// Lee el DTE (factura electrónica) directamente del SQL Server de Softland.
// Softland guarda, por documento, el XML legal + el timbre PDF417 ya como imagen
// JPEG (base64) en dbo.FMAEDTE. No hay PDF pre-renderizado: el PDF oficial se
// arma como "representación impresa" desde estos dos campos.

const sqlServerConfig: mssql.config = {
  server: process.env.SQL_SERVER_HOST || '',
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  database: process.env.SQL_SERVER_DATABASE || '',
  user: process.env.SQL_SERVER_USER || '',
  password: process.env.SQL_SERVER_PASSWORD || '',
  options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 30000,
  requestTimeout: 60000,
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise: Promise<mssql.ConnectionPool> | null = null;

async function getPool(): Promise<mssql.ConnectionPool> {
  if (!sqlServerConfig.server || !sqlServerConfig.user) {
    throw new Error('SQL Server no configurado (SQL_SERVER_HOST / SQL_SERVER_USER vacíos)');
  }
  if (!poolPromise) {
    poolPromise = new mssql.ConnectionPool(sqlServerConfig).connect().catch((err) => {
      poolPromise = null; // permitir reintento en la próxima request
      throw err;
    });
  }
  return poolPromise;
}

export interface DteRecord {
  idmaeedo: number;
  tido: string;
  nudo: string;
  endo: string;       // RUT del receptor (cliente)
  tipo: number | null; // tipo DTE SII (33 = factura afecta)
  folio: string;
  xml: string;        // DTE completo
  pdf417: string;     // timbre, base64 JPEG
}

/** Trae el DTE de un documento por su IDMAEEDO. null si no existe o no tiene DTE. */
export async function getDteByIdmaeedo(idmaeedo: number): Promise<DteRecord | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', mssql.Int, idmaeedo)
    .query(`
      SELECT TOP 1
        IDMAEEDO AS idmaeedo, TIDO AS tido, NUDO AS nudo, ENDO AS endo,
        TIPO AS tipo, FOLIO AS folio,
        CAST(XML AS varchar(max)) AS xml,
        CAST(PDF417 AS varchar(max)) AS pdf417
      FROM dbo.FMAEDTE
      WHERE IDMAEEDO = @id
    `);
  const row = result.recordset[0];
  if (!row || !row.xml) return null;
  return {
    idmaeedo: Number(row.idmaeedo),
    tido: (row.tido || '').trim(),
    nudo: (row.nudo || '').trim(),
    endo: (row.endo || '').trim(),
    tipo: row.tipo != null ? Number(row.tipo) : null,
    folio: (row.folio || '').trim(),
    xml: row.xml,
    pdf417: (row.pdf417 || '').replace(/\s+/g, ''),
  };
}
