/**
 * Contabilidad desde Softland — el ETL que reemplaza la carga por Excel
 * ---------------------------------------------------------------
 * El módulo Balance nació leyendo un archivo: alguien exportaba el plan de
 * cuentas y los saldos del mes y los subía a mano. La pregunta abierta en
 * `BALANCE.md` era de dónde salían esos saldos de verdad. Ya está contestada:
 * salen de este mismo SQL Server, la base `PANORAMICA`, las tablas contables
 * que el ETL de ventas nunca tocó.
 *
 * ## El mapa
 *
 * | Tabla      | Qué es                               | Filas    |
 * |------------|--------------------------------------|----------|
 * | `CGRANCUE` | Nivel 1 del plan: la gran cuenta     | 129      |
 * | `CMAYOR`   | Nivel 2. **No es el libro mayor**    | 403      |
 * | `CCUENTAS` | Nivel 3: la cuenta imputable         | 3.640    |
 * | `CCOMPRE`  | Comprobante, encabezado              | 104.137  |
 * | `CCOMPRD`  | Comprobante, detalle (`DEBE`/`HABER`)| 350.340  |
 *
 * `CMAYOR` es la trampa cara del modelo: por el nombre parece el libro mayor y
 * es el segundo nivel del plan de cuentas. El movimiento está en `CCOMPRD`.
 *
 * ## El código de cuenta no existe en la base
 *
 * Lo que la intranet llama `41010105` está guardado en **tres columnas**:
 * `GRANCUE char(2)` + `MAYOR char(3)` + `CUENTA char(3)`. El export que entregó
 * el cliente las venía concatenando en crudo, y de ahí salía `"5120 106"`: en el
 * plan 2026, el mayor de GASTOS DE OPERACION está guardado como `'20 '` —dos
 * caracteres y un espacio— en vez de `'020'`. El hueco no es del Excel, es del
 * ERP. Pasa lo mismo con cinco cuentas (`'10 '`, `'65 '`, `'01 '`, `'40 '`).
 *
 * Por eso `codigoDesdeErp` rellena con ceros **a la izquierda** cada nivel por
 * separado, que es lo que hace la propia contabilidad cuando muestra el código.
 * Se verificó contra los datos: 0 líneas huérfanas en agosto 2026.
 *
 * ## El plan se versiona por año
 *
 * Cada fila de `CGRANCUE`/`CMAYOR`/`CCUENTAS` lleva `PERIODO char(4)` con el
 * año. 2026 tiene 347 cuentas; 2014 tenía 193. **Todo join lleva `PERIODO`**, y
 * el del movimiento va contra el `PERIODO` del comprobante, no contra el año en
 * curso: un comprobante de 2024 se lee con el plan de 2024. Se verificó que
 * `PERIODO` y `YEAR(FECHCOM)` nunca discrepan (0 de 104.137).
 *
 * ## Lo que este ETL NO trae, a propósito
 *
 * El plan tiene activo, pasivo y patrimonio (`11`, `12`, `13`, `21`, `22`,
 * `31`) — o sea, el estado de situación es posible. Pero `armarResultado()`
 * arma la jerarquía con **todas** las cuentas que encuentre, y `naturalezaDe()`
 * sólo distingue ingreso de egreso: traer el activo hoy lo pintaría como gasto
 * en el detalle. Así que se importa sólo el resultado (`GRANDES_CUENTAS`), y
 * abrir el balance general es un cambio de pantalla, no de ETL.
 */
import mssql from 'mssql';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { naturalezaDe } from './balance-plan';
import { etlExecutionLog } from '../shared/schema';

/**
 * El nombre con el que este ETL aparece en Monitor ETL. Tiene que ser el mismo
 * en `ventas.etl_execution_log`, en el router de `/api/etl/execute` y en la
 * pestaña del panel: de ahí sale el estado, el historial y las estadísticas.
 */
export const ETL_NAME = 'estado_resultados';

const sqlServerConfig: mssql.config = {
  server: process.env.SQL_SERVER_HOST || '',
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  user: process.env.SQL_SERVER_USER || '',
  password: process.env.SQL_SERVER_PASSWORD || '',
  database: process.env.SQL_SERVER_DATABASE || '',
  options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 30000,
  requestTimeout: 180000,
};

