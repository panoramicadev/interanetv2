/**
 * Detalle facturación NVV y GDV: lo ingresado y emitido en un período, por tipo
 * de documento, para los paneles de admin y recepción.
 *
 * Cada documento desaparece a medida que pasa al siguiente: la nota de venta al
 * pasar a guía o factura, y la guía al facturarse. De una nota que pasó en parte
 * queda solo el saldo. Facturas y notas de crédito se quedan.
 *
 * Todo se lee de Random al momento, porque el panel se refresca cada 10 minutos
 * y los espejos no dan ese ritmo: ventas.fact_ventas se carga cada 4 horas, y con
 * él una guía recién facturada desaparecería sin aparecer todavía en facturas.
 *
 *   Notas de venta   → MAEEDO y MAEDDO: lo que falta pasar es CAPRCO2 - CAPREX2
 *   y guías             en las líneas abiertas. No se usa gdv.fact_gdv, que solo
 *                       trae las guías del día.
 *   Facturas y notas → MAEEDO. Si Random no responde, ventas.fact_ventas.
 *   de crédito
 *
 * Los montos van netos, igual que en el dashboard. Las facturas menos las notas
 * de crédito dan las ventas del dashboard, salvo lo emitido después de su última carga.
 *
 * El consolidado suma notas de venta, guías y facturas, y le resta las notas de
 * crédito. La tarjeta de notas de crédito se muestra en positivo.
 *
 * Resumen, PDF y Excel salen de los mismos documentos (`cargarDataset`), para
 * que lo descargado siempre coincida con lo que se ve en pantalla. Las líneas
 * (productos) de cada documento se leen aparte: al desplegar un documento en la
 * tabla (`/lineas`) y, para todos, al descargar.
 */
import type { Express } from "express";
import { sql } from "drizzle-orm";
import mssql from "mssql";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { db } from "./db";
import { requireRoles } from "./auth";
import { erp } from "./obras-ventas";
import { canonicalSegmentName } from "./utils/segment-normalize";

const ROLES_PERMITIDOS = ["admin", "reception"];
const MAX_DIAS_RANGO = 366;
/** Las mismas sucursales que trae el ETL de notas de venta. */
const SUCURSALES_ERP = ["004", "005", "006", "007"];
/** Los tipos y sucursales que trae el ETL de ventas, sin las guías. */
const TIDOS_FACTURAS = ["FCV", "FVL", "BLV", "FDV", "NCV"];
const SUCURSALES_FACTURAS = ["004", "006", "007"];
/** Bajo este neto, una línea de guía no cuenta como pendiente: es el mismo corte del ETL de guías. */
const NETO_MINIMO_LINEA_GUIA = 1000;
/** Hay clientes sin segmento en el ERP: sin esta opción, sus montos no saldrían en ningún filtro. */
const SIN_SEGMENTO = "Sin segmento";
/**
 * Las sucursales que se pueden elegir en el filtro (pedido del usuario, nov-2026).
 * "Todas" sigue siendo la opción por defecto: incluye también 005 y 006, para que
 * los totales no cambien y las facturas sigan cuadrando con el dashboard.
 */
const SUCURSALES_FILTRO: { codigo: string; nombre: string }[] = [
  { codigo: "004", nombre: "Lautaro" },
  { codigo: "007", nombre: "Concepción" },
];
const nombreSucursal = (codigo: string) => {
  const conocida = SUCURSALES_FILTRO.find((s) => s.codigo === codigo);
  return conocida ? `${codigo} ${conocida.nombre}` : codigo || "—";
};
/** fact_ventas guarda la sucursal como número (4): el ERP la escribe "004". */
const codigoSucursal = (v: unknown) => {
  const t = texto(v);
  return /^\d{1,3}$/.test(t) ? t.padStart(3, "0") : t;
};

const MARCA = "#fd6301";
const TINTA = "#17181c";
const GRIS = "#6b7280";
const BORDE = "#e5e7eb";
const FONDO_TOTAL = "#fff7ed";

type ClaveCategoria = "nvv" | "gdv" | "facturas" | "ncv";

interface Documento {
  /** IDMAEEDO: con él se leen las líneas del documento. */
  id: string;
  tipo: string;
  numero: string;
  fecha: string;
  codigoCliente: string;
  cliente: string;
  vendedor: string;
  segmento: string;
  /** Código de la sucursal del documento (SUDO), con sus ceros: "004". */
  sucursal: string;
  neto: number;
  bruto: number;
}

/** Una línea (producto) de un documento. */
interface Linea {
  codigo: string;
  producto: string;
  unidad: string;
  cantidad: number;
  /** Solo notas de venta y guías: lo que falta pasar al documento siguiente. */
  pendiente: number | null;
  precio: number;
  /** En notas de venta y guías, el neto y bruto de lo pendiente: así suman lo que muestra el documento. */
  neto: number;
  bruto: number;
}

/** Líneas por id de documento; null = no se pudieron leer. */
type LineasPorDocumento = Map<string, Linea[]> | null;

interface Categoria {
  clave: ClaveCategoria;
  titulo: string;
  hoja: string;
  /** null = no se pudo leer la fuente: nunca se informa como $0. */
  documentos: Documento[] | null;
}

interface Filtros {
  vendedor?: string;
  /** Código del cliente: el nombre puede venir escrito distinto entre el ERP y fact_ventas. */
  cliente?: string;
  segmento?: string;
  /** Código de sucursal: "004" o "007". Sin él, todas. */
  sucursal?: string;
  /** Lo escrito en el buscador de la tabla: así la descarga trae lo mismo que se ve. */
  busqueda?: string;
  /** Solo esta categoría: la descarga de una pestaña de la tabla. */
  categoria?: ClaveCategoria;
}

interface Dataset {
  desde: string;
  hasta: string;
  categorias: Categoria[];
  /** Lo que se puede elegir en el período, sin aplicar los filtros. */
  opciones: {
    sucursales: { codigo: string; nombre: string }[];
    vendedores: string[];
    clientes: { codigo: string; nombre: string }[];
    segmentos: string[];
  };
  /** Los filtros del informe, en palabras: siempre los cuatro, también los que están en "Todos". */
  filtrosTexto: string;
  /** Sin filtro de sucursal: el Excel separa además las notas de venta por sucursal. */
  todasLasSucursales: boolean;
  /** La descarga es de una sola pestaña: el total es el de esa categoría, no el consolidado. */
  soloCategoria: boolean;
}

