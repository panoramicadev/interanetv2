/**
 * Balance — plan de cuentas y resultado del período
 * ---------------------------------------------------------------
 * Contabilidad vive en Softland y la intranet nunca la había tocado: el ETL
 * sólo trae ventas y maestros, ninguna tabla contable. Este módulo es el primer
 * punto de apoyo: el plan de cuentas, los saldos de cada mes, y las dos
 * preguntas que se le hacen a esos saldos —¿cómo venimos contra el presupuesto?
 * ¿lo que la contabilidad cargó por sueldos calza con lo que Talana pagó?
 *
 * ⚠️ Es un ESTADO DE RESULTADOS, no un balance general. El plan que entregó el
 * cliente sólo trae las grandes cuentas 41 (ingresos), 51 (egresos de la
 * operación) y 52 (no operacionales): no hay activo, pasivo ni patrimonio.
 * La pantalla habla de "resultado" hasta que lleguen las cuentas 1/2/3.
 *
 * Tres cosas que el archivo del cliente trae torcidas y se arreglan al importar
 * (ver `normalizarCodigo` y el importador):
 *
 *  1. Softland no rellena el mayor a tres dígitos: `CMAYOR = "20"` en vez de
 *     `"020"`, y deja el hueco como un espacio dentro del código. Las 20 cuentas
 *     de GASTOS DE OPERACION llegan como `"5120 106"` cuando la cuenta real es
 *     `51020106`. Se guardan las dos formas, porque la cruda es la que va a
 *     venir en el archivo de saldos.
 *  2. `NOCUENTA` está truncado a 25 caracteres ("REMUNERACIONES ADMINISTRA").
 *     Por eso existe `nombre_largo`, que se escribe desde la intranet.
 *  3. Hay nombres repetidos con códigos distintos (`51030429` y `51030431`, las
 *     dos "INDEMNIZACIONES VENTAS"). Se importan igual —el código manda— pero se
 *     marcan como posible duplicado para preguntarle al cliente.
 *
 * Resiliencia, como el resto del repo: las tablas se crean en runtime con
 * CREATE TABLE IF NOT EXISTS porque el runner de migraciones corta al primer
 * fallo y en producción puede no llegar a correr (ver server/commissions.ts).
 */
import type { Express } from 'express';
import { z } from 'zod';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import multer from 'multer';
import { db } from './db';
import { requireAuth, requireRoles } from './auth';
import { requirePermission } from './permissions';
import {
  cuentasContables, balancePeriodos, balanceSaldos, balancePresupuesto,
  balancePuentePersonal,
  periodoBalanceSchema, editarCuentaContableSchema, guardarPresupuestoSchema,
  guardarPuentePersonalSchema,
} from '../shared/schema';
import {
  limpiarTexto, aNumero, montoDeFila,
  parsearPlanDeCuentas, parsearSaldos,
} from './balance-plan';
import { construirCruce } from './routes-remuneraciones';
import {
  estadoErpContabilidad, sincronizarPlanDeCuentas, sincronizarPeriodo,
  periodoHabilitado, PERIODOS_HABILITADOS,
} from './etl-contabilidad';
import { getPeriodos, talanaConfigurado } from './services/talana';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Tablas en runtime ──────────────────────────────────────────────────────

