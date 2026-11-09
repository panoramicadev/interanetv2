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
  /** Fórmula con la comisión (sin piso) de cada vendedor según su liquidación. */
  comision: Map<string, string>;
};

/** Nombre de hoja listo para una fórmula: 'PABLO SOTO'!A1. */
const refHoja = (nombre: string) => `'${nombre.replace(/'/g, "''")}'`;

/**
 * Separa la base de la comisión de un vendedor por % efectivo, documento a
 * documento (igual que el cálculo del servidor). El % del vendedor va primero
 * aunque no tenga base, para que la hoja siempre lo muestre.
 */
function tramosDeComision(item: any, documentos: any[]) {
  const porPct = new Map<number, number>();
  porPct.set(item.commissionPct, 0);
  for (const d of documentos) {
    porPct.set(d.effectivePct, (porPct.get(d.effectivePct) ?? 0) + d.marginAdjusted);
  }
  return Array.from(porPct.entries())
    .map(([pct, base]) => ({ pct, base, especial: pct !== item.commissionPct }))
    .filter((t) => !t.especial || Math.round(t.base) !== 0)
    .sort((a, b) => Number(a.especial) - Number(b.especial) || b.pct - a.pct);
}

/** Hoja de liquidación de un vendedor, calcada del formato en papel. */
function agregarHojaLiquidacion(
  wb: ExcelJS.Workbook,
  item: any,
  clientes: any[],
  documentos: any[],
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
  // La base es el margen AJUSTADO por flete (lo mismo que la pantalla), y se
  // separa por % efectivo: una fila con el % del vendedor y una por cada %
  // especial (cliente o venta con otro %). Antes salía margen neto × % del
  // vendedor y no cuadraba con "Comisión a pagar" si había especiales.
  const grande = { name: "Arial", size: 12, bold: true };
  const tramos = tramosDeComision(item, documentos);
  const filaPrimerTramo = filaValores + 2;
  tramos.forEach((t, i) => {
    const f = filaPrimerTramo + i;
    ws.getCell(f, 4).value = t.especial ? `COMISION ESPECIAL ${t.pct}%` : "COMISION";
    ws.getCell(f, 5).value = round(t.base);
    // El % general sigue saliendo del Resumen: cambiarlo ahí mueve esta hoja.
    ws.getCell(f, 6).value = !t.especial && filaVendedor
      ? F(`Resumen!$J$${filaVendedor}/100`, t.pct / 100)
      : t.pct / 100;
    ws.getCell(f, 7).value = F(`E${f}*F${f}`, round(t.base) * (t.pct / 100));
  });
  const ultimoTramo = filaPrimerTramo + tramos.length - 1;
  const comisionRaw = tramos.reduce((n, t) => n + round(t.base) * (t.pct / 100), 0);
  const comision = Math.max(0, comisionRaw);
  // Con más de un tramo va un total; con uno solo, ese tramo ya es el total.
  const filaComision = tramos.length > 1 ? ultimoTramo + 1 : ultimoTramo;
  if (tramos.length > 1) {
    ws.getCell(filaComision, 4).value = "TOTAL COMISION";
    ws.getCell(filaComision, 7).value = F(`MAX(0,SUM(G${filaPrimerTramo}:G${ultimoTramo}))`, comision);
  }
  refs.comision.set(item.salesperson, `SUM(${refHoja(ws.name)}!$G$${filaPrimerTramo}:$G$${ultimoTramo})`);
  const filaSemana = filaComision + 1;

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

  for (let f = filaPrimerTramo; f <= filaSemana; f++) {
    for (let col = 4; col <= 7; col++) ws.getCell(f, col).font = grande;
    ws.getCell(f, 5).numFmt = MONEDA;
    ws.getCell(f, 7).numFmt = MONEDA;
    ws.getRow(f).height = 15.6;
  }
  for (let f = filaPrimerTramo; f <= ultimoTramo; f++) ws.getCell(f, 6).numFmt = PORCENTAJE;
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
 * Una hoja por cadena (REDMAT): sus ferreterías, vendedor por vendedor, con la
 * comisión que generan. Las ferreterías siguen apareciendo en la liquidación de
 * cada vendedor; esta hoja es para ver la cadena como un solo cliente.
 * La comisión de cada fila se suma documento a documento, con el % efectivo de
 * cada venta, igual que el servidor.
 */
function agregarHojasCadena(wb: ExcelJS.Workbook, clients: any[], documents: any[], usados: Set<string>) {
  const cadenas = Array.from(new Set(clients.filter((c) => c.cadena).map((c) => c.cadena as string))).sort();
  for (const cadena of cadenas) {
    const suyos = clients
      .filter((c) => c.cadena === cadena)
      .sort((a, b) =>
        String(a.salesperson).localeCompare(String(b.salesperson)) || b.revenue - a.revenue);

    const filas = suyos.map((c, i) => {
      const r = i + 2;
      const docs = documents.filter((d) => d.salesperson === c.salesperson && d.client === c.client);
      const comision = docs.reduce((n, d) => n + d.marginAdjusted * (d.effectivePct / 100), 0);
      const pcts = Array.from(new Set(docs.map((d) => d.effectivePct)));
      return {
        vendedor: c.salesperson,
        ferreteria: c.client,
        rut: c.rut || "",
        revenue: round(c.revenue),
        cost: round(c.cost),
        margin: F(`D${r}-E${r}`, c.margin),
        fleteCobrado: round(c.fleteCobrado),
        fleteDeficit: round(c.fleteDeficit),
        marginAdjusted: F(`F${r}-H${r}`, c.marginAdjusted),
        // Un solo % → se muestra; si las ventas tienen % distintos, "varios".
        pct: pcts.length === 1 ? pcts[0] : pcts.length > 1 ? "varios" : c.effectivePct,
        especial: c.overridePct != null || docs.some((d) => d.overridePct != null) ? "Sí" : "",
        comision: round(comision),
      };
    });

    const n = filas.length;
    const ws = agregarHojaDetalle(wb, nombreHoja(cadena, usados), [
      { header: "Vendedor", key: "vendedor", width: 28 },
      { header: "Ferretería", key: "ferreteria", width: 40 },
      { header: "RUT", key: "rut", width: 14 },
      { header: "Facturado neto", key: "revenue", width: 16, style: { numFmt: MONEDA } },
      { header: "Costo", key: "cost", width: 14, style: { numFmt: MONEDA } },
      { header: "Margen", key: "margin", width: 14, style: { numFmt: MONEDA } },
      { header: "Flete cobrado", key: "fleteCobrado", width: 14, style: { numFmt: MONEDA } },
      { header: "Regularización flete", key: "fleteDeficit", width: 18, style: { numFmt: MONEDA } },
      { header: "Margen ajustado", key: "marginAdjusted", width: 16, style: { numFmt: MONEDA } },
      { header: "% Comisión", key: "pct", width: 12 },
      { header: "% especial", key: "especial", width: 10 },
      { header: "Comisión", key: "comision", width: 14, style: { numFmt: MONEDA } },
    ], filas);

    const t = n + 2;
    const suma = (col: string) => (n ? `SUM(${col}2:${col}${t - 1})` : "0");
    const tot = (k: string) => suyos.reduce((s, c) => s + (c[k] || 0), 0);
    const total = ws.getRow(t);
    total.values = {
      vendedor: `TOTAL ${cadena}`,
      ferreteria: `${n} ${n === 1 ? "ferretería" : "ferreterías"}`,
      revenue: F(suma("D"), tot("revenue")),
      cost: F(suma("E"), tot("cost")),
      margin: F(suma("F"), tot("margin")),
      fleteCobrado: F(suma("G"), tot("fleteCobrado")),
      fleteDeficit: F(suma("H"), tot("fleteDeficit")),
      marginAdjusted: F(suma("I"), tot("marginAdjusted")),
      comision: F(suma("L"), filas.reduce((s, f) => s + f.comision, 0)),
    } as any;
    total.font = { bold: true };
    total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBDD" } };
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
    comision: new Map(),
  };
  const filaTotalResumen = FILA_1 + items.length;

  // ── Liquidaciones (una hoja por vendedor) ──
  const usados = new Set<string>();
  for (const item of items) {
    const suyos = clients
      .filter((c) => c.salesperson === item.salesperson)
      .sort((a, b) => String(a.rut || "").localeCompare(String(b.rut || "")));
    const susDocs = documents.filter((d) => d.salesperson === item.salesperson);
    agregarHojaLiquidacion(wb, item, suyos, susDocs, periodo, data.startDate, data.endDate, logo, usados, refs);
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
      // Con % especiales la comisión sale de los tramos de la liquidación, que
      // a su vez toman el % general de esta hoja: todo se mueve junto.
      commissionRaw: comisionPorFormula(it)
        ? F(`I${r}*J${r}/100`, it.commissionRaw)
        : refs.comision.has(it.salesperson)
          ? F(refs.comision.get(it.salesperson)!, it.commissionRaw)
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

  agregarHojasCadena(wb, clients, documents, usados);

  agregarHojaLineas(wb, lines);

  return wb;
}
