/**
 * Libro de comisiones en el formato de la liquidación que firma el vendedor.
 *
 * Una hoja por vendedor con el machote de siempre (logo, ventas por cliente,
 * bloque de margen, comisión, semana corrida y firmas) y, detrás, las cuatro
 * hojas de respaldo con el detalle que muestra la pantalla.
 *
 * La comisión de la liquidación va sobre el MARGEN NETO —sin descontar la
 * regularización de flete— por decisión del negocio: el papel que se firma
 * mantiene el cálculo histórico. Las hojas de respaldo sí traen el margen
 * ajustado, que es la base con la que el módulo calcula en pantalla.
 */
import ExcelJS from "exceljs";
import { diasSemanaCorrida } from "./feriados-chile";
import fs from "fs";
import path from "path";

const EMPRESA = "PINTURERIA PANORAMICA LTDA.";

const MONEDA = '_ "$"* #,##0_ ;_ "$"* -#,##0_ ;_ "$"* "-"_ ;_ @_ ';
const PORCENTAJE = "0%";
const BORDE_FINO = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "agosto-25" cuando el rango es un mes completo; si no, "01-08-25 al 15-08-25". */
function etiquetaPeriodo(startDate: string, endDate: string): string {
  const desde = new Date(`${startDate}T00:00:00`);
  const hasta = new Date(`${endDate}T00:00:00`);
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) return `${startDate} al ${endDate}`;
  const finDeMes = new Date(desde.getFullYear(), desde.getMonth() + 1, 0);
  const esMesCompleto =
    desde.getDate() === 1 &&
    hasta.getFullYear() === finDeMes.getFullYear() &&
    hasta.getMonth() === finDeMes.getMonth() &&
    hasta.getDate() === finDeMes.getDate();
  const corta = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(2)}`;
  return esMesCompleto
    ? `${MESES[desde.getMonth()]}-${String(desde.getFullYear()).slice(2)}`
    : `${corta(desde)} al ${corta(hasta)}`;
}

// Ancho del logo en la hoja (px). El alto sale del PNG para no deformarlo.
const LOGO_ANCHO = 158;

/** Alto proporcional leyendo el IHDR del PNG; si no se puede, cae en 3:1. */
function altoLogo(png: Buffer): number {
  try {
    const ancho = png.readUInt32BE(16);
    const alto = png.readUInt32BE(20);
    if (ancho > 0 && alto > 0) return Math.round((LOGO_ANCHO * alto) / ancho);
  } catch {
    /* usa el fallback */
  }
  return Math.round(LOGO_ANCHO / 3);
}

/** El logo vive en public/; según el entorno el build lo deja en dist o en client. */
function leerLogo(): Buffer | null {
  const candidatos = [
    path.resolve(process.cwd(), "dist/public/panoramica-logo.png"),
    path.resolve(process.cwd(), "client/public/panoramica-logo.png"),
    path.resolve(process.cwd(), "public/panoramica-logo.png"),
  ];
  for (const ruta of candidatos) {
    try {
      if (fs.existsSync(ruta)) return fs.readFileSync(ruta);
    } catch {
      /* si no se puede leer, la hoja sale sin logo */
    }
  }
  return null;
}

/** Excel no acepta : \ / ? * [ ] en el nombre de la hoja, y corta en 31. */
function nombreHoja(salesperson: string, usados: Set<string>): string {
  const base = (salesperson || "VENDEDOR").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "VENDEDOR";
  let nombre = base;
  let n = 2;
  while (usados.has(nombre.toLowerCase())) {
    const sufijo = ` (${n++})`;
    nombre = base.slice(0, 31 - sufijo.length) + sufijo;
  }
  usados.add(nombre.toLowerCase());
  return nombre;
}

const round = (n: number) => Math.round(n || 0);

function formatFecha(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Hoja de liquidación de un vendedor, calcada del formato en papel. */
function agregarHojaLiquidacion(
  wb: ExcelJS.Workbook,
  item: any,
  clientes: any[],
  periodo: string,
  startDate: string,
  endDate: string,
  logo: { id: number; alto: number } | null,
  usados: Set<string>,
) {
  const ws = wb.addWorksheet(nombreHoja(item.salesperson, usados));
  ws.views = [{ showGridLines: false }];
  // Es un documento que se imprime y se firma: tiene que caber en una hoja.
  ws.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  ws.columns = [
    { width: 1.5 }, { width: 6 }, { width: 12 }, { width: 39.7 }, { width: 16.3 },
    { width: 18.1 }, { width: 15.3 }, { width: 12.4 }, { width: 10.9 }, { width: 9.1 },
  ];

  if (logo) {
    ws.addImage(logo.id, { tl: { col: 1, row: 0 }, ext: { width: LOGO_ANCHO, height: logo.alto } });
  }

  const titulo = (celda: string, valor: string) => {
    const c = ws.getCell(celda);
    c.value = valor;
    c.font = { name: "Arial Narrow", size: 9, bold: true };
  };
  titulo("D6", `VENTAS PROPIAS ${item.salesperson}`);
  titulo("D7", EMPRESA);
  titulo("D8", periodo);

  // ── Ventas por cliente ──
  const FILA_ENCABEZADO = 10;
  const encabezados = ["", "KOFULIDO", "ENDO", "CLIENTE", "VALORNETO"];
  encabezados.forEach((texto, i) => {
    const c = ws.getCell(FILA_ENCABEZADO, i + 1);
    if (texto) c.value = texto;
    c.font = { name: "Arial Narrow", size: 9, bold: true };
    c.alignment = { horizontal: "center" };
    c.border = BORDE_FINO;
  });

  let fila = FILA_ENCABEZADO + 1;
  for (const cli of clientes) {
    const valores = [null, cli.salespersonCode || "", cli.rut || "", cli.client, round(cli.revenue)];
    valores.forEach((valor, i) => {
      const c = ws.getCell(fila, i + 1);
      if (valor !== null) c.value = valor as any;
      c.font = { name: "Arial", size: 8 };
      c.border = BORDE_FINO;
      if (i === 4) c.numFmt = MONEDA;
    });
    fila++;
  }
  const filaTotal = fila;
  const celdaTotal = ws.getCell(filaTotal, 5);
  celdaTotal.value = clientes.length
    ? { formula: `SUM(E${FILA_ENCABEZADO + 1}:E${filaTotal - 1})`, result: round(item.netRevenue) }
    : 0;
  celdaTotal.font = { name: "Arial Narrow", size: 8, bold: true };
  celdaTotal.numFmt = '"$"#,##0_);[Red]("$"#,##0)';
  celdaTotal.border = { left: BORDE_FINO.left, right: BORDE_FINO.right, bottom: BORDE_FINO.bottom };
  ws.getRow(filaTotal).height = 15.6;

  // ── Bloque de margen del período ──
  const filaResumen = filaTotal + 2;
  ["VALORNETO", "COSTO", "MARGEN", "%"].forEach((texto, i) => {
    const c = ws.getCell(filaResumen, i + 5);
    c.value = texto;
    c.font = { name: "Arial Narrow", size: 9, bold: true };
    c.alignment = { horizontal: "center" };
    c.border = BORDE_FINO;
  });

  const filaValores = filaResumen + 1;
  const etiqueta = ws.getCell(filaValores, 4);
  etiqueta.value = periodo;
  etiqueta.font = { name: "Arial", size: 10, bold: true };
  const valoresResumen: [number, string][] = [
    [round(item.netRevenue), MONEDA],
    [round(item.netCost), MONEDA],
    [round(item.netMargin), MONEDA],
    [item.netRevenue !== 0 ? item.netMargin / item.netRevenue : 0, PORCENTAJE],
  ];
  valoresResumen.forEach(([valor, fmt], i) => {
    const c = ws.getCell(filaValores, i + 5);
    c.value = valor;
    c.numFmt = fmt;
    c.font = { name: "Arial", size: 11, bold: true };
    c.border = BORDE_FINO;
  });
  ws.getRow(filaResumen).height = 15.6;
  ws.getRow(filaValores).height = 15.6;

  // ── Comisión y semana corrida ──
  const filaComision = filaValores + 2;
  const filaSemana = filaComision + 1;
  const comision = round(item.netMargin) * (item.commissionPct / 100);
  const grande = { name: "Arial", size: 12, bold: true };

  ws.getCell(filaComision, 4).value = "COMISION";
  ws.getCell(filaComision, 5).value = round(item.netMargin);
  ws.getCell(filaComision, 6).value = item.commissionPct / 100;
  ws.getCell(filaComision, 7).value = { formula: `E${filaComision}*F${filaComision}`, result: comision };

  // Días del período, no constantes: el divisor y el multiplicador cambian mes a
  // mes según dónde caen los domingos y los feriados — ver server/feriados-chile.ts.
  const dsc = diasSemanaCorrida(startDate, endDate);
  ws.getCell(filaSemana, 4).value = "SEMANA CORRIDA";
  ws.getCell(filaSemana, 5).value = {
    formula: `G${filaComision}/${dsc.diasLaborables}`,
    result: comision / dsc.diasLaborables,
  };
  ws.getCell(filaSemana, 6).value = dsc.domingosYFestivos;
  ws.getCell(filaSemana, 7).value = {
    formula: `F${filaSemana}*E${filaSemana}`,
    result: (comision / dsc.diasLaborables) * dsc.domingosYFestivos,
  };

  for (const f of [filaComision, filaSemana]) {
    for (let col = 4; col <= 7; col++) ws.getCell(f, col).font = grande;
    ws.getCell(f, 5).numFmt = MONEDA;
    ws.getCell(f, 7).numFmt = MONEDA;
    ws.getRow(f).height = 15.6;
  }
  ws.getCell(filaComision, 6).numFmt = PORCENTAJE;
  ws.getCell(filaSemana, 6).numFmt = "0";

  // ── Firmas ──
  const filaFirmas = filaSemana + 10;
  const firma = (col: number, ancho: number, colTexto: number, texto: string) => {
    for (let i = 0; i < ancho; i++) {
      const c = ws.getCell(filaFirmas, col + i);
      c.border = { top: BORDE_FINO.top };
      c.font = { name: "Arial Narrow", size: 12, bold: true };
      c.alignment = { horizontal: "center" };
    }
    ws.getCell(filaFirmas, colTexto).value = texto;
  };
  firma(2, 3, 3, "FIRMA TRABAJADOR");
  firma(7, 2, 7, "FIRMA EMPLEADOR");
  ws.getRow(filaFirmas).height = 15.6;
}

/** Hoja de respaldo: encabezado naranja de marca y anchos fijos. */
function agregarHojaDetalle(
  wb: ExcelJS.Workbook,
  nombre: string,
  columnas: Partial<ExcelJS.Column>[],
  filas: any[],
) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columnas as ExcelJS.Column[];
  const encabezado = ws.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFD6301" } };
  for (const fila of filas) ws.addRow(fila);
}

/**
 * Arma el libro completo. `salesperson` limita la exportación a un vendedor
 * (el filtro de la pantalla); sin él salen todos los del período.
 */
export async function buildCommissionWorkbook(data: any, salesperson?: string): Promise<ExcelJS.Workbook> {
  const soloUno = (nombre: string) => !salesperson || nombre === salesperson;
  const items = (data.summary.items as any[]).filter((it) => soloUno(it.salesperson));
  const clients = (data.clients as any[]).filter((c) => soloUno(c.salesperson));
  const documents = (data.documents as any[]).filter((d) => soloUno(d.salesperson));
  const lines = (data.lines as any[]).filter((l) => soloUno(l.salesperson));

  const wb = new ExcelJS.Workbook();
  wb.creator = EMPRESA;
  wb.created = new Date();

  const logoPng = leerLogo();
  const logo = logoPng
    ? { id: wb.addImage({ buffer: logoPng as any, extension: "png" }), alto: altoLogo(logoPng) }
    : null;
  const periodo = etiquetaPeriodo(data.startDate, data.endDate);

  // ── Liquidaciones (una hoja por vendedor) ──
  const usados = new Set<string>();
  for (const item of items) {
    const suyos = clients
      .filter((c) => c.salesperson === item.salesperson)
      .sort((a, b) => String(a.rut || "").localeCompare(String(b.rut || "")));
    agregarHojaLiquidacion(wb, item, suyos, periodo, data.startDate, data.endDate, logo, usados);
  }

  // ── Respaldo: los mismos números que muestra la pantalla ──
  const resumen = items.map((it) => ({
    vendedor: it.salesperson,
    netRevenue: round(it.netRevenue),
    netCost: round(it.netCost),
    netMargin: round(it.netMargin),
    marginPct: Number(it.netMarginPct.toFixed(2)),
    fleteCobrado: round(it.fleteCobrado),
    fleteObjetivo: round(it.fleteObjetivo),
    fleteDeficit: round(it.fleteDeficit),
    marginAdjusted: round(it.marginAdjusted),
    commissionPct: it.commissionPct,
    commissionRaw: round(it.commissionRaw),
    commissionAmount: round(it.commissionAmount),
  }));
  const totales = items.reduce(
    (acc, it) => ({
      netRevenue: acc.netRevenue + it.netRevenue,
      netCost: acc.netCost + it.netCost,
      netMargin: acc.netMargin + it.netMargin,
      fleteCobrado: acc.fleteCobrado + it.fleteCobrado,
      fleteObjetivo: acc.fleteObjetivo + it.fleteObjetivo,
      fleteDeficit: acc.fleteDeficit + it.fleteDeficit,
      marginAdjusted: acc.marginAdjusted + it.marginAdjusted,
      commissionRaw: acc.commissionRaw + it.commissionRaw,
      commissionAmount: acc.commissionAmount + it.commissionAmount,
    }),
    { netRevenue: 0, netCost: 0, netMargin: 0, fleteCobrado: 0, fleteObjetivo: 0,
      fleteDeficit: 0, marginAdjusted: 0, commissionRaw: 0, commissionAmount: 0 },
  );
  resumen.push({
    vendedor: "TOTAL",
    netRevenue: round(totales.netRevenue),
    netCost: round(totales.netCost),
    netMargin: round(totales.netMargin),
    marginPct: totales.netRevenue !== 0 ? Number(((totales.netMargin / totales.netRevenue) * 100).toFixed(2)) : 0,
    fleteCobrado: round(totales.fleteCobrado),
    fleteObjetivo: round(totales.fleteObjetivo),
    fleteDeficit: round(totales.fleteDeficit),
    marginAdjusted: round(totales.marginAdjusted),
    commissionPct: "" as any,
    commissionRaw: round(totales.commissionRaw),
    commissionAmount: round(totales.commissionAmount),
  });

  agregarHojaDetalle(wb, "Resumen", [
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "Facturado neto (FCV − NCV)", key: "netRevenue", width: 24, style: { numFmt: MONEDA } },
    { header: "Costo neto", key: "netCost", width: 14, style: { numFmt: MONEDA } },
    { header: "Margen neto", key: "netMargin", width: 14, style: { numFmt: MONEDA } },
    { header: "% Margen", key: "marginPct", width: 10 },
    { header: "Flete cobrado", key: "fleteCobrado", width: 14, style: { numFmt: MONEDA } },
    { header: "Flete objetivo", key: "fleteObjetivo", width: 14, style: { numFmt: MONEDA } },
    { header: "Regularización flete", key: "fleteDeficit", width: 18, style: { numFmt: MONEDA } },
    { header: "Margen ajustado", key: "marginAdjusted", width: 16, style: { numFmt: MONEDA } },
    { header: "% Comisión", key: "commissionPct", width: 12 },
    { header: "Comisión calculada", key: "commissionRaw", width: 18, style: { numFmt: MONEDA } },
    { header: "Comisión a pagar", key: "commissionAmount", width: 16, style: { numFmt: MONEDA } },
  ], resumen);

  agregarHojaDetalle(wb, "Clientes", [
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "RUT", key: "rut", width: 14 },
    { header: "Cliente", key: "cliente", width: 34 },
    { header: "Facturado neto", key: "revenue", width: 16, style: { numFmt: MONEDA } },
    { header: "Costo", key: "cost", width: 14, style: { numFmt: MONEDA } },
    { header: "Margen", key: "margin", width: 14, style: { numFmt: MONEDA } },
    { header: "Flete cobrado", key: "fleteCobrado", width: 14, style: { numFmt: MONEDA } },
    { header: "% Flete", key: "fletePct", width: 9 },
    { header: "Flete objetivo", key: "fleteObjetivo", width: 14, style: { numFmt: MONEDA } },
    { header: "Regularización flete", key: "fleteDeficit", width: 18, style: { numFmt: MONEDA } },
    { header: "Margen ajustado", key: "marginAdjusted", width: 16, style: { numFmt: MONEDA } },
    { header: "% Comisión", key: "commissionPct", width: 12 },
    { header: "Comisión", key: "commission", width: 14, style: { numFmt: MONEDA } },
    { header: "Líneas", key: "lineCount", width: 8 },
  ], clients.map((c) => ({
    vendedor: c.salesperson,
    rut: c.rut || "",
    cliente: c.client,
    revenue: round(c.revenue),
    cost: round(c.cost),
    margin: round(c.margin),
    fleteCobrado: round(c.fleteCobrado),
    fletePct: c.fleteEffectivePct,
    fleteObjetivo: round(c.fleteObjetivo),
    fleteDeficit: round(c.fleteDeficit),
    marginAdjusted: round(c.marginAdjusted),
    commissionPct: c.effectivePct,
    commission: round(c.marginAdjusted * c.effectivePct / 100),
    lineCount: c.lineCount,
  })));

  agregarHojaDetalle(wb, "Documentos", [
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "Tipo", key: "tido", width: 7 },
    { header: "Documento", key: "numero", width: 12 },
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Cliente", key: "cliente", width: 34 },
    { header: "Neto", key: "revenue", width: 14, style: { numFmt: MONEDA } },
    { header: "Costo", key: "cost", width: 14, style: { numFmt: MONEDA } },
    { header: "Margen", key: "margin", width: 14, style: { numFmt: MONEDA } },
    { header: "Flete cobrado", key: "fleteCobrado", width: 14, style: { numFmt: MONEDA } },
    { header: "% Flete", key: "fletePct", width: 9 },
    { header: "Flete objetivo", key: "fleteObjetivo", width: 14, style: { numFmt: MONEDA } },
    { header: "Regularización flete", key: "fleteDeficit", width: 18, style: { numFmt: MONEDA } },
    { header: "Margen ajustado", key: "marginAdjusted", width: 16, style: { numFmt: MONEDA } },
    { header: "% Comisión", key: "commissionPct", width: 12 },
    { header: "Comisión", key: "commission", width: 14, style: { numFmt: MONEDA } },
    { header: "Líneas", key: "lineCount", width: 8 },
  ], documents.map((d) => ({
    vendedor: d.salesperson,
    tido: d.tido,
    numero: d.numero,
    fecha: formatFecha(d.fecha),
    cliente: d.client,
    revenue: round(d.revenue),
    cost: round(d.cost),
    margin: round(d.margin),
    fleteCobrado: round(d.fleteCobrado),
    fletePct: d.fleteEffectivePct,
    fleteObjetivo: round(d.fleteObjetivo),
    fleteDeficit: round(d.fleteDeficit),
    marginAdjusted: round(d.marginAdjusted),
    commissionPct: d.effectivePct,
    commission: round(d.marginAdjusted * d.effectivePct / 100),
    lineCount: d.lineCount,
  })));

  agregarHojaDetalle(wb, "Líneas", [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Tipo", key: "tido", width: 7 },
    { header: "Documento", key: "numero", width: 12 },
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "Cliente", key: "cliente", width: 34 },
    { header: "SKU", key: "sku", width: 14 },
    { header: "Producto", key: "producto", width: 40 },
    { header: "Es flete", key: "esFlete", width: 9 },
    { header: "Cantidad", key: "cantidad", width: 11 },
    { header: "Neto", key: "revenue", width: 14, style: { numFmt: MONEDA } },
    { header: "Costo", key: "cost", width: 14, style: { numFmt: MONEDA } },
    { header: "Margen", key: "margin", width: 14, style: { numFmt: MONEDA } },
  ], lines.map((l) => ({
    fecha: formatFecha(l.fecha),
    tido: l.tido,
    numero: l.numero,
    vendedor: l.salesperson,
    cliente: l.client,
    sku: l.sku,
    producto: l.producto,
    esFlete: l.esFlete ? "Sí" : "",
    cantidad: l.cantidad,
    revenue: round(l.revenue),
    cost: round(l.cost),
    margin: round(l.margin),
  })));

  return wb;
}
