/**
 * Remuneraciones — Talana cruzado con la intranet
 * ---------------------------------------------------------------
 * Panorámica liquida sueldos en Talana y calcula comisiones, gastos y
 * reembolsos en la intranet. Hasta ahora esas dos mitades solo se juntaban en
 * una planilla a mano cada mes. Este módulo las cruza persona por persona y
 * deja a la vista lo único que importa antes de cerrar el mes: **si lo que
 * Talana va a pagar coincide con lo que la intranet calculó**.
 *
 * De Talana (server/services/talana.ts):
 *   - contratos     → cargo, centro de costo, sucursal, sueldo base, activo
 *   - días trabajados → del mes VIGENTE (la API no responde meses anteriores)
 *   - liquidaciones  → días, haberes, descuentos, líquido, costo empresa,
 *                      comisiones pagadas (Comision1 + Comision2), anticipos,
 *                      atrasos, ausencias y licencias del período
 *
 * De la intranet:
 *   - comisión calculada sobre el margen facturado (server/commissions.ts),
 *     que es la cifra que RR.HH. carga a mano en Talana como "Comisión"
 *   - reembolsos de gastos ya aprobados (gastos_empresariales), que se pagan
 *     junto con el sueldo
 *   - la persona (`users`) y el vendedor del ERP (`fact_ventas.nokofu`)
 *
 * El puente entre las tres identidades (RUT en Talana, `users.id` en la
 * intranet, nombre del vendedor en el ERP) vive en `talana_vinculos`. El
 * sistema propone el calce por nombre y RR.HH. lo confirma; nada se cruza a
 * ciegas: cada fila dice de dónde salió su vínculo.
 *
 * Reglas de resiliencia (las mismas del resto del repo):
 *   - Las tablas se crean en runtime con CREATE TABLE IF NOT EXISTS: el runner
 *     de migraciones no es confiable en producción (ver server/commissions.ts).
 *   - Si Talana está caído o sin token, el endpoint responde 200 con
 *     `talana.ok = false` y el detalle. El módulo abre igual y explica qué
 *     pasa, en vez de mostrar un error genérico.
 *   - Si el cálculo de comisiones falla (tablas del ERP no disponibles), el
 *     cruce se entrega igual con `comisionIntranet` en null.
 */
