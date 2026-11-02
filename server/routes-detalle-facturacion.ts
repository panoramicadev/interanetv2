/**
 * Detalle facturación NVV y GDV: lo ingresado y emitido en un período, por tipo
 * de documento, para los paneles de admin y recepción.
 *
 * De dónde sale cada indicador:
 *
 *   Notas de venta   → MAEEDO de Random, leído al momento. El espejo nvv.fact_nvv
 *                      NO sirve acá: solo guarda las notas abiertas, y las ya
 *                      despachadas (la gran mayoría) desaparecen de él.
 *   Guías, facturas  → ventas.fact_ventas. Tampoco se usa gdv.fact_gdv, que
 *   y notas de crédito  guarda únicamente las guías pendientes de facturar.
 *
 * Los montos van netos, igual que en el dashboard. Las facturas menos las notas
 * de crédito del período dan las ventas que muestra el dashboard.
 *
 * El consolidado es la suma simple de los cuatro, con las notas de crédito en
 * positivo: mide volumen de movimientos, como pidió el área, no ventas. Una
 * misma venta puede aparecer como nota, guía y factura.
 *
 * Resumen, PDF y Excel salen de los mismos documentos (`cargarDataset`), para
 * que lo descargado siempre coincida con lo que se ve en pantalla.
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
const SUCURSALES_NVV = ["004", "005", "006", "007"];
/** Hay clientes sin segmento en el ERP: sin esta opción, sus montos no saldrían en ningún filtro. */
const SIN_SEGMENTO = "Sin segmento";

const MARCA = "#fd6301";
const TINTA = "#17181c";
const GRIS = "#6b7280";
const BORDE = "#e5e7eb";
const FONDO_TOTAL = "#fff7ed";

type ClaveCategoria = "nvv" | "gdv" | "facturas" | "ncv";

interface Documento {
  tipo: string;
  numero: string;
  fecha: string;
  codigoCliente: string;
  cliente: string;
  vendedor: string;
  segmento: string;
  neto: number;
  bruto: number;
}

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
}

interface Dataset {
  desde: string;
  hasta: string;
  categorias: Categoria[];
  /** Lo que se puede elegir en el período, sin aplicar los filtros. */
  opciones: { vendedores: string[]; clientes: { codigo: string; nombre: string }[]; segmentos: string[] };
  /** Los filtros del informe, en palabras: siempre los tres, también los que están en "Todos". */
  filtrosTexto: string;
}

const montoDe = (c: Categoria) => c.documentos?.reduce((s, d) => s + d.neto, 0) ?? null;
const consolidadoDe = (ds: Dataset) => ds.categorias.reduce((s, c) => s + (montoDe(c) ?? 0), 0);
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
  return { vendedor: valor(query.vendedor), cliente: valor(query.cliente), segmento: valor(query.segmento) };
}

const nombreSegmento = (v: unknown) => String(canonicalSegmentName(texto(v))) || SIN_SEGMENTO;

async function notasDeVentaDelErp(desde: string, hasta: string): Promise<Documento[]> {
  const req = (await erp()).request();
  req.input("desde", mssql.Date, new Date(`${desde}T00:00:00Z`));
  req.input("hasta", mssql.Date, new Date(`${hasta}T00:00:00Z`));
  const sucursales = SUCURSALES_NVV.map((s) => `'${s}'`).join(",");
  // MAEEN tiene una fila por sucursal del cliente: con un JOIN directo, cada nota
  // se contaría una vez por sucursal. Por eso OUTER APPLY con TOP 1.
  const r = await req.query(`
    SELECT ed.NUDO, CONVERT(varchar(10), ed.FEEMDO, 23) AS FECHA, ed.ENDO, en.NOKOEN, fu.NOKOFU,
           ru.NOKORU, ed.VANEDO, ed.VABRDO
    FROM dbo.MAEEDO ed
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
    WHERE ed.TIDO = 'NVV'
      AND ed.SUDO IN (${sucursales})
      AND ed.FEEMDO >= @desde
      AND ed.FEEMDO < DATEADD(day, 1, @hasta)
    ORDER BY ed.FEEMDO, ed.NUDO
  `);
  return r.recordset.map((f: any) => ({
    tipo: "NVV",
    numero: texto(f.NUDO),
    fecha: f.FECHA,
    codigoCliente: texto(f.ENDO),
    cliente: texto(f.NOKOEN),
    vendedor: texto(f.NOKOFU),
    segmento: nombreSegmento(f.NOKORU),
    neto: numero(f.VANEDO),
    bruto: numero(f.VABRDO),
  }));
}

