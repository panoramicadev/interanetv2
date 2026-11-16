/**
 * Datos de una empresa externa (Pinturería del Sur, empresa 02 de Random) para
 * los usuarios que trabajan con ella. Ver shared/empresas-externas.ts.
 *
 * Todo se lee EN VIVO desde Random, solo lectura: la carga de ventas de la
 * intranet no trae la empresa 02 y no debe traerla, porque ventas.fact_ventas
 * no distingue empresa y las cifras de Panorámica quedarían infladas en todas
 * las pantallas. Los resultados se guardan 3 minutos en memoria para no
 * repetir la consulta en cada recarga.
 *
 * Mismas reglas que la intranet usa para Panorámica:
 *  - Venta = suma de VANELI de FCV, FVL, BLV, FDV y NCV (la NCV resta). Las
 *    guías (GDV) no son venta.
 *  - Costo de la línea = PPPRPM × CAPRCO1 (costo del documento, en unidad 1).
 *    Las líneas "ZZ…" son conceptos (fletes, servicios): no llevan costo y no
 *    cuentan como venta de mercadería (server/costo-linea.ts).
 *  - Unidades = CAPRCO2 (envases), con la NCV restando.
 */
import type { Express } from "express";
import mssql from "mssql";
import { requireAuth } from "./auth";
import { erp } from "./obras-ventas";
import {
  EMPRESAS_EXTERNAS,
  RUT_PANORAMICA,
  bodegasInventarioDe,
  empresaExternaDe,
  rutaBloqueadaParaEmpresaExterna,
  type BodegaInventario,
  type EmpresaExterna,
} from "../shared/empresas-externas";

const TIPOS_VENTA = "('FCV','FVL','NCV','BLV','FDV')";
const SIGNO = "(CASE WHEN d.TIDO = 'NCV' THEN -1 ELSE 1 END)";
const VENTA = `(CASE WHEN d.TIDO = 'NCV' THEN -ABS(d.VANELI) ELSE d.VANELI END)`;
const ES_CONCEPTO = `(UPPER(LTRIM(d.KOPRCT)) LIKE 'ZZ%')`;
const VENTA_MERCADERIA = `(CASE WHEN ${ES_CONCEPTO} THEN 0 ELSE ${VENTA} END)`;
const COSTO = `(CASE WHEN ${ES_CONCEPTO} THEN 0 ELSE ${SIGNO} * ABS(ISNULL(d.PPPRPM, 0) * ISNULL(d.CAPRCO1, 0)) END)`;
const UNIDADES = `(${SIGNO} * ABS(ISNULL(d.CAPRCO2, 0)))`;

/**
 * La empresa con la que trabaja el usuario. Un admin puede mirar la de
 * cualquier empresa externa pasando ?empresa=<código> (vista previa).
 */
function empresaDelUsuario(req: any): EmpresaExterna | null {
  const propia = empresaExternaDe(req.user?.email);
  if (propia) return propia;
  if (req.user?.role === "admin" && req.query?.empresa) {
    return EMPRESAS_EXTERNAS.find((e) => e.codigo === String(req.query.empresa)) || null;
  }
  return null;
}

const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_MS = 3 * 60_000;
async function conCache<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.data as T;
  const data = await fn();
  cache.set(clave, { ts: Date.now(), data });
  if (cache.size > 300) {
    const masViejo = cache.keys().next().value;
    if (masViejo) cache.delete(masViejo);
  }
  return data;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => Number(v) || 0;

/** Mismo rango, un año antes. Un 29 de febrero pasa a 28. */
function unAnoAntes(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const ultimoDia = new Date(y - 1, m, 0).getDate();
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
}

interface FiltrosVenta {
  vendedor?: string;
  cliente?: string;
  producto?: string;
}

/** Condiciones de filtro opcionales sobre e (MAEEDO) y d (MAEDDO). */
function condicionesFiltro(req: mssql.Request, f: FiltrosVenta): string {
  let w = "";
  if (f.vendedor) {
    req.input("vendedor", mssql.VarChar(20), f.vendedor);
    w += " AND e.KOFUDO = @vendedor";
  }
  if (f.cliente) {
    req.input("cliente", mssql.VarChar(20), f.cliente);
    w += " AND e.ENDO = @cliente";
  }
  if (f.producto) {
    req.input("producto", mssql.VarChar(30), f.producto);
    w += " AND d.KOPRCT = @producto";
  }
  return w;
}

