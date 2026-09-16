/**
 * ¿Está la contabilidad de Softland en el SQL Server? — descubrimiento
 * ---------------------------------------------------------------
 * El módulo Balance funciona, pero se llena a mano: alguien exporta un Excel y
 * lo sube. La contabilidad, en cambio, ya vive en el ERP — el archivo del plan
 * de cuentas que entregó el cliente trae las columnas `CGRANCUE, NOGRANCUE,
 * CMAYOR, NOMAYOR, CUENTA, NOCUENTA`, que son nombres de campo de Softland, no
 * de una planilla. Alguien lo exportó desde ahí, así que la tabla existe.
 *
 * Lo que no se sabe es si está en ESTE servidor, en ESTA base, y si el usuario
 * del ETL la puede leer. El ETL de ventas sólo toca siete tablas —MAEEDO,
 * MAEDDO, MAEEN, MAEPR, TABBO, TABFU, TABRU— y ninguna es contable, así que el
 * repo no tiene ni una pista.
 *
 * Este endpoint responde esa pregunta y nada más. Es el paso previo a escribir
 * `etl-contabilidad.ts`: sin los nombres reales de tabla y columna, el ETL se
 * escribiría a ciegas.
 *
 * Va en la app desplegada, no como script suelto, por una razón práctica: el
 * SQL Server está en red privada (ver `.env.example`, `[RED-PRIV]`) y la única
 * máquina con credenciales y llegada es el servidor de la intranet.
 *
 * ⚠️ SÓLO LECTURA. Sólo `SELECT` sobre el catálogo (`sys.databases`,
 * `INFORMATION_SCHEMA`) y tres filas de muestra de cada candidata. No escribe
 * nada, no recibe parámetros, y los nombres de tabla que interpola salen del
 * propio catálogo —nunca del request— y pasan igual por un filtro de forma.
 */
import type { Express } from 'express';
import mssql from 'mssql';
import { requireAuth, requireRoles } from './auth';

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

/**
 * Buscar por COLUMNA, no por nombre de tabla: el nombre cambia entre versiones
 * de Softland, pero los campos no —son los que salieron en el export del
 * cliente—. La tabla que tenga `CGRANCUE` es el plan de cuentas; la que tenga
 * `CUENTA` junto a `DEBE`/`HABER` es el mayor.
 */
const COLUMNAS_DELATORAS = [
  'CGRANCUE', 'NOGRANCUE', 'CMAYOR', 'NOMAYOR', 'NOCUENTA', 'CUENTA', 'CTA',
  'DEBE', 'HABER', 'DEBEMN', 'HABERMN', 'DEBEME', 'HABERME',
  'GLOSA', 'NUCOMP', 'TICOMP', 'FECOMP', 'PERIODO', 'CENTRO',
];

/** Las de sistema no tienen contabilidad y sólo ensucian el recorrido. */
const BASES_DE_SISTEMA = new Set(['master', 'tempdb', 'model', 'msdb', 'distribution']);

/** Nada se interpola en una query sin pasar por acá. */
const NOMBRE_SEGURO = /^[A-Za-z0-9_]+$/;

/** Cuántas candidatas se abren en detalle. Más que esto es ruido. */
const MAX_CANDIDATAS = 12;

type Candidata = {
  base: string;
  esquema: string;
  tabla: string;
  /** Qué parece ser, según las columnas que tiene. */
  rol: 'plan_de_cuentas' | 'movimientos' | 'saldos' | 'quizas';
  columnasDelatoras: string[];
  columnas?: { nombre: string; tipo: string; largo: number | null; nulable: boolean }[];
  filas?: number;
  muestra?: Record<string, unknown>[];
  error?: string;
};

/** Un valor de muestra legible en JSON: sin binarios ni textos kilométricos. */
function valorLegible(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Buffer.isBuffer(v)) return '<binario>';
  if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  return v;
}

/**
 * Qué parece ser una tabla según las columnas que trae. Es una pista para leer
 * el JSON, no una decisión: la decisión se toma mirando la muestra.
 */
function rolDe(columnas: Set<string>): Candidata['rol'] {
  if (columnas.has('CGRANCUE') || columnas.has('NOGRANCUE')) return 'plan_de_cuentas';
  const tieneCuenta = columnas.has('CUENTA') || columnas.has('CTA');
  const tieneMontos = ['DEBE', 'HABER', 'DEBEMN', 'HABERMN', 'DEBEME', 'HABERME']
    .some((c) => columnas.has(c));
  if (tieneCuenta && tieneMontos) {
    // Con comprobante y glosa es el detalle; sin eso, ya viene acumulado.
    return columnas.has('NUCOMP') || columnas.has('GLOSA') ? 'movimientos' : 'saldos';
  }
  return 'quizas';
}