const montoDe = (c: Categoria) => c.documentos?.reduce((s, d) => s + d.neto, 0) ?? null;
const consolidadoDe = (ds: Dataset) =>
  ds.categorias.reduce((s, c) => s + (c.clave === "ncv" ? -1 : 1) * (montoDe(c) ?? 0), 0);
const estaIncompleto = (ds: Dataset) => ds.categorias.some((c) => c.documentos === null);

const texto = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");
const etiquetaPeriodo = (desde: string, hasta: string) =>
  desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

function esFechaValida(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function leerPeriodo(query: any): { desde: string; hasta: string } | { error: string } {
  const { desde, hasta } = query;
  if (!esFechaValida(desde) || !esFechaValida(hasta)) return { error: "Las fechas no son válidas" };
  if (desde > hasta) return { error: "La fecha de inicio es posterior a la de término" };
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1;
  if (dias > MAX_DIAS_RANGO) return { error: "El período no puede superar los 12 meses" };
  return { desde, hasta };
}

function leerFiltros(query: any): Filtros {
  const valor = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined);
  const categoria = valor(query.categoria) as ClaveCategoria | undefined;
  return {
    vendedor: valor(query.vendedor),
    cliente: valor(query.cliente),
    segmento: valor(query.segmento),
    sucursal: valor(query.sucursal),
    busqueda: valor(query.busqueda),
    categoria: categoria && ["nvv", "gdv", "facturas", "ncv"].includes(categoria) ? categoria : undefined,
  };
}

const nombreSegmento = (v: unknown) => String(canonicalSegmentName(texto(v))) || SIN_SEGMENTO;

const listaSql = (valores: string[]) => valores.map((v) => `'${v}'`).join(",");

/** `montos` aporta las columnas NETO y BRUTO de cada documento, como `pe`. */
async function documentosDelErp(tidos: string[], sucursales: string[], montos: string, desde: string, hasta: string): Promise<Documento[]> {
  const req = (await erp()).request();
  req.input("desde", mssql.Date, new Date(`${desde}T00:00:00Z`));
  req.input("hasta", mssql.Date, new Date(`${hasta}T00:00:00Z`));
  // MAEEN tiene una fila por sucursal del cliente: con un JOIN directo, cada nota
  // se contaría una vez por sucursal. Por eso OUTER APPLY con TOP 1.
  const r = await req.query(`
    SELECT CAST(ed.IDMAEEDO AS varchar(20)) AS IDMAEEDO, ed.TIDO, ed.NUDO, CONVERT(varchar(10), ed.FEEMDO, 23) AS FECHA, ed.ENDO, en.NOKOEN, fu.NOKOFU,
           ru.NOKORU, ed.SUDO, pe.NETO, pe.BRUTO
    FROM dbo.MAEEDO ed
    ${montos}
    OUTER APPLY (
      SELECT TOP 1 m.NOKOEN, m.RUEN FROM dbo.MAEEN m
      WHERE m.KOEN = ed.ENDO
      ORDER BY CASE WHEN m.SUEN = ed.SUENDO THEN 0 ELSE 1 END
    ) en
    -- El vendedor es el de la línea, como en fact_ventas y fact_nvv: KOFUDO es quien
    -- digitó el documento. Una nota con varios vendedores (casi no hay) queda con el primero.
    OUTER APPLY (
      SELECT TOP 1 dd.KOFULIDO FROM dbo.MAEDDO dd
      WHERE dd.IDMAEEDO = ed.IDMAEEDO AND dd.KOFULIDO IS NOT NULL
      ORDER BY dd.IDMAEDDO
    ) li
    LEFT JOIN dbo.TABFU fu ON fu.KOFU = COALESCE(li.KOFULIDO, ed.KOFUDO)
    LEFT JOIN dbo.TABRU ru ON ru.KORU = en.RUEN
    WHERE ed.TIDO IN (${listaSql(tidos)})
      AND ed.SUDO IN (${listaSql(sucursales)})
      AND ed.FEEMDO >= @desde
      AND ed.FEEMDO < DATEADD(day, 1, @hasta)
    ORDER BY ed.FEEMDO, ed.NUDO
  `);
  return r.recordset.map((f: any) => ({
    id: texto(f.IDMAEEDO),
    tipo: texto(f.TIDO),
    numero: texto(f.NUDO),
    fecha: f.FECHA,
    codigoCliente: texto(f.ENDO),
    cliente: texto(f.NOKOEN),
    vendedor: texto(f.NOKOFU),
    segmento: nombreSegmento(f.NOKORU),
    sucursal: codigoSucursal(f.SUDO),
    neto: numero(f.NETO),
    bruto: numero(f.BRUTO),
  }));
}

/** Las líneas que cuentan como pendientes: las mismas para el monto del documento y para su detalle. */
const condicionPendiente = (tido: "NVV" | "GDV") => `
        AND (dd.ESLIDO IS NULL OR LTRIM(RTRIM(dd.ESLIDO)) = '')
        AND dd.CAPRCO2 - dd.CAPREX2 > 0
        ${tido === "GDV" ? `AND dd.VANELI >= ${NETO_MINIMO_LINEA_GUIA}` : ""}`;

/** Notas de venta o guías del período, solo con lo que falta pasar al documento siguiente. */
function pendientesDelErp(tido: "NVV" | "GDV", desde: string, hasta: string): Promise<Documento[]> {
  // Sin líneas pendientes, el HAVING no devuelve fila y el documento queda fuera.
  const montos = `
    CROSS APPLY (
      SELECT SUM((dd.CAPRCO2 - dd.CAPREX2) * dd.PPPRNE) AS NETO,
             SUM((dd.CAPRCO2 - dd.CAPREX2) * dd.PPPRBR) AS BRUTO
      FROM dbo.MAEDDO dd
      WHERE dd.IDMAEEDO = ed.IDMAEEDO
        ${condicionPendiente(tido)}
      HAVING COUNT(*) > 0
    ) pe`;
  return documentosDelErp([tido], SUCURSALES_ERP, montos, desde, hasta);
}

function facturasDelErp(desde: string, hasta: string): Promise<Documento[]> {
  const montos = "CROSS APPLY (SELECT ABS(ed.VANEDO) AS NETO, ABS(ed.VABRDO) AS BRUTO) pe";
  return documentosDelErp(TIDOS_FACTURAS, SUCURSALES_FACTURAS, montos, desde, hasta);
}

