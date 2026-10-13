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
import { fmtDec, toInt, toNum } from "./formato";
import { UNIDADES_OBRA, UNIDAD_POR_DEFECTO, normalizarUnidad, type UnidadObra } from "./unidades";

export interface ProductoCalculado {
  producto: ObraProducto;
  proyectada: number;
  pedida: number;
  entregada: number;
  utilizada: number;
  /** Desde los documentos: lo facturado (menos notas de crédito). */
  facturada: number;
  /** Desde los documentos: notas de venta o guías que aún no se facturan. */
  nvv: number;
  /** Proyectado − pedido: lo que todavía no se le compró a la obra. */
  porPedir: number;
  /** Entregado − utilizado: lo que debería estar hoy en la bodega de la obra. */
  saldo: number;
  /** Avance del producto = (facturado + NVV) ÷ proyectado. */
  avance: number;
  /** Se consumió más de lo que llegó a la obra (saldo negativo). */
  alertaSaldo: boolean;
  /** Se pidió más de lo proyectado. */
  alertaPedido: boolean;
  /** Rendimiento declarado: unidades por vivienda (1,5 tinetas por casa). */
  rendimiento: number;
  /** Viviendas pintadas de la obra: el avance de viviendas se cuenta por obra. */
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

/**
 * `pintadasObra` son las viviendas pintadas que se cargaron en la fila de la
 * obra: en terreno el avance de viviendas se cuenta por obra. El producto las
 * usa solo para el rendimiento (consumo por vivienda); su avance propio es lo
 * utilizado sobre lo proyectado.
 */
export function calcularProducto(producto: ObraProducto, pintadasObra = 0): ProductoCalculado {
  const proyectada = toNum(producto.cantidadProyectada);
  const pedida = toNum(producto.cantidadPedida);
  const entregada = toNum(producto.cantidadEntregada);
  const utilizada = toNum(producto.cantidadUtilizada);
  const facturada = toNum(producto.cantidadFacturada);
  const nvv = toNum(producto.cantidadNvv);
  // El rendimiento es un dato de entrada, no se deriva de proyectada/viviendas:
  // las proyectadas van redondeadas hacia arriba y la división desviaría el
  // consumo esperado (1,502 en vez de 1,5).
  const rendimiento = toNum(producto.rendimientoPorVivienda);
  const pintadas = pintadasObra;

  const porPedir = Math.max(0, proyectada - pedida);
  const saldo = entregada - utilizada;
  // Avance del producto = (facturado + NVV) ÷ proyectado (pedido del usuario,
  // oct-2026): cuánto de lo proyectado ya se le vendió. Un producto cargado a
  // mano no tiene facturado ni NVV, así que se mide con su pedido.
  const comprometido = producto.desdeDocumentos ? facturada + nvv : pedida;
  const avance = proyectada > 0 ? Math.min(1, comprometido / proyectada) : 0;
  const alertaSaldo = saldo < 0;
  const alertaPedido = pedida > proyectada;
  const teorico = pintadas * rendimiento;
  const rendimientoReal = pintadas > 0 ? utilizada / pintadas : 0;
  const desviacion = rendimiento > 0 && rendimientoReal > 0 ? rendimientoReal / rendimiento - 1 : 0;
  const cobertura = rendimiento > 0 ? Math.max(0, saldo) / rendimiento : 0;
  const sugerido = Math.max(0, proyectada - pedida - Math.max(0, saldo));

  return {
    producto, proyectada, pedida, entregada, utilizada, facturada, nvv, porPedir, saldo,
    avance, alertaSaldo, alertaPedido,
    rendimiento, pintadas, teorico, rendimientoReal, desviacion, cobertura, sugerido,
  };
}

// ---------------------------------------------------------------------------
// Material por formato
// ---------------------------------------------------------------------------

/**
 * Cantidades de material de una obra (o de varias), separadas por formato.
 *
 * Sumar 10 tinetas de 4 galones con 6 galones daba "16" y no significaba nada.
 * El total se lleva en las mismas unidades en que se cargan los productos, una
 * cifra por formato.
 */
export interface MaterialPorUnidad {
  proyectadas: number;
  pedidas: number;
  facturadas: number;
  nvv: number;
  entregadas: number;
  usadas: number;
  saldo: number;
  faltante: number;
  sugerido: number;
}

export type CampoMaterial = keyof MaterialPorUnidad;

export type Material = Record<string, MaterialPorUnidad>;

const materialVacio = (): MaterialPorUnidad => ({
  proyectadas: 0, pedidas: 0, facturadas: 0, nvv: 0, entregadas: 0, usadas: 0, saldo: 0, faltante: 0, sugerido: 0,
});

function sumarMaterial(destino: Material, unidad: string, m: MaterialPorUnidad) {
  const acc = destino[unidad] ?? (destino[unidad] = materialVacio());
  for (const k of Object.keys(m) as CampoMaterial[]) acc[k] += m[k];
}

/** Junta el material de varias obras. */
export function juntarMaterial(materiales: Material[]): Material {
  const total: Material = {};
  for (const m of materiales) for (const [unidad, valores] of Object.entries(m)) sumarMaterial(total, unidad, valores);
  return total;
}

/** Un campo del material, una entrada por formato y en el orden del selector. */
export function porFormato(material: Material, campo: CampoMaterial): Array<{ unidad: UnidadObra; valor: number }> {
  return UNIDADES_OBRA.filter((u) => material[u.valor]).map((u) => ({ unidad: u, valor: material[u.valor][campo] }));
}

/**
 * "120 Tineta 4 gl · 30 Galón": para los recuadros de resumen, donde va texto.
 * `dividir` sirve para los "por vivienda".
 */
export function textoMaterial(material: Material, campo: CampoMaterial, dividir = 1): string {
  const partes = porFormato(material, campo);
  if (partes.length === 0) return "0";
  return partes.map(({ unidad, valor }) => `${fmtDec(valor / (dividir || 1))} ${unidad.corto}`).join(" · ");
}

/** Si algún formato tiene el campo bajo cero (saldo) o sobre cero (próximo pedido). */
export const algunNegativo = (material: Material, campo: CampoMaterial) =>
  porFormato(material, campo).some((p) => p.valor < 0);

export const algunPositivo = (material: Material, campo: CampoMaterial) =>
  porFormato(material, campo).some((p) => p.valor > 0);

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
  /**
   * Columna "% avance" de la planilla: (facturado + NVV) ÷ proyectado, sumando
   * sus productos. Facturado + NVV es lo pedido (ver server/obras-cantidades.ts).
   */
  avanceVenta: number;
  /**
   * Lo pedido de cada producto, pero sin pasar su propia proyección: lo que se
   * compró de más (o sin proyectar) no puede inflar el avance de los demás.
   */
  pedidasHastaProyectado: number;
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
  /**
   * Cuánto producto se está yendo en cada vivienda = usadas / pintadas.
   *
   * Es el rendimiento que está teniendo la obra de verdad, y se puede saber
   * SIN haber declarado nada: alcanza con lo que se consumió y las casas que se
   * pintaron. La desviación necesita además el rendimiento declarado, así que
   * este número aparece antes y sirve justamente para descubrirlo.
   */
  rendimientoReal: number;
  productos: number;
  /** Material separado por formato: es lo que se muestra en la fila de la obra. */
  material: Material;
  /** Productos con saldo negativo o pedidos por sobre lo proyectado. */
  alertas: number;
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
 *  - avance             = las viviendas pintadas que se cargan en la fila de
 *                         la obra; si todavía no se cargaron, las del producto
 *                         más adelantado (así venían las obras anteriores)
 *  - desviación         = consumo real / consumo esperado − 1: es el "¿está
 *                         rindiendo lo que dijimos?" que se revisa en terreno
 *  - estado = Terminado si está todo pintado; Revisar si algún producto
 *             consumió más de lo entregado o se pidió por sobre lo
 *             proyectado; Crítico si no queda nada en obra y
 *             falta pintar; Pedir si el saldo cubre menos del 20% de lo que falta.
 *
 * Las obras cargadas antes de este cambio todavía no tienen productos: mientras
 * no se les cargue ninguno se siguen leyendo las columnas de la obra, para no
 * dejar en cero un control que ya estaba andando.
 */
export function calcularObra(obra: ObraConCliente, productosObra: ObraProducto[] = []): ObraCalculada {
  const viviendas = toInt(obra.viviendas);
  const pintadasObra = toInt(obra.viviendasPintadas);
  const calculados = productosObra.map((p) => calcularProducto(p, pintadasObra));

  if (calculados.length === 0) {
    const proyectadas = toInt(obra.tinetasProyectadas);
    const pintadas = pintadasObra;
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
      avanceVenta: proyectadas > 0 ? Math.min(1, pedidas / proyectadas) : 0,
      pedidasHastaProyectado: Math.min(pedidas, proyectadas),
      proyectadas, pedidas, entregadas, usadas, saldo,
      faltantePorPedir: Math.max(0, proyectadas - pedidas),
      sugerido: Math.max(0, proyectadas - pedidas - Math.max(0, saldo)),
      consumoTeorico: teorico,
      consumoReal: real,
      desviacion: teorico > 0 ? real / teorico - 1 : 0,
      rendimientoReal: pintadas > 0 ? usadas / pintadas : 0,
      productos: 0,
      // La planilla vieja se llevaba en tinetas, sin distinguir capacidad.
      material: vacia
        ? {}
        : {
            [UNIDAD_POR_DEFECTO]: {
              proyectadas, pedidas, entregadas, usadas, saldo,
              // La planilla vieja no separaba facturado de nota de venta.
              facturadas: 0, nvv: 0,
              faltante: Math.max(0, proyectadas - pedidas),
              sugerido: Math.max(0, proyectadas - pedidas - Math.max(0, saldo)),
            },
          },
      alertas: (saldo < 0 ? 1 : 0) + (pedidas > proyectadas ? 1 : 0),
      estado: vacia
        ? "sindatos"
        : viviendas > 0 && pintadas >= viviendas
          ? "terminado"
          : saldo < 0 || pedidas > proyectadas
            ? "revisar"
            : "ok",
    };
  }

