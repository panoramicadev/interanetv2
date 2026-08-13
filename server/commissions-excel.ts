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
  /** Fila de cada cliente en la hoja Clientes, por "vendedor|cliente". */
  cliente: Map<string, number>;
  /** Fila del parámetro "% Flete por defecto" en la hoja Resumen. */
  filaFleteDefecto: number;
};

const claveCliente = (vendedor: string, cliente: string) => `${vendedor}|||${cliente}`;

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
    // El neto sale de la hoja Clientes: si allá se cambia un %, acá se refleja.
    const filaCli = refs.cliente.get(claveCliente(item.salesperson, cli.client));
    const neto: any = filaCli ? F(`Clientes!$D$${filaCli}`, cli.revenue) : round(cli.revenue);
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
 * Arma el libro completo. `salesperson` limita la exportación a un vendedor
 * (el filtro de la pantalla); sin él salen todos los del período.
 *
 * El libro es "vivo": las hojas de respaldo están encadenadas por fórmula, de
 * Líneas → Documentos → Clientes → Resumen → liquidación. Las celdas pintadas
 * (% Flete y % Comisión) son las entradas: al cambiar una, se recalcula todo lo
 * que cuelga de ella, incluida la hoja del vendedor que se firma. El % que no
 * está fijado a mano hereda por fórmula del nivel de arriba (documento ← cliente
 * ← vendedor / % de flete por defecto), así que tocar el general baja a todos.
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

  // ── Mapa de filas: las hojas se referencian entre sí, así que hay que saber
  //    de antemano en qué fila cae cada vendedor y cada cliente. ──
  const FILA_1 = 2; // fila 1 = encabezado
  const refs: Refs = {
    vendedor: new Map(items.map((it, i) => [it.salesperson, FILA_1 + i])),
    cliente: new Map(clients.map((c, i) => [claveCliente(c.salesperson, c.client), FILA_1 + i])),
    // El parámetro va debajo de la tabla (vendedores + fila TOTAL + una en blanco).
    filaFleteDefecto: FILA_1 + items.length + 2,
  };
  const filaTotalResumen = FILA_1 + items.length;

  const nLineas = lines.length;
  const nDocs = documents.length;
  const nClientes = clients.length;
  const rangoLineas = (col: string) => `Líneas!$${col}$${FILA_1}:$${col}$${FILA_1 + nLineas - 1}`;
  const rangoDocs = (col: string) => `Documentos!$${col}$${FILA_1}:$${col}$${FILA_1 + nDocs - 1}`;
  const rangoClientes = (col: string) => `Clientes!$${col}$${FILA_1}:$${col}$${FILA_1 + nClientes - 1}`;

  // Se agrupa con SUMPRODUCT y no con SUMIFS porque los criterios son nombres de
  // cliente y de vendedor: SUMIFS los leería como patrones y un "*" o un "?" en
  // la razón social sumaría filas de otro. La comparación con "=" es literal.
  // Sin filas debajo no hay rango que sumar: ahí la celda se queda con el valor
  // del servidor en vez de una fórmula rota.
  const sumaPorCliente = (col: string, r: number, valor: number) =>
    nDocs
      ? F(`SUMPRODUCT((${rangoDocs("A")}=$A${r})*(${rangoDocs("E")}=$C${r})*${rangoDocs(col)})`, valor)
      : valor;
  const sumaPorVendedor = (col: string, r: number, valor: number) =>
    nClientes
      ? F(`SUMPRODUCT((${rangoClientes("A")}=$A${r})*${rangoClientes(col)})`, valor)
      : valor;

  // ── ¿Se puede encadenar Documentos con Líneas? ──
  // Solo si la hoja de líneas trae el detalle completo del documento. Si el
  // período se recortó por tamaño, o si el documento tiene líneas que la hoja
  // no muestra, ese documento se queda con los valores del servidor: mejor un
  // número fijo y correcto que una fórmula que no cuadra con la pantalla.
  const porDocumento = new Map<string, { revenue: number; cost: number; flete: number }>();
  for (const l of lines) {
    const acc = porDocumento.get(l.document) || { revenue: 0, cost: 0, flete: 0 };
    if (l.esFlete) acc.flete += l.revenue;
    else {
      acc.revenue += l.revenue;
      acc.cost += l.cost;
    }
    porDocumento.set(l.document, acc);
  }
  const cuadra = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 1;
  const desdeLineas = (d: any) => {
    if (data.linesTruncated || !nLineas) return false;
    const acc = porDocumento.get(d.document);
    return !!acc && cuadra(acc.revenue, d.revenue) && cuadra(acc.cost, d.cost)
      && cuadra(acc.flete, d.fleteCobrado);
  };

  // ── Liquidaciones (una hoja por vendedor) ──
  const usados = new Set<string>();
  for (const item of items) {
    const suyos = clients
      .filter((c) => c.salesperson === item.salesperson)
      .sort((a, b) => String(a.rut || "").localeCompare(String(b.rut || "")));
    agregarHojaLiquidacion(wb, item, suyos, periodo, data.startDate, data.endDate, logo, usados, refs);
  }

  // ── Resumen: se alimenta de Clientes; el % del vendedor es la entrada ──
  const resumen = items.map((it, i) => {
    const r = FILA_1 + i;
    return {
      vendedor: it.salesperson,
      netRevenue: sumaPorVendedor("D", r, it.netRevenue),
      netCost: sumaPorVendedor("E", r, it.netCost),
      netMargin: F(`B${r}-C${r}`, it.netMargin),
      marginPct: F(`IF(B${r}=0,0,D${r}/B${r}*100)`, it.netMarginPct),
      fleteCobrado: sumaPorVendedor("G", r, it.fleteCobrado),
      fleteObjetivo: sumaPorVendedor("I", r, it.fleteObjetivo),
      fleteDeficit: sumaPorVendedor("J", r, it.fleteDeficit),
      marginAdjusted: F(`D${r}-H${r}`, it.marginAdjusted),
      commissionPct: it.commissionPct,
      commissionRaw: sumaPorVendedor("M", r, it.commissionRaw),
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

  // Parámetro global: el % de flete que se aplica cuando el cliente no tiene uno propio.
  const etiquetaFlete = hojaResumen.getCell(refs.filaFleteDefecto, 1);
  etiquetaFlete.value = "% Flete por defecto";
  etiquetaFlete.font = { bold: true };
  const celdaFlete = hojaResumen.getCell(refs.filaFleteDefecto, 2);
  celdaFlete.value = data.defaultFletePct;
  celdaFlete.fill = RELLENO_EDITABLE;
  celdaFlete.numFmt = "0.##";
  celdaFlete.alignment = { horizontal: "left" };

  // ── Clientes: suma sus documentos; los % son entradas y, si no hay uno
  //    fijado a mano, heredan del vendedor / del parámetro global ──
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
  ], clients.map((c, i) => {
    const r = FILA_1 + i;
    const filaVendedor = refs.vendedor.get(c.salesperson);
    return {
      vendedor: c.salesperson,
      rut: c.rut || "",
      cliente: c.client,
      revenue: sumaPorCliente("F", r, c.revenue),
      cost: sumaPorCliente("G", r, c.cost),
      margin: F(`D${r}-E${r}`, c.margin),
      fleteCobrado: sumaPorCliente("I", r, c.fleteCobrado),
      // Sin tasa propia hereda el parámetro global; escribir acá la fija.
      fletePct: c.fleteOverridePct != null
        ? c.fleteOverridePct
        : F(`Resumen!$B$${refs.filaFleteDefecto}`, c.fleteEffectivePct),
      fleteObjetivo: sumaPorCliente("K", r, c.fleteObjetivo),
      fleteDeficit: sumaPorCliente("L", r, c.fleteDeficit),
      marginAdjusted: F(`F${r}-J${r}`, c.marginAdjusted),
      // Sin % propio hereda el del vendedor en Resumen.
      commissionPct: c.overridePct != null || !filaVendedor
        ? c.effectivePct
        : F(`Resumen!$J$${filaVendedor}`, c.effectivePct),
      commission: sumaPorCliente("O", r, c.marginAdjusted * c.effectivePct / 100),
      lineCount: sumaPorCliente("P", r, c.lineCount),
    } as any;
  }), [8, 12]);

  // ── Documentos: la base del cálculo. El flete y la comisión se resuelven
  //    documento a documento, igual que en el servidor. ──
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
    { header: "ID documento", key: "idDoc", width: 14 },
  ], documents.map((d, i) => {
    const r = FILA_1 + i;
    const filaCli = refs.cliente.get(claveCliente(d.salesperson, d.client));
    const conLineas = desdeLineas(d);
    const sumaLineas = (col: string, esFlete: string) =>
      `SUMIFS(${rangoLineas(col)},${rangoLineas("M")},$Q${r},${rangoLineas("H")},"${esFlete}")`;
    return {
      vendedor: d.salesperson,
      tido: d.tido,
      numero: d.numero,
      fecha: formatFecha(d.fecha),
      cliente: d.client,
      revenue: conLineas ? F(sumaLineas("J", "No"), d.revenue) : round(d.revenue),
      cost: conLineas ? F(sumaLineas("K", "No"), d.cost) : round(d.cost),
      margin: F(`F${r}-G${r}`, d.margin),
      fleteCobrado: conLineas ? F(sumaLineas("J", "Sí"), d.fleteCobrado) : round(d.fleteCobrado),
      // Sin tasa propia hereda la del cliente; escribir acá la fija para esta venta.
      fletePct: d.fleteOverridePct != null || !filaCli
        ? d.fleteEffectivePct
        : F(`Clientes!$H$${filaCli}`, d.fleteEffectivePct),
      fleteObjetivo: F(`F${r}*J${r}/100`, d.fleteObjetivo),
      // Piso espejado: la factura nunca acredita flete, la NC nunca lo castiga.
      fleteDeficit: F(
        `IF(F${r}>=0,MAX(0,K${r}-I${r}),MIN(0,K${r}-I${r}))`,
        d.fleteDeficit,
      ),
      marginAdjusted: F(`H${r}-L${r}`, d.marginAdjusted),
      commissionPct: d.overridePct != null || !filaCli
        ? d.effectivePct
        : F(`Clientes!$L$${filaCli}`, d.effectivePct),
      commission: F(`M${r}*N${r}/100`, d.marginAdjusted * d.effectivePct / 100),
      lineCount: d.lineCount,
      idDoc: d.document,
    } as any;
  }), [10, 14]);

  // ── Líneas: el dato crudo del ERP. Es el piso de la cadena. ──
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
    { header: "ID documento", key: "idDoc", width: 14 },
  ], lines.map((l, i) => {
    const r = FILA_1 + i;
    return {
      fecha: formatFecha(l.fecha),
      tido: l.tido,
      numero: l.numero,
      vendedor: l.salesperson,
      cliente: l.client,
      sku: l.sku,
      producto: l.producto,
      esFlete: l.esFlete ? "Sí" : "No",
      cantidad: l.cantidad,
      revenue: l.revenue,
      cost: l.cost,
      margin: F(`J${r}-K${r}`, l.margin),
      idDoc: l.document,
    } as any;
  }));

  return wb;
}