/** Respaldo de `facturasDelErp`: una fila por documento (fact_ventas viene por línea). */
async function documentosDeVentas(desde: string, hasta: string): Promise<Documento[]> {
  const r: any = await db.execute(sql`
    SELECT idmaeedo::text AS id,
           tido,
           MAX(nudo)::text AS numero,
           MAX(feemdo)::text AS fecha,
           MAX(endo) AS codigo_cliente,
           MAX(nokoen) AS cliente,
           MAX(nokofu) AS vendedor,
           MAX(noruen) AS segmento,
           MAX(sudo)::text AS sucursal,
           ABS(SUM(vaneli)) AS neto,
           ABS(MAX(vabrdo)) AS bruto
    FROM ventas.fact_ventas
    WHERE feemdo >= ${desde}::date AND feemdo <= ${hasta}::date
      AND tido <> 'GDV'
    GROUP BY idmaeedo, tido
    ORDER BY MAX(feemdo), MAX(nudo)
  `);
  return (r.rows ?? r).map((f: any) => ({
    id: texto(f.id),
    tipo: texto(f.tido),
    numero: texto(f.numero),
    fecha: f.fecha,
    codigoCliente: texto(f.codigo_cliente),
    cliente: texto(f.cliente),
    vendedor: texto(f.vendedor),
    segmento: nombreSegmento(f.segmento),
    sucursal: codigoSucursal(f.sucursal),
    neto: numero(f.neto),
    bruto: numero(f.bruto),
  }));
}

const LOTE_IDS = 1000;
/** Los ids van dentro del SQL: solo se aceptan números. */
const idsValidos = (ids: string[]) => Array.from(new Set(ids.filter((id) => /^\d{1,20}$/.test(id))));

function agrupar(filas: { id: string; linea: Linea }[]): Map<string, Linea[]> {
  const mapa = new Map<string, Linea[]>();
  for (const { id, linea } of filas) {
    const lista = mapa.get(id);
    if (lista) lista.push(linea);
    else mapa.set(id, [linea]);
  }
  return mapa;
}

/**
 * Líneas de los documentos desde MAEDDO. En notas de venta y guías, solo las
 * pendientes y por lo que falta pasar, igual que el monto del documento.
 */
async function lineasDelErp(clave: ClaveCategoria, ids: string[]): Promise<Map<string, Linea[]>> {
  const validos = idsValidos(ids);
  const pendiente = clave === "nvv" || clave === "gdv";
  const filtro = clave === "nvv" ? condicionPendiente("NVV") : clave === "gdv" ? condicionPendiente("GDV") : "";
  const filas: { id: string; linea: Linea }[] = [];
  for (let i = 0; i < validos.length; i += LOTE_IDS) {
    const lote = validos.slice(i, i + LOTE_IDS);
    const r = await (await erp()).request().query(`
      SELECT CAST(dd.IDMAEEDO AS varchar(20)) AS IDMAEEDO, dd.KOPRCT, dd.NOKOPR, dd.UD02PR,
             dd.CAPRCO2, dd.CAPREX2, dd.PPPRNE, dd.PPPRBR, dd.VANELI, dd.VABRLI
      FROM dbo.MAEDDO dd
      WHERE dd.IDMAEEDO IN (${lote.join(",")})
        ${filtro}
      ORDER BY dd.IDMAEEDO, dd.IDMAEDDO
    `);
    for (const f of r.recordset as any[]) {
      const cantidad = Math.abs(numero(f.CAPRCO2));
      const falta = pendiente ? numero(f.CAPRCO2) - numero(f.CAPREX2) : null;
      filas.push({
        id: texto(f.IDMAEEDO),
        linea: {
          codigo: texto(f.KOPRCT),
          producto: texto(f.NOKOPR),
          unidad: texto(f.UD02PR),
          cantidad,
          pendiente: falta,
          precio: Math.abs(numero(f.PPPRNE)),
          neto: falta !== null ? falta * numero(f.PPPRNE) : Math.abs(numero(f.VANELI)),
          bruto: falta !== null ? falta * numero(f.PPPRBR) : Math.abs(numero(f.VABRLI)),
        },
      });
    }
  }
  return agrupar(filas);
}

/** Respaldo de `lineasDelErp` para facturas y notas de crédito. */
async function lineasDeVentas(ids: string[]): Promise<Map<string, Linea[]>> {
  const validos = idsValidos(ids);
  const filas: { id: string; linea: Linea }[] = [];
  for (let i = 0; i < validos.length; i += LOTE_IDS) {
    const lote = validos.slice(i, i + LOTE_IDS);
    const r: any = await db.execute(sql`
      SELECT idmaeedo::text AS id, koprct, nokoprct, ud02pr, caprco2, ppprne, vaneli, vabrli
      FROM ventas.fact_ventas
      WHERE idmaeedo IN (${sql.join(lote.map((id) => sql`${id}::numeric`), sql`, `)})
      ORDER BY idmaeedo, idmaeddo
    `);
    for (const f of r.rows ?? r) {
      filas.push({
        id: texto(f.id),
        linea: {
          codigo: texto(f.koprct),
          producto: texto(f.nokoprct),
          unidad: texto(f.ud02pr),
          cantidad: Math.abs(numero(f.caprco2)),
          pendiente: null,
          precio: Math.abs(numero(f.ppprne)),
          neto: Math.abs(numero(f.vaneli)),
          bruto: Math.abs(numero(f.vabrli)),
        },
      });
    }
  }
  return agrupar(filas);
}

async function cargarLineas(clave: ClaveCategoria, ids: string[]): Promise<Map<string, Linea[]>> {
  if (clave === "nvv" || clave === "gdv") return lineasDelErp(clave, ids);
  return lineasDelErp(clave, ids).catch((e) => {
    console.error("[detalle-facturacion] No se pudo leer líneas del ERP, se usa fact_ventas:", e?.message);
    return lineasDeVentas(ids);
  });
}