export async function resumen(emp: EmpresaExterna, desde: string, hasta: string, f: FiltrosVenta) {
  const pool = await erp();
  const r = pool.request();
  r.input("emp", mssql.Char(2), emp.codigo);
  r.input("desde", mssql.Date, desde);
  r.input("hasta", mssql.Date, hasta);
  r.input("desdeAnt", mssql.Date, unAnoAntes(desde));
  r.input("hastaAnt", mssql.Date, unAnoAntes(hasta));
  r.input("anio", mssql.Int, Number(desde.slice(0, 4)));
  const filtro = condicionesFiltro(r, f);

  // Líneas de venta de la empresa con los filtros, sin fecha (cada bloque pone la suya).
  const lineas = (join = "") => `
    FROM MAEDDO d
    JOIN MAEEDO e ON e.IDMAEEDO = d.IDMAEEDO${join}
    WHERE e.EMPRESA = @emp AND e.TIDO IN ${TIPOS_VENTA}${filtro}`;
  const base = lineas();
  const enRango = `${base} AND e.FEEMDO >= @desde AND e.FEEMDO <= @hasta`;

  const q = await r.query(`
    -- 1) Totales del período
    SELECT SUM(${VENTA}) AS venta, SUM(${VENTA_MERCADERIA}) AS ventaMercaderia,
           SUM(${COSTO}) AS costo, SUM(${UNIDADES}) AS unidades,
           COUNT(DISTINCT CASE WHEN e.TIDO <> 'NCV' THEN e.IDMAEEDO END) AS documentos,
           COUNT(DISTINCT e.ENDO) AS clientes
    ${enRango};

    -- 2) Mismo período del año anterior
    SELECT SUM(${VENTA}) AS venta
    ${base} AND e.FEEMDO >= @desdeAnt AND e.FEEMDO <= @hastaAnt;

    -- 3) Por vendedor
    SELECT RTRIM(e.KOFUDO) AS codigo, MAX(RTRIM(fu.NOKOFU)) AS nombre,
           SUM(${VENTA}) AS venta, SUM(${COSTO}) AS costo, SUM(${VENTA_MERCADERIA}) AS ventaMercaderia,
           COUNT(DISTINCT CASE WHEN e.TIDO <> 'NCV' THEN e.IDMAEEDO END) AS documentos
    ${lineas("\n    LEFT JOIN TABFU fu ON fu.KOFU = e.KOFUDO")} AND e.FEEMDO >= @desde AND e.FEEMDO <= @hasta
    GROUP BY e.KOFUDO
    ORDER BY venta DESC;

    -- 4) Mejores clientes
    SELECT TOP 10 RTRIM(e.ENDO) AS codigo,
           (SELECT TOP 1 RTRIM(en.NOKOEN) FROM MAEEN en WHERE en.KOEN = e.ENDO) AS nombre,
           SUM(${VENTA}) AS venta,
           COUNT(DISTINCT CASE WHEN e.TIDO <> 'NCV' THEN e.IDMAEEDO END) AS documentos
    ${enRango}
    GROUP BY e.ENDO
    ORDER BY venta DESC;

    -- 5) Productos más vendidos (sin conceptos ZZ)
    -- El nombre sale de la ficha del producto: el de la línea cambia con cada
    -- color entintado ("ESMALTE AGUA VOLCANITA" para un esmalte blanco base).
    SELECT TOP 10 RTRIM(d.KOPRCT) AS codigo,
           COALESCE(MAX(RTRIM(pr.NOKOPR)), MAX(RTRIM(d.NOKOPR))) AS nombre,
           SUM(${VENTA}) AS venta, SUM(${UNIDADES}) AS unidades, MAX(RTRIM(d.UD02PR)) AS unidad
    ${lineas("\n    LEFT JOIN MAEPR pr ON pr.KOPR = d.KOPRCT")} AND e.FEEMDO >= @desde AND e.FEEMDO <= @hasta AND NOT ${ES_CONCEPTO}
    GROUP BY d.KOPRCT
    ORDER BY venta DESC;

    -- 6) Clientes nuevos: su primera compra en la empresa cae dentro del período
    SELECT COUNT(*) AS nuevos FROM (
      SELECT e.ENDO, MIN(e.FEEMDO) AS primera
      FROM MAEEDO e
      WHERE e.EMPRESA = @emp AND e.TIDO IN ('FCV','FVL','BLV','FDV')
      GROUP BY e.ENDO
    ) t WHERE t.primera >= @desde AND t.primera <= @hasta;

    -- 7) Venta por mes del año del período y del anterior
    SELECT YEAR(e.FEEMDO) AS anio, MONTH(e.FEEMDO) AS mes, SUM(${VENTA}) AS venta
    ${base} AND YEAR(e.FEEMDO) IN (@anio, @anio - 1)
    GROUP BY YEAR(e.FEEMDO), MONTH(e.FEEMDO);
  `);

  const sets = q.recordsets as any[][];
  const t = sets[0][0] || {};
  const venta = num(t.venta);
  const ventaMercaderia = num(t.ventaMercaderia);
  const costo = num(t.costo);
  const beneficio = ventaMercaderia - costo;
  const margenDe = (vm: number, c: number) => (vm > 0 ? ((vm - c) / vm) * 100 : 0);

  return {
    empresa: { codigo: emp.codigo, nombre: emp.nombre },
    periodo: { desde, hasta, desdeAnterior: unAnoAntes(desde), hastaAnterior: unAnoAntes(hasta) },
    totales: {
      venta,
      ventaAnterior: num(sets[1][0]?.venta),
      ventaMercaderia,
      costo,
      beneficio,
      margenPct: margenDe(ventaMercaderia, costo),
      unidades: num(t.unidades),
      documentos: num(t.documentos),
      clientes: num(t.clientes),
      clientesNuevos: num(sets[5][0]?.nuevos),
    },
    porVendedor: sets[2].map((v) => ({
      codigo: texto(v.codigo),
      nombre: texto(v.nombre) || texto(v.codigo) || "Sin vendedor",
      venta: num(v.venta),
      margenPct: margenDe(num(v.ventaMercaderia), num(v.costo)),
      documentos: num(v.documentos),
    })),
    topClientes: sets[3].map((c) => ({
      codigo: texto(c.codigo),
      // Las boletas sin RUT llegan con el código de cliente en blanco.
      nombre: texto(c.nombre) || texto(c.codigo) || "Boletas sin cliente",
      venta: num(c.venta),
      documentos: num(c.documentos),
    })),
    topProductos: sets[4].map((p) => ({
      codigo: texto(p.codigo),
      nombre: texto(p.nombre) || texto(p.codigo),
      venta: num(p.venta),
      unidades: num(p.unidades),
      unidad: texto(p.unidad),
    })),
    porMes: sets[6].map((m) => ({ anio: num(m.anio), mes: num(m.mes), venta: num(m.venta) })),
  };
}