/**
 * Sólo las cuentas de resultado. El plan trae además `11`/`12`/`13` (activo),
 * `21`/`22` (pasivo) y `31` (patrimonio): el día que la pantalla sepa mostrar un
 * estado de situación, se agregan acá y el resto del ETL no cambia.
 */
const GRANDES_CUENTAS = ['41', '51', '52'];

/**
 * Meses que se pueden traer. `null` = todos.
 *
 * Estuvo en `['2026-07']` durante la primera corrida: la contabilidad se lee en
 * vivo y cada traída **reemplaza el mes completo**, así que antes de soltarla
 * sobre catorce años había que validar un mes contra lo que dice el ERP. Julio
 * 2026 cuadró exacto —$4.363.255 de pérdida, idéntico a sumar CCOMPRD—, así que
 * la compuerta se levanta y se elige el mes que se quiera: agosto, enero de
 * 2019, el que sea.
 *
 * Se deja el mecanismo, no el límite. Volver a acotar es cambiar esta línea: la
 * compuerta se aplica en un solo lugar (`periodoHabilitado`) y tanto la pantalla
 * como los endpoints la respetan.
 */
export const PERIODOS_HABILITADOS: readonly string[] | null = null;

/**
 * Qué mes trae el botón genérico "Ejecutar ETL" de Monitor ETL, que no sabe de
 * períodos. Mientras haya compuerta es el mes habilitado; cuando se levante, el
 * mes anterior al corriente — el actual todavía se está cargando en el ERP.
 */
export function periodoPorDefecto(hoy: Date = new Date()): string {
  if (PERIODOS_HABILITADOS?.length) return PERIODOS_HABILITADOS[0];
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
}

/** ¿Se puede traer este mes hoy? Único lugar que decide. */
export function periodoHabilitado(periodo: string): boolean {
  return PERIODOS_HABILITADOS === null || PERIODOS_HABILITADOS.includes(periodo);
}

/**
 * Softland multiempresa: `01` es Panorámica. La `02` —PINT. DEL SUR— existe con
 * 3.556 comprobantes, pero el último es de 2019 y su contabilidad no es la que
 * mira este módulo. Si alguna vez hay que consolidar, es acá.
 */
const EMPRESA = process.env.SQL_SERVER_EMPRESA || '01';

/**
 * El código de cuenta tal como lo usa la intranet, a partir de los tres niveles
 * como vienen del ERP.
 *
 * Cada nivel se rellena por separado y **a la izquierda**: `'20 '` es el mayor
 * 20 mal guardado, no el 200. Es la misma regla que `normalizarCodigo()` aplica
 * al Excel, sólo que acá los niveles llegan separados y no hay que adivinar
 * dónde cortaba el prefijo.
 */
export function codigoDesdeErp(granCuenta: string, mayor: string, cuenta: string): string {
  const nivel = (v: string, largo: number) => String(v ?? '').replace(/\s/g, '').padStart(largo, '0');
  return `${nivel(granCuenta, 2)}${nivel(mayor, 3)}${nivel(cuenta, 3)}`;
}

/**
 * La forma cruda, concatenada tal cual está en la base. Es la que traía el
 * archivo del cliente (`"5120 106"`), así que se guarda para que un Excel viejo
 * siga calzando contra el plan traído del ERP.
 */
function codigoErpCrudo(granCuenta: string, mayor: string, cuenta: string): string {
  return `${granCuenta ?? ''}${mayor ?? ''}${cuenta ?? ''}`;
}

/** Softland rellena los `char(n)` con espacios; para nosotros son texto. */
const limpio = (v: unknown): string => String(v ?? '').trim();

function conectar(): Promise<mssql.ConnectionPool> {
  if (!sqlServerConfig.server || !sqlServerConfig.user) {
    throw new Error('Faltan las credenciales del SQL Server (SQL_SERVER_HOST / SQL_SERVER_USER).');
  }
  return mssql.connect(sqlServerConfig);
}

