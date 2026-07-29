/**
 * Fórmulas del control de obras — todas a nivel de PRODUCTO.
 *
 * El control dejó de llevarse por obra ("tantas tinetas") y pasó a llevarse por
 * SKU: cada producto tiene su propio rendimiento declarado, sus viviendas
 * pintadas y su saldo, porque el sellador, la fachada y el esmalte de rejas no
 * avanzan al mismo ritmo. Los números de la obra son la suma de sus productos.
 *
 * Vive aparte porque la planilla (control-obras.tsx) y el detalle por producto
 * (panel-productos.tsx) tienen que calcular exactamente lo mismo.
 */
import type { ObraConCliente, ObraProducto } from "@shared/schema";
import { toInt, toNum } from "./formato";

export interface ProductoCalculado {
  producto: ObraProducto;
  proyectada: number;
  pedida: number;
  entregada: number;
  utilizada: number;
  /** Proyectado − pedido: lo que todavía no se le compró a la obra. */
  porPedir: number;
  /** Entregado − utilizado: lo que debería estar hoy en la bodega de la obra. */
  saldo: number;
  /** Rendimiento declarado: unidades por vivienda (1,5 tinetas por casa). */
  rendimiento: number;
  pintadas: number;
  /** Consumo esperado según lo declarado = pintadas × rendimiento. */
  teorico: number;
  /**
   * Rendimiento que está teniendo de verdad = utilizado / pintadas. Es el número
   * que el vendedor arma en terreno: le pregunta al bodeguero cuánto queda,
   * cuenta las casas pintadas y compara contra lo que se prometió.
   */
  rendimientoReal: number;
  /** Desviación real vs declarado (+0,2 = se está gastando 20% de más). */
  desviacion: number;
  /** Viviendas que alcanza a cubrir el saldo en obra. */
  cobertura: number;
  /** Próximo pedido sugerido: lo que falta comprar descontando lo que hay en obra. */
  sugerido: number;
}

export function calcularProducto(producto: ObraProducto): ProductoCalculado {
  const proyectada = toNum(producto.cantidadProyectada);
  const pedida = toNum(producto.cantidadPedida);
  const entregada = toNum(producto.cantidadEntregada);
  const utilizada = toNum(producto.cantidadUtilizada);
  // El rendimiento es un dato de entrada, no se deriva de proyectada/viviendas:
  // las proyectadas van redondeadas hacia arriba y la división desviaría el
  // consumo esperado (1,502 en vez de 1,5).
  const rendimiento = toNum(producto.rendimientoPorVivienda);
  const pintadas = toInt(producto.viviendasPintadas);

  const porPedir = Math.max(0, proyectada - pedida);
  const saldo = entregada - utilizada;
  const teorico = pintadas * rendimiento;
  const rendimientoReal = pintadas > 0 ? utilizada / pintadas : 0;
  const desviacion = rendimiento > 0 && rendimientoReal > 0 ? rendimientoReal / rendimiento - 1 : 0;
  const cobertura = rendimiento > 0 ? Math.max(0, saldo) / rendimiento : 0;
  const sugerido = Math.max(0, proyectada - pedida - Math.max(0, saldo));

  return {
    producto, proyectada, pedida, entregada, utilizada, porPedir, saldo,
    rendimiento, pintadas, teorico, rendimientoReal, desviacion, cobertura, sugerido,
  };
}

/** Desviación con signo, para el badge: "+18%" gasta de más, "−7%" rinde mejor. */
export const fmtDesviacion = (d: number) =>
  `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.round(Math.abs(d) * 100)}%`;

// ---------------------------------------------------------------------------
// Nivel obra: la suma de sus productos
// ---------------------------------------------------------------------------

export type EstadoObra = "critico" | "pedir" | "ok" | "terminado" | "revisar" | "sindatos";