/** Vendedores de la empresa en Random, con la misma memoria de 3 minutos. */
export function vendedoresEmpresaExterna(emp: EmpresaExterna) {
  return conCache(`vendedores:${emp.codigo}`, () => vendedores(emp));
}

export async function vendedores(emp: EmpresaExterna) {
  const pool = await erp();
  const r = pool.request();
  r.input("emp", mssql.Char(2), emp.codigo);
  // Los que tienen documentos de venta en los últimos dos años.
  const q = await r.query(`
    SELECT RTRIM(e.KOFUDO) AS codigo, MAX(RTRIM(fu.NOKOFU)) AS nombre
    FROM MAEEDO e
    LEFT JOIN TABFU fu ON fu.KOFU = e.KOFUDO
    WHERE e.EMPRESA = @emp AND e.TIDO IN ${TIPOS_VENTA}
      AND e.FEEMDO >= DATEADD(YEAR, -2, GETDATE())
      AND LTRIM(RTRIM(ISNULL(e.KOFUDO, ''))) <> ''
    GROUP BY e.KOFUDO
    ORDER BY MAX(fu.NOKOFU)
  `);
  return q.recordset.map((v: any) => ({ codigo: texto(v.codigo), nombre: texto(v.nombre) || texto(v.codigo) }));
}