/**
 * `2026-08` → `{ desde: '20260801', hasta: '20260901' }`.
 *
 * Sin guiones a propósito. `CONVERT(datetime, '2026-08-01', 23)` **falla** en
 * este servidor —está en `us_english` y rechaza el estilo ISO con separadores—,
 * mientras que `YYYYMMDD` (estilo 112) se interpreta igual sin importar el
 * idioma ni el `DATEFORMAT` de la sesión. Probado contra el servidor: el 23 tira
 * "Conversion failed when converting date and/or time from character string".
 */
function rangoDelMes(periodo: string): { desde: string; hasta: string; anio: string } {
  const [anio, mes] = periodo.split('-').map(Number);
  const siguiente = mes === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mes + 1 };
  const compacta = (a: number, m: number) => `${a}${String(m).padStart(2, '0')}01`;
  return { desde: compacta(anio, mes), hasta: compacta(siguiente.a, siguiente.m), anio: String(anio) };
}

// ─── ¿Se puede? ─────────────────────────────────────────────────────────────

export type EstadoErp = {
  disponible: boolean;
  error?: string;
  servidor: string;
  base: string;
  empresa: string;
  /** Años con plan de cuentas cargado, del más nuevo al más viejo. */
  anios: string[];
  /**
   * Meses que se pueden traer hoy, del más nuevo al más viejo. Ya vienen
   * filtrados por la compuerta de prueba: la pantalla no ofrece lo que el
   * servidor va a rechazar.
   */
  periodos: { periodo: string; comprobantes: number; lineas: number }[];
  /** Los meses habilitados, o `null` si no hay límite. Para explicarlo en pantalla. */
  limitadoA: readonly string[] | null;
  /** Cuántos meses con movimiento quedaron fuera por la compuerta. */
  mesesFueraDelLimite: number;
};

/**
 * Qué hay del otro lado. La pantalla lo pide antes de ofrecer nada: sin esto
 * habría que mostrar un selector de meses inventado y que el error salte al
 * apretar.
 *
 * No lanza: si el ERP está caído, el módulo tiene que abrir igual y decir por
 * qué la sincronización no está disponible. Es la misma regla con la que el
 * cruce de Talana tolera que su API no responda.
 */
export async function estadoErpContabilidad(): Promise<EstadoErp> {
  const base: EstadoErp = {
    disponible: false,
    servidor: sqlServerConfig.server,
    base: sqlServerConfig.database ?? '',
    empresa: EMPRESA,
    anios: [],
    periodos: [],
    limitadoA: PERIODOS_HABILITADOS,
    mesesFueraDelLimite: 0,
  };
  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await conectar();
    const anios = await pool.request().query<{ PERIODO: string }>(`
      SELECT DISTINCT PERIODO FROM CCUENTAS ORDER BY PERIODO DESC
    `);
    // Sin FORMAT(): este SQL Server 2012 corre con lightweight pooling y toda
    // función CLR revienta ("CLR execution is not supported under lightweight
    // pooling"). CONVERT estilo 23 es ISO y no depende del idioma del servidor.
    const periodos = await pool.request()
      .input('empresa', mssql.Char(2), EMPRESA)
      .query<{ periodo: string; comprobantes: number; lineas: number }>(`
        SELECT LEFT(CONVERT(char(10), e.FECHCOM, 23), 7) AS periodo,
               COUNT(DISTINCT e.IDCOMPRE) AS comprobantes,
               COUNT(d.IDCOMPRD) AS lineas
        FROM CCOMPRE e
        JOIN CCOMPRD d ON d.IDCOMPRE = e.IDCOMPRE
        WHERE e.EMPRESA = @empresa
        GROUP BY LEFT(CONVERT(char(10), e.FECHCOM, 23), 7)
        ORDER BY periodo DESC
      `);
    base.disponible = true;
    base.anios = anios.recordset.map((r) => limpio(r.PERIODO)).filter(Boolean);
    const todos = periodos.recordset.map((r) => ({
      periodo: r.periodo, comprobantes: r.comprobantes, lineas: r.lineas,
    }));
    base.periodos = todos.filter((p) => periodoHabilitado(p.periodo));
    base.mesesFueraDelLimite = todos.length - base.periodos.length;
  } catch (error: any) {
    base.error = error?.message || String(error);
  } finally {
    try { await pool?.close(); } catch { /* ya venía muerto */ }
  }
  return base;
}