// Orden fijo del resumen por estado: primero lo que hay que atender.
export const ESTADOS: Array<{
  key: EstadoObra;
  label: string;
  badge: string;
  dot: string;
}> = [
  { key: "critico", label: "Crítico", badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", dot: "bg-red-500" },
  { key: "pedir", label: "Pedir", badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  { key: "ok", label: "OK", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
  { key: "revisar", label: "Revisar", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
  { key: "terminado", label: "Terminado", badge: "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200", dot: "bg-slate-400" },
  // Una obra recién creada no está "OK": no tiene nada cargado todavía. El verde
  // en una fila de puros ceros hacía leer como controlado lo que está vacío.
  { key: "sindatos", label: "Sin cargar", badge: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-300" },
];

export const ESTADO_MAP = Object.fromEntries(ESTADOS.map((e) => [e.key, e])) as Record<
  EstadoObra,
  (typeof ESTADOS)[number]
>;

export interface ObraCalculada {
  obra: ObraConCliente;
  viviendas: number;
  pintadas: number;
  pendientes: number;
  avance: number;
  proyectadas: number;
  pedidas: number;
  entregadas: number;
  usadas: number;
  saldo: number;
  faltantePorPedir: number;
  sugerido: number;
  /** Consumo esperado y consumo real, para saber si el producto está rindiendo. */
  consumoTeorico: number;
  consumoReal: number;
  desviacion: number;
  productos: number;
  estado: EstadoObra;
}

/**
 * Derivadas de una obra — TODO sale de sus productos.
 *
 * La planilla llevaba el control en "tinetas" de la obra; ahora cada SKU tiene
 * su proyectado, su rendimiento y sus viviendas pintadas, y la obra es la suma:
 *  - proyectadas / pedidas / entregadas / usadas = suma de sus productos
 *  - saldo en obra      = entregado − utilizado
 *  - faltante por pedir = proyectado − pedido
 *  - próximo pedido     = proyectado − pedido − saldo disponible
 *  - avance             = el producto más adelantado marca las viviendas
 *                         pintadas de la obra (el detalle por producto muestra
 *                         cuánto va rezagado cada uno)
 *  - desviación         = consumo real / consumo esperado − 1: es el "¿está
 *                         rindiendo lo que dijimos?" que se revisa en terreno
 *  - estado = Terminado si está todo pintado; Revisar saldo si algún producto
 *             consumió más de lo entregado; Crítico si no queda nada en obra y
 *             falta pintar; Pedir si el saldo cubre menos del 20% de lo que falta.
 *
 * Las obras cargadas antes de este cambio todavía no tienen productos: mientras
 * no se les cargue ninguno se siguen leyendo las columnas de la obra, para no
 * dejar en cero un control que ya estaba andando.
 */
export function calcularObra(obra: ObraConCliente, productosObra: ObraProducto[] = []): ObraCalculada {
  const viviendas = toInt(obra.viviendas);
  const calculados = productosObra.map(calcularProducto);

  if (calculados.length === 0) {
    const proyectadas = toInt(obra.tinetasProyectadas);
    const pintadas = toInt(obra.viviendasPintadas);
    const pedidas = toInt(obra.tinetasPedidas);
    const entregadas = toInt(obra.tinetasEntregadas);
    const ratio = toNum(obra.tinetasPorVivienda);
    const real = toNum(obra.tinetasUtilizadasReal);
    const usadas = real || pintadas * ratio;
    const saldo = entregadas - usadas;
    // Sin consumo real informado no hay nada que contrastar: el badge tiene que
    // decir "—" y no un "0%" que se lee como "rinde exacto lo declarado".
    const teorico = real > 0 ? pintadas * ratio : 0;
    // Sin productos y sin números viejos no hay control que mostrar: la fila
    // queda como "Sin cargar" en vez de fingir un OK con puros ceros.
    const vacia = proyectadas === 0 && pedidas === 0 && entregadas === 0 && pintadas === 0;
    return {
      obra, viviendas, pintadas,
      pendientes: Math.max(0, viviendas - pintadas),
      avance: viviendas > 0 ? Math.min(1, pintadas / viviendas) : 0,
      proyectadas, pedidas, entregadas, usadas, saldo,
      faltantePorPedir: Math.max(0, proyectadas - pedidas),
      sugerido: Math.max(0, proyectadas - pedidas - Math.max(0, saldo)),
      consumoTeorico: teorico,
      consumoReal: real,
      desviacion: teorico > 0 ? real / teorico - 1 : 0,
      productos: 0,
      estado: vacia ? "sindatos" : viviendas > 0 && pintadas >= viviendas ? "terminado" : saldo < 0 ? "revisar" : "ok",
    };
  }

  const suma = (f: (p: ProductoCalculado) => number) => calculados.reduce((a, p) => a + f(p), 0);
  const proyectadas = suma((p) => p.proyectada);
  const pedidas = suma((p) => p.pedida);
  const entregadas = suma((p) => p.entregada);
  const usadas = suma((p) => p.utilizada);
  const saldo = suma((p) => p.saldo);
  const faltantePorPedir = suma((p) => p.porPedir);
  const sugerido = suma((p) => p.sugerido);

  // Solo entran al contraste los productos que declararon rendimiento: sin ese
  // dato no hay contra qué comparar el consumo.
  const conRendimiento = calculados.filter((p) => p.rendimiento > 0 && p.pintadas > 0);
  const consumoTeorico = conRendimiento.reduce((a, p) => a + p.teorico, 0);
  const consumoReal = conRendimiento.reduce((a, p) => a + p.utilizada, 0);
  const desviacion = consumoTeorico > 0 ? consumoReal / consumoTeorico - 1 : 0;

  // La obra avanza al ritmo de su producto más adelantado (la fachada, casi
  // siempre); el rezago de cada SKU se ve en el detalle.
  const pintadas = calculados.reduce((max, p) => Math.max(max, p.pintadas), 0);
  const pendientes = Math.max(0, viviendas - pintadas);
  const avance = viviendas > 0 ? Math.min(1, pintadas / viviendas) : 0;

  // El producto más escaso manda: la obra se para cuando se acaba cualquiera.
  const coberturas = calculados.filter((p) => p.rendimiento > 0).map((p) => p.cobertura);
  const cobertura = coberturas.length > 0 ? Math.min(...coberturas) : Infinity;

  let estado: EstadoObra;
  if (viviendas > 0 && pintadas >= viviendas) estado = "terminado";
  else if (calculados.some((p) => p.saldo < 0)) estado = "revisar";
  else if (viviendas === 0) estado = "ok";
  else if (cobertura <= 0) estado = "critico";
  else if (cobertura < pendientes * 0.2) estado = "pedir";
  else estado = "ok";

  return {
    obra, viviendas, pintadas, pendientes, avance,
    proyectadas, pedidas, entregadas, usadas, saldo, faltantePorPedir, sugerido,
    consumoTeorico, consumoReal, desviacion,
    productos: calculados.length,
    estado,
  };
}

/** Suma de un conjunto de obras — sirve igual para la tarjeta de una
 *  constructora en la cartera que para el resumen del detalle. */
export function calcularTotales(filas: ObraCalculada[]) {
  const t = filas.reduce(
    (acc, f) => {
      acc.viviendas += f.viviendas;
      acc.proyectadas += f.proyectadas;
      acc.pintadas += f.pintadas;
      acc.pendientes += f.pendientes;
      acc.usadas += f.usadas;
      acc.pedidas += f.pedidas;
      acc.entregadas += f.entregadas;
      acc.saldo += f.saldo;
      acc.faltante += f.faltantePorPedir;
      acc.sugerido += f.sugerido;
      acc.consumoTeorico += f.consumoTeorico;
      acc.consumoReal += f.consumoReal;
      return acc;
    },
    {
      viviendas: 0, proyectadas: 0, pintadas: 0, pendientes: 0, usadas: 0,
      pedidas: 0, entregadas: 0, saldo: 0, faltante: 0, sugerido: 0,
      consumoTeorico: 0, consumoReal: 0,
    },
  );
  const conteoEstados = ESTADOS.map((e) => ({
    ...e,
    cantidad: filas.filter((f) => f.estado === e.key).length,
  }));
  const ultima = filas.reduce<Date | null>((max, f) => {
    const d = f.obra.updatedAt ? new Date(f.obra.updatedAt as any) : null;
    return d && (!max || d > max) ? d : max;
  }, null);
  return {
    ...t,
    avance: t.viviendas > 0 ? t.pintadas / t.viviendas : 0,
    desviacion: t.consumoTeorico > 0 ? t.consumoReal / t.consumoTeorico - 1 : 0,
    conteoEstados,
    ultima,
  };
}

export type Totales = ReturnType<typeof calcularTotales>;
