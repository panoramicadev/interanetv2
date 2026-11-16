/**
 * Empresas externas que usan la intranet con SUS propios datos.
 *
 * El ERP Random tiene más de una empresa en la misma base: la 01 es
 * Pinturería Panorámica y la 02 es Pinturería del Sur Ltda. (RUT 76565296-0,
 * sucursal y bodega "SUR"). La carga de ventas de la intranet solo trae las
 * sucursales de Panorámica (004, 006, 007), así que ventas.fact_ventas nunca
 * tiene datos de la 02.
 *
 * Un usuario de esta lista ve su Dashboard, su Inventario y sus Pedidos
 * leídos directo desde Random para SU empresa (server/routes-empresa-externa.ts),
 * y el servidor le bloquea los resúmenes de ventas de Panorámica
 * (rutas en RUTAS_BLOQUEADAS_EMPRESA_EXTERNA).
 *
 * Se identifica por correo en minúsculas, igual que user_permissions: es la
 * credencial de login y la identidad estable del usuario.
 */
export interface EmpresaExterna {
  /** Código de empresa en Random (columna EMPRESA). */
  codigo: string;
  /** Nombre visible en pantalla. */
  nombre: string;
  /** Sucursales de la empresa en Random (KOSU / SUDO). */
  sucursales: string[];
  /** Bodegas de la empresa en Random (KOBO). */
  bodegas: string[];
  /** RUT con el que la empresa le compra a Panorámica (endo en ventas.fact_ventas). */
  rutCliente: string;
  /**
   * Bodegas de Panorámica cuyo stock también puede consultar (sin costos), para
   * saber qué hay disponible antes de comprar. Se eligen en Inventario.
   */
  bodegasPanoramica: BodegaInventario[];
  /** Correos (en minúsculas) de los usuarios que trabajan con esta empresa. */
  emails: string[];
  /**
   * Datos de pago que lleva el PDF de las cotizaciones web que cotiza esta
   * empresa (se mantiene el logo de Panorámica). Lo que esté vacío no se
   * imprime: sin cuenta no sale el bloque de transferencia, sin link no sale
   * el de tarjetas. Nunca se cae a los datos de Panorámica.
   */
  datosPago: DatosPagoCotizacion;
  /** Logo y pie del PDF de esas cotizaciones (diseño "Datos para transferencia"). */
  marcaCotizacion?: MarcaCotizacion;
}

export interface MarcaCotizacion {
  /** Ruta pública del logo (client/public). */
  logoUrl: string;
  direccion?: string;
  web?: string;
}

export interface DatosPagoCotizacion {
  /** Link de pago con tarjetas (Getnet, Webpay, etc.). */
  linkTarjetas?: string;
  razonSocial: string;
  rut: string;
  banco?: string;
  /** "Cuenta Corriente", "Cuenta Vista"… */
  tipoCuenta?: string;
  numeroCuenta?: string;
  email?: string;
}

export interface BodegaInventario {
  /** Clave que viaja en la dirección (?bodega=). */
  id: string;
  nombre: string;
  /** Empresa en Random (01 = Panorámica). */
  empresa: string;
  /** Bodegas (KOBO) que se suman. */
  bodegas: string[];
}

/** Bodegas que puede elegir el usuario en Inventario: la propia primero. */
export function bodegasInventarioDe(emp: EmpresaExterna): BodegaInventario[] {
  return [
    { id: "propia", nombre: `Bodega ${emp.nombre}`, empresa: emp.codigo, bodegas: emp.bodegas },
    ...emp.bodegasPanoramica,
  ];
}

/** RUT de Pinturería Panorámica como proveedor (ENDO en las facturas de compra). */
export const RUT_PANORAMICA = "78652260-9";

export const EMPRESAS_EXTERNAS: EmpresaExterna[] = [
  {
    codigo: "02",
    nombre: "Pinturería del Sur",
    sucursales: ["SUR"],
    bodegas: ["SUR"],
    rutCliente: "76565296-0",
    // Planta Lautaro (sucursal 004) → Productos Terminados: lo que se le vende.
    bodegasPanoramica: [{ id: "lautaro", nombre: "Planta Lautaro (Panorámica)", empresa: "01", bodegas: ["006"] }],
    // Pablo Rossi: dueño y vendedor de Pinturería del Sur (nov-2026).
    emails: ["prossi@pintureriadelsur.com"],
    // Datos de la hoja "Datos para transferencia" de Pinturería del Sur
    // (nov-2026). No entregaron link de pago con tarjetas: ese bloque no sale.
    datosPago: {
      linkTarjetas: "",
      razonSocial: "PINTURERIA DEL SUR LIMITADA",
      rut: "76.565.296-0",
      banco: "Santander",
      tipoCuenta: "Cuenta Corriente",
      numeroCuenta: "70509059",
      email: "prossi@pintureriadelsur.com",
    },
    // Mismo diseño de esa hoja: logo Panorámica Store y la franja de colores.
    marcaCotizacion: {
      logoUrl: "/panoramica-store-logo.png",
      direccion: "Ruta 5 – Parque Industrial, Lautaro",
      web: "pinturaspanoramica.cl",
    },
  },
];

/** La empresa externa del usuario, o null si es un usuario de Panorámica. */
export function empresaExternaDe(email?: string | null): EmpresaExterna | null {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;
  return EMPRESAS_EXTERNAS.find((emp) => emp.emails.includes(e)) || null;
}

/**
 * Rutas con datos comerciales de Panorámica que un usuario de empresa externa
 * no puede pedir: ventas, márgenes, metas, proyecciones, notas de venta y la
 * franja de mensajes (muestra la meta del mes de Panorámica). Se comparan por
 * tramo completo: "/api/sales" bloquea "/api/sales/metrics" pero no
 * "/api/sales-algo".
 */
export const RUTAS_BLOQUEADAS_EMPRESA_EXTERNA = [
  "/api/sales",
  "/api/salespeople",
  "/api/salesperson",
  "/api/margen",
  "/api/proyecciones",
  "/api/goals",
  "/api/presupuesto-ventas",
  "/api/dashboard",
  "/api/supervisor",
  "/api/segments",
  "/api/nvv",
  "/api/ecommerce/erp-orders",
  // Costo de producción de Panorámica (Lista de Precios). La empresa externa ve
  // como costo su último precio de compra (/api/empresa-externa/costos-compra).
  "/api/inventory/gri-prices",
  "/api/mensajes-destacados",
];

export function rutaBloqueadaParaEmpresaExterna(path: string): boolean {
  return RUTAS_BLOQUEADAS_EMPRESA_EXTERNA.some((p) => path === p || path.startsWith(p + "/"));
}
