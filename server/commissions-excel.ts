/**
 * Libro de comisiones en el formato de la liquidación que firma el vendedor.
 *
 * Una hoja por vendedor con el machote de siempre (logo, ventas por cliente,
 * bloque de margen, comisión, semana corrida y firmas) y, detrás, dos hojas de
 * respaldo: el Resumen y las Líneas agrupadas por SKU.
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

/** Celda con fórmula, guardando el valor calculado por el servidor como caché. */
const F = (formula: string, result: number): ExcelJS.CellFormulaValue =>
  ({ formula, result } as ExcelJS.CellFormulaValue);

/** Relleno de las celdas que el usuario puede pisar a mano. */
const RELLENO_EDITABLE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF3E0" },
};

/** Dónde vive cada fila del libro, para que las fórmulas se apunten entre hojas. */
type Refs = {
  /** Fila de cada vendedor en la hoja Resumen. */
  vendedor: Map<string, number>;
};

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
  refs: Refs,
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

  const filaVendedor = refs.vendedor.get(item.salesperson);

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
    const neto = round(cli.revenue);
    const valores = [null, cli.salespersonCode || "", cli.rut || "", cli.client, neto];
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
    ? F(`SUM(E${FILA_ENCABEZADO + 1}:E${filaTotal - 1})`, round(item.netRevenue))
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
  const margenPct = item.netRevenue !== 0 ? item.netMargin / item.netRevenue : 0;
  const valoresResumen: [any, string][] = [
    [filaVendedor ? F(`Resumen!$B$${filaVendedor}`, item.netRevenue) : round(item.netRevenue), MONEDA],
    [filaVendedor ? F(`Resumen!$C$${filaVendedor}`, item.netCost) : round(item.netCost), MONEDA],
    [F(`E${filaValores}-F${filaValores}`, item.netMargin), MONEDA],
    [F(`IF(E${filaValores}=0,0,G${filaValores}/E${filaValores})`, margenPct), PORCENTAJE],
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
  ws.getCell(filaComision, 5).value = F(`G${filaValores}`, item.netMargin);
  ws.getCell(filaComision, 6).value = filaVendedor
    ? F(`Resumen!$J$${filaVendedor}/100`, item.commissionPct / 100)
    : item.commissionPct / 100;
  ws.getCell(filaComision, 7).value = F(`E${filaComision}*F${filaComision}`, comision);

  // Días del período, no constantes: el divisor y el multiplicador cambian mes a
  // mes según dónde caen los domingos y los feriados — ver server/feriados-chile.ts.
  const dsc = diasSemanaCorrida(startDate, endDate);
  ws.getCell(filaSemana, 4).value = "SEMANA CORRIDA";
  ws.getCell(filaSemana, 5).value = F(
    `G${filaComision}/${dsc.diasLaborables}`,
    comision / dsc.diasLaborables,
  );
  ws.getCell(filaSemana, 6).value = dsc.domingosYFestivos;
  ws.getCell(filaSemana, 7).value = F(
    `F${filaSemana}*E${filaSemana}`,
    (comision / dsc.diasLaborables) * dsc.domingosYFestivos,
  );

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

/**
 * Hoja de respaldo: encabezado naranja de marca y anchos fijos.
 * `editables` son las columnas (1-based) que el usuario puede pisar a mano;
 * salen pintadas para que se vea dónde se puede escribir.
 */
function agregarHojaDetalle(
  wb: ExcelJS.Workbook,
  nombre: string,
  columnas: Partial<ExcelJS.Column>[],
  filas: any[],
  editables: number[] = [],
) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columnas as ExcelJS.Column[];
  const encabezado = ws.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFD6301" } };
  for (const fila of filas) {
    const agregada = ws.addRow(fila);
    for (const col of editables) agregada.getCell(col).fill = RELLENO_EDITABLE;
  }
  return ws;
}


/**
 * Hoja de líneas agrupada por SKU: una fila resumen por producto y, debajo,
 * cada operación. Las operaciones vienen plegadas (esquema de Excel, los
 * botones + / − del margen izquierdo) para que la hoja no sea un listado
 * interminable; el resumen suma su grupo por fórmula.
 */