  const suma = (f: (p: ProductoCalculado) => number) => calculados.reduce((a, p) => a + f(p), 0);
  const proyectadas = suma((p) => p.proyectada);
  const pedidas = suma((p) => p.pedida);
  const entregadas = suma((p) => p.entregada);
  const usadas = suma((p) => p.utilizada);
  const saldo = suma((p) => p.saldo);
  const faltantePorPedir = suma((p) => p.porPedir);
  const pedidasHastaProyectado = suma((p) =>
    Math.min(p.producto.desdeDocumentos ? p.facturada + p.nvv : p.pedida, p.proyectada),
  );
  const sugerido = suma((p) => p.sugerido);

  // Solo entran al contraste los productos que declararon rendimiento: sin ese
  // dato no hay contra qué comparar el consumo.
  const conRendimiento = calculados.filter((p) => p.rendimiento > 0 && p.pintadas > 0);
  const consumoTeorico = conRendimiento.reduce((a, p) => a + p.teorico, 0);
  const consumoReal = conRendimiento.reduce((a, p) => a + p.utilizada, 0);
  const desviacion = consumoTeorico > 0 ? consumoReal / consumoTeorico - 1 : 0;

  // Manda lo que se cargó en la fila de la obra. Las obras que venían con el
  // avance cargado solo por producto siguen leyendo el más adelantado (la
  // fachada, casi siempre) hasta que alguien escriba el número de la obra.
  const pintadas = pintadasObra > 0
    ? pintadasObra
    : productosObra.reduce((max, p) => Math.max(max, toInt(p.viviendasPintadas)), 0);
  const pendientes = Math.max(0, viviendas - pintadas);
  const avance = viviendas > 0 ? Math.min(1, pintadas / viviendas) : 0;