import type { Express } from 'express';
import { z } from 'zod';
import { eq, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { requirePermission } from './permissions';
import { talanaVinculos, users, salespeopleUsers, guardarTalanaVinculoSchema } from '../shared/schema';
import { getCommissionSummary } from './commissions';
import {
  getContratos,
  getDiasTrabajados,
  getLiquidaciones,
  getPeriodos,
  item,
  items,
  limpiarCacheTalana,
  nombreCompleto,
  rutNormalizado,
  talanaConfigurado,
  type TalanaContrato,
  type TalanaLiquidacion,
  type TalanaPeriodo,
} from './services/talana';

// ─── Constantes de negocio ──────────────────────────────────────────────────

/**
 * Los ítems de comisión de Talana. Panorámica usa dos glosas ("Comision1" y
 * "Comision2") y la comisión del mes es la suma: comparar solo contra una
 * mostraría un descuadre que no existe.
 */
const ITEMS_COMISION = ['Comision1', 'Comision2'];

/**
 * Diferencia (en pesos) a partir de la cual una comisión se marca como
 * descuadrada. No es cero a propósito: la intranet calcula con decimales y
 * Talana redondea al peso, así que diferencias de unidades son ruido.
 */
const UMBRAL_DESCUADRE = 1000;

// ─── Tablas en runtime ──────────────────────────────────────────────────────

let ensureTablesPromise: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS talana_vinculos (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          talana_empleado_id integer NOT NULL,
          rut varchar(20),
          nombre_talana varchar(255),
          user_id varchar,
          salesperson_name varchar(255),
          confirmado boolean NOT NULL DEFAULT false,
          ignorado boolean NOT NULL DEFAULT false,
          actualizado_por varchar,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_talana_vinculos_empleado"
        ON talana_vinculos (talana_empleado_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "IDX_talana_vinculos_rut"
        ON talana_vinculos (rut)
      `);
    })().catch((error) => {
      ensureTablesPromise = null; // permite reintentar
      throw error;
    });
  }
  return ensureTablesPromise;
}

/** Se llama en el arranque (server/index.ts) para no depender del runner. */
export async function ensureRemuneracionesTables(): Promise<void> {
  await ensureTables();
}

// ─── Calce de nombres ───────────────────────────────────────────────────────

/** Sin tildes, sin dobles espacios y en mayúsculas. */
function normalizar(texto: string | null | undefined): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calce por nombre entre Talana y la intranet. No compara cadenas completas
 * porque el orden y la cantidad de nombres cambia según la fuente: en Talana
 * "Luis Antonio Barrientos Becerra", en el ERP "BARRIENTOS LUIS" y en la
 * intranet "Luis Barrientos". Se exige que **todas** las palabras del nombre
 * más corto estén en el más largo y que al menos dos coincidan, así "Luis
 * Barrientos" calza con "Luis Antonio Barrientos Becerra" pero "Luis Soto" no.
 */
function calzaNombre(a: string, b: string): boolean {
  const pa = normalizar(a).split(' ').filter((w) => w.length > 2);
  const pb = normalizar(b).split(' ').filter((w) => w.length > 2);
  if (pa.length < 2 || pb.length < 2) return false;
  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  const setLargo = new Set(largo);
  const comunes = corto.filter((w) => setLargo.has(w));
  return comunes.length === corto.length && comunes.length >= 2;
}

/**
 * Lo que el sistema PROPONE para una persona de Talana, calzando por nombre.
 * Es la misma función que usan el cruce y la pestaña de vínculos: si cada lado
 * calzara por su cuenta, la planilla podría decir "Automático" donde la pantalla
 * de vínculos muestra "Sin asignar", que fue justamente el error a evitar.
 */
export function proponerVinculo(
  nombreTalana: string,
  personas: PersonaIntranet[],
  vendedores: string[],
): { persona: PersonaIntranet | null; salespersonName: string | null } {
  const persona = personas.find((p) =>
    calzaNombre(p.nombre, nombreTalana) || (!!p.salespersonName && calzaNombre(p.salespersonName, nombreTalana))) ?? null;
  const salespersonName =
    persona?.salespersonName ?? vendedores.find((v) => calzaNombre(v, nombreTalana)) ?? null;
  return { persona, salespersonName };
}

// ─── Datos de la intranet ───────────────────────────────────────────────────

interface PersonaIntranet {
  id: string;
  nombre: string;
  email: string | null;
  role: string | null;
  /** Nombre con el que aparece en las ventas del ERP, si la persona es vendedor. */
  salespersonName: string | null;
  /**
   * Todos los ids con los que esta persona puede haber creado gastos. Son dos
   * porque la intranet tiene dos tablas de login: `users` y `salespeople_users`.
   * Quien existe en las dos rinde gastos con el id de la tabla por la que entró,
   * así que sumar por un solo id dejaría reembolsos afuera.
   */
  idsGastos: string[];
}

/**
 * Las personas de la intranet: la unión de `users` y `salespeople_users` (sin
 * los clientes del Market), juntando por email a quien está en las dos.
 *
 * De `salespeople_users` sale además `salespersonName`, que es exactamente el
 * nombre con el que el ERP registra la venta (`fact_ventas.nokofu`): es el
 * puente más confiable hacia la comisión calculada, mejor que calzar nombres.
 */
async function getPersonasIntranet(): Promise<PersonaIntranet[]> {
  const [filasUsers, filasVendedores] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      // `ne` solo deja fuera a los clientes: una fila con rol NULL no se pierde.
      .where(or(isNull(users.role), ne(users.role, 'client'))),
    db
      .select({
        id: salespeopleUsers.id,
        salespersonName: salespeopleUsers.salespersonName,
        email: salespeopleUsers.email,
        role: salespeopleUsers.role,
      })
      .from(salespeopleUsers)
      .where(or(isNull(salespeopleUsers.role), ne(salespeopleUsers.role, 'client'))),
  ]);

  const porEmail = new Map<string, PersonaIntranet>();
  const salida: PersonaIntranet[] = [];

  for (const u of filasUsers) {
    const persona: PersonaIntranet = {
      id: u.id,
      nombre: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || (u.email || ''),
      email: u.email ?? null,
      role: u.role ?? null,
      salespersonName: null,
      idsGastos: [u.id],
    };
    salida.push(persona);
    if (persona.email) porEmail.set(persona.email.toLowerCase(), persona);
  }

  for (const v of filasVendedores) {
    const clave = (v.email || '').toLowerCase();
    const existente = clave ? porEmail.get(clave) : undefined;
    if (existente) {
      // Misma persona en las dos tablas: se queda con el id de `users` (el que
      // usan los informes de rendición) y suma el otro para los gastos.
      existente.salespersonName = v.salespersonName ?? existente.salespersonName;
      if (!existente.idsGastos.includes(v.id)) existente.idsGastos.push(v.id);
      continue;
    }
    const persona: PersonaIntranet = {
      id: v.id,
      nombre: (v.salespersonName || v.email || '').trim(),
      email: v.email ?? null,
      role: v.role ?? null,
      salespersonName: v.salespersonName ?? null,
      idsGastos: [v.id],
    };
    salida.push(persona);
    if (clave) porEmail.set(clave, persona);
  }

  return salida;
}

/**
 * Reembolsos ya aprobados que se pagan junto con el sueldo del período.
 * Se imputan por la fecha en que quedaron aprobados (que es cuando entran a la
 * planilla), no por la fecha de la boleta: un gasto de marzo aprobado en abril
 * se paga en abril.
 */
async function getReembolsosAprobados(desde: string, hasta: string): Promise<Map<string, { monto: number; cantidad: number }>> {
  const out = new Map<string, { monto: number; cantidad: number }>();
  try {
    const res: any = await db.execute(sql`
      SELECT user_id,
             COALESCE(SUM(monto), 0) AS monto,
             COUNT(*)                AS cantidad
      FROM gastos_empresariales
      WHERE user_id IS NOT NULL
        AND COALESCE(funding_mode, 'reembolso') = 'reembolso'
        AND (estado_aprobacion = 'aprobado' OR estado = 'aprobado')
        AND COALESCE(fecha_aprobacion_rrhh, fecha_aprobacion, created_at)::date
            BETWEEN ${desde}::date AND ${hasta}::date
      GROUP BY user_id
    `);
    for (const r of res.rows ?? res ?? []) {
      out.set(String(r.user_id), {
        monto: Number(r.monto) || 0,
        cantidad: Number(r.cantidad) || 0,
      });
    }
  } catch (error: any) {
    // La tabla de gastos puede no existir en un ambiente recién levantado:
    // el cruce de sueldos no se cae por eso, solo se queda sin esa columna.
    console.warn('[remuneraciones] no se pudieron leer los reembolsos:', error?.message);
  }
  return out;
}

// ─── El cruce ───────────────────────────────────────────────────────────────

export type EstadoVinculo = 'confirmado' | 'automatico' | 'sin_vinculo' | 'ignorado';

export interface FilaCruce {
  talanaEmpleadoId: number;
  rut: string;
  nombre: string;
  cargo: string | null;
  centroCosto: string | null;
  sucursal: string | null;
  contratoActivo: boolean;
  // Talana
  diasTrabajados: number | null;
  fuenteDias: 'liquidacion' | 'workedDays' | null;
  diasAusencia: number;
  diasLicencia: number;
  sueldoBase: number;
  haberes: number;
  descuentos: number;
  liquido: number;
  costoEmpresa: number;
  anticipo: number;
  atrasos: number;
  comisionTalana: number;
  estadoLiquidacion: string | null;
  // Intranet
  userId: string | null;
  userNombre: string | null;
  salespersonName: string | null;
  comisionIntranet: number | null;
  diferenciaComision: number | null;
  reembolsosAprobados: number;
  reembolsosCantidad: number;
  estadoVinculo: EstadoVinculo;
}

export type TipoAlerta =
  | 'comision_descuadrada'
  | 'comision_no_pagada'
  | 'comision_sin_respaldo'
  | 'sin_vinculo'
  | 'vendedor_sin_liquidacion'
  | 'sin_liquidacion';

export interface Alerta {
  tipo: TipoAlerta;
  nombre: string;
  detalle: string;
  monto?: number;
  talanaEmpleadoId?: number;
}

/**
 * Arma el cruce de un período.
 *
 * Los días trabajados salen de la liquidación (`diasTrabajadosItem`) cuando el
 * mes ya tiene una; para el mes en curso, que todavía no la tiene, se usan los
 * días vigentes de `workedDays`. Cada fila declara de dónde salió el número en
 * `fuenteDias`, porque no significan lo mismo: uno es lo liquidado y el otro,
 * lo que va corriendo.
 */
export async function construirCruce(periodo: TalanaPeriodo) {
  const [contratos, liquidaciones] = await Promise.all([
    getContratos(),
    getLiquidaciones(periodo.id),
  ]);

  // Los días vigentes solo aportan si el período está abierto: en un mes
  // cerrado mostrarían los días del mes actual, no los del mes liquidado.
  let workedDays: Awaited<ReturnType<typeof getDiasTrabajados>> = [];
  if (!periodo.cerrado) {
    workedDays = await getDiasTrabajados().catch(() => []);
  }

  const vinculos = await db.select().from(talanaVinculos);
  const porEmpleado = new Map(vinculos.map((v) => [v.talanaEmpleadoId, v]));

  const personas = await getPersonasIntranet();

  // Comisión calculada por la intranet para el mismo rango de fechas.
  let comisiones: { salesperson: string; commissionAmount: number }[] | null = null;
  let comisionesError: string | null = null;
  try {
    const resumen = await getCommissionSummary(periodo.desde, periodo.hasta);
    comisiones = resumen.items.map((i: any) => ({
      salesperson: i.salesperson,
      commissionAmount: i.commissionAmount,
    }));
  } catch (error: any) {
    comisionesError = error?.message || 'no se pudo calcular';
    console.warn('[remuneraciones] comisiones no disponibles:', comisionesError);
  }

  const nombresVendedores = (comisiones || []).map((c) => c.salesperson).filter(Boolean);

  const reembolsos = await getReembolsosAprobados(periodo.desde, periodo.hasta);

  // Índices por empleado de Talana
  const sueldoPorEmpleado = new Map<number, TalanaLiquidacion>();
  const anticipoPorEmpleado = new Map<number, number>();
  for (const liq of liquidaciones) {
    if (liq.tipoLiquidacion === 'sueldo' || liq.tipoLiquidacion === 'finiquito') {
      // Si hubiera más de una, manda la última cargada (id mayor).
      const previa = sueldoPorEmpleado.get(liq.empleado);
      if (!previa || liq.id > previa.id) sueldoPorEmpleado.set(liq.empleado, liq);
    } else if (liq.tipoLiquidacion === 'anticipo') {
      anticipoPorEmpleado.set(
        liq.empleado,
        (anticipoPorEmpleado.get(liq.empleado) || 0) + item(liq, 'montoTransfer'),
      );
    }
  }

  const contratoPorEmpleado = new Map<number, TalanaContrato>();
  for (const c of contratos) {
    const previo = contratoPorEmpleado.get(c.empleado);
    // El contrato vigente manda sobre uno finiquitado, y entre dos vigentes el
    // más nuevo (Talana crea un contrato nuevo por cada anexo).
    if (!previo || (c.activo && !previo.activo) || (c.activo === previo.activo && c.id > previo.id)) {
      contratoPorEmpleado.set(c.empleado, c);
    }
  }

  const diasVigentesPorEmpleado = new Map<number, number>();
  for (const wd of workedDays) {
    diasVigentesPorEmpleado.set(wd.empleado.id, Number(wd.diasTrabajados) || 0);
  }

  // Universo de personas del período: todo el que tenga liquidación o contrato
  // vigente. Un finiquitado sin liquidación en el mes no aporta nada.
  const empleadoIds = new Set<number>();
  for (const l of liquidaciones) empleadoIds.add(l.empleado);
  for (const c of contratos) if (c.activo && !c.finiquitado) empleadoIds.add(c.empleado);

  const usadosSalesperson = new Set<string>();
  const filas: FilaCruce[] = [];

  for (const empleadoId of Array.from(empleadoIds)) {
    const liq = sueldoPorEmpleado.get(empleadoId) || null;
    const contrato = contratoPorEmpleado.get(empleadoId) || null;
    const empleado = liq?.empleado_detalles || contrato?.empleadoDetails || null;
    const nombre = nombreCompleto(empleado) || `Empleado ${empleadoId}`;
    const rut = rutNormalizado(empleado?.rut);

    const vinculo = porEmpleado.get(empleadoId) || null;

    // Persona de la intranet: la del vínculo guardado o, si no hay, el calce
    // por nombre (que la UI marca como "automático", no como confirmado).
    let persona: PersonaIntranet | null = null;
    let sugerido: string | null = null;
    if (vinculo?.userId) {
      persona = personas.find((p) => p.id === vinculo!.userId) ?? null;
    } else if (!vinculo?.ignorado) {
      const propuesta = proponerVinculo(nombre, personas, nombresVendedores);
      persona = propuesta.persona;
      sugerido = propuesta.salespersonName;
    }
    const userId = vinculo?.userId ?? persona?.id ?? null;
    const userNombre = persona?.nombre ?? null;

    // Vendedor del ERP: manda el vínculo guardado; si no, el `salespersonName`
    // de la propia persona (el nombre con el que el ERP graba la venta) y por
    // último el calce por nombre contra los vendedores del período.
    const salespersonName = vinculo?.salespersonName ?? persona?.salespersonName ?? sugerido;
    if (salespersonName) usadosSalesperson.add(normalizar(salespersonName));

    const comisionIntranet = salespersonName && comisiones
      ? comisiones.find((c) => normalizar(c.salesperson) === normalizar(salespersonName!))?.commissionAmount ?? 0
      : null;

    const comisionTalana = liq ? items(liq, ITEMS_COMISION) : 0;
    const diasLiquidacion = liq ? item(liq, 'diasTrabajadosItem') : 0;
    const diasVigentes = diasVigentesPorEmpleado.get(empleadoId);

    const diasTrabajados = liq && diasLiquidacion > 0
      ? diasLiquidacion
      : (diasVigentes ?? null);
    const fuenteDias: FilaCruce['fuenteDias'] = liq && diasLiquidacion > 0
      ? 'liquidacion'
      : diasVigentes !== undefined ? 'workedDays' : null;

    // Los reembolsos se suman por TODOS los ids de login de la persona (ver
    // PersonaIntranet.idsGastos): con un solo id se perderían los gastos que
    // creó entrando por la otra tabla de usuarios.
    const idsGastos = persona?.idsGastos ?? (userId ? [userId] : []);
    const reembolso = idsGastos.reduce(
      (acc, id) => {
        const r = reembolsos.get(id);
        if (r) { acc.monto += r.monto; acc.cantidad += r.cantidad; }
        return acc;
      },
      { monto: 0, cantidad: 0 },
    );

    const estadoVinculo: EstadoVinculo = vinculo?.ignorado
      ? 'ignorado'
      : vinculo?.confirmado
        ? 'confirmado'
        : (userId || salespersonName)
          ? 'automatico'
          : 'sin_vinculo';

    filas.push({
      talanaEmpleadoId: empleadoId,
      rut,
      nombre,
      cargo: contrato?.cargo ?? null,
      centroCosto: contrato?.centroCosto?.nombre ?? null,
      sucursal: contrato?.sucursal?.nombre ?? null,
      contratoActivo: !!contrato?.activo && !contrato?.finiquitado,
      diasTrabajados,
      fuenteDias,
      diasAusencia: liq ? item(liq, 'diasAusenciaItem') : 0,
      diasLicencia: liq ? item(liq, 'diasLicenciaItem') : 0,
      sueldoBase: liq ? item(liq, 'SueldoBase') : Number(contrato?.sueldoBase) || 0,
      haberes: liq ? item(liq, 'SumaHaberes') : 0,
      descuentos: liq ? item(liq, 'SumaDescuentosLegalesyAdicionales') : 0,
      liquido: liq ? item(liq, 'SueldoLiquido') || item(liq, 'montoTransfer') : 0,
      costoEmpresa: liq ? item(liq, 'CostoEmpresa') : 0,
      anticipo: anticipoPorEmpleado.get(empleadoId) || 0,
      atrasos: liq ? item(liq, 'Atraso') : 0,
      comisionTalana,
      estadoLiquidacion: liq?.estado ?? null,
      userId,
      userNombre,
      salespersonName,
      comisionIntranet,
      diferenciaComision: comisionIntranet === null ? null : Math.round(comisionIntranet - comisionTalana),
      reembolsosAprobados: reembolso.monto,
      reembolsosCantidad: reembolso.cantidad,
      estadoVinculo,
    });
  }

  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // ── Alertas ──
  const alertas: Alerta[] = [];
  for (const f of filas) {
    if (f.estadoVinculo === 'ignorado') continue;

    if (f.comisionIntranet !== null && f.diferenciaComision !== null) {
      if (f.comisionIntranet > 0 && f.comisionTalana === 0) {
        alertas.push({
          tipo: 'comision_no_pagada',
          nombre: f.nombre,
          talanaEmpleadoId: f.talanaEmpleadoId,
          monto: f.comisionIntranet,
          detalle: `La intranet calculó comisión y la liquidación de Talana no la trae.`,
        });
      } else if (Math.abs(f.diferenciaComision) >= UMBRAL_DESCUADRE) {
        alertas.push({
          tipo: 'comision_descuadrada',
          nombre: f.nombre,
          talanaEmpleadoId: f.talanaEmpleadoId,
          monto: f.diferenciaComision,
          detalle: `Intranet ${clp(f.comisionIntranet)} vs. Talana ${clp(f.comisionTalana)}.`,
        });
      }
    }

    // Solo si el cálculo de comisiones SÍ está disponible: cuando falla entero,
    // nadie tiene comisión de la intranet y esto marcaría a todos los vendedores.
    if (comisiones && f.comisionTalana > 0 && f.comisionIntranet === null) {
      alertas.push({
        tipo: 'comision_sin_respaldo',
        nombre: f.nombre,
        talanaEmpleadoId: f.talanaEmpleadoId,
        monto: f.comisionTalana,
        detalle: 'Talana paga comisión pero la persona no está vinculada a un vendedor del ERP.',
      });
    }

    if (f.estadoVinculo === 'sin_vinculo') {
      alertas.push({
        tipo: 'sin_vinculo',
        nombre: f.nombre,
        talanaEmpleadoId: f.talanaEmpleadoId,
        detalle: 'Está en Talana y no se pudo calzar con nadie de la intranet.',
      });
    }

    if (periodo.cerrado && f.contratoActivo && !f.estadoLiquidacion) {
      alertas.push({
        tipo: 'sin_liquidacion',
        nombre: f.nombre,
        talanaEmpleadoId: f.talanaEmpleadoId,
        detalle: 'Contrato vigente sin liquidación en un período ya cerrado.',
      });
    }
  }

  // Vendedores con comisión calculada que no aparecen en ninguna liquidación:
  // o no están en Talana, o su vínculo apunta a otra persona.
  const vendedoresSinLiquidacion = (comisiones || [])
    .filter((c) => c.commissionAmount > 0 && !usadosSalesperson.has(normalizar(c.salesperson)))
    .map((c) => ({ salesperson: c.salesperson, commissionAmount: c.commissionAmount }));

  for (const v of vendedoresSinLiquidacion) {
    alertas.push({
      tipo: 'vendedor_sin_liquidacion',
      nombre: v.salesperson,
      monto: v.commissionAmount,
      detalle: 'Tiene comisión calculada en la intranet y no se encontró su liquidación en Talana.',
    });
  }

  const totales = filas.reduce(
    (acc, f) => {
      acc.personas += 1;
      if (f.estadoLiquidacion) acc.conLiquidacion += 1;
      acc.haberes += f.haberes;
      acc.descuentos += f.descuentos;
      acc.liquido += f.liquido;
      acc.costoEmpresa += f.costoEmpresa;
      acc.comisionTalana += f.comisionTalana;
      acc.comisionIntranet += f.comisionIntranet ?? 0;
      acc.reembolsos += f.reembolsosAprobados;
      acc.diasTrabajados += f.diasTrabajados ?? 0;
      return acc;
    },
    {
      personas: 0, conLiquidacion: 0, haberes: 0, descuentos: 0, liquido: 0,
      costoEmpresa: 0, comisionTalana: 0, comisionIntranet: 0, reembolsos: 0,
      diasTrabajados: 0,
    },
  );

  return {
    periodo,
    filas,
    totales,
    alertas,
    vendedoresSinLiquidacion,
    comisionesError,
    umbralDescuadre: UMBRAL_DESCUADRE,
  };
}

function clp(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CL')}`;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export function registerRemuneracionesRoutes(app: Express) {
  const guard = requirePermission('rrhh.remuneraciones');

  /** Estado de la integración: sirve para explicar en pantalla qué falta. */
  app.get('/api/rrhh/remuneraciones/estado', requireAuth, guard, async (_req: any, res) => {
    if (!talanaConfigurado()) {
      return res.json({
        ok: false,
        configurado: false,
        error: 'Falta la variable de entorno TALANA_API_TOKEN.',
      });
    }
    try {
      const periodos = await getPeriodos();
      res.json({ ok: true, configurado: true, periodos: periodos.length });
    } catch (error: any) {
      res.json({ ok: false, configurado: true, error: error?.message || 'Error consultando Talana' });
    }
  });

  /** Períodos de remuneración disponibles en Talana. */
  app.get('/api/rrhh/remuneraciones/periodos', requireAuth, guard, async (_req: any, res) => {
    try {
      const periodos = await getPeriodos();
      res.json({ ok: true, periodos });
    } catch (error: any) {
      res.status(200).json({ ok: false, periodos: [], error: error?.message || 'Error consultando Talana' });
    }
  });

  /**
   * El cruce del período. Responde 200 aunque Talana falle: el módulo tiene que
   * poder abrirse y contar qué pasa (`talana.ok = false`).
   */
  app.get('/api/rrhh/remuneraciones/cruce', requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const periodo = await resolverPeriodo(req.query.periodo);
      const data = await construirCruce(periodo);
      res.json({ talana: { ok: true }, ...data });
    } catch (error: any) {
      console.error('[remuneraciones] error armando el cruce:', error);
      res.json({
        talana: { ok: false, error: error?.message || 'Error consultando Talana' },
        periodo: null,
        filas: [],
        totales: null,
        alertas: [],
        vendedoresSinLiquidacion: [],
      });
    }
  });

  /**
   * Datos de la pestaña "Vínculos": las personas de Talana, las de la intranet,
   * los vendedores del ERP y los vínculos ya guardados.
   */
  app.get('/api/rrhh/remuneraciones/vinculos', requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const [vinculos, personas] = await Promise.all([
        db.select().from(talanaVinculos),
        getPersonasIntranet(),
      ]);

      let empleados: { id: number; rut: string; nombre: string; cargo: string | null; activo: boolean }[] = [];
      let talanaError: string | null = null;
      try {
        const contratos = await getContratos();
        const vistos = new Set<number>();
        for (const c of contratos) {
          if (vistos.has(c.empleado)) continue;
          vistos.add(c.empleado);
          empleados.push({
            id: c.empleado,
            rut: rutNormalizado(c.empleadoDetails?.rut),
            nombre: nombreCompleto(c.empleadoDetails),
            cargo: c.cargo ?? null,
            activo: !!c.activo && !c.finiquitado,
          });
        }
        // Talana devuelve 56 contratos pero liquida a 64 personas: quien no tiene
        // contrato vigente en la lista quedaba fuera de esta pantalla y no se
        // podía vincular, justo el caso de un vendedor con comisión. Se
        // completa con los empleados de los dos últimos períodos.
        const periodos = await getPeriodos();
        for (const periodo of periodos.slice(0, 2)) {
          const liquidaciones = await getLiquidaciones(periodo.id).catch(() => []);
          for (const l of liquidaciones) {
            if (vistos.has(l.empleado) || !l.empleado_detalles) continue;
            vistos.add(l.empleado);
            empleados.push({
              id: l.empleado,
              rut: rutNormalizado(l.empleado_detalles.rut),
              nombre: nombreCompleto(l.empleado_detalles),
              cargo: null,
              activo: false,
            });
          }
        }
        empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      } catch (error: any) {
        talanaError = error?.message || 'Error consultando Talana';
      }

      // Vendedores del ERP del año en curso: son los nombres que se pueden
      // vincular (no toda la historia de la tabla de ventas).
      let vendedores: string[] = [];
      try {
        const hoy = new Date();
        const desde = `${hoy.getFullYear()}-01-01`;
        const hasta = hoy.toISOString().slice(0, 10);
        const resumen = await getCommissionSummary(desde, hasta);
        vendedores = resumen.items.map((i: any) => i.salesperson).filter(Boolean).sort();
      } catch {
        vendedores = [];
      }

      // Cada empleado viaja con lo que el sistema propone, para que la pantalla
      // muestre la sugerencia ya elegida en los selectores y distinga
      // "propuesta sin confirmar" de "no calzó con nadie".
      const conSugerencia = empleados.map((e) => {
        const { persona, salespersonName } = proponerVinculo(e.nombre, personas, vendedores);
        return {
          ...e,
          sugerencia: {
            userId: persona?.id ?? null,
            salespersonName: salespersonName ?? null,
          },
        };
      });

      res.json({ empleados: conSugerencia, personas, vendedores, vinculos, talanaError });
    } catch (error: any) {
      console.error('[remuneraciones] error listando vínculos:', error);
      res.status(500).json({ message: 'Error obteniendo los vínculos: ' + (error?.message || 'desconocido') });
    }
  });

  /** Guarda (o actualiza) el vínculo de una persona de Talana. */
  app.put('/api/rrhh/remuneraciones/vinculos', requireAuth, guard, async (req: any, res) => {
    try {
      const parsed = guardarTalanaVinculoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Formato inválido', errors: parsed.error.flatten() });
      }
      await ensureTables();
      const { talanaEmpleadoId, rut, nombreTalana, userId, salespersonName, ignorado } = parsed.data;

      // Guardar es confirmar: el vínculo deja de ser una propuesta del sistema.
      const valores = {
        talanaEmpleadoId,
        rut: rut ? rutNormalizado(rut) : null,
        nombreTalana: nombreTalana ?? null,
        userId: userId || null,
        salespersonName: salespersonName || null,
        confirmado: !ignorado,
        ignorado: !!ignorado,
        actualizadoPor: req.user?.id || null,
        updatedAt: new Date(),
      };

      await db
        .insert(talanaVinculos)
        .values(valores)
        .onConflictDoUpdate({ target: talanaVinculos.talanaEmpleadoId, set: valores });

      res.json({ ok: true });
    } catch (error: any) {
      console.error('[remuneraciones] error guardando vínculo:', error);
      res.status(500).json({ message: 'Error guardando el vínculo: ' + (error?.message || 'desconocido') });
    }
  });

  /** Borra el vínculo: la persona vuelve al calce automático por nombre. */
  app.delete('/api/rrhh/remuneraciones/vinculos/:talanaEmpleadoId', requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const id = Number(req.params.talanaEmpleadoId);
      if (!Number.isInteger(id)) return res.status(400).json({ message: 'Empleado inválido' });
      await db.delete(talanaVinculos).where(eq(talanaVinculos.talanaEmpleadoId, id));
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[remuneraciones] error borrando vínculo:', error);
      res.status(500).json({ message: 'Error borrando el vínculo: ' + (error?.message || 'desconocido') });
    }
  });

  /** Vacía el caché para volver a leer Talana (botón "Actualizar"). */
  app.post('/api/rrhh/remuneraciones/refrescar', requireAuth, guard, async (_req: any, res) => {
    limpiarCacheTalana();
    res.json({ ok: true });
  });

  /** El cruce en CSV, para pegarlo en la planilla del cierre de mes. */
  app.get('/api/rrhh/remuneraciones/export.csv', requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const periodo = await resolverPeriodo(req.query.periodo);
      const { filas } = await construirCruce(periodo);

      const cabeceras = [
        'RUT', 'Nombre', 'Cargo', 'Centro de costo', 'Sucursal', 'Días trabajados',
        'Sueldo base', 'Haberes', 'Descuentos', 'Líquido', 'Costo empresa',
        'Comisión Talana', 'Comisión intranet', 'Diferencia',
        'Reembolsos aprobados', 'Vendedor ERP', 'Estado del vínculo',
      ];
      const lineas = [cabeceras.join(';')];
      for (const f of filas) {
        lineas.push([
          f.rut, f.nombre, f.cargo ?? '', f.centroCosto ?? '', f.sucursal ?? '',
          f.diasTrabajados ?? '', f.sueldoBase, f.haberes, f.descuentos, f.liquido,
          f.costoEmpresa, f.comisionTalana, f.comisionIntranet ?? '',
          f.diferenciaComision ?? '', f.reembolsosAprobados, f.salespersonName ?? '',
          f.estadoVinculo,
        ].map(csvCampo).join(';'));
      }

      const nombre = `remuneraciones-${periodo.ano}-${String(periodo.mes).padStart(2, '0')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      // BOM para que Excel en Windows respete los acentos.
      res.send('﻿' + lineas.join('\n'));
    } catch (error: any) {
      console.error('[remuneraciones] error exportando:', error);
      res.status(500).json({ message: 'Error exportando: ' + (error?.message || 'desconocido') });
    }
  });
}

/** El período pedido, o el más reciente de Talana si no vino ninguno. */
async function resolverPeriodo(valor: any): Promise<TalanaPeriodo> {
  const periodos = await getPeriodos();
  if (!periodos.length) throw new Error('Talana no devolvió períodos de remuneración.');
  const id = Number(valor);
  if (Number.isInteger(id) && id > 0) {
    const p = periodos.find((x) => x.id === id);
    if (p) return p;
  }
  return periodos[0];
}

function csvCampo(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