/** Guías, facturas y notas de crédito, una fila por documento (fact_ventas viene por línea). */
async function documentosDeVentas(desde: string, hasta: string): Promise<Documento[]> {
  const r: any = await db.execute(sql`
    SELECT tido,
           MAX(nudo)::text AS numero,
           MAX(feemdo)::text AS fecha,
           MAX(endo) AS codigo_cliente,
           MAX(nokoen) AS cliente,
           MAX(nokofu) AS vendedor,
           MAX(noruen) AS segmento,
           ABS(SUM(vaneli)) AS neto,
           ABS(MAX(vabrdo)) AS bruto
    FROM ventas.fact_ventas
    WHERE feemdo >= ${desde}::date AND feemdo <= ${hasta}::date
    GROUP BY idmaeedo, tido
    ORDER BY MAX(feemdo), MAX(nudo)
  `);
  return (r.rows ?? r).map((f: any) => ({
    tipo: texto(f.tido),
    numero: texto(f.numero),
    fecha: f.fecha,
    codigoCliente: texto(f.codigo_cliente),
    cliente: texto(f.cliente),
    vendedor: texto(f.vendedor),
    segmento: nombreSegmento(f.segmento),
    neto: numero(f.neto),
    bruto: numero(f.bruto),
  }));
}

async function cargarDataset(desde: string, hasta: string, filtros: Filtros = {}): Promise<Dataset> {
  const [nvv, ventas] = await Promise.all([
    // Si Random no responde, el resto del panel sigue sirviendo: la tarjeta de
    // notas de venta avisa que no está disponible en vez de mostrar un $0 falso.
    notasDeVentaDelErp(desde, hasta).catch((e) => {
      console.error("[detalle-facturacion] No se pudo leer notas de venta del ERP:", e?.message);
      return null;
    }),
    documentosDeVentas(desde, hasta),
  ]);

  const todos = [...(nvv ?? []), ...ventas];
  const clientes = new Map<string, string>();
  for (const d of todos) {
    if (d.codigoCliente && !clientes.has(d.codigoCliente)) clientes.set(d.codigoCliente, d.cliente || d.codigoCliente);
  }
  const opciones = {
    vendedores: Array.from(new Set(todos.map((d) => d.vendedor).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")),
    clientes: Array.from(clientes, ([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    // "Sin segmento" va al final: no es un segmento, es lo que falta clasificar.
    segmentos: Array.from(new Set(todos.map((d) => d.segmento))).sort((a, b) =>
      a === SIN_SEGMENTO ? 1 : b === SIN_SEGMENTO ? -1 : a.localeCompare(b, "es"),
    ),
  };

  const pasa = (d: Documento) =>
    (!filtros.vendedor || d.vendedor === filtros.vendedor) &&
    (!filtros.cliente || d.codigoCliente === filtros.cliente) &&
    (!filtros.segmento || d.segmento === filtros.segmento);
  const ventasFiltradas = ventas.filter(pasa);

  const filtrosTexto = [
    `Segmento: ${filtros.segmento ?? "Todos"}`,
    `Vendedor: ${filtros.vendedor ?? "Todos"}`,
    `Cliente: ${filtros.cliente ? clientes.get(filtros.cliente) ?? filtros.cliente : "Todos"}`,
  ].join(" · ");

  return {
    desde,
    hasta,
    opciones,
    filtrosTexto,
    categorias: [
      { clave: "nvv", titulo: "Notas de venta", hoja: "Notas de venta", documentos: nvv && nvv.filter(pasa) },
      { clave: "gdv", titulo: "Guías de despacho", hoja: "Guías de despacho", documentos: ventasFiltradas.filter((d) => d.tipo === "GDV") },
      { clave: "facturas", titulo: "Total facturado", hoja: "Facturas", documentos: ventasFiltradas.filter((d) => d.tipo !== "GDV" && d.tipo !== "NCV") },
      { clave: "ncv", titulo: "Notas de crédito", hoja: "Notas de crédito", documentos: ventasFiltradas.filter((d) => d.tipo === "NCV") },
    ],
  };
}

const nombreArchivo = (ds: Dataset, ext: string) => `detalle-facturacion_${ds.desde}_${ds.hasta}.${ext}`;

const NOTA_CONSOLIDADO =
  "El consolidado suma los cuatro totales y mide volumen de movimientos: una misma venta puede aparecer como nota, guía y factura. Montos netos, sin IVA.";
const NOTA_INCOMPLETO =
  "Las notas de venta no estuvieron disponibles al generar este informe: el consolidado no las incluye.";

function generarPdf(salida: NodeJS.WritableStream, ds: Dataset): Promise<void> {
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
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(18).text("Detalle facturación NVV y GDV", izquierda + 16, 50);
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
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(12).text("Total consolidado del período", izquierda + 10, y + 13);
    doc.fillColor(MARCA).fontSize(14).text(clp(consolidadoDe(ds)), colMonto - 10, y + 12, { width: 140, align: "right" });
    y += 54;

    doc.fillColor(GRIS).font("Helvetica").fontSize(9);
    doc.text(NOTA_CONSOLIDADO, izquierda, y, { width: ancho });
    if (estaIncompleto(ds)) {
      doc.moveDown(0.5).fillColor("#dc2626").text(NOTA_INCOMPLETO, izquierda, doc.y, { width: ancho });
    }
    const generado = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
    doc.moveDown(1).fillColor(GRIS).text(`Generado el ${generado}`, izquierda, doc.y, { width: ancho });

    doc.end();
  });
}

const COLUMNAS_DETALLE: { titulo: string; ancho: number }[] = [
  { titulo: "Tipo", ancho: 8 },
  { titulo: "N° documento", ancho: 16 },
  { titulo: "Fecha", ancho: 12 },
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

async function generarExcel(ds: Dataset): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const periodo = etiquetaPeriodo(ds.desde, ds.hasta);

  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [{ width: 34 }, { width: 14 }, { width: 18 }];
  resumen.addRow(["Detalle facturación NVV y GDV"]).font = { bold: true, size: 14 };
  resumen.addRow(["Período consultado", periodo]);
  resumen.addRow(["Filtros", ds.filtrosTexto]);
  resumen.addRow([]);
  estilarEncabezado(resumen.addRow(["Categoría", "Documentos", "Total neto"]));
  for (const c of ds.categorias) {
    const monto = montoDe(c);
    const fila = resumen.addRow([c.titulo, c.documentos?.length ?? "—", monto ?? "No disponible"]);
    fila.getCell(3).numFmt = FORMATO_MONTO;
  }
  const total = resumen.addRow(["Total consolidado del período", "", consolidadoDe(ds)]);
  total.font = { bold: true };
  total.getCell(3).numFmt = FORMATO_MONTO;
  resumen.addRow([]);
  resumen.addRow([NOTA_CONSOLIDADO]);
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
      const fila = hoja.addRow([d.tipo, d.numero, fechaCorta(d.fecha), d.codigoCliente, d.cliente, d.vendedor, d.segmento, d.neto, d.bruto]);
      fila.getCell(8).numFmt = FORMATO_MONTO;
      fila.getCell(9).numFmt = FORMATO_MONTO;
    }
    const totalHoja = hoja.addRow([
      "Total", "", "", "", "", "", "",
      c.documentos.reduce((s, d) => s + d.neto, 0),
      c.documentos.reduce((s, d) => s + d.bruto, 0),
    ]);
    totalHoja.font = { bold: true };
    totalHoja.getCell(8).numFmt = FORMATO_MONTO;
    totalHoja.getCell(9).numFmt = FORMATO_MONTO;
  }

  return wb.xlsx.writeBuffer();
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

  app.get(
    "/api/detalle-facturacion/pdf",
    requireRoles(ROLES_PERMITIDOS),
    conPeriodo(async (ds, res) => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo(ds, "pdf")}"`);
      await generarPdf(res, ds);
    }),
  );

  app.get(
    "/api/detalle-facturacion/excel",
    requireRoles(ROLES_PERMITIDOS),
    conPeriodo(async (ds, res) => {
      const archivo = await generarExcel(ds);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo(ds, "xlsx")}"`);
      res.send(Buffer.from(archivo as ArrayBuffer));
    }),
  );
}