// ─── El plan de cuentas ─────────────────────────────────────────────────────

export type ResumenPlan = {
  anio: string;
  leidas: number;
  guardadas: number;
  /** Las que el ERP guarda con el código mal formado; se ve qué se corrigió. */
  normalizadas: { codigoErp: string; codigo: string; nombre: string }[];
  /** Mismo nombre, códigos distintos. No es un error, pero hay que mirarlo. */
  posiblesDuplicados: { nombre: string; codigos: string[] }[];
};

/**
 * Trae el plan de cuentas de un año.
 *
 * No borra lo que ya está: una cuenta que existió en 2025 y no está en 2026
 * sigue en la tabla porque sus saldos históricos la necesitan para leerse. Y
 * como en el import por Excel, `nombre_largo` y `activa` no se pisan: el ERP
 * manda en el código, nosotros en cómo se lee.
 */
type CuentaDelPlan = {
  codigo: string; codigoErp: string;
  granCuenta: string; granCuentaNombre: string;
  mayor: string; mayorNombre: string;
  nombre: string; naturaleza: 'ingreso' | 'egreso';
};

/**
 * Leer el plan de un año, **reusando un pool ya abierto**.
 *
 * Separado de `sincronizarPlanDeCuentas` porque `sincronizarPeriodo` necesita
 * traer un plan sin cerrar su propia conexión: `mssql.connect()` devuelve el
 * pool global, así que el `close()` de una función mata la conexión de la otra.
 */
async function leerPlanDelErp(pool: mssql.ConnectionPool, anio: string): Promise<CuentaDelPlan[]> {
  const enLista = GRANDES_CUENTAS.map((g) => `'${g}'`).join(',');
  const filas = await pool.request()
    .input('periodo', mssql.Char(4), anio)
    .query<any>(`
      SELECT c.GRANCUE, g.NOGRANCUE, c.MAYOR, m.NOMAYOR, c.CUENTA, c.NOCUENTA
      FROM CCUENTAS c
      JOIN CGRANCUE g ON g.PERIODO = c.PERIODO AND g.GRANCUE = c.GRANCUE
      JOIN CMAYOR   m ON m.PERIODO = c.PERIODO AND m.GRANCUE = c.GRANCUE AND m.MAYOR = c.MAYOR
      WHERE c.PERIODO = @periodo AND c.GRANCUE IN (${enLista})
      ORDER BY c.GRANCUE, c.MAYOR, c.CUENTA
    `);
  return filas.recordset.map((f) => {
    const granCuenta = limpio(f.GRANCUE);
    return {
      codigo: codigoDesdeErp(f.GRANCUE, f.MAYOR, f.CUENTA),
      codigoErp: codigoErpCrudo(f.GRANCUE, f.MAYOR, f.CUENTA),
      granCuenta,
      granCuentaNombre: limpio(f.NOGRANCUE) || granCuenta,
      mayor: limpio(f.MAYOR).padStart(3, '0'),
      mayorNombre: limpio(f.NOMAYOR) || limpio(f.MAYOR),
      nombre: limpio(f.NOCUENTA) || codigoDesdeErp(f.GRANCUE, f.MAYOR, f.CUENTA),
      naturaleza: naturalezaDe(granCuenta),
    };
  });
}

/** Upsert del plan. No pisa `nombre_largo` ni `activa`: esos son nuestros. */
async function guardarPlan(cuentas: CuentaDelPlan[]): Promise<void> {
  for (const c of cuentas) {
    await db.execute(sql`
      INSERT INTO cuentas_contables
        (codigo, codigo_erp, gran_cuenta, gran_cuenta_nombre, mayor, mayor_nombre, nombre, naturaleza)
      VALUES (${c.codigo}, ${c.codigoErp}, ${c.granCuenta}, ${c.granCuentaNombre},
              ${c.mayor}, ${c.mayorNombre}, ${c.nombre}, ${c.naturaleza})
      ON CONFLICT (codigo) DO UPDATE SET
        codigo_erp = EXCLUDED.codigo_erp,
        gran_cuenta = EXCLUDED.gran_cuenta,
        gran_cuenta_nombre = EXCLUDED.gran_cuenta_nombre,
        mayor = EXCLUDED.mayor,
        mayor_nombre = EXCLUDED.mayor_nombre,
        nombre = EXCLUDED.nombre,
        naturaleza = EXCLUDED.naturaleza,
        updated_at = now()
    `);
  }
}