export async function notasVenta(emp: EmpresaExterna, soloPendientes: boolean, desde: string, hasta: string, vendedor?: string) {
  const pool = await erp();
  const r = pool.request();
  r.input("emp", mssql.Char(2), emp.codigo);
  r.input("desde", mssql.Date, desde);
  r.input("hasta", mssql.Date, hasta);
  let w = "";
  if (vendedor) {
    r.input("vendedor", mssql.VarChar(20), vendedor);
    w += " AND e.KOFUDO = @vendedor";
  }
  // Abierta = ESDO vacío. Pendiente por línea = pedido − despachado − cerrado a mano.
  const q = await r.query(`
    SELECT TOP 500 e.IDMAEEDO AS id, RTRIM(e.NUDO) AS numero, e.FEEMDO AS fecha,
           RTRIM(e.ENDO) AS clienteCodigo,
           (SELECT TOP 1 RTRIM(en.NOKOEN) FROM MAEEN en WHERE en.KOEN = e.ENDO) AS cliente,
           RTRIM(e.KOFUDO) AS vendedorCodigo, RTRIM(fu.NOKOFU) AS vendedor,
           e.VANEDO AS neto, RTRIM(ISNULL(e.ESDO, '')) AS estado,
           SUM(CASE WHEN d.CAPRCO1 - d.CAPRAD1 - d.CAPREX1 > 0
                    THEN (d.CAPRCO1 - d.CAPRAD1 - d.CAPREX1) * (d.VANELI / NULLIF(d.CAPRCO1, 0))
                    ELSE 0 END) AS netoPendiente,
           COUNT(*) AS lineas,
           SUM(CASE WHEN d.CAPRCO1 - d.CAPRAD1 - d.CAPREX1 > 0 THEN 1 ELSE 0 END) AS lineasPendientes
    FROM MAEEDO e
    JOIN MAEDDO d ON d.IDMAEEDO = e.IDMAEEDO
    LEFT JOIN TABFU fu ON fu.KOFU = e.KOFUDO
    WHERE e.EMPRESA = @emp AND e.TIDO = 'NVV'
      AND e.FEEMDO >= @desde AND e.FEEMDO <= @hasta
      ${soloPendientes ? "AND LTRIM(RTRIM(ISNULL(e.ESDO, ''))) = ''" : ""}
      ${w}
    GROUP BY e.IDMAEEDO, e.NUDO, e.FEEMDO, e.ENDO, e.KOFUDO, fu.NOKOFU, e.VANEDO, e.ESDO
    -- Una nota abierta sin nada por despachar no es pendiente (quedó sin cerrar en el ERP).
    ${soloPendientes ? "HAVING SUM(CASE WHEN d.CAPRCO1 - d.CAPRAD1 - d.CAPREX1 > 0 THEN 1 ELSE 0 END) > 0" : ""}
    ORDER BY e.FEEMDO DESC, e.NUDO DESC
  `);
  return q.recordset.map((n: any) => ({
    id: num(n.id),
    numero: texto(n.numero),
    fecha: n.fecha instanceof Date ? n.fecha.toISOString().slice(0, 10) : texto(n.fecha).slice(0, 10),
    clienteCodigo: texto(n.clienteCodigo),
    cliente: texto(n.cliente) || texto(n.clienteCodigo),
    vendedorCodigo: texto(n.vendedorCodigo),
    vendedor: texto(n.vendedor) || texto(n.vendedorCodigo),
    neto: num(n.neto),
    netoPendiente: num(n.netoPendiente),
    estado: texto(n.estado) === "C" ? "cerrada" : texto(n.estado) === "N" ? "nula" : "abierta",
    lineas: num(n.lineas),
    lineasPendientes: num(n.lineasPendientes),
  }));
}