/** Las líneas de todos los documentos del informe; si una categoría falla, el resto se descarga igual. */
async function cargarLineasDataset(ds: Dataset): Promise<Map<ClaveCategoria, LineasPorDocumento>> {
  const resultado = await Promise.all(
    ds.categorias.map(async (c): Promise<[ClaveCategoria, LineasPorDocumento]> => {
      if (!c.documentos) return [c.clave, null];
      try {
        return [c.clave, await cargarLineas(c.clave, c.documentos.map((d) => d.id))];
      } catch (e: any) {
        console.error(`[detalle-facturacion] No se pudo leer las líneas de ${c.clave}:`, e?.message);
        return [c.clave, null];
      }
    }),
  );
  return new Map(resultado);
}

async function cargarDataset(desde: string, hasta: string, filtros: Filtros = {}): Promise<Dataset> {
  // Si Random no responde, el resto del panel sigue sirviendo: las tarjetas de notas
  // de venta y guías avisan que no están disponibles en vez de mostrar un $0 falso.
  const delErp = (tido: "NVV" | "GDV") =>
    pendientesDelErp(tido, desde, hasta).catch((e) => {
      console.error(`[detalle-facturacion] No se pudo leer ${tido} del ERP:`, e?.message);
      return null;
    });
  const facturas = facturasDelErp(desde, hasta).catch((e) => {
    console.error("[detalle-facturacion] No se pudo leer facturas del ERP, se usa fact_ventas:", e?.message);
    return documentosDeVentas(desde, hasta);
  });
  const [nvv, gdv, ventas] = await Promise.all([delErp("NVV"), delErp("GDV"), facturas]);

  const todos = [...(nvv ?? []), ...(gdv ?? []), ...ventas];
  const clientes = new Map<string, string>();
  for (const d of todos) {
    if (d.codigoCliente && !clientes.has(d.codigoCliente)) clientes.set(d.codigoCliente, d.cliente || d.codigoCliente);
  }
  const opciones = {
    sucursales: SUCURSALES_FILTRO.map((s) => ({ codigo: s.codigo, nombre: `${s.codigo} ${s.nombre}` })),
    vendedores: Array.from(new Set(todos.map((d) => d.vendedor).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")),
    clientes: Array.from(clientes, ([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    // "Sin segmento" va al final: no es un segmento, es lo que falta clasificar.
    segmentos: Array.from(new Set(todos.map((d) => d.segmento))).sort((a, b) =>
      a === SIN_SEGMENTO ? 1 : b === SIN_SEGMENTO ? -1 : a.localeCompare(b, "es"),
    ),
  };

  // La búsqueda es la misma del buscador de la tabla: número, cliente o vendedor.
  const termino = filtros.busqueda?.toLowerCase();
  const pasa = (d: Documento) =>
    (!filtros.vendedor || d.vendedor === filtros.vendedor) &&
    (!filtros.cliente || d.codigoCliente === filtros.cliente) &&
    (!filtros.segmento || d.segmento === filtros.segmento) &&
    (!filtros.sucursal || d.sucursal === filtros.sucursal) &&
    (!termino || [d.numero, d.cliente, d.codigoCliente, d.vendedor].some((v) => v.toLowerCase().includes(termino)));
  const ventasFiltradas = ventas.filter(pasa);

  const filtrosTexto = [
    `Sucursal: ${filtros.sucursal ? nombreSucursal(filtros.sucursal) : "Todas"}`,
    `Segmento: ${filtros.segmento ?? "Todos"}`,
    `Vendedor: ${filtros.vendedor ?? "Todos"}`,
    `Cliente: ${filtros.cliente ? clientes.get(filtros.cliente) ?? filtros.cliente : "Todos"}`,
    ...(filtros.busqueda ? [`Búsqueda: "${filtros.busqueda}"`] : []),
  ].join(" · ");

  const categorias: Categoria[] = [
    { clave: "nvv", titulo: "Notas de venta", hoja: "Notas de venta", documentos: nvv && nvv.filter(pasa) },
    { clave: "gdv", titulo: "Guías de despacho", hoja: "Guías de despacho", documentos: gdv && gdv.filter(pasa) },
    { clave: "facturas", titulo: "Total facturado", hoja: "Facturas", documentos: ventasFiltradas.filter((d) => d.tipo !== "NCV") },
    { clave: "ncv", titulo: "Notas de crédito", hoja: "Notas de crédito", documentos: ventasFiltradas.filter((d) => d.tipo === "NCV") },
  ];

  return {
    desde,
    hasta,
    opciones,
    filtrosTexto,
    todasLasSucursales: !filtros.sucursal,
    soloCategoria: !!filtros.categoria,
    categorias: filtros.categoria ? categorias.filter((c) => c.clave === filtros.categoria) : categorias,
  };
}

const nombreArchivo = (ds: Dataset, ext: string) =>
  `detalle-facturacion${ds.soloCategoria ? `_${ds.categorias[0]?.clave ?? ""}` : ""}_${ds.desde}_${ds.hasta}.${ext}`;

/** Título y total del informe: el consolidado, o el de la única pestaña que se descargó. */
const tituloInforme = (ds: Dataset) =>
  ds.soloCategoria && ds.categorias[0] ? `${ds.categorias[0].titulo}: detalle` : "Detalle facturación NVV y GDV";
const totalInforme = (ds: Dataset): { etiqueta: string; monto: number } =>
  ds.soloCategoria && ds.categorias[0]
    ? { etiqueta: `Total ${ds.categorias[0].titulo.toLowerCase()}`, monto: montoDe(ds.categorias[0]) ?? 0 }
    : { etiqueta: "Total consolidado del período", monto: consolidadoDe(ds) };

const NOTA_CONSOLIDADO =
  "Notas de venta y guías muestran solo lo que falta pasar al documento siguiente. El consolidado suma notas de venta, guías y facturas, y resta las notas de crédito. Montos netos, sin IVA.";
const NOTA_MONTOS = "Notas de venta y guías muestran solo lo que falta pasar al documento siguiente. Montos netos, sin IVA.";
const NOTA_LINEAS =
  "En notas de venta y guías, cada línea muestra la cantidad del documento y lo que falta pasar; el neto y el bruto son los de lo pendiente.";
const NOTA_SIN_LINEAS = "No se pudo leer el detalle de productos de estos documentos al generar este informe.";
const NOTA_INCOMPLETO =
  "Las notas de venta y las guías no estuvieron disponibles al generar este informe: el consolidado no las incluye.";

function generarPdf(salida: NodeJS.WritableStream, ds: Dataset, lineas: Map<ClaveCategoria, LineasPorDocumento>): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("error", reject);
    salida.on("finish", () => resolve());
    doc.pipe(salida);

    const izquierda = 50;
    const ancho = doc.page.width - 100;
    const colDocs = izquierda + ancho - 230;
    const colMonto = izquierda + ancho - 140;

    doc.rect(izquierda, 50, 6, 44).fill(MARCA);
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(18).text(tituloInforme(ds), izquierda + 16, 50);
    doc.fillColor(GRIS).font("Helvetica").fontSize(10).text("Pinturas Panorámica", izquierda + 16, 76);

    doc.fillColor(GRIS).fontSize(9).text("PERÍODO CONSULTADO", izquierda, 120);
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(13).text(etiquetaPeriodo(ds.desde, ds.hasta), izquierda, 134);
    // Hasta dos líneas: un vendedor y un cliente de nombre largo no caben en una.
    doc.fillColor(GRIS).font("Helvetica").fontSize(9).text(ds.filtrosTexto, izquierda, 153, { width: ancho, height: 24, ellipsis: true });

    let y = 188;
    doc.fillColor(GRIS).font("Helvetica-Bold").fontSize(9);
    doc.text("CATEGORÍA", izquierda, y);
    doc.text("DOCUMENTOS", colDocs, y, { width: 80, align: "right" });
    doc.text("TOTAL", colMonto, y, { width: 140, align: "right" });
    y += 16;
    doc.moveTo(izquierda, y).lineTo(izquierda + ancho, y).strokeColor(BORDE).stroke();

    for (const c of ds.categorias) {
      const monto = montoDe(c);
      y += 12;
      doc.fillColor(TINTA).font("Helvetica").fontSize(11).text(c.titulo, izquierda, y);
      doc.text(c.documentos ? c.documentos.length.toLocaleString("es-CL") : "—", colDocs, y, { width: 80, align: "right" });
      doc.text(monto === null ? "No disponible" : clp(monto), colMonto, y, { width: 140, align: "right" });
      y += 22;
      doc.moveTo(izquierda, y).lineTo(izquierda + ancho, y).strokeColor(BORDE).stroke();
    }

    y += 10;
    doc.rect(izquierda, y, ancho, 38).fill(FONDO_TOTAL);
    const total = totalInforme(ds);
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(12).text(total.etiqueta, izquierda + 10, y + 13);
    doc.fillColor(MARCA).fontSize(14).text(clp(total.monto), colMonto - 10, y + 12, { width: 140, align: "right" });
    y += 54;

    doc.fillColor(GRIS).font("Helvetica").fontSize(9);
    doc.text(ds.soloCategoria ? NOTA_MONTOS : NOTA_CONSOLIDADO, izquierda, y, { width: ancho });
    if (estaIncompleto(ds)) {
      doc.moveDown(0.5).fillColor("#dc2626").text(NOTA_INCOMPLETO, izquierda, doc.y, { width: ancho });
    }
    const generado = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
    doc.moveDown(1).fillColor(GRIS).text(`Generado el ${generado}`, izquierda, doc.y, { width: ancho });

    if (esFacturasPorCliente(ds)) escribirFacturasPorClientePdf(doc, ds);
    else escribirDetallePdf(doc, ds, lineas);

    doc.end();
  });
}

/**
 * El PDF de la pestaña Facturas va por cliente, no por documento (pedido del
 * usuario, nov-2026): lo que se necesita es cuánto se le facturó a cada uno.
 */
const esFacturasPorCliente = (ds: Dataset) => ds.soloCategoria && ds.categorias[0]?.clave === "facturas";

/** Una fila por cliente con sus documentos y el total facturado, de mayor a menor. */
function escribirFacturasPorClientePdf(doc: PDFKit.PDFDocument, ds: Dataset) {
  const c = ds.categorias[0];
  if (!c?.documentos || c.documentos.length === 0) return;

  const porCliente = new Map<string, { codigo: string; cliente: string; documentos: number; neto: number; bruto: number }>();
  for (const d of c.documentos) {
    const clave = d.codigoCliente || d.cliente;
    const fila = porCliente.get(clave) ?? { codigo: d.codigoCliente, cliente: d.cliente, documentos: 0, neto: 0, bruto: 0 };
    if (!fila.cliente && d.cliente) fila.cliente = d.cliente;
    fila.documentos += 1;
    fila.neto += d.neto;
    fila.bruto += d.bruto;
    porCliente.set(clave, fila);
  }
  const filas = Array.from(porCliente.values()).sort((a, b) => b.neto - a.neto);

  const izquierda = 50;
  const ancho = doc.page.width - 100;
  const limite = () => doc.page.height - 60;
  const cCodigo = izquierda + 6;
  const cBruto = izquierda + ancho - 80;
  const cNeto = cBruto - 84;
  const cDocs = cNeto - 64;
  const cCliente = cCodigo + 76;
  const anchoCliente = cDocs - cCliente - 8;
  const unaLinea = { lineBreak: false } as const;
  const cabe = (t: string, w: number) => {
    if (doc.widthOfString(t) <= w) return t;
    let r = t;
    while (r.length > 1 && doc.widthOfString(`${r}…`) > w) r = r.slice(0, -1);
    return `${r.trimEnd()}…`;
  };

  let y = 50;
  const encabezado = () => {
    doc.rect(izquierda, y, ancho, 16).fill("#f3f4f6");
    doc.fillColor(GRIS).font("Helvetica-Bold").fontSize(7.5);
    doc.text("CÓDIGO", cCodigo, y + 5, unaLinea);
    doc.text("CLIENTE", cCliente, y + 5, unaLinea);
    doc.text("DOCUMENTOS", cDocs, y + 5, { width: 60, align: "right", ...unaLinea });
    doc.text("NETO", cNeto, y + 5, { width: 80, align: "right", ...unaLinea });
    doc.text("BRUTO", cBruto, y + 5, { width: 80, align: "right", ...unaLinea });
    y += 20;
  };

  doc.addPage();
  doc.rect(izquierda, y, 4, 22).fill(MARCA);
  doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(14).text(`${c.titulo}: total por cliente`, izquierda + 12, y + 3);
  y += 30;
  doc.fillColor(GRIS).font("Helvetica").fontSize(8);
  doc.text(cabe(`${etiquetaPeriodo(ds.desde, ds.hasta)} · ${ds.filtrosTexto}`, ancho), izquierda, y, { width: ancho, ...unaLinea });
  y += 12;
  doc.text(`${filas.length.toLocaleString("es-CL")} clientes · montos netos y brutos de lo facturado en el período.`, izquierda, y, { width: ancho, ...unaLinea });
  y += 18;
  encabezado();

  for (const f of filas) {
    if (y + 16 > limite()) {
      doc.addPage();
      y = 50;
      encabezado();
    }
    doc.fillColor(TINTA).font("Helvetica").fontSize(8.5);
    doc.text(cabe(f.codigo || "—", 72), cCodigo, y, { width: 72, ...unaLinea });
    doc.text(cabe(f.cliente || f.codigo || "—", anchoCliente), cCliente, y, { width: anchoCliente, ...unaLinea });
    doc.text(f.documentos.toLocaleString("es-CL"), cDocs, y, { width: 60, align: "right", ...unaLinea });
    doc.font("Helvetica-Bold").text(clp(f.neto), cNeto, y, { width: 80, align: "right", ...unaLinea });
    doc.font("Helvetica").text(clp(f.bruto), cBruto, y, { width: 80, align: "right", ...unaLinea });
    y += 12;
    doc.moveTo(izquierda, y).lineTo(izquierda + ancho, y).strokeColor(BORDE).lineWidth(0.5).stroke();
    y += 4;
  }

  if (y + 26 > limite()) {
    doc.addPage();
    y = 50;
  }
  y += 4;
  doc.rect(izquierda, y, ancho, 22).fill(FONDO_TOTAL);
  doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(9);
  doc.text("Total facturado", cCodigo, y + 7, unaLinea);
  doc.text(c.documentos.length.toLocaleString("es-CL"), cDocs, y + 7, { width: 60, align: "right", ...unaLinea });
  doc.fillColor(MARCA).text(clp(filas.reduce((s, f) => s + f.neto, 0)), cNeto, y + 7, { width: 80, align: "right", ...unaLinea });
  doc.fillColor(TINTA).text(clp(filas.reduce((s, f) => s + f.bruto, 0)), cBruto, y + 7, { width: 80, align: "right", ...unaLinea });
}

/** Una página por categoría con cada documento y sus productos. */
function escribirDetallePdf(doc: PDFKit.PDFDocument, ds: Dataset, lineas: Map<ClaveCategoria, LineasPorDocumento>) {
  const izquierda = 50;
  const ancho = doc.page.width - 100;
  const limite = () => doc.page.height - 60;
  // Columnas de las líneas: código, producto, cantidad, pendiente, precio, neto.
  const cCodigo = izquierda + 8;
  const cProducto = cCodigo + 70;
  const cNeto = izquierda + ancho - 70;
  const cPrecio = cNeto - 64;
  const cPendiente = cPrecio - 52;
  const cCantidad = cPendiente - 52;
  const anchoProducto = cCantidad - cProducto - 6;
  const unaLinea = { lineBreak: false } as const;
  // pdfkit solo corta con "…" si hay alto fijo: se recorta a mano para que nada salte de línea.
  const cabe = (t: string, w: number) => {
    if (doc.widthOfString(t) <= w) return t;
    let r = t;
    while (r.length > 1 && doc.widthOfString(`${r}…`) > w) r = r.slice(0, -1);
    return `${r.trimEnd()}…`;
  };

  let y = 0;
  const asegurar = (alto: number, alSaltar?: () => void) => {
    if (y + alto <= limite()) return;
    doc.addPage();
    y = 50;
    alSaltar?.();
  };

  for (const c of ds.categorias) {
    if (!c.documentos || c.documentos.length === 0) continue;
    const delGrupo = lineas.get(c.clave) ?? null;
    const conPendiente = c.clave === "nvv" || c.clave === "gdv";

    doc.addPage();
    y = 50;
    doc.rect(izquierda, y, 4, 22).fill(MARCA);
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(14).text(`${c.titulo}: detalle por documento`, izquierda + 12, y + 3);
    y += 30;
    doc.fillColor(GRIS).font("Helvetica").fontSize(8).text(cabe(`${etiquetaPeriodo(ds.desde, ds.hasta)} · ${ds.filtrosTexto}`, ancho), izquierda, y, { width: ancho, ...unaLinea });
    y += 12;
    if (conPendiente) {
      doc.text(NOTA_LINEAS, izquierda, y, { width: ancho });
      y = doc.y + 4;
    }
    if (!delGrupo) {
      doc.fillColor("#dc2626").text(NOTA_SIN_LINEAS, izquierda, y, { width: ancho });
      y = doc.y + 4;
    }
    y += 6;

    const encabezadoLineas = () => {
      doc.fillColor(GRIS).font("Helvetica-Bold").fontSize(7);
      doc.text("CÓDIGO", cCodigo, y, unaLinea);
      doc.text("PRODUCTO", cProducto, y, unaLinea);
      doc.text("CANTIDAD", cCantidad, y, { width: 48, align: "right", ...unaLinea });
      if (conPendiente) doc.text("PENDIENTE", cPendiente, y, { width: 48, align: "right", ...unaLinea });
      doc.text("PRECIO NETO", cPrecio, y, { width: 60, align: "right", ...unaLinea });
      doc.text("NETO", cNeto, y, { width: 70, align: "right", ...unaLinea });
      y += 11;
    };

    for (const d of c.documentos) {
      const productos = delGrupo?.get(d.id) ?? [];
      asegurar(delGrupo ? 40 : 20);
      doc.rect(izquierda, y, ancho, 16).fill("#f3f4f6");
      doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(8.5);
      doc.text(cabe(`${d.tipo} ${d.numero} · ${fechaCorta(d.fecha)} · Suc. ${nombreSucursal(d.sucursal)} · ${d.cliente || d.codigoCliente}`, ancho - 206), izquierda + 6, y + 4, { width: ancho - 200, ...unaLinea });
      doc.font("Helvetica").fillColor(GRIS).text(cabe(d.vendedor || "—", 110), izquierda + ancho - 190, y + 4, { width: 110, ...unaLinea });
      doc.font("Helvetica-Bold").fillColor(TINTA).text(clp(d.neto), cNeto, y + 4, { width: 64, align: "right", ...unaLinea });
      y += 20;
      if (!delGrupo) continue;
      if (productos.length === 0) {
        doc.fillColor(GRIS).font("Helvetica").fontSize(7.5).text("Sin líneas en el sistema de gestión.", cCodigo, y, unaLinea);
        y += 14;
        continue;
      }
      encabezadoLineas();
      for (const l of productos) {
        asegurar(11, encabezadoLineas);
        doc.fillColor(TINTA).font("Helvetica").fontSize(7.5);
        doc.text(cabe(l.codigo, 66), cCodigo, y, { width: 66, ...unaLinea });
        doc.text(cabe(l.producto, anchoProducto), cProducto, y, { width: anchoProducto, ...unaLinea });
        doc.text(`${l.cantidad.toLocaleString("es-CL")} ${l.unidad}`.trim(), cCantidad, y, { width: 48, align: "right", ...unaLinea });
        if (conPendiente) doc.text((l.pendiente ?? 0).toLocaleString("es-CL"), cPendiente, y, { width: 48, align: "right", ...unaLinea });
        doc.text(clp(l.precio), cPrecio, y, { width: 60, align: "right", ...unaLinea });
        doc.text(clp(l.neto), cNeto, y, { width: 70, align: "right", ...unaLinea });
        y += 11;
      }
      y += 6;
    }
  }
}

const COLUMNAS_LINEAS: { titulo: string; ancho: number }[] = [
  { titulo: "Tipo", ancho: 8 },
  { titulo: "N° documento", ancho: 16 },
  { titulo: "Fecha", ancho: 12 },
  { titulo: "Sucursal", ancho: 16 },
  { titulo: "Cliente", ancho: 40 },
  { titulo: "Vendedor", ancho: 28 },
  { titulo: "Código producto", ancho: 18 },
  { titulo: "Producto", ancho: 46 },
  { titulo: "Unidad", ancho: 9 },
  { titulo: "Cantidad", ancho: 11 },
  { titulo: "Pendiente", ancho: 11 },
  { titulo: "Precio neto", ancho: 14 },
  { titulo: "Neto", ancho: 15 },
  { titulo: "Bruto", ancho: 15 },
];

const COLUMNAS_DETALLE: { titulo: string; ancho: number }[] = [
  { titulo: "Tipo", ancho: 8 },
  { titulo: "N° documento", ancho: 16 },
  { titulo: "Fecha", ancho: 12 },
  { titulo: "Sucursal", ancho: 16 },
  { titulo: "Código cliente", ancho: 16 },
  { titulo: "Cliente", ancho: 44 },
  { titulo: "Vendedor", ancho: 30 },
  { titulo: "Segmento", ancho: 24 },
  { titulo: "Neto", ancho: 15 },
  { titulo: "Bruto", ancho: 15 },
];
const FORMATO_MONTO = '"$"#,##0';

function estilarEncabezado(fila: ExcelJS.Row) {
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFD6301" } };
  });
}