export async function sincronizarPlanDeCuentas(anio: string): Promise<ResumenPlan> {
  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await conectar();
    const cuentas = await leerPlanDelErp(pool, anio);
    await guardarPlan(cuentas);
    const porNombre = new Map<string, string[]>();
    for (const c of cuentas) {
      porNombre.set(c.nombre, [...(porNombre.get(c.nombre) ?? []), c.codigo]);
    }

    return {
      anio,
      leidas: cuentas.length,
      guardadas: cuentas.length,
      normalizadas: cuentas
        .filter((c) => c.codigo !== c.codigoErp)
        .map((c) => ({ codigoErp: c.codigoErp, codigo: c.codigo, nombre: c.nombre })),
      posiblesDuplicados: Array.from(porNombre.entries())
        .filter(([, codigos]) => codigos.length > 1)
        .map(([nombre, codigos]) => ({ nombre, codigos })),
    };
  } finally {
    try { await pool?.close(); } catch { /* ya venía muerto */ }
  }
}

// ─── Los saldos del mes ─────────────────────────────────────────────────────

export type ResumenPeriodo = {
  periodo: string;
  cuentas: number;
  lineas: number;
  debe: number;
  haber: number;
  /**
   * Líneas cuya cuenta no está en `cuentas_contables`. Si sale > 0, falta
   * sincronizar el plan de ese año: el mes quedaría incompleto y en silencio.
   */
  sinCuentaEnElPlan: { codigo: string; lineas: number; debe: number; haber: number }[];
  /** Comprobantes donde debe ≠ haber. En el ERP deberían ser siempre 0. */
  comprobantesDescuadrados: number;
  /** Año cuyo plan hubo que traer al vuelo porque faltaban cuentas, o `null`. */
  planTraidoAutomaticamente: string | null;
};

/**
 * Trae los saldos de un mes: agrega `DEBE`/`HABER` de `CCOMPRD` por cuenta y
 * reemplaza el período entero.
 *
 * Se agrega en el ERP, no acá, y por una razón concreta: 350.340 líneas de
 * detalle contra ~170 filas de saldo. Traer el detalle para sumarlo en Node
 * sería mover 2.000 veces más datos para llegar al mismo número.
 *
 * El mes se reemplaza completo, igual que la carga por Excel: una sincronización
 * parcial dejaría mezcladas cuentas de la corrida anterior y el resultado no
 * cuadraría.
 */