export async function detalleNota(emp: EmpresaExterna, id: number) {
  const pool = await erp();
  const r = pool.request();
  r.input("emp", mssql.Char(2), emp.codigo);
  r.input("id", mssql.Int, id);
  const q = await r.query(`
    SELECT RTRIM(d.KOPRCT) AS codigo, RTRIM(d.NOKOPR) AS producto, RTRIM(d.UD01PR) AS unidad,
           d.CAPRCO1 AS pedido, d.CAPRAD1 AS despachado, d.CAPREX1 AS cerrado,
           d.PPPRNE AS precio, d.VANELI AS neto
    FROM MAEDDO d
    JOIN MAEEDO e ON e.IDMAEEDO = d.IDMAEEDO
    WHERE d.IDMAEEDO = @id AND e.EMPRESA = @emp AND e.TIDO = 'NVV'
    ORDER BY d.NULIDO
  `);
  return q.recordset.map((l: any) => ({
    codigo: texto(l.codigo),
    producto: texto(l.producto),
    unidad: texto(l.unidad),
    pedido: num(l.pedido),
    despachado: num(l.despachado),
    pendiente: Math.max(0, num(l.pedido) - num(l.despachado) - num(l.cerrado)),
    precio: num(l.precio),
    neto: num(l.neto),
  }));
}

/**
 * Stock de una bodega: la propia de la empresa externa o una de Panorámica
 * (bodegasInventarioDe). Con `conCosto`, cada producto lleva su último costo de
 * compra por la unidad en que se muestra; solo se pide para la bodega propia.
 * Las de Panorámica van siempre sin costos.
 *
 * Los productos en balde (unidad 2 = "BD": los de 4 y de 5 galones) se muestran
 * en baldes y no en galones, como se venden (pedido del usuario, nov-2026):
 * stock con STFI2/STOCNV2 y costo por balde. El resto, en su unidad 1.
 */
export async function inventario(bodega: BodegaInventario, conCosto = false) {
  const [costos1, costos2] = conCosto
    ? await Promise.all([ultimosCostos(bodega.empresa, 1), ultimosCostos(bodega.empresa, 2)])
    : [null, null];
  const pool = await erp();
  const r = pool.request();
  r.input("emp", mssql.Char(2), bodega.empresa);
  const bodegas = bodega.bodegas.map((b, i) => {
    r.input(`b${i}`, mssql.VarChar(10), b);
    return `@b${i}`;
  });
  // Físico, comprometido en notas de venta y disponible, por producto (suma de bodegas).
  const q = await r.query(`
    SELECT RTRIM(s.KOPR) AS codigo, MAX(RTRIM(p.NOKOPR)) AS producto,
           MAX(RTRIM(p.UD01PR)) AS unidad, MAX(RTRIM(p.UD02PR)) AS unidad2, MAX(p.RLUD) AS galonesPorEnvase,
           SUM(s.STFI1) AS fisico, SUM(s.STOCNV1) AS comprometido,
           SUM(s.STFI2) AS fisico2, SUM(s.STOCNV2) AS comprometido2
    FROM MAEST s
    LEFT JOIN MAEPR p ON p.KOPR = s.KOPR
    WHERE s.EMPRESA = @emp AND s.KOBO IN (${bodegas.join(",")})
      -- "ZZ…" son conceptos internos (marketing, alojamiento, agua), no productos.
      AND UPPER(LTRIM(s.KOPR)) NOT LIKE 'ZZ%'
    GROUP BY s.KOPR
    HAVING SUM(s.STFI1) <> 0 OR SUM(s.STOCNV1) <> 0
    ORDER BY MAX(p.NOKOPR)
  `);
  return q.recordset.map((s: any) => {
    const unidad1 = texto(s.unidad).toUpperCase();
    const unidad2 = texto(s.unidad2).toUpperCase();
    // Balde = unidad 2 "BD" (4 y casi todos los de 5 galones) o "B5" (otros 16 de
    // 5 galones), con la unidad 1 en galones y más de un galón por envase.
    const enBaldes = unidad1 === "GL" && (unidad2 === "BD" || unidad2 === "B5") && num(s.galonesPorEnvase) > 1;
    const fisico = enBaldes ? num(s.fisico2) : num(s.fisico);
    const comprometido = enBaldes ? num(s.comprometido2) : num(s.comprometido);
    const costos = enBaldes ? costos2 : costos1;
    const costo = costos?.[texto(s.codigo).toUpperCase()];
    return {
      codigo: texto(s.codigo),
      producto: texto(s.producto) || texto(s.codigo),
      // Unidad en que van las cantidades y el costo de esta fila.
      unidad: enBaldes ? "BD" : texto(s.unidad),
      fisico,
      comprometido,
      disponible: fisico - comprometido,
      ...(conCosto ? { ultimoCosto: costo?.price ?? null, ultimoCostoFecha: costo?.date ?? null } : {}),
    };
  });
}