let ensureTablesPromise: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cuentas_contables (
          codigo varchar(20) PRIMARY KEY,
          codigo_erp varchar(20) NOT NULL,
          gran_cuenta varchar(4) NOT NULL,
          gran_cuenta_nombre varchar(120) NOT NULL,
          mayor varchar(4) NOT NULL,
          mayor_nombre varchar(120) NOT NULL,
          nombre varchar(120) NOT NULL,
          nombre_largo varchar(200),
          naturaleza varchar(10) NOT NULL,
          activa boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cuentas_contables_codigo_erp" ON cuentas_contables (codigo_erp)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_cuentas_contables_gran_cuenta" ON cuentas_contables (gran_cuenta)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS balance_periodos (
          periodo varchar(7) PRIMARY KEY,
          estado varchar(20) NOT NULL DEFAULT 'borrador',
          origen varchar(20) NOT NULL DEFAULT 'excel',
          archivo_nombre varchar(255),
          cargado_por varchar,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS balance_saldos (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          periodo varchar(7) NOT NULL,
          cuenta_codigo varchar(20) NOT NULL,
          debe numeric(18,2) NOT NULL DEFAULT 0,
          haber numeric(18,2) NOT NULL DEFAULT 0,
          saldo numeric(18,2) NOT NULL DEFAULT 0,
          created_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_saldos_periodo_cuenta" ON balance_saldos (periodo, cuenta_codigo)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_balance_saldos_periodo" ON balance_saldos (periodo)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS balance_presupuesto (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          periodo varchar(7) NOT NULL,
          cuenta_codigo varchar(20) NOT NULL,
          monto numeric(18,2) NOT NULL DEFAULT 0,
          actualizado_por varchar,
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_presupuesto_periodo_cuenta" ON balance_presupuesto (periodo, cuenta_codigo)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS balance_puente_personal (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          concepto varchar(60) NOT NULL,
          tipo varchar(20) NOT NULL,
          valor varchar(255) NOT NULL,
          created_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_balance_puente_tipo_valor" ON balance_puente_personal (tipo, valor)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_balance_puente_concepto" ON balance_puente_personal (concepto)`);
    })().catch((error) => {
      ensureTablesPromise = null; // permite reintentar
      throw error;
    });
  }
  return ensureTablesPromise;
}

/** Se llama en el arranque (server/index.ts) para no depender del runner. */
export async function ensureBalanceTables(): Promise<void> {
  await ensureTables();
}

// ─── El estado de resultados ────────────────────────────────────────────────

/** `2026-07` → `julio 2026`, para los mensajes que lee una persona. */
function etiquetaMes(periodo: string): string {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [ano, mes] = periodo.split('-').map(Number);
  return `${meses[mes - 1] ?? periodo} ${ano}`;
}

/** `2026-09` → `2026-08`. */
function periodoAnterior(periodo: string): string {
  const [ano, mes] = periodo.split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

/** Los meses del mismo año hasta el período, para el acumulado. */
function mesesDelAnoHasta(periodo: string): string[] {
  const [ano, mes] = periodo.split('-').map(Number);
  return Array.from({ length: mes }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
}

type MontosCuenta = { mes: number; anterior: number; acumulado: number; presupuesto: number };

/**
 * Arma el resultado del período: la jerarquía gran cuenta → mayor → cuenta con
 * los montos del mes, del mes anterior y del acumulado del año, más las líneas
 * del estado de resultados.
 *
 * El corte administración / ventas NO se puede hacer por mayor: el mayor `030`
 * se llama "GASTOS DE ADMIN. Y VENTAS" y mezcla las dos cosas. Separar eso
 * necesita agrupar cuentas a mano, que es justamente lo que hace el puente de
 * personal para su propio cruce.
 */
async function armarResultado(periodo: string) {
  const cuentas = await db.select().from(cuentasContables).orderBy(asc(cuentasContables.codigo));
  const anterior = periodoAnterior(periodo);
  const meses = mesesDelAnoHasta(periodo);

  const filasSaldo = await db.select().from(balanceSaldos)
    .where(inArray(balanceSaldos.periodo, Array.from(new Set([...meses, anterior]))));
  const filasPresupuesto = await db.select().from(balancePresupuesto)
    .where(eq(balancePresupuesto.periodo, periodo));

  const naturalezaPorCodigo = new Map(cuentas.map((c) => [c.codigo, c.naturaleza]));
  const montos = new Map<string, MontosCuenta>();
  const vacio = (): MontosCuenta => ({ mes: 0, anterior: 0, acumulado: 0, presupuesto: 0 });

  for (const f of filasSaldo) {
    const naturaleza = naturalezaPorCodigo.get(f.cuentaCodigo);
    if (!naturaleza) continue; // saldo de una cuenta que ya no está en el plan
    const monto = montoDeFila(naturaleza, Number(f.debe), Number(f.haber), Number(f.saldo));
    const m = montos.get(f.cuentaCodigo) ?? vacio();
    if (f.periodo === periodo) m.mes += monto;
    if (f.periodo === anterior) m.anterior += monto;
    if (meses.includes(f.periodo)) m.acumulado += monto;
    montos.set(f.cuentaCodigo, m);
  }
  for (const p of filasPresupuesto) {
    const m = montos.get(p.cuentaCodigo) ?? vacio();
    m.presupuesto += Number(p.monto);
    montos.set(p.cuentaCodigo, m);
  }

  // Jerarquía gran cuenta → mayor → cuenta.
  const grupos: any[] = [];
  for (const c of cuentas) {
    const m = montos.get(c.codigo) ?? vacio();
    let grupo = grupos.find((g) => g.granCuenta === c.granCuenta);
    if (!grupo) {
      grupo = { granCuenta: c.granCuenta, nombre: c.granCuentaNombre, naturaleza: c.naturaleza, mayores: [], ...vacio() };
      grupos.push(grupo);
    }
    let mayor = grupo.mayores.find((x: any) => x.mayor === c.mayor);
    if (!mayor) {
      mayor = { mayor: c.mayor, nombre: c.mayorNombre, cuentas: [], ...vacio() };
      grupo.mayores.push(mayor);
    }
    mayor.cuentas.push({
      codigo: c.codigo,
      codigoErp: c.codigoErp,
      nombre: c.nombreLargo || c.nombre,
      nombreErp: c.nombre,
      activa: c.activa,
      ...m,
    });
    for (const k of ['mes', 'anterior', 'acumulado', 'presupuesto'] as const) {
      mayor[k] += m[k];
      grupo[k] += m[k];
    }
  }

  const total = (gran: string, mayoresIncluidos?: string[], excluir?: string[]) => {
    const grupo = grupos.find((g) => g.granCuenta === gran);
    if (!grupo) return vacio();
    return grupo.mayores
      .filter((m: any) => (mayoresIncluidos ? mayoresIncluidos.includes(m.mayor) : true))
      .filter((m: any) => (excluir ? !excluir.includes(m.mayor) : true))
      .reduce((acc: MontosCuenta, m: any) => {
        acc.mes += m.mes; acc.anterior += m.anterior;
        acc.acumulado += m.acumulado; acc.presupuesto += m.presupuesto;
        return acc;
      }, vacio());
  };
  const resta = (a: MontosCuenta, ...b: MontosCuenta[]): MontosCuenta =>
    b.reduce((acc, x) => ({
      mes: acc.mes - x.mes, anterior: acc.anterior - x.anterior,
      acumulado: acc.acumulado - x.acumulado, presupuesto: acc.presupuesto - x.presupuesto,
    }), { ...a });

  const ingresosOperacionales = total('41', ['010']);
  const costoDeVentas = total('51', ['010']);
  const margenBruto = resta(ingresosOperacionales, costoDeVentas);
  const gastosOperacion = total('51', ['020']);
  const gastosAdminVentas = total('51', undefined, ['010', '020']);
  const resultadoOperacional = resta(margenBruto, gastosOperacion, gastosAdminVentas);
  const ingresosNoOperacionales = total('41', undefined, ['010']);
  const egresosNoOperacionales = total('52');
  const resultado = resta(resultadoOperacional, egresosNoOperacionales);
  resultado.mes += ingresosNoOperacionales.mes;
  resultado.anterior += ingresosNoOperacionales.anterior;
  resultado.acumulado += ingresosNoOperacionales.acumulado;
  resultado.presupuesto += ingresosNoOperacionales.presupuesto;

  const lineas = [
    { clave: 'ingresos_operacionales', etiqueta: 'Ingresos operacionales', tipo: 'grupo', ...ingresosOperacionales },
    { clave: 'costo_de_ventas', etiqueta: 'Costo de ventas', tipo: 'grupo', ...costoDeVentas },
    { clave: 'margen_bruto', etiqueta: 'Margen bruto', tipo: 'subtotal', ...margenBruto },
    { clave: 'gastos_admin_ventas', etiqueta: 'Gastos de administración y ventas', tipo: 'grupo', ...gastosAdminVentas },
    { clave: 'gastos_operacion', etiqueta: 'Gastos de operación', tipo: 'grupo', ...gastosOperacion },
    { clave: 'resultado_operacional', etiqueta: 'Resultado operacional', tipo: 'subtotal', ...resultadoOperacional },
    { clave: 'ingresos_no_operacionales', etiqueta: 'Ingresos no operacionales', tipo: 'grupo', ...ingresosNoOperacionales },
    { clave: 'egresos_no_operacionales', etiqueta: 'Egresos no operacionales', tipo: 'grupo', ...egresosNoOperacionales },
    { clave: 'resultado', etiqueta: 'Resultado del período', tipo: 'total', ...resultado },
  ];

  const [cargado] = await db.select().from(balancePeriodos).where(eq(balancePeriodos.periodo, periodo)).limit(1);

  // Qué meses hay de verdad. Sin esto, un mes que nunca se cargó se muestra
  // como $0 y se lee como "ese mes no vendió nada" — que es una afirmación
  // bastante más fuerte que "no lo hemos traído". Importa especialmente ahora,
  // con el ETL limitado a un solo mes: es el estado normal, no la excepción.
  const cargados = new Set(filasSaldo.map((f) => f.periodo));

  return {
    periodo,
    periodoAnterior: anterior,
    cargado: cargado ?? null,
    /** `false` ⇒ la columna del mes anterior no es un cero, es un hueco. */
    periodoAnteriorCargado: cargados.has(anterior),
    /** Cuántos de los meses del año hasta acá están cargados, y cuántos son. */
    mesesAcumulados: meses.filter((m) => cargados.has(m)).length,
    mesesDelAcumulado: meses.length,
    // Lo que el módulo NO es: sin cuentas 1/2/3 no hay estado de situación.
    esEstadoDeResultados: true,
    grupos,
    lineas,
  };
}

// ─── El cruce con Talana ────────────────────────────────────────────────────

/**
 * Las áreas en las que el plan de cuentas separa el gasto en gente, con las
 * cuentas de cada una.
 *
 * No se cruza cuenta a cuenta: el costo empresa que entrega Talana viene todo
 * junto por persona, mientras que la contabilidad separa la remuneración de la
 * indemnización y de las leyes sociales. Lo que sí calza es el área, y es el
 * mismo corte con el que Talana asigna el centro de costo de cada contrato.
 *
 * Estas cuentas se siembran al importar el plan. Los centros de costo NO: nadie
 * sabe todavía cómo se llaman en Talana, así que se mapean desde la pantalla y
 * hasta entonces aparecen listados como pendientes.
 */
const CONCEPTOS_PERSONAL: { concepto: string; nombre: string; cuentas: string[] }[] = [
  { concepto: 'administracion', nombre: 'Administración', cuentas: ['51030106', '51030451', '51030454'] },
  { concepto: 'ventas', nombre: 'Ventas', cuentas: ['51030341', '51030429', '51030431'] },
  { concepto: 'operacion', nombre: 'Operación', cuentas: ['51020106', '51020121', '51020122'] },
  { concepto: 'store_concepcion', nombre: 'Panorámica Store Concepción', cuentas: ['51030342'] },
  { concepto: 'socios', nombre: 'Socios', cuentas: ['51030240', '51030245'] },
];

const NOMBRE_CONCEPTO = new Map(CONCEPTOS_PERSONAL.map((c) => [c.concepto, c.nombre]));

/**
 * Qué cuenta *parece* ser de gasto en gente.
 *
 * `CONCEPTOS_PERSONAL` se armó con las 77 cuentas del export que trajo el
 * cliente. El plan completo del ERP tiene 177 de resultado, y entre ellas hay 30
 * de personal: las cuatro de LEYES SOCIALES, las sucursales viejas (Puerto
 * Montt, Valdivia, Santiago, Los Ángeles) y un segundo `REMUNERACIONES
 * ADMINISTRA` (`51030105`, además del `51030106` que sí está mapeado).
 *
 * Hoy todas esas están en cero, así que el cruce cuadra. Pero si mañana alguien
 * imputa a una, el costo contable se compararía contra Talana **de menos** y no
 * habría forma de notarlo. Por eso no se adivina el mapeo —cuál área es cada
 * una es una decisión del cliente— y en cambio se listan aparte, igual que los
 * centros de costo que Talana informa y nadie asignó.
 */
const PARECE_DE_PERSONAL = /REMUNERAC|INDEMNIZ|LEYES SOC|SUELDO|FINIQUIT/i;

/** El mismo umbral con el que Remuneraciones decide si una comisión descuadra. */
const UMBRAL_DESCUADRE = 1000;

/**
 * Contabilidad contra Talana, por área.
 *
 * Nunca lanza por culpa de Talana: si la API está caída o sin token, devuelve el
 * lado contable igual y dice qué falta. Es la misma regla del módulo de
 * Remuneraciones — la pantalla abre y explica, en vez de mostrar un error seco.
 */
async function armarPersonal(periodo: string) {
  const puente = await db.select().from(balancePuentePersonal);
  const cuentasPorConcepto = new Map<string, string[]>();
  const centrosPorConcepto = new Map<string, string[]>();
  for (const p of puente) {
    const destino = p.tipo === 'cuenta' ? cuentasPorConcepto : centrosPorConcepto;
    destino.set(p.concepto, [...(destino.get(p.concepto) ?? []), p.valor]);
  }

  // Lado contable.
  const cuentas = await db.select().from(cuentasContables);
  const naturalezaPorCodigo = new Map(cuentas.map((c) => [c.codigo, c.naturaleza]));
  const nombrePorCodigo = new Map(cuentas.map((c) => [c.codigo, c.nombreLargo || c.nombre]));
  const saldos = await db.select().from(balanceSaldos).where(eq(balanceSaldos.periodo, periodo));
  const contablePorCuenta = new Map<string, number>();
  for (const s of saldos) {
    const naturaleza = naturalezaPorCodigo.get(s.cuentaCodigo);
    if (!naturaleza) continue;
    contablePorCuenta.set(s.cuentaCodigo, montoDeFila(naturaleza, Number(s.debe), Number(s.haber), Number(s.saldo)));
  }

  // Lado Talana.
  let talana: { ok: boolean; error?: string; porCentro: Map<string, { costo: number; personas: number }> } = {
    ok: false, porCentro: new Map(),
  };
  if (!talanaConfigurado()) {
    talana.error = 'Falta la variable de entorno TALANA_API_TOKEN.';
  } else {
    try {
      const [ano, mes] = periodo.split('-').map(Number);
      const periodos = await getPeriodos();
      const periodoTalana = periodos.find((p) => p.ano === ano && p.mes === mes);
      if (!periodoTalana) {
        talana.error = `Talana no tiene el período ${periodo}. Sólo expone los que siguen abiertos en su plataforma.`;
      } else {
        const cruce = await construirCruce(periodoTalana);
        for (const fila of cruce.filas) {
          const centro = limpiarTexto(fila.centroCosto) || 'Sin centro de costo';
          const acc = talana.porCentro.get(centro) ?? { costo: 0, personas: 0 };
          acc.costo += fila.costoEmpresa;
          acc.personas += 1;
          talana.porCentro.set(centro, acc);
        }
        talana.ok = true;
      }
    } catch (error: any) {
      talana.error = `No se pudo leer Talana: ${error?.message || error}`;
    }
  }

  // Cuentas que parecen de personal, tienen movimiento y nadie asignó a un área.
  // Es el espejo exacto de `centrosSinMapear`: lo que no se está comparando se
  // ve, en vez de desaparecer del total.
  const cuentasMapeadas = new Set(Array.from(cuentasPorConcepto.values()).flat());
  const cuentasSinMapear = cuentas
    .filter((c) => !cuentasMapeadas.has(c.codigo))
    .filter((c) => PARECE_DE_PERSONAL.test(`${c.nombre} ${c.nombreLargo ?? ''}`))
    .map((c) => ({ codigo: c.codigo, nombre: c.nombreLargo || c.nombre, monto: contablePorCuenta.get(c.codigo) ?? 0 }))
    .filter((c) => c.monto !== 0)
    .sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto));

  const centrosMapeados = new Set(Array.from(centrosPorConcepto.values()).flat());
  const conceptos = Array.from(new Set([
    ...CONCEPTOS_PERSONAL.map((c) => c.concepto),
    ...Array.from(cuentasPorConcepto.keys()),
    ...Array.from(centrosPorConcepto.keys()),
  ])).map((concepto) => {
    const codigos = cuentasPorConcepto.get(concepto) ?? [];
    const centros = centrosPorConcepto.get(concepto) ?? [];
    const contable = codigos.reduce((acc, c) => acc + (contablePorCuenta.get(c) ?? 0), 0);
    const montoTalana = centros.reduce((acc, c) => acc + (talana.porCentro.get(c)?.costo ?? 0), 0);
    const personas = centros.reduce((acc, c) => acc + (talana.porCentro.get(c)?.personas ?? 0), 0);
    const diferencia = contable - montoTalana;
    return {
      concepto,
      nombre: NOMBRE_CONCEPTO.get(concepto) ?? concepto,
      cuentas: codigos.map((c) => ({ codigo: c, nombre: nombrePorCodigo.get(c) ?? c, monto: contablePorCuenta.get(c) ?? 0 })),
      centrosCosto: centros,
      contable,
      talana: montoTalana,
      personas,
      diferencia,
      // Sin centros mapeados no hay comparación: es "falta configurar", no "cuadra".
      comparable: talana.ok && centros.length > 0,
      descuadra: talana.ok && centros.length > 0 && Math.abs(diferencia) > UMBRAL_DESCUADRE,
    };
  });

  return {
    periodo,
    talana: { ok: talana.ok, error: talana.error ?? null },
    conceptos,
    /** Centros que Talana informó y nadie asignó todavía: se ven, no se pierden. */
    centrosSinMapear: Array.from(talana.porCentro.entries())
      .filter(([centro]) => !centrosMapeados.has(centro))
      .map(([centro, v]) => ({ centroCosto: centro, costoEmpresa: v.costo, personas: v.personas }))
      .sort((a, b) => b.costoEmpresa - a.costoEmpresa),
    /** El otro lado del mismo agujero: gasto en gente que no entra en el cruce. */
    cuentasSinMapear,
    umbralDescuadre: UMBRAL_DESCUADRE,
  };
}

// ─── CSV ────────────────────────────────────────────────────────────────────

/**
 * Excel interpreta como fórmula cualquier celda que empiece con `= + - @`, así
 * que se les antepone una comilla. Mismo criterio que el export de Remuneraciones.
 */
function csvCampo(valor: unknown): string {
  const s = String(valor ?? '');
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export function registerBalanceRoutes(app: Express) {
  /**
   * Doble cerrojo, igual que Remuneraciones y por la misma razón: acá se ve el
   * resultado completo de la empresa. Con `requireRoles(['admin'])` delante,
   * cualquier grant que aparezca por otra vía se queda en un 403. Si algún día
   * tiene que entrar contabilidad, se saca esta línea con intención.
   */
  const soloAdmin = requireRoles(['admin']);
  const conPermiso = requirePermission('finanzas.balance');
  // Encadenados a mano en UN middleware: pasarlos como arreglo hace que Express
  // pierda el tipo de `res` en todos los handlers.
  const guard = (req: any, res: any, next: any) =>
    soloAdmin(req, res, (err?: any) => (err ? next(err) : conPermiso(req, res, next)));

  const fallo = (res: any, error: any, contexto: string) => {
    console.error(`[balance] ${contexto}:`, error?.message || error);
    res.status(500).json({ message: error?.message || `Error en ${contexto}` });
  };

  /** Qué hay cargado. Sirve para que la pantalla explique qué falta. */
  app.get('/api/finanzas/balance/estado', requireAuth, guard, async (_req: any, res: any) => {
    try {
      await ensureTables();
      const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(cuentasContables);
      const periodos = await db.select().from(balancePeriodos).orderBy(asc(balancePeriodos.periodo));
      res.json({
        cuentas: total,
        periodos: periodos.map((p) => p.periodo),
        ultimoPeriodo: periodos.length ? periodos[periodos.length - 1].periodo : null,
        talanaConfigurado: talanaConfigurado(),
        // Sin cuentas 1/2/3 no hay estado de situación, y conviene decirlo arriba.
        soloResultado: true,
      });
    } catch (error: any) { fallo(res, error, 'estado'); }
  });

  app.get('/api/finanzas/balance/cuentas', requireAuth, guard, async (_req: any, res: any) => {
    try {
      await ensureTables();
      const cuentas = await db.select().from(cuentasContables).orderBy(asc(cuentasContables.codigo));
      const porNombre = new Map<string, string[]>();
      for (const c of cuentas) porNombre.set(c.nombre, [...(porNombre.get(c.nombre) ?? []), c.codigo]);
      res.json({
        cuentas,
        posiblesDuplicados: Array.from(porNombre.entries())
          .filter(([, codigos]) => codigos.length > 1)
          .map(([nombre, codigos]) => ({ nombre, codigos })),
        normalizadas: cuentas.filter((c) => c.codigo !== c.codigoErp).length,
      });
    } catch (error: any) { fallo(res, error, 'cuentas'); }
  });

  app.put('/api/finanzas/balance/cuentas/:codigo', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const parsed = editarCuentaContableSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Datos inválidos' });
      }
      const cambios: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.nombreLargo !== undefined) cambios.nombreLargo = limpiarTexto(parsed.data.nombreLargo) || null;
      if (parsed.data.activa !== undefined) cambios.activa = parsed.data.activa;
      const [actualizada] = await db.update(cuentasContables).set(cambios)
        .where(eq(cuentasContables.codigo, req.params.codigo)).returning();
      if (!actualizada) return res.status(404).json({ message: 'No existe esa cuenta' });
      res.json(actualizada);
    } catch (error: any) { fallo(res, error, 'editar cuenta'); }
  });

  /**
   * Importar el plan de cuentas. `modo=preview` muestra qué pasaría y no escribe
   * nada; sin él, escribe. El mismo par que usan los otros importadores del repo.
   */
  app.post('/api/finanzas/balance/cuentas/importar', requireAuth, guard, upload.single('file'), async (req: any, res: any) => {
    try {
      await ensureTables();
      if (!req.file) return res.status(400).json({ message: 'Falta el archivo' });
      const { cuentas, errores, posiblesDuplicados, normalizadas } = parsearPlanDeCuentas(req.file.buffer);
      if (cuentas.length === 0) {
        return res.status(400).json({ message: 'El archivo no tiene ninguna cuenta legible', errores });
      }
      const resumen = { leidas: cuentas.length, errores, posiblesDuplicados, normalizadas };
      if (req.query.modo === 'preview') return res.json({ preview: true, ...resumen, muestra: cuentas.slice(0, 20) });

      for (const c of cuentas) {
        await db.insert(cuentasContables).values(c).onConflictDoUpdate({
          target: cuentasContables.codigo,
          // `nombreLargo` y `activa` NO se pisan: son nuestros, no del ERP.
          set: {
            codigoErp: c.codigoErp, granCuenta: c.granCuenta, granCuentaNombre: c.granCuentaNombre,
            mayor: c.mayor, mayorNombre: c.mayorNombre, nombre: c.nombre,
            naturaleza: c.naturaleza, updatedAt: new Date(),
          },
        });
      }

      // Primer import: se siembra el lado contable del puente con Talana. Los
      // centros de costo quedan sin mapear a propósito (ver CONCEPTOS_PERSONAL).
      const [{ total: yaHayPuente }] = await db.select({ total: sql<number>`count(*)::int` }).from(balancePuentePersonal);
      let conceptosSembrados = 0;
      if (!yaHayPuente) {
        const existentes = new Set(cuentas.map((c) => c.codigo));
        for (const grupo of CONCEPTOS_PERSONAL) {
          for (const codigo of grupo.cuentas.filter((c) => existentes.has(c))) {
            await db.insert(balancePuentePersonal)
              .values({ concepto: grupo.concepto, tipo: 'cuenta', valor: codigo })
              .onConflictDoNothing();
            conceptosSembrados++;
          }
        }
      }

      res.json({ ...resumen, guardadas: cuentas.length, conceptosSembrados });
    } catch (error: any) { fallo(res, error, 'importar plan de cuentas'); }
  });

  app.get('/api/finanzas/balance/periodos', requireAuth, guard, async (_req: any, res: any) => {
    try {
      await ensureTables();
      res.json(await db.select().from(balancePeriodos).orderBy(asc(balancePeriodos.periodo)));
    } catch (error: any) { fallo(res, error, 'periodos'); }
  });

  app.get('/api/finanzas/balance/resultado', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const periodo = periodoBalanceSchema.safeParse(req.query.periodo);
      if (!periodo.success) return res.status(400).json({ message: periodo.error.errors[0].message });
      res.json(await armarResultado(periodo.data));
    } catch (error: any) { fallo(res, error, 'resultado'); }
  });

  /** Importar los saldos de un mes. Reemplaza el período entero. */
  app.post('/api/finanzas/balance/saldos/importar', requireAuth, guard, upload.single('file'), async (req: any, res: any) => {
    try {
      await ensureTables();
      if (!req.file) return res.status(400).json({ message: 'Falta el archivo' });
      const periodo = periodoBalanceSchema.safeParse(req.body?.periodo);
      if (!periodo.success) return res.status(400).json({ message: periodo.error.errors[0].message });

      const plan = await db.select({
        codigo: cuentasContables.codigo, codigoErp: cuentasContables.codigoErp,
        naturaleza: cuentasContables.naturaleza,
      }).from(cuentasContables);
      if (plan.length === 0) {
        return res.status(400).json({ message: 'Primero hay que importar el plan de cuentas' });
      }

      const { saldos, errores } = parsearSaldos(req.file.buffer, plan);
      const resumen = { periodo: periodo.data, leidas: saldos.length, errores };
      if (req.query.modo === 'preview') return res.json({ preview: true, ...resumen, muestra: saldos.slice(0, 20) });
      if (saldos.length === 0) {
        return res.status(400).json({ message: 'Ninguna fila del archivo calzó con el plan de cuentas', errores });
      }

      const [cargado] = await db.select().from(balancePeriodos).where(eq(balancePeriodos.periodo, periodo.data)).limit(1);
      if (cargado?.estado === 'cerrado') {
        return res.status(409).json({ message: `El período ${periodo.data} está cerrado. Reabrilo antes de volver a cargarlo.` });
      }

      // El período se reemplaza entero: una carga parcial dejaría cuentas del
      // archivo anterior mezcladas con las del nuevo, y el resultado no cuadraría.
      await db.delete(balanceSaldos).where(eq(balanceSaldos.periodo, periodo.data));
      for (const s of saldos) {
        await db.insert(balanceSaldos).values({
          periodo: periodo.data, cuentaCodigo: s.cuentaCodigo,
          debe: String(s.debe), haber: String(s.haber), saldo: String(s.saldo),
        });
      }
      await db.insert(balancePeriodos).values({
        periodo: periodo.data, estado: 'borrador', origen: 'excel',
        archivoNombre: req.file.originalname?.slice(0, 255) ?? null,
        cargadoPor: req.user?.id ?? null,
      }).onConflictDoUpdate({
        target: balancePeriodos.periodo,
        set: {
          origen: 'excel', archivoNombre: req.file.originalname?.slice(0, 255) ?? null,
          cargadoPor: req.user?.id ?? null, updatedAt: new Date(),
        },
      });

      res.json({ ...resumen, guardadas: saldos.length });
    } catch (error: any) { fallo(res, error, 'importar saldos'); }
  });

  app.put('/api/finanzas/balance/periodos/:periodo/estado', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const estado = z.enum(['borrador', 'cerrado']).safeParse(req.body?.estado);
      if (!estado.success) return res.status(400).json({ message: 'El estado va como borrador o cerrado' });
      const [actualizado] = await db.update(balancePeriodos)
        .set({ estado: estado.data, updatedAt: new Date() })
        .where(eq(balancePeriodos.periodo, req.params.periodo)).returning();
      if (!actualizado) return res.status(404).json({ message: 'Ese período no está cargado' });
      res.json(actualizado);
    } catch (error: any) { fallo(res, error, 'estado del período'); }
  });

  /**
   * Presupuesto del mes.
   *
   * Hoy sólo tiene sentido para la línea de ingresos: el presupuesto que existe
   * es de ventas por vendedor y unidad de negocio, sin gastos y sin cuentas
   * contables. Se informa en la respuesta para que la pantalla lo diga en vez
   * de mostrar una columna vacía sin explicación.
   */
  // ─── Softland, en vivo ────────────────────────────────────────────────────
  //
  // La contabilidad no se sube: se trae. Estos tres endpoints reemplazan la
  // carga por Excel, que queda como respaldo para cuando el ERP no esté (ver
  // `server/etl-contabilidad.ts` para el mapa de tablas y las trampas del
  // modelo de Softland).

  /** Qué hay del otro lado: años de plan y meses con movimiento. Nunca lanza. */
  app.get('/api/finanzas/balance/erp/estado', requireAuth, guard, async (_req: any, res: any) => {
    try {
      await ensureTables();
      res.json(await estadoErpContabilidad());
    } catch (error: any) { fallo(res, error, 'estado del ERP'); }
  });

  /** Traer el plan de cuentas de un año desde Softland. */
  app.post('/api/finanzas/balance/erp/plan', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const anio = z.string().regex(/^\d{4}$/, 'El año va como YYYY').safeParse(String(req.body?.anio ?? ''));
      if (!anio.success) return res.status(400).json({ message: anio.error.errors[0].message });

      const resumen = await sincronizarPlanDeCuentas(anio.data);
      if (resumen.leidas === 0) {
        return res.status(404).json({ message: `El ERP no tiene plan de cuentas para ${anio.data}.` });
      }

      // Igual que el import por Excel: el puente con Talana se siembra una sola
      // vez, y sólo con las cuentas que de verdad existen en el plan traído.
      const [{ total: yaHayPuente }] = await db.select({ total: sql<number>`count(*)::int` }).from(balancePuentePersonal);
      let conceptosSembrados = 0;
      if (!yaHayPuente) {
        const existentes = new Set(
          (await db.select({ codigo: cuentasContables.codigo }).from(cuentasContables)).map((c) => c.codigo),
        );
        for (const grupo of CONCEPTOS_PERSONAL) {
          for (const codigo of grupo.cuentas.filter((c) => existentes.has(c))) {
            await db.insert(balancePuentePersonal)
              .values({ concepto: grupo.concepto, tipo: 'cuenta', valor: codigo })
              .onConflictDoNothing();
            conceptosSembrados++;
          }
        }
      }

      res.json({ ...resumen, conceptosSembrados });
    } catch (error: any) { fallo(res, error, 'traer el plan del ERP'); }
  });

  /** Traer los saldos de un mes desde Softland. Reemplaza el período entero. */
  app.post('/api/finanzas/balance/erp/periodo', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const periodo = periodoBalanceSchema.safeParse(req.body?.periodo);
      if (!periodo.success) return res.status(400).json({ message: periodo.error.errors[0].message });

      // Compuerta de prueba: el primer ETL va sólo con los meses habilitados.
      // Se responde con el motivo, no con un 500 desde el throw de la función.
      if (!periodoHabilitado(periodo.data)) {
        return res.status(409).json({
          message: `Por ahora sólo se puede traer ${(PERIODOS_HABILITADOS ?? []).map(etiquetaMes).join(', ')}. `
            + 'Es la primera corrida del ETL y se está validando contra el ERP mes a mes.',
        });
      }

      const [{ total: cuentasEnPlan }] = await db.select({ total: sql<number>`count(*)::int` }).from(cuentasContables);
      if (cuentasEnPlan === 0) {
        return res.status(400).json({ message: 'Primero hay que traer el plan de cuentas.' });
      }

      // Mismo cerrojo que la carga por Excel: un mes cerrado no se pisa solo.
      const [cargado] = await db.select().from(balancePeriodos).where(eq(balancePeriodos.periodo, periodo.data)).limit(1);
      if (cargado?.estado === 'cerrado') {
        return res.status(409).json({ message: `El período ${periodo.data} está cerrado. Reabrilo antes de volver a traerlo.` });
      }

      const resumen = await sincronizarPeriodo(periodo.data, req.user?.id ?? null);
      if (resumen.cuentas === 0 && resumen.sinCuentaEnElPlan.length === 0) {
        return res.status(404).json({ message: `El ERP no tiene movimiento contable en ${periodo.data}.` });
      }
      res.json(resumen);
    } catch (error: any) { fallo(res, error, 'traer el período del ERP'); }
  });

  app.get('/api/finanzas/balance/presupuesto', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const periodo = periodoBalanceSchema.safeParse(req.query.periodo);
      if (!periodo.success) return res.status(400).json({ message: periodo.error.errors[0].message });
      const filas = await db.select().from(balancePresupuesto).where(eq(balancePresupuesto.periodo, periodo.data));
      const cuentas = await db.select().from(cuentasContables).where(eq(cuentasContables.naturaleza, 'ingreso'));
      res.json({
        periodo: periodo.data,
        filas,
        cuentasIngreso: cuentas.map((c) => ({ codigo: c.codigo, nombre: c.nombreLargo || c.nombre })),
        soloIngresos: true,
        nota: 'El presupuesto disponible es de ventas por vendedor y unidad de negocio: no trae gastos ni cuentas contables.',
      });
    } catch (error: any) { fallo(res, error, 'presupuesto'); }
  });

  app.put('/api/finanzas/balance/presupuesto', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const parsed = guardarPresupuestoSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const monto = aNumero(parsed.data.monto);
      const [fila] = await db.insert(balancePresupuesto).values({
        periodo: parsed.data.periodo, cuentaCodigo: parsed.data.cuentaCodigo,
        monto: String(monto), actualizadoPor: req.user?.id ?? null,
      }).onConflictDoUpdate({
        target: [balancePresupuesto.periodo, balancePresupuesto.cuentaCodigo],
        set: { monto: String(monto), actualizadoPor: req.user?.id ?? null, updatedAt: new Date() },
      }).returning();
      res.json(fila);
    } catch (error: any) { fallo(res, error, 'guardar presupuesto'); }
  });

  app.get('/api/finanzas/balance/personal', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const periodo = periodoBalanceSchema.safeParse(req.query.periodo);
      if (!periodo.success) return res.status(400).json({ message: periodo.error.errors[0].message });
      res.json(await armarPersonal(periodo.data));
    } catch (error: any) { fallo(res, error, 'personal'); }
  });

  app.get('/api/finanzas/balance/puente-personal', requireAuth, guard, async (_req: any, res: any) => {
    try {
      await ensureTables();
      const filas = await db.select().from(balancePuentePersonal);
      res.json({
        conceptos: CONCEPTOS_PERSONAL.map((c) => ({ concepto: c.concepto, nombre: c.nombre })),
        filas,
      });
    } catch (error: any) { fallo(res, error, 'puente personal'); }
  });

  /** Reemplaza de una vez la lista de un lado del puente (cuentas o centros). */
  app.put('/api/finanzas/balance/puente-personal', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const parsed = guardarPuentePersonalSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { concepto, tipo, valores } = parsed.data;
      const limpios = Array.from(new Set(valores.map((v) => limpiarTexto(v)).filter(Boolean)));

      await db.delete(balancePuentePersonal)
        .where(and(eq(balancePuentePersonal.concepto, concepto), eq(balancePuentePersonal.tipo, tipo)));
      for (const valor of limpios) {
        // El índice único es por (tipo, valor): un centro de costo pertenece a un
        // solo concepto, si no su costo se contaría dos veces.
        await db.delete(balancePuentePersonal)
          .where(and(eq(balancePuentePersonal.tipo, tipo), eq(balancePuentePersonal.valor, valor)));
        await db.insert(balancePuentePersonal).values({ concepto, tipo, valor });
      }
      res.json({ concepto, tipo, valores: limpios });
    } catch (error: any) { fallo(res, error, 'guardar puente personal'); }
  });

  /** El detalle de una cuenta: su serie mes a mes dentro del año. */
  app.get('/api/finanzas/balance/cuenta/:codigo', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const ano = Number(req.query.ano) || new Date().getFullYear();
      const [cuenta] = await db.select().from(cuentasContables)
        .where(eq(cuentasContables.codigo, req.params.codigo)).limit(1);
      if (!cuenta) return res.status(404).json({ message: 'No existe esa cuenta' });

      const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
      const saldos = await db.select().from(balanceSaldos)
        .where(and(eq(balanceSaldos.cuentaCodigo, cuenta.codigo), inArray(balanceSaldos.periodo, meses)));
      const presupuesto = await db.select().from(balancePresupuesto)
        .where(and(eq(balancePresupuesto.cuentaCodigo, cuenta.codigo), inArray(balancePresupuesto.periodo, meses)));

      const porPeriodo = new Map(saldos.map((s) => [s.periodo, s]));
      const presuPorPeriodo = new Map(presupuesto.map((p) => [p.periodo, Number(p.monto)]));
      res.json({
        cuenta,
        ano,
        serie: meses.map((periodo) => {
          const s = porPeriodo.get(periodo);
          return {
            periodo,
            monto: s ? montoDeFila(cuenta.naturaleza, Number(s.debe), Number(s.haber), Number(s.saldo)) : null,
            debe: s ? Number(s.debe) : null,
            haber: s ? Number(s.haber) : null,
            presupuesto: presuPorPeriodo.get(periodo) ?? null,
          };
        }),
      });
    } catch (error: any) { fallo(res, error, 'detalle de cuenta'); }
  });

  app.get('/api/finanzas/balance/export.csv', requireAuth, guard, async (req: any, res: any) => {
    try {
      await ensureTables();
      const periodo = periodoBalanceSchema.safeParse(req.query.periodo);
      if (!periodo.success) return res.status(400).json({ message: periodo.error.errors[0].message });
      const { grupos, lineas } = await armarResultado(periodo.data);

      const filas: string[] = [];
      filas.push(['Código', 'Código ERP', 'Gran cuenta', 'Mayor', 'Cuenta', 'Mes', 'Mes anterior', 'Acumulado año', 'Presupuesto'].map(csvCampo).join(';'));
      for (const g of grupos) {
        for (const m of g.mayores) {
          for (const c of m.cuentas) {
            filas.push([c.codigo, c.codigoErp, g.nombre, m.nombre, c.nombre, c.mes, c.anterior, c.acumulado, c.presupuesto].map(csvCampo).join(';'));
          }
        }
      }
      filas.push('');
      for (const l of lineas) {
        filas.push(['', '', '', '', l.etiqueta, l.mes, l.anterior, l.acumulado, l.presupuesto].map(csvCampo).join(';'));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="resultado-${periodo.data}.csv"`);
      res.send('﻿' + filas.join('\n')); // BOM: sin él Excel en Windows rompe las tildes
    } catch (error: any) { fallo(res, error, 'export csv'); }
  });
}