export async function sincronizarPeriodo(periodo: string, usuarioId?: string | null): Promise<ResumenPeriodo> {
  const empezo = Date.now();
  // El cerrojo va acá y no sólo en el endpoint: el día que esto lo llame el
  // scheduler, la compuerta tiene que seguir puesta.
  if (!periodoHabilitado(periodo)) {
    throw new Error(`El período ${periodo} no está habilitado todavía. Ver PERIODOS_HABILITADOS en server/etl-contabilidad.ts.`);
  }
  const { desde, hasta } = rangoDelMes(periodo);
  let pool: mssql.ConnectionPool | null = null;

  // Se registra en el mismo log que los demás ETLs para que Monitor ETL lo vea
  // sin saber nada de contabilidad: estado, historial y estadísticas salen de acá.
  const [corrida] = await db.insert(etlExecutionLog).values({
    etlName: ETL_NAME,
    startTime: new Date(),
    status: 'running',
    period: periodo,
    documentTypes: 'CCOMPRD/CCOMPRE',
    branches: EMPRESA,
  }).returning();

  try {
    pool = await conectar();
    const enLista = GRANDES_CUENTAS.map((g) => `'${g}'`).join(',');

    // El plan se une por el PERIODO **del comprobante**: un asiento de 2024 se
    // lee con el plan de 2024, que es el que estaba vigente cuando se hizo.
    const movimientos = await pool.request()
      .input('empresa', mssql.Char(2), EMPRESA)
      .input('desde', mssql.Char(8), desde)
      .input('hasta', mssql.Char(8), hasta)
      .query<any>(`
        SELECT d.GRANCUE, d.MAYOR, d.CUENTA,
               SUM(d.DEBE) AS debe, SUM(d.HABER) AS haber, COUNT(*) AS lineas
        FROM CCOMPRD d
        JOIN CCOMPRE e ON e.IDCOMPRE = d.IDCOMPRE
        WHERE e.EMPRESA = @empresa
          AND e.FECHCOM >= CONVERT(datetime, @desde, 112)
          AND e.FECHCOM <  CONVERT(datetime, @hasta, 112)
          AND d.GRANCUE IN (${enLista})
        GROUP BY d.GRANCUE, d.MAYOR, d.CUENTA
      `);

    // Un comprobante descuadrado es un problema del ERP, no nuestro, pero si
    // aparece explica por qué el resultado no cierra. Se informa, no se corta.
    const descuadre = await pool.request()
      .input('empresa', mssql.Char(2), EMPRESA)
      .input('desde', mssql.Char(8), desde)
      .input('hasta', mssql.Char(8), hasta)
      .query<{ n: number }>(`
        SELECT COUNT(*) AS n FROM (
          SELECT d.IDCOMPRE
          FROM CCOMPRD d
          JOIN CCOMPRE e ON e.IDCOMPRE = d.IDCOMPRE
          WHERE e.EMPRESA = @empresa
            AND e.FECHCOM >= CONVERT(datetime, @desde, 112)
            AND e.FECHCOM <  CONVERT(datetime, @hasta, 112)
          GROUP BY d.IDCOMPRE
          HAVING ABS(SUM(d.DEBE) - SUM(d.HABER)) > 1
        ) x
      `);

    // Si el ERP no tiene nada en ese mes, se sale **antes** de tocar Postgres.
    // Si no, pedir un mes vacío borraría los saldos que ya estaban cargados —por
    // ejemplo los que entraron por Excel— y el 404 llegaría con el daño hecho.
    if (movimientos.recordset.length === 0) {
      await db.update(etlExecutionLog).set({
        status: 'success', endTime: new Date(), recordsProcessed: 0,
        executionTimeMs: Date.now() - empezo,
        statistics: JSON.stringify({ sinMovimiento: true }),
      }).where(sql`id = ${corrida.id}`);
      return {
        periodo, cuentas: 0, lineas: 0, debe: 0, haber: 0,
        sinCuentaEnElPlan: [],
        comprobantesDescuadrados: descuadre.recordset[0]?.n ?? 0,
        planTraidoAutomaticamente: null,
      };
    }

    const leerPlanGuardado = async () => {
      const plan = await db.execute(sql`SELECT codigo FROM cuentas_contables`);
      return new Set((plan.rows as any[]).map((r) => String(r.codigo)));
    };

    const repartir = (conocidas: Set<string>) => {
      const saldos: { codigo: string; debe: number; haber: number; lineas: number }[] = [];
      const huerfanas: ResumenPeriodo['sinCuentaEnElPlan'] = [];
      for (const m of movimientos.recordset) {
        const codigo = codigoDesdeErp(m.GRANCUE, m.MAYOR, m.CUENTA);
        const fila = { codigo, debe: Number(m.debe) || 0, haber: Number(m.haber) || 0, lineas: m.lineas };
        if (conocidas.has(codigo)) saldos.push(fila);
        else huerfanas.push({ codigo, lineas: fila.lineas, debe: fila.debe, haber: fila.haber });
      }
      return { saldos, huerfanas };
    };

    let { saldos, huerfanas: sinCuentaEnElPlan } = repartir(await leerPlanGuardado());

    /**
     * Si sobran cuentas, traer el plan del año del mes y reintentar. Una sola vez.
     *
     * `cuentas_contables` no guarda el año —los códigos son estables y la tabla
     * los acumula—, así que no hay forma de preguntar "¿está cargado el plan de
     * 2019?". Lo que sí se puede es mirar el resultado: una cuenta con
     * movimiento que no está en el plan ES la señal de que falta.
     *
     * Con la compuerta puesta en un solo mes esto no podía pasar. Abierta a los
     * catorce años sí: traer enero de 2019 con el plan de 2026 cargado dejaría
     * fuera las cuentas que existían entonces y ya no existen, y el mes quedaría
     * incompleto **en silencio** —los huérfanos se informan, pero el mes se
     * guarda igual y el total no cuadra contra el ERP—.
     *
     * Se reusa el pool a propósito: `sincronizarPlanDeCuentas()` abre y cierra
     * el suyo, y como `mssql.connect()` devuelve el pool global, su `close()`
     * mataría la conexión que esta función está usando.
     */
    let planTraidoAutomaticamente: string | null = null;
    if (sinCuentaEnElPlan.length > 0) {
      const anioDelMes = periodo.slice(0, 4);
      planTraidoAutomaticamente = anioDelMes;
      console.log(`[contabilidad] ${sinCuentaEnElPlan.length} cuenta(s) fuera del plan en ${periodo}: trayendo el plan ${anioDelMes}...`);
      await guardarPlan(await leerPlanDelErp(pool, anioDelMes));
      ({ saldos, huerfanas: sinCuentaEnElPlan } = repartir(await leerPlanGuardado()));
      if (sinCuentaEnElPlan.length > 0) {
        // Quedan huérfanas con el plan de su propio año: eso ya no es un plan
        // desactualizado, es una cuenta imputada que el plan no declara.
        console.warn(`[contabilidad] ${periodo}: quedan ${sinCuentaEnElPlan.length} cuenta(s) sin plan incluso con el plan ${anioDelMes}`);
      }
    }

    await db.execute(sql`DELETE FROM balance_saldos WHERE periodo = ${periodo}`);
    for (const s of saldos) {
      // `saldo` se guarda como debe − haber por coherencia con la convención
      // contable, pero no se usa para leer el resultado: `montoDeFila()` sólo
      // cae en él cuando debe y haber son cero, y acá nunca lo son.
      await db.execute(sql`
        INSERT INTO balance_saldos (periodo, cuenta_codigo, debe, haber, saldo)
        VALUES (${periodo}, ${s.codigo}, ${s.debe}, ${s.haber}, ${s.debe - s.haber})
      `);
    }

    await db.execute(sql`
      INSERT INTO balance_periodos (periodo, estado, origen, archivo_nombre, cargado_por)
      VALUES (${periodo}, 'borrador', 'erp', NULL, ${usuarioId ?? null})
      ON CONFLICT (periodo) DO UPDATE SET
        origen = 'erp', archivo_nombre = NULL,
        cargado_por = ${usuarioId ?? null}, updated_at = now()
    `);

    const resumen = {
      periodo,
      cuentas: saldos.length,
      lineas: saldos.reduce((a, s) => a + s.lineas, 0),
      debe: saldos.reduce((a, s) => a + s.debe, 0),
      haber: saldos.reduce((a, s) => a + s.haber, 0),
      sinCuentaEnElPlan,
      comprobantesDescuadrados: descuadre.recordset[0]?.n ?? 0,
      planTraidoAutomaticamente,
    };

    await db.update(etlExecutionLog).set({
      status: 'success', endTime: new Date(),
      recordsProcessed: resumen.cuentas,
      executionTimeMs: Date.now() - empezo,
      statistics: JSON.stringify({
        cuentas: resumen.cuentas, lineas: resumen.lineas,
        debe: resumen.debe, haber: resumen.haber,
        sinCuentaEnElPlan: sinCuentaEnElPlan.length,
        comprobantesDescuadrados: resumen.comprobantesDescuadrados,
        planTraidoAutomaticamente,
      }),
    }).where(sql`id = ${corrida.id}`);

    return resumen;
  } catch (error: any) {
    await db.update(etlExecutionLog).set({
      status: 'error', endTime: new Date(),
      executionTimeMs: Date.now() - empezo,
      errorMessage: error?.message || String(error),
    }).where(sql`id = ${corrida.id}`).catch(() => { /* el log no puede tapar el error real */ });
    throw error;
  } finally {
    try { await pool?.close(); } catch { /* ya venía muerto */ }
  }
}