/**
 * Último costo de compra de cada producto según las facturas de proveedor (FCC)
 * de la propia empresa externa en Random: lo que de verdad registró que pagó.
 * Neto, con los descuentos de la factura ya aplicados. { CODIGO: { price, date } },
 * el mismo formato que /api/inventory/gri-prices.
 *
 * - `unidad` 1 = por la unidad del stock (GL, UN, LT): para Inventario.
 *   `unidad` 2 = por envase (balde, galón), la unidad de cada fila de la lista
 *   de precios: para Lista de Precios.
 * - `proveedor`: solo las compras a ese RUT (Panorámica, para Lista de Precios).
 *   Sin proveedor, la última compra a quien sea (Inventario: también tienen
 *   productos de otros proveedores).
 *
 * Se usan las facturas de la empresa y no las de venta de Panorámica a su RUT:
 * esas traen documentos que la empresa no registró como costo (en nov-2026,
 * dos facturas de Latex Supercubriente a $10.000 el balde contra $36.360 de
 * su factura de compra del mismo día).
 */
export async function ultimosCostos(empresa: string, unidad: 1 | 2, proveedor?: string) {
  const pool = await erp();
  const r = pool.request();
  r.input("emp", mssql.Char(2), empresa);
  if (proveedor) r.input("prov", mssql.VarChar(20), proveedor);
  const cantidad = unidad === 1 ? "d.CAPRCO1" : "d.CAPRCO2";
  const q = await r.query(`
    SELECT codigo, fecha, costo FROM (
      SELECT UPPER(RTRIM(LTRIM(d.KOPRCT))) AS codigo, d.FEEMLI AS fecha,
             d.VANELI / NULLIF(${cantidad}, 0) AS costo,
             ROW_NUMBER() OVER (PARTITION BY d.KOPRCT ORDER BY d.FEEMLI DESC, d.IDMAEDDO DESC) AS n
      FROM MAEDDO d
      JOIN MAEEDO e ON e.IDMAEEDO = d.IDMAEEDO
      WHERE d.EMPRESA = @emp AND d.TIDO = 'FCC'
        AND d.VANELI > 0 AND ${cantidad} > 0
        AND UPPER(LTRIM(d.KOPRCT)) NOT LIKE 'ZZ%'
        ${proveedor ? "AND e.ENDO = @prov" : ""}
    ) t WHERE n = 1
  `);
  const mapa: Record<string, { price: number; date: string | null }> = {};
  for (const f of q.recordset as any[]) {
    const fecha = f.fecha instanceof Date ? f.fecha.toISOString().slice(0, 10) : texto(f.fecha).slice(0, 10) || null;
    mapa[texto(f.codigo)] = { price: Math.round(num(f.costo)), date: fecha };
  }
  return mapa;
}

/** Costo en Lista de Precios: la última compra a Panorámica, por envase. */
export function costosCompra(emp: EmpresaExterna) {
  return ultimosCostos(emp.codigo, 2, RUT_PANORAMICA);
}

/**
 * Bloquea a los usuarios de empresas externas las rutas con datos comerciales
 * de Panorámica. Va antes de todas las rutas de la API.
 */