function agregarHojaLineas(wb: ExcelJS.Workbook, lines: any[]) {
  const ws = wb.addWorksheet("Líneas", { views: [{ state: "frozen", ySplit: 1 }] });
  // El resumen queda arriba de su detalle, no abajo.
  ws.properties.outlineProperties = { summaryBelow: false, summaryRight: true };
  ws.properties.outlineLevelRow = 1;
  // ExcelJS marca `collapsed` en las filas del detalle; Excel lo espera en la
  // fila resumen (la de arriba), o muestra "−" con el grupo cerrado.
  const marcarPlegado = (row: ExcelJS.Row, plegado: boolean) =>
    Object.defineProperty(row, "collapsed", { get: () => plegado });
  ws.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Tipo", key: "tido", width: 7 },
    { header: "Documento", key: "numero", width: 12 },
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "Cliente", key: "cliente", width: 34 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Producto", key: "producto", width: 40 },
    { header: "Cantidad", key: "cantidad", width: 11 },
    { header: "Neto", key: "revenue", width: 14, style: { numFmt: MONEDA } },
    { header: "Costo", key: "cost", width: 14, style: { numFmt: MONEDA } },
    { header: "Margen", key: "margin", width: 14, style: { numFmt: MONEDA } },
    { header: "% Margen", key: "marginPct", width: 10, style: { numFmt: "0.0%" } },
  ] as ExcelJS.Column[];
  const encabezado = ws.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFD6301" } };

  const porSku = new Map<string, any[]>();
  for (const l of lines) {
    const sku = l.sku || "(sin SKU)";
    const grupo = porSku.get(sku);
    if (grupo) grupo.push(l);
    else porSku.set(sku, [l]);
  }
  const skus = Array.from(porSku.keys()).sort((a, b) => a.localeCompare(b));

  const pct = (margen: number, neto: number) => (neto !== 0 ? margen / neto : 0);
  let fila = 2;
  for (const sku of skus) {
    const grupo = porSku.get(sku)!;
    grupo.sort(
      (a, b) =>
        String(a.fecha || "").localeCompare(String(b.fecha || "")) ||
        String(a.numero || "").localeCompare(String(b.numero || "")),
    );
    const primera = fila + 1;
    const ultima = fila + grupo.length;
    const neto = grupo.reduce((n, l) => n + (l.revenue || 0), 0);
    const costo = grupo.reduce((n, l) => n + (l.cost || 0), 0);
    const cantidad = grupo.reduce((n, l) => n + (l.cantidad || 0), 0);

    const resumen = ws.getRow(fila);
    resumen.getCell("sku").value = sku;
    resumen.getCell("producto").value = grupo[0].producto || "";
    resumen.getCell("cantidad").value = F(`SUM(H${primera}:H${ultima})`, cantidad);
    resumen.getCell("revenue").value = F(`SUM(I${primera}:I${ultima})`, neto);
    resumen.getCell("cost").value = F(`SUM(J${primera}:J${ultima})`, costo);
    resumen.getCell("margin").value = F(`I${fila}-J${fila}`, neto - costo);
    resumen.getCell("marginPct").value = F(`IF(I${fila}=0,0,K${fila}/I${fila})`, pct(neto - costo, neto));
    marcarPlegado(resumen, true);
    resumen.font = { bold: true };
    resumen.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBDD" } };
    fila++;

    for (const l of grupo) {
      const detalle = ws.getRow(fila);
      detalle.values = {
        fecha: formatFecha(l.fecha),
        tido: l.tido,
        numero: l.numero,
        vendedor: l.salesperson,
        cliente: l.client,
        sku: l.sku,
        producto: l.producto,
        cantidad: l.cantidad,
        revenue: l.revenue,
        cost: l.cost,
        margin: F(`I${fila}-J${fila}`, l.margin),
        marginPct: F(`IF(I${fila}=0,0,K${fila}/I${fila})`, pct(l.margin, l.revenue)),
      } as any;
      detalle.outlineLevel = 1;
      detalle.hidden = true;
      marcarPlegado(detalle, false);
      fila++;
    }
  }
}