export function registerContabilidadDescubrirRoutes(app: Express) {
  /**
   * Mismo cerrojo que `/api/etl/diagnostics`: esto expone la forma de la base
   * del ERP, no es para supervisores.
   */
  app.get(
    '/api/etl/contabilidad/descubrir',
    requireAuth,
    requireRoles(['admin']),
    async (_req: any, res: any) => {
      if (!sqlServerConfig.server || !sqlServerConfig.user) {
        return res.status(503).json({
          message: 'Faltan las credenciales del SQL Server (SQL_SERVER_HOST / SQL_SERVER_USER).',
        });
      }

      const empezo = Date.now();
      let pool: mssql.ConnectionPool | null = null;

      try {
        pool = await mssql.connect(sqlServerConfig);

        // 1. ¿Hay más de una base? Softland suele separar la contabilidad de la
        //    comercial, y el ETL sólo conoce la comercial.
        const bases = await pool.request().query<{ name: string; acceso: number | null }>(`
          SELECT name, HAS_DBACCESS(name) AS acceso
          FROM sys.databases
          WHERE state = 0
          ORDER BY name
        `);

        const aRevisar = bases.recordset
          .filter((b) => b.acceso === 1 && !BASES_DE_SISTEMA.has(b.name) && NOMBRE_SEGURO.test(b.name))
          .map((b) => b.name);

        // 2. Buscar las columnas delatoras en cada base accesible.
        const enLista = COLUMNAS_DELATORAS.map((c) => `'${c}'`).join(',');
        const porTabla = new Map<string, { base: string; esquema: string; tabla: string; columnas: Set<string> }>();
        const basesSinPermiso: { base: string; error: string }[] = [];

        for (const base of aRevisar) {
          try {
            const hallazgos = await pool.request().query<{
              TABLE_SCHEMA: string; TABLE_NAME: string; COLUMN_NAME: string;
            }>(`
              SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
              FROM [${base}].INFORMATION_SCHEMA.COLUMNS
              WHERE COLUMN_NAME IN (${enLista})
            `);

            for (const f of hallazgos.recordset) {
              const clave = `${base}.${f.TABLE_SCHEMA}.${f.TABLE_NAME}`;
              const actual = porTabla.get(clave)
                ?? { base, esquema: f.TABLE_SCHEMA, tabla: f.TABLE_NAME, columnas: new Set<string>() };
              actual.columnas.add(f.COLUMN_NAME.toUpperCase());
              porTabla.set(clave, actual);
            }
          } catch (error: any) {
            // Sin permiso sobre esa base. Es información, no un fallo.
            basesSinPermiso.push({ base, error: error?.message || String(error) });
          }
        }

        // 3. Ordenar: primero el plan de cuentas, después el mayor, y dentro de
        //    cada grupo la que tenga más columnas delatoras.
        const orden: Record<Candidata['rol'], number> = {
          plan_de_cuentas: 0, movimientos: 1, saldos: 2, quizas: 3,
        };
        const candidatas: Candidata[] = Array.from(porTabla.values())
          .map((t) => ({
            base: t.base,
            esquema: t.esquema,
            tabla: t.tabla,
            rol: rolDe(t.columnas),
            columnasDelatoras: Array.from(t.columnas).sort(),
          }))
          .sort((a, b) => orden[a.rol] - orden[b.rol]
            || b.columnasDelatoras.length - a.columnasDelatoras.length
            || a.tabla.localeCompare(b.tabla));

        // 4. Abrir en detalle sólo las primeras: estructura, cuántas filas y tres
        //    de muestra. Lo que interesa de la muestra es el formato real —cómo
        //    viene el código de cuenta, la fecha, el signo del monto—.
        for (const c of candidatas.slice(0, MAX_CANDIDATAS)) {
          if (!NOMBRE_SEGURO.test(c.tabla) || !NOMBRE_SEGURO.test(c.esquema)) {
            c.error = 'Nombre con caracteres raros: no se abre.';
            continue;
          }
          const ruta = `[${c.base}].[${c.esquema}].[${c.tabla}]`;
          try {
            const cols = await pool.request().query<{
              COLUMN_NAME: string; DATA_TYPE: string;
              CHARACTER_MAXIMUM_LENGTH: number | null; IS_NULLABLE: string;
            }>(`
              SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
              FROM [${c.base}].INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = '${c.esquema}' AND TABLE_NAME = '${c.tabla}'
              ORDER BY ORDINAL_POSITION
            `);
            c.columnas = cols.recordset.map((col) => ({
              nombre: col.COLUMN_NAME,
              tipo: col.DATA_TYPE,
              largo: col.CHARACTER_MAXIMUM_LENGTH,
              nulable: col.IS_NULLABLE === 'YES',
            }));

            const cuenta = await pool.request().query<{ filas: number }>(
              `SELECT COUNT(*) AS filas FROM ${ruta}`,
            );
            c.filas = cuenta.recordset[0]?.filas ?? 0;

            const muestra = await pool.request().query(`SELECT TOP 3 * FROM ${ruta}`);
            c.muestra = muestra.recordset.map((fila: any) => {
              const limpia: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(fila)) limpia[k] = valorLegible(v);
              return limpia;
            });
          } catch (error: any) {
            // Típico: SELECT denegado sobre esa tabla. Se anota y se sigue.
            c.error = error?.message || String(error);
          }
        }

        const plan = candidatas.find((c) => c.rol === 'plan_de_cuentas' && !c.error);
        const mayor = candidatas.find((c) => (c.rol === 'movimientos' || c.rol === 'saldos') && !c.error);

        res.json({
          servidor: sqlServerConfig.server,
          baseDelEtl: sqlServerConfig.database,
          bases: bases.recordset.map((b) => ({ nombre: b.name, acceso: b.acceso === 1 })),
          basesRevisadas: aRevisar,
          basesSinPermiso,
          candidatas,
          // La respuesta corta, para no tener que leer todo el JSON.
          veredicto: {
            planDeCuentas: plan ? `${plan.base}.${plan.esquema}.${plan.tabla} (${plan.filas} filas)` : null,
            mayor: mayor ? `${mayor.base}.${mayor.esquema}.${mayor.tabla} (${mayor.filas} filas)` : null,
            sePuedeImportar: Boolean(plan && mayor),
          },
          tomoMs: Date.now() - empezo,
        });
      } catch (error: any) {
        console.error('[contabilidad/descubrir]', error?.message || error);
        res.status(500).json({
          message: error?.message || 'No se pudo consultar el SQL Server',
          servidor: sqlServerConfig.server,
          baseDelEtl: sqlServerConfig.database,
        });
      } finally {
        try { await pool?.close(); } catch { /* el pool ya venía muerto */ }
      }
    },
  );
}