export function bloquearDatosPanoramicaAEmpresasExternas(req: any, res: any, next: any) {
  if (!req.path?.startsWith("/api/")) return next();
  if (!empresaExternaDe(req.user?.email)) return next();
  // Lista de Precios: la empresa externa ve los precios, pero no el costo de
  // producción de Panorámica que viaja en cada fila.
  if (req.method === "GET" && req.path === "/api/price-list") {
    const json = res.json.bind(res);
    res.json = (cuerpo: any) => {
      if (cuerpo && Array.isArray(cuerpo.items)) {
        cuerpo = {
          ...cuerpo,
          items: cuerpo.items.map((it: any) => ({ ...it, costoProduccion: null, porcentajeUtilidad: null })),
        };
      }
      return json(cuerpo);
    };
    return next();
  }
  if (!rutaBloqueadaParaEmpresaExterna(req.path)) return next();
  // La franja de mensajes pide esta ruta en todas las pantallas: lista vacía y sin error.
  if (req.path === "/api/mensajes-destacados/mios") return res.json([]);
  return res.status(403).json({ message: "Esta información no está disponible para tu empresa." });
}

export function registerEmpresaExternaRoutes(app: Express): void {
  const conEmpresa = (handler: (req: any, res: any, emp: EmpresaExterna) => Promise<void>) =>
    async (req: any, res: any) => {
      const emp = empresaDelUsuario(req);
      if (!emp) return res.status(403).json({ message: "Tu usuario no está asociado a una empresa externa." });
      try {
        await handler(req, res, emp);
      } catch (error: any) {
        console.error("[empresa-externa]", req.path, error?.message || error);
        res.status(502).json({ message: "No se pudo leer la información desde el sistema de facturación. Intenta de nuevo en un momento." });
      }
    };

  app.get("/api/empresa-externa/resumen", requireAuth, conEmpresa(async (req, res, emp) => {
    const desde = texto(req.query.desde);
    const hasta = texto(req.query.hasta);
    if (!FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta) {
      return void res.status(400).json({ message: "Período inválido." });
    }
    const f: FiltrosVenta = {
      vendedor: texto(req.query.vendedor) || undefined,
      cliente: texto(req.query.cliente) || undefined,
      producto: texto(req.query.producto) || undefined,
    };
    const clave = `resumen:${emp.codigo}:${desde}:${hasta}:${f.vendedor || ""}:${f.cliente || ""}:${f.producto || ""}`;
    res.json(await conCache(clave, () => resumen(emp, desde, hasta, f)));
  }));

  app.get("/api/empresa-externa/vendedores", requireAuth, conEmpresa(async (_req, res, emp) => {
    res.json(await conCache(`vendedores:${emp.codigo}`, () => vendedores(emp)));
  }));

  app.get("/api/empresa-externa/notas-venta", requireAuth, conEmpresa(async (req, res, emp) => {
    const soloPendientes = texto(req.query.estado) !== "todas";
    const desde = FECHA.test(texto(req.query.desde)) ? texto(req.query.desde) : "1900-01-01";
    const hasta = FECHA.test(texto(req.query.hasta)) ? texto(req.query.hasta) : "2999-12-31";
    const vendedor = texto(req.query.vendedor) || undefined;
    const clave = `nvv:${emp.codigo}:${soloPendientes}:${desde}:${hasta}:${vendedor || ""}`;
    res.json(await conCache(clave, () => notasVenta(emp, soloPendientes, desde, hasta, vendedor)));
  }));

  app.get("/api/empresa-externa/notas-venta/:id", requireAuth, conEmpresa(async (req, res, emp) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return void res.status(400).json({ message: "Nota de venta inválida." });
    res.json(await conCache(`nvv-detalle:${emp.codigo}:${id}`, () => detalleNota(emp, id)));
  }));

  app.get("/api/empresa-externa/inventario", requireAuth, conEmpresa(async (req, res, emp) => {
    // Solo las bodegas que la configuración le permite a esta empresa.
    const bodega = bodegasInventarioDe(emp).find((b) => b.id === (texto(req.query.bodega) || "propia"));
    if (!bodega) return void res.status(400).json({ message: "Bodega no disponible." });
    const propia = bodega.id === "propia";
    res.json(await conCache(`inventario:${emp.codigo}:${bodega.id}`, () => inventario(bodega, propia)));
  }));

  app.get("/api/empresa-externa/costos-compra", requireAuth, conEmpresa(async (_req, res, emp) => {
    res.json(await conCache(`costos-compra:${emp.codigo}`, () => costosCompra(emp)));
  }));
}