  // El producto más escaso manda: la obra se para cuando se acaba cualquiera.
  const coberturas = calculados.filter((p) => p.rendimiento > 0).map((p) => p.cobertura);
  const cobertura = coberturas.length > 0 ? Math.min(...coberturas) : Infinity;

  const material: Material = {};
  for (const p of calculados) {
    sumarMaterial(material, normalizarUnidad(p.producto.unidad), {
      proyectadas: p.proyectada,
      pedidas: p.pedida,
      facturadas: p.facturada,
      nvv: p.nvv,
      entregadas: p.entregada,
      usadas: p.utilizada,
      saldo: p.saldo,
      faltante: p.porPedir,
      sugerido: p.sugerido,
    });
  }
  const alertas = calculados.filter((p) => p.alertaSaldo || p.alertaPedido).length;

  let estado: EstadoObra;
  if (viviendas > 0 && pintadas >= viviendas) estado = "terminado";
  else if (alertas > 0) estado = "revisar";
  else if (viviendas === 0) estado = "ok";
  else if (cobertura <= 0) estado = "critico";
  else if (cobertura < pendientes * 0.2) estado = "pedir";
  else estado = "ok";

  return {
    obra, viviendas, pintadas, pendientes, avance,
    avanceVenta: proyectadas > 0 ? Math.min(1, pedidasHastaProyectado / proyectadas) : 0,
    pedidasHastaProyectado,
    proyectadas, pedidas, entregadas, usadas, saldo, faltantePorPedir, sugerido,
    consumoTeorico, consumoReal, desviacion,
    // Sobre las pintadas de la obra: es el consumo total repartido entre las
    // casas que efectivamente se pintaron.
    rendimientoReal: pintadas > 0 ? usadas / pintadas : 0,
    productos: calculados.length,
    material,
    alertas,
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
      acc.pedidasHastaProyectado += f.pedidasHastaProyectado;
      acc.sugerido += f.sugerido;
      acc.consumoTeorico += f.consumoTeorico;
      acc.consumoReal += f.consumoReal;
      return acc;
    },
    {
      viviendas: 0, proyectadas: 0, pintadas: 0, pendientes: 0, usadas: 0,
      pedidas: 0, entregadas: 0, saldo: 0, faltante: 0, sugerido: 0,
      pedidasHastaProyectado: 0,
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
  // La columna "Edificio / Casa" cuenta torres en los edificios y viviendas en
  // las casas: el total las lleva por separado porque no se suman entre sí.
  const torres = filas.reduce((a, f) => a + (f.obra.tipoObra === "edificios" ? toInt(f.obra.torres) : 0), 0);
  const casas = filas.reduce((a, f) => a + (f.obra.tipoObra === "edificios" ? 0 : f.viviendas), 0);
  return {
    ...t,
    torres,
    casas,
    material: juntarMaterial(filas.map((f) => f.material)),
    avance: t.viviendas > 0 ? t.pintadas / t.viviendas : 0,
    // Columna "% avance": (facturado + NVV) ÷ proyectado de todas las obras.
    avanceVenta: t.proyectadas > 0 ? Math.min(1, t.pedidasHastaProyectado / t.proyectadas) : 0,
    desviacion: t.consumoTeorico > 0 ? t.consumoReal / t.consumoTeorico - 1 : 0,
    rendimientoReal: t.pintadas > 0 ? t.usadas / t.pintadas : 0,
    conteoEstados,
    ultima,
  };
}

export type Totales = ReturnType<typeof calcularTotales>;