/**
 * Arma el libro completo. `salesperson` limita la exportación a un vendedor
 * (el filtro de la pantalla); sin él salen todos los del período.
 *
 * Hojas: una liquidación por vendedor, el Resumen y las Líneas por SKU. El
 * Resumen y la liquidación se recalculan entre sí: el % de comisión pintado en
 * el Resumen es la entrada y mueve la comisión de la hoja que se firma.
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
  // Sin esto Excel muestra el valor cacheado y no recalcula al abrir.
  wb.calcProperties.fullCalcOnLoad = true;

  const logoPng = leerLogo();
  const logo = logoPng
    ? { id: wb.addImage({ buffer: logoPng as any, extension: "png" }), alto: altoLogo(logoPng) }
    : null;
  const periodo = etiquetaPeriodo(data.startDate, data.endDate);

  const FILA_1 = 2; // fila 1 = encabezado
  const refs: Refs = {
    vendedor: new Map(items.map((it, i) => [it.salesperson, FILA_1 + i])),
  };
  const filaTotalResumen = FILA_1 + items.length;

  // ── Liquidaciones (una hoja por vendedor) ──
  const usados = new Set<string>();
  for (const item of items) {
    const suyos = clients
      .filter((c) => c.salesperson === item.salesperson)
      .sort((a, b) => String(a.rut || "").localeCompare(String(b.rut || "")));
    agregarHojaLiquidacion(wb, item, suyos, periodo, data.startDate, data.endDate, logo, usados, refs);
  }

  // ── Resumen: el % de comisión del vendedor es la entrada ──
  // Con % propio en algún cliente o documento, la comisión ya no es margen ×
  // % del vendedor: ese vendedor se queda con el valor del servidor.
  const comisionPorFormula = (it: any) => {
    const conPropio =
      clients.some((c) => c.salesperson === it.salesperson && c.overridePct != null) ||
      documents.some((d) => d.salesperson === it.salesperson && d.overridePct != null);
    return !conPropio && Math.abs(it.marginAdjusted * it.commissionPct / 100 - it.commissionRaw) < 1;
  };
  const resumen = items.map((it, i) => {
    const r = FILA_1 + i;
    return {
      vendedor: it.salesperson,
      netRevenue: round(it.netRevenue),
      netCost: round(it.netCost),
      netMargin: F(`B${r}-C${r}`, it.netMargin),
      marginPct: F(`IF(B${r}=0,0,D${r}/B${r}*100)`, it.netMarginPct),
      fleteCobrado: round(it.fleteCobrado),
      fleteObjetivo: round(it.fleteObjetivo),
      fleteDeficit: round(it.fleteDeficit),
      marginAdjusted: F(`D${r}-H${r}`, it.marginAdjusted),
      commissionPct: it.commissionPct,
      commissionRaw: comisionPorFormula(it)
        ? F(`I${r}*J${r}/100`, it.commissionRaw)
        : round(it.commissionRaw),
      commissionAmount: F(`MAX(0,K${r})`, it.commissionAmount),
    } as any;
  });
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
  const rt = filaTotalResumen;
  const sumaHasta = (col: string) => `SUM(${col}${FILA_1}:${col}${rt - 1})`;
  resumen.push({
    vendedor: "TOTAL",
    netRevenue: F(sumaHasta("B"), totales.netRevenue),
    netCost: F(sumaHasta("C"), totales.netCost),
    netMargin: F(sumaHasta("D"), totales.netMargin),
    marginPct: F(
      `IF(B${rt}=0,0,D${rt}/B${rt}*100)`,
      totales.netRevenue !== 0 ? (totales.netMargin / totales.netRevenue) * 100 : 0,
    ),
    fleteCobrado: F(sumaHasta("F"), totales.fleteCobrado),
    fleteObjetivo: F(sumaHasta("G"), totales.fleteObjetivo),
    fleteDeficit: F(sumaHasta("H"), totales.fleteDeficit),
    marginAdjusted: F(sumaHasta("I"), totales.marginAdjusted),
    commissionPct: "",
    commissionRaw: F(sumaHasta("K"), totales.commissionRaw),
    commissionAmount: F(sumaHasta("L"), totales.commissionAmount),
  } as any);

  const hojaResumen = agregarHojaDetalle(wb, "Resumen", [
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
  ], resumen, [10]);
  // La fila TOTAL no lleva % de vendedor: no es una entrada.
  hojaResumen.getCell(rt, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

  agregarHojaLineas(wb, lines);

  return wb;
}