async function generarExcel(ds: Dataset, lineas: Map<ClaveCategoria, LineasPorDocumento>): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const periodo = etiquetaPeriodo(ds.desde, ds.hasta);

  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [{ width: 34 }, { width: 14 }, { width: 18 }];
  resumen.addRow([tituloInforme(ds)]).font = { bold: true, size: 14 };
  resumen.addRow(["Período consultado", periodo]);
  resumen.addRow(["Filtros", ds.filtrosTexto]);
  resumen.addRow([]);
  estilarEncabezado(resumen.addRow(["Categoría", "Documentos", "Total neto"]));
  for (const c of ds.categorias) {
    const monto = montoDe(c);
    const fila = resumen.addRow([c.titulo, c.documentos?.length ?? "—", monto ?? "No disponible"]);
    fila.getCell(3).numFmt = FORMATO_MONTO;
  }
  const { etiqueta, monto } = totalInforme(ds);
  const total = resumen.addRow([etiqueta, "", monto]);
  total.font = { bold: true };
  total.getCell(3).numFmt = FORMATO_MONTO;
  resumen.addRow([]);
  resumen.addRow([ds.soloCategoria ? NOTA_MONTOS : NOTA_CONSOLIDADO]);
  if (estaIncompleto(ds)) resumen.addRow([NOTA_INCOMPLETO]).font = { color: { argb: "FFDC2626" } };

  for (const c of ds.categorias) {
    const hoja = wb.addWorksheet(c.hoja);
    hoja.columns = COLUMNAS_DETALLE.map((col) => ({ width: col.ancho }));
    hoja.addRow(["Período consultado", periodo]);
    hoja.addRow(["Filtros", ds.filtrosTexto]);
    hoja.addRow([]);
    if (!c.documentos) {
      hoja.addRow(["No disponible: no se pudo consultar el sistema de gestión al generar este informe."]);
      continue;
    }
    const encabezado = hoja.addRow(COLUMNAS_DETALLE.map((col) => col.titulo));
    estilarEncabezado(encabezado);
    hoja.views = [{ state: "frozen", ySplit: encabezado.number }];
    for (const d of c.documentos) {
      const fila = hoja.addRow([d.tipo, d.numero, fechaCorta(d.fecha), nombreSucursal(d.sucursal), d.codigoCliente, d.cliente, d.vendedor, d.segmento, d.neto, d.bruto]);
      fila.getCell(9).numFmt = FORMATO_MONTO;
      fila.getCell(10).numFmt = FORMATO_MONTO;
    }
    const totalHoja = hoja.addRow([
      "Total", "", "", "", "", "", "", "",
      c.documentos.reduce((s, d) => s + d.neto, 0),
      c.documentos.reduce((s, d) => s + d.bruto, 0),
    ]);
    totalHoja.font = { bold: true };
    totalHoja.getCell(9).numFmt = FORMATO_MONTO;
    totalHoja.getCell(10).numFmt = FORMATO_MONTO;
  }

  // Una hoja de productos por categoría: una fila por línea, con los datos del documento repetidos para poder filtrar.
  for (const c of ds.categorias) {
    if (!c.documentos) continue;
    escribirHojaLineas(wb, `${c.hoja} - detalle`, c, c.documentos, lineas.get(c.clave) ?? null, periodo, ds.filtrosTexto);
  }

  // Con todas las sucursales, las notas de venta pendientes se separan además en una hoja por sucursal.
  const nvv = ds.categorias.find((c) => c.clave === "nvv");
  if (nvv?.documentos && ds.todasLasSucursales) {
    for (const { hoja, sucursal } of HOJAS_NVV_POR_SUCURSAL) {
      const filtros = ds.filtrosTexto.replace("Sucursal: Todas", `Sucursal: ${nombreSucursal(sucursal)}`);
      const documentos = nvv.documentos.filter((d) => d.sucursal === sucursal);
      escribirHojaLineas(wb, hoja, nvv, documentos, lineas.get("nvv") ?? null, periodo, filtros);
    }
  }

  return wb.xlsx.writeBuffer();
}

