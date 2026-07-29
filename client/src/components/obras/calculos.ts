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
import type { ObraProducto } from "@shared/schema";
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