/** Hojas extra del Excel con las notas de venta pendientes de una sola sucursal. */
const HOJAS_NVV_POR_SUCURSAL = [
  { hoja: "Planta", sucursal: "004" },
  { hoja: "Store Concepción", sucursal: "007" },
];

function escribirHojaLineas(
  wb: ExcelJS.Workbook,
  nombre: string,
  c: Categoria,
  documentos: Documento[],
  delGrupo: LineasPorDocumento | null,
  periodo: string,
  filtrosTexto: string,
) {
  const conPendiente = c.clave === "nvv" || c.clave === "gdv";
  const columnas = COLUMNAS_LINEAS.filter((col) => conPendiente || col.titulo !== "Pendiente");
  const hoja = wb.addWorksheet(nombre);
  hoja.columns = columnas.map((col) => ({ width: col.ancho }));
  hoja.addRow(["Período consultado", periodo]);
  hoja.addRow(["Filtros", filtrosTexto]);
  if (conPendiente) hoja.addRow([NOTA_LINEAS]);
  hoja.addRow([]);
  if (!delGrupo) {
    hoja.addRow([NOTA_SIN_LINEAS]).font = { color: { argb: "FFDC2626" } };
    return;
  }
  const encabezado = hoja.addRow(columnas.map((col) => col.titulo));
  estilarEncabezado(encabezado);
  hoja.views = [{ state: "frozen", ySplit: encabezado.number }];
  const montos = columnas.length - 3; // precio, neto y bruto son las tres últimas
  let totalNeto = 0;
  let totalBruto = 0;
  for (const d of documentos) {
    for (const l of delGrupo.get(d.id) ?? []) {
      const valores: (string | number)[] = [d.tipo, d.numero, fechaCorta(d.fecha), nombreSucursal(d.sucursal), d.cliente || d.codigoCliente, d.vendedor, l.codigo, l.producto, l.unidad, l.cantidad];
      if (conPendiente) valores.push(l.pendiente ?? 0);
      valores.push(l.precio, l.neto, l.bruto);
      const fila = hoja.addRow(valores);
      for (let i = montos + 1; i <= columnas.length; i++) fila.getCell(i).numFmt = FORMATO_MONTO;
      totalNeto += l.neto;
      totalBruto += l.bruto;
    }
  }
  const total = hoja.addRow([...Array(columnas.length - 2).fill(""), totalNeto, totalBruto]);
  total.getCell(1).value = "Total";
  total.font = { bold: true };
  total.getCell(columnas.length - 1).numFmt = FORMATO_MONTO;
  total.getCell(columnas.length).numFmt = FORMATO_MONTO;
}

export function registerDetalleFacturacionRoutes(app: Express) {
  const conPeriodo = (manejar: (ds: Dataset, res: any, req: any) => Promise<unknown>) => async (req: any, res: any) => {
    const periodo = leerPeriodo(req.query);
    if ("error" in periodo) return res.status(400).json({ message: periodo.error });
    try {
      await manejar(await cargarDataset(periodo.desde, periodo.hasta, leerFiltros(req.query)), res, req);
    } catch (error: any) {
      console.error("[detalle-facturacion] Error:", error);
      // Si el archivo ya empezó a enviarse no se puede responder JSON: se corta.
      if (res.headersSent) return res.end();
      res.status(500).json({ message: "No se pudo obtener el detalle de facturación" });
    }
  };

  app.get(
    "/api/detalle-facturacion/resumen",
    requireRoles(ROLES_PERMITIDOS),
    conPeriodo(async (ds, res) => {
      res.json({
        actualizadoEn: new Date().toISOString(),
        desde: ds.desde,
        hasta: ds.hasta,
        categorias: ds.categorias.map((c) => ({
          clave: c.clave,
          titulo: c.titulo,
          monto: montoDe(c),
          documentos: c.documentos?.length ?? null,
        })),
        consolidado: consolidadoDe(ds),
        incompleto: estaIncompleto(ds),
        opciones: ds.opciones,
      });
    }),
  );

  app.get(
    "/api/detalle-facturacion/documentos",
    requireRoles(ROLES_PERMITIDOS),
    conPeriodo(async (ds, res, req) => {
      const categoria = ds.categorias.find((c) => c.clave === req.query.categoria);
      if (!categoria) return res.status(400).json({ message: "La categoría no es válida" });
      res.json({ documentos: categoria.documentos });
    }),
  );

  // Las líneas de un documento, para desplegarlas al pincharlo en la tabla.
  app.get("/api/detalle-facturacion/lineas", requireRoles(ROLES_PERMITIDOS), async (req: any, res: any) => {
    const clave = req.query.categoria as ClaveCategoria;
    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (!["nvv", "gdv", "facturas", "ncv"].includes(clave)) return res.status(400).json({ message: "La categoría no es válida" });
    if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ message: "El documento no es válido" });
    try {
      const lineas = await cargarLineas(clave, [id]);
      res.json({ lineas: lineas.get(id) ?? [] });
    } catch (error: any) {
      console.error("[detalle-facturacion] Error al leer líneas:", error?.message);
      res.status(500).json({ message: "No se pudo leer el detalle del documento" });
    }
  });

  app.get(
    "/api/detalle-facturacion/pdf",
    requireRoles(ROLES_PERMITIDOS),
    conPeriodo(async (ds, res) => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo(ds, "pdf")}"`);
      // Por cliente no lleva productos: no hace falta leerlos.
      const lineas = esFacturasPorCliente(ds) ? new Map<ClaveCategoria, LineasPorDocumento>() : await cargarLineasDataset(ds);
      await generarPdf(res, ds, lineas);
    }),
  );

  app.get(
    "/api/detalle-facturacion/excel",
    requireRoles(ROLES_PERMITIDOS),
    conPeriodo(async (ds, res) => {
      const archivo = await generarExcel(ds, await cargarLineasDataset(ds));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo(ds, "xlsx")}"`);
      res.send(Buffer.from(archivo as ArrayBuffer));
    }),
  );
}
