/**
 * ESTADO DE CUENTA DE UN CLIENTE — PDF y Excel.
 *
 * Pedido de Recepción (sep-2026): bajar desde Random el detalle de la deuda de
 * un solo cliente toma unos doce pasos, y el correo de cobranza decía solo el
 * monto vencido total. Este archivo resuelve las dos cosas: se descarga desde la
 * pestaña Crédito de la ficha y viaja adjunto en el correo de cobranza.
 *
 * Por documento trae tipo y folio, fecha de emisión, fecha de vencimiento, monto
 * facturado y el saldo separado en vencido y por vencer: las columnas del
 * reporte "Documentos de venta según estado de pago" de Random, con la marca de
 * Panorámica.
 *
 * Los números salen de obtenerCreditoCliente() (services/credito-cliente.ts),
 * la misma función que pinta la pestaña Crédito: el archivo que recibe el
 * cliente no puede decir algo distinto de lo que ve quien se lo manda.
 *
 * Los dos formatos no son el mismo archivo en dos extensiones:
 *  - el PDF es el que se le manda al cliente. Por eso le habla de "usted" y
 *    cierra con los datos para el pago;
 *  - el Excel es para trabajar la cartera —filtrar, sumar, cruzar— y trae
 *    además el abonado y el saldo de cada documento. Los totales van con
 *    SUBTOTAL, así que siguen al filtro.
 */
import type { Express } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { formatRutDisplay } from '@shared/rut';
import { requireAuth } from '../auth';
import { CONTACTO_COBRANZA, DATOS_PAGO } from '../email-templates';
import {
  obtenerCreditoCliente,
  type CreditoCliente,
  type DocumentoCredito,
} from './credito-cliente';

export type FormatoEstadoCuenta = 'pdf' | 'xlsx';

const EMPRESA = 'Pinturas Panorámica';

const LINEA_CONSULTAS = `Ante cualquier consulta, escríbanos a ${CONTACTO_COBRANZA.consultas}.`;

const TIPO_CONTENIDO: Record<FormatoEstadoCuenta, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// ─── Formato ────────────────────────────────────────────────────────────────

const formatoClp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
const clp = (n: number) => formatoClp.format(Math.round(n || 0));

/** "2026-09-28" → "28-09-2026", el mismo formato que la pestaña Crédito. */
function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

/**
 * Fecha de hoy en Chile, AAAA-MM-DD: el servidor corre en UTC. Se arma por
 * partes y no con un locale que "ya venga" en ese orden, porque ese orden
 * depende de la versión de ICU.
 */
function hoyEnChile(ahora: Date): string {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/** "AAAA-MM-DD" → Date a medianoche UTC: así Excel muestra el mismo día. */
function fechaExcel(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

const documentos = (n: number) => `${n} ${n === 1 ? 'documento' : 'documentos'}`;

/** Dirección, comuna y ciudad sin repetir: en muchas fichas comuna y ciudad son la misma. */
function lineaDireccion(c: NonNullable<CreditoCliente['client']>): string {
  const partes: string[] = [];
  for (const parte of [c.address, c.comuna, c.city]) {
    if (parte && !partes.some((p) => p.toUpperCase() === parte.toUpperCase())) partes.push(parte);
  }
  return partes.join(' · ');
}

// ─── Nombre del archivo ─────────────────────────────────────────────────────

/** "Estado de cuenta - SOLUCIONES HABITACIONALES TECN - 2026-09-28.pdf" */
export function nombreArchivoEstadoCuenta(
  credito: CreditoCliente,
  formato: FormatoEstadoCuenta,
  generadoEn: Date = new Date(),
): string {
  const cliente = (credito.client?.name || 'cliente')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return `Estado de cuenta - ${cliente} - ${hoyEnChile(generadoEn)}.${formato}`;
}

/**
 * Content-Disposition con el nombre en UTF-8 (RFC 5987) y un respaldo ASCII:
 * sin el respaldo, un nombre con tildes rompe la cabecera en algunos navegadores.
 */
function contentDisposition(tipo: 'inline' | 'attachment', nombre: string): string {
  const ascii = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '');
  const utf8 = encodeURIComponent(nombre).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

// ─── Logo ───────────────────────────────────────────────────────────────────

/**
 * El logo sobre fondo claro. attached_assets viaja a producción (ver
 * Dockerfile). El de client/public no sirve para papel: trae el "30 años" en
 * blanco, que sobre blanco no se ve y deja un hueco al costado.
 */
let logoEnCache: Buffer | null | undefined;
function leerLogo(): Buffer | null {
  if (logoEnCache !== undefined) return logoEnCache;
  logoEnCache = null;
  const ruta = path.resolve(process.cwd(), 'attached_assets/logo-panoramica-negro.png');
  try {
    if (fs.existsSync(ruta)) logoEnCache = fs.readFileSync(ruta);
  } catch {
    /* sin logo, el encabezado sale con el nombre en texto */
  }
  return logoEnCache;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════════

const COLOR = {
  marca: '#fd6301',
  tinta: '#17181c',
  tintaSuave: '#4b5563',
  tenue: '#9ca3af',
  borde: '#e5e7eb',
  filaAlterna: '#f9fafb',
  /** El mismo azul noche del bloque "Datos para el pago" del correo que lo lleva. */
  noche: '#1a1f2e',
  fondoTotal: '#fff7ed',
  vencido: '#dc2626',
  alDia: '#16a34a',
  porVencer: '#d97706',
};

const MARGEN = 40;
const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const ALTO_ENCABEZADO = 58;
const ALTO_PIE = 26;
const TOPE = MARGEN + ALTO_ENCABEZADO + 12;
const FONDO = ALTO_PAGINA - MARGEN - ALTO_PIE;

const ALTO_CABECERA_TABLA = 20;
const ALTO_FILA = 17;
const ALTO_FILA_TOTAL = 21;

interface ContextoPdf {
  credito: CreditoCliente;
  cliente: string;
  /** dd-mm-aaaa */
  fechaCorte: string;
  /** El logo ya abierto por el documento (ver generarEstadoCuentaPdf). */
  logo: unknown | null;
}

type Pdf = PDFKit.PDFDocument;

export async function generarEstadoCuentaPdf(
  credito: CreditoCliente,
  generadoEn: Date = new Date(),
): Promise<Buffer> {
  const cliente = credito.client?.name?.trim() || 'Cliente';
  const fechaCorte = fecha(hoyEnChile(generadoEn));

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: TOPE, bottom: ALTO_PAGINA - FONDO, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: {
      Title: `Estado de cuenta — ${cliente}`,
      Subject: `Documentos pendientes al ${fechaCorte}`,
      Author: EMPRESA,
      Creator: EMPRESA,
    },
  });

  // pdfkit incrusta el logo de nuevo cada vez que recibe el Buffer, y cada
  // página nueva sumaba otros 90 KB al PDF. Abierto una vez, se incrusta una
  // vez y las demás páginas lo referencian.
  const logo = leerLogo();
  const ctx: ContextoPdf = {
    credito,
    cliente,
    fechaCorte,
    logo: logo ? (doc as any).openImage(logo) : null,
  };

  const partes: Buffer[] = [];
  const listo = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  let y = dibujarCliente(doc, ctx, TOPE);
  y = dibujarResumen(doc, ctx, y + 14);
  y = dibujarDocumentos(doc, ctx, y + 22);
  if (credito.docs.length > 0) {
    dibujarDatosPago(doc, y + 18);
  } else {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.tinta)
      .text(LINEA_CONSULTAS, MARGEN, y + 10, { width: ANCHO_UTIL });
  }

  // Encabezado y pie se pintan al final: solo entonces se sabe cuántas páginas hay.
  // Los dos caen fuera del área de contenido; con los márgenes puestos pdfkit
  // lo tomaría como desborde y agregaría una página en blanco, por eso se anulan
  // mientras se dibujan (mismo truco que el reporte de rendiciones).
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    const margenes = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    dibujarEncabezado(doc, ctx);
    dibujarPie(doc, ctx, i + 1, rango.count);
    doc.page.margins = margenes;
  }

  doc.end();
  return listo;
}

function dibujarEncabezado(doc: Pdf, ctx: ContextoPdf): void {
  const y = MARGEN;

  if (ctx.logo) {
    doc.image(ctx.logo as any, MARGEN, y, { fit: [130, 42] });
  } else {
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLOR.tinta)
      .text('PANORAMICA', MARGEN, y + 10, { lineBreak: false });
  }

  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR.tinta)
    .text('Estado de cuenta', MARGEN, y + 2, { width: ANCHO_UTIL, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(COLOR.tintaSuave)
    .text(`Documentos pendientes al ${ctx.fechaCorte}`, MARGEN, y + 22, {
      width: ANCHO_UTIL,
      align: 'right',
      lineBreak: false,
    });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.tenue)
    .text(`${DATOS_PAGO.razonSocial} · RUT ${DATOS_PAGO.rut}`, MARGEN, y + 35, {
      width: ANCHO_UTIL,
      align: 'right',
      lineBreak: false,
    });

  doc.moveTo(MARGEN, y + ALTO_ENCABEZADO)
    .lineTo(MARGEN + ANCHO_UTIL, y + ALTO_ENCABEZADO)
    .lineWidth(1.2)
    .strokeColor(COLOR.marca)
    .stroke();
}

function dibujarPie(doc: Pdf, ctx: ContextoPdf, actual: number, total: number): void {
  const y = ALTO_PAGINA - MARGEN - 12;
  doc.moveTo(MARGEN, y - 7)
    .lineTo(MARGEN + ANCHO_UTIL, y - 7)
    .lineWidth(0.5)
    .strokeColor(COLOR.borde)
    .stroke();

  doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.tenue);
  const pagina = `Página ${actual} de ${total}`;
  const anchoPagina = doc.widthOfString(pagina) + 12;
  doc.text(recortar(doc, `${ctx.cliente} · Estado de cuenta al ${ctx.fechaCorte}`, ANCHO_UTIL - anchoPagina), MARGEN, y, {
    width: ANCHO_UTIL - anchoPagina,
    lineBreak: false,
  });
  doc.text(pagina, MARGEN, y, { width: ANCHO_UTIL, align: 'right', lineBreak: false });
}

/** Corta con "…" lo que no entra en el ancho, con la fuente que esté puesta. */
function recortar(doc: Pdf, texto: string, ancho: number): string {
  if (doc.widthOfString(texto) <= ancho) return texto;
  let corto = texto;
  while (corto.length > 1 && doc.widthOfString(`${corto}…`) > ancho) corto = corto.slice(0, -1);
  return `${corto.trimEnd()}…`;
}

function dibujarCliente(doc: Pdf, ctx: ContextoPdf, y0: number): number {
  const c = ctx.credito.client;
  let y = y0;

  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.tenue)
    .text('CLIENTE', MARGEN, y, { characterSpacing: 0.8, lineBreak: false });
  y += 11;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.tinta);
  const altoNombre = doc.heightOfString(ctx.cliente, { width: ANCHO_UTIL });
  doc.text(ctx.cliente, MARGEN, y, { width: ANCHO_UTIL });
  y += altoNombre + 3;

  if (!c) return y;

  const lineas = [
    [c.rut ? `RUT ${formatRutDisplay(c.rut)}` : null, c.clientCode ? `Código ${c.clientCode}` : null],
    [lineaDireccion(c) || null],
    [c.phone ? `Teléfono ${c.phone}` : null, c.paymentCondition ? `Condición de pago: ${c.paymentCondition}` : null],
    // Con varias fichas (casa matriz y sucursales) la deuda es la de todas:
    // hay que decirlo, o el total no calza con la ficha que el cliente conoce.
    [c.branchCount > 1 ? `Incluye las ${c.branchCount} fichas de la empresa (casa matriz y sucursales).` : null],
  ];

  doc.font('Helvetica').fontSize(9).fillColor(COLOR.tintaSuave);
  for (const partes of lineas) {
    const texto = partes.filter(Boolean).join('   ·   ');
    if (!texto) continue;
    const alto = doc.heightOfString(texto, { width: ANCHO_UTIL });
    doc.text(texto, MARGEN, y, { width: ANCHO_UTIL });
    y += alto + 2;
  }
  return y;
}

function dibujarResumen(doc: Pdf, ctx: ContextoPdf, y: number): number {
  const { credit, docs } = ctx.credito;
  const vencidos = docs.filter((d) => d.vencida).length;
  const porVencer = docs.length - vencidos;

  const cajas = [
    {
      etiqueta: 'TOTAL ADEUDADO',
      valor: clp(credit.used),
      detalle: documentos(docs.length),
      acento: COLOR.marca,
      colorValor: COLOR.tinta,
    },
    {
      etiqueta: 'VENCIDO',
      valor: clp(credit.overdue),
      detalle: vencidos > 0
        ? `${documentos(vencidos)}${credit.overdueSince ? ` · desde ${fecha(credit.overdueSince)}` : ''}`
        : 'Sin documentos vencidos',
      acento: credit.overdue > 0 ? COLOR.vencido : COLOR.alDia,
      colorValor: credit.overdue > 0 ? COLOR.vencido : COLOR.tinta,
    },
    {
      etiqueta: 'POR VENCER',
      valor: clp(credit.upcoming),
      detalle: porVencer > 0
        ? `${documentos(porVencer)}${credit.nextDueDate ? ` · próximo ${fecha(credit.nextDueDate)}` : ''}`
        : 'Sin documentos por vencer',
      acento: COLOR.porVencer,
      colorValor: COLOR.tinta,
    },
  ];

  const separacion = 10;
  const ancho = (ANCHO_UTIL - separacion * 2) / 3;
  const alto = 56;

  cajas.forEach((caja, i) => {
    const x = MARGEN + i * (ancho + separacion);

    doc.save();
    doc.roundedRect(x, y, ancho, alto, 6).clip();
    doc.rect(x, y, ancho, alto).fill(COLOR.filaAlterna);
    doc.rect(x, y, 3, alto).fill(caja.acento);
    doc.restore();
    doc.roundedRect(x, y, ancho, alto, 6).lineWidth(0.6).strokeColor(COLOR.borde).stroke();

    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.tenue)
      .text(caja.etiqueta, x + 13, y + 10, { width: ancho - 20, characterSpacing: 0.6, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(caja.colorValor)
      .text(caja.valor, x + 13, y + 21, { width: ancho - 20, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.tintaSuave)
      .text(recortar(doc, caja.detalle, ancho - 20), x + 13, y + 41, { width: ancho - 20, lineBreak: false });
  });

  return y + alto;
}

interface ColumnaPdf {
  clave: 'tipo' | 'folio' | 'ficha' | 'emision' | 'vencimiento' | 'dias' | 'facturado' | 'vencido' | 'porVencer';
  titulo: string;
  peso: number;
  alinear: 'left' | 'right';
  valor: (d: DocumentoCredito) => string;
  color?: (d: DocumentoCredito) => string;
  ancho?: number;
}

function columnasPdf(docs: DocumentoCredito[]): Required<ColumnaPdf>[] {
  const sinColor = () => COLOR.tinta;
  // La ficha de cada documento solo hace falta cuando la deuda junta varias
  // (casa matriz y sucursales): con una sola, sería la misma en todas las filas.
  const variasFichas = new Set(docs.map((d) => d.clientCode).filter(Boolean)).size > 1;

  const columnas: ColumnaPdf[] = [
    { clave: 'tipo', titulo: 'Tipo', peso: variasFichas ? 30 : 34, alinear: 'left', valor: (d) => d.tido || '—' },
    { clave: 'folio', titulo: 'Folio', peso: variasFichas ? 60 : 64, alinear: 'left', valor: (d) => d.nudo || '—' },
    ...(variasFichas
      ? [{ clave: 'ficha', titulo: 'Ficha', peso: 58, alinear: 'left', valor: (d: DocumentoCredito) => d.clientCode || '—' } as ColumnaPdf]
      : []),
    { clave: 'emision', titulo: 'Emisión', peso: variasFichas ? 54 : 60, alinear: 'left', valor: (d) => fecha(d.emision) },
    { clave: 'vencimiento', titulo: 'Vencimiento', peso: variasFichas ? 58 : 64, alinear: 'left', valor: (d) => fecha(d.vencimiento) },
    {
      clave: 'dias',
      titulo: 'Días venc.',
      peso: 50,
      alinear: 'right',
      valor: (d) => (d.vencida ? String(d.diasVencido) : '—'),
      color: (d) => (d.vencida ? COLOR.vencido : COLOR.tenue),
    },
    { clave: 'facturado', titulo: 'Monto facturado', peso: variasFichas ? 69 : 81, alinear: 'right', valor: (d) => clp(d.facturado) },
    {
      clave: 'vencido',
      titulo: 'Vencido',
      peso: variasFichas ? 68 : 81,
      alinear: 'right',
      valor: (d) => (d.vencida ? clp(d.saldo) : '—'),
      color: (d) => (d.vencida ? COLOR.vencido : COLOR.tenue),
    },
    {
      clave: 'porVencer',
      titulo: 'Por vencer',
      peso: variasFichas ? 68 : 81,
      alinear: 'right',
      valor: (d) => (d.vencida ? '—' : clp(d.saldo)),
      color: (d) => (d.vencida ? COLOR.tenue : COLOR.tinta),
    },
  ];

  const pesoTotal = columnas.reduce((t, c) => t + c.peso, 0);
  return columnas.map((c) => ({ ...c, color: c.color ?? sinColor, ancho: (c.peso * ANCHO_UTIL) / pesoTotal }));
}

function dibujarDocumentos(doc: Pdf, ctx: ContextoPdf, y0: number): number {
  const { docs, credit } = ctx.credito;
  let y = y0;

  // Título, cabecera y al menos una fila van juntos: un título solo al pie de
  // una página, con la tabla en la siguiente, se lee como una sección vacía.
  if (y + 16 + ALTO_CABECERA_TABLA + ALTO_FILA > FONDO) {
    doc.addPage();
    y = TOPE;
  }

  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR.tinta)
    .text('Detalle de documentos', MARGEN, y, { lineBreak: false });
  if (docs.length > 0) {
    doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.tenue)
      .text('Ordenados por fecha de vencimiento', MARGEN, y + 2.5, { width: ANCHO_UTIL, align: 'right', lineBreak: false });
  }
  y += 18;

  if (docs.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(COLOR.tintaSuave)
      .text(`El cliente no registra documentos pendientes al ${ctx.fechaCorte}.`, MARGEN, y + 4, { width: ANCHO_UTIL });
    return y + 22;
  }

  const columnas = columnasPdf(docs);
  const PAD = 5;
  // Una celda nunca baja de línea: si el texto no entra se corta con "…". Si
  // pdfkit lo partiera, la segunda línea se montaría sobre la fila de abajo.
  const celda = (texto: string, x: number, yc: number, ancho: number, alinear: 'left' | 'right') =>
    doc.text(recortar(doc, texto, ancho - PAD * 2), x + PAD, yc, {
      width: ancho - PAD * 2,
      align: alinear,
      lineBreak: false,
    });

  const cabecera = (yc: number): number => {
    doc.rect(MARGEN, yc, ANCHO_UTIL, ALTO_CABECERA_TABLA).fill(COLOR.noche);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
    let x = MARGEN;
    for (const col of columnas) {
      celda(col.titulo, x, yc + 6.5, col.ancho, col.alinear);
      x += col.ancho;
    }
    return yc + ALTO_CABECERA_TABLA;
  };

  y = cabecera(y);

  docs.forEach((d, i) => {
    if (y + ALTO_FILA > FONDO) {
      doc.addPage();
      y = cabecera(TOPE);
    }
    if (i % 2 === 1) doc.rect(MARGEN, y, ANCHO_UTIL, ALTO_FILA).fill(COLOR.filaAlterna);

    let x = MARGEN;
    for (const col of columnas) {
      doc.font('Helvetica').fontSize(8).fillColor(col.color(d));
      celda(col.valor(d), x, y + 5, col.ancho, col.alinear);
      x += col.ancho;
    }
    doc.moveTo(MARGEN, y + ALTO_FILA)
      .lineTo(MARGEN + ANCHO_UTIL, y + ALTO_FILA)
      .lineWidth(0.4)
      .strokeColor(COLOR.borde)
      .stroke();
    y += ALTO_FILA;
  });

  // Fila de totales: si no entra, baja con la cabecera para no quedar suelta.
  if (y + ALTO_FILA_TOTAL > FONDO) {
    doc.addPage();
    y = cabecera(TOPE);
  }
  doc.rect(MARGEN, y, ANCHO_UTIL, ALTO_FILA_TOTAL).fill(COLOR.fondoTotal);
  doc.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO_UTIL, y).lineWidth(1).strokeColor(COLOR.marca).stroke();

  const totalFacturado = docs.reduce((t, d) => t + d.facturado, 0);
  const totales: Partial<Record<ColumnaPdf['clave'], { texto: string; color: string }>> = {
    facturado: { texto: clp(totalFacturado), color: COLOR.tinta },
    vencido: { texto: clp(credit.overdue), color: credit.overdue > 0 ? COLOR.vencido : COLOR.tinta },
    porVencer: { texto: clp(credit.upcoming), color: COLOR.tinta },
  };
  const anchoEtiqueta = columnas
    .slice(0, columnas.findIndex((c) => c.clave === 'facturado'))
    .reduce((t, c) => t + c.ancho, 0);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.tinta)
    .text(`Total · ${documentos(docs.length)}`, MARGEN + PAD, y + 7, {
      width: anchoEtiqueta - PAD * 2,
      lineBreak: false,
    });
  let x = MARGEN;
  for (const col of columnas) {
    const total = totales[col.clave];
    if (total) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(total.color);
      celda(total.texto, x, y + 7, col.ancho, 'right');
    }
    x += col.ancho;
  }
  y += ALTO_FILA_TOTAL;

  // Con abonos el saldo es menor que lo facturado, y la fila no "suma": se explica.
  if (docs.some((d) => d.abonado > 0)) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLOR.tintaSuave)
      .text(
        'Vencido y Por vencer muestran lo que queda por pagar de cada documento: si tuvo abonos, es menos que el monto facturado.',
        MARGEN,
        y + 6,
        { width: ANCHO_UTIL },
      );
    y += 18;
  }

  return y;
}

function dibujarDatosPago(doc: Pdf, y0: number): void {
  const ALTO_FRANJA = 18;
  const ALTO_CUERPO = 58;
  const ALTO_CIERRE = 24;
  let y = y0;

  if (y + ALTO_FRANJA + ALTO_CUERPO + ALTO_CIERRE > FONDO) {
    doc.addPage();
    y = TOPE;
  }

  doc.rect(MARGEN, y, ANCHO_UTIL, ALTO_FRANJA).fill(COLOR.noche);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff')
    .text('DATOS PARA EL PAGO', MARGEN + 12, y + 6, { characterSpacing: 0.6, lineBreak: false });
  y += ALTO_FRANJA;

  doc.rect(MARGEN, y, ANCHO_UTIL, ALTO_CUERPO).lineWidth(0.6).strokeColor(COLOR.borde).stroke();

  const mitad = ANCHO_UTIL / 2;
  const columna = (x: number, titulo: string, lineas: Array<{ texto: string; link?: string }>) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR.marca)
      .text(titulo, x, y + 10, { width: mitad - 24, lineBreak: false });
    lineas.forEach((l, i) => {
      doc.font('Helvetica').fontSize(8).fillColor(l.link ? COLOR.marca : COLOR.tintaSuave)
        .text(l.texto, x, y + 23 + i * 11, { width: mitad - 24, lineBreak: false, link: l.link });
    });
  };

  // Sin pago con tarjeta: quien recibe un estado de cuenta tiene cuenta
  // corriente y paga por transferencia (el botón de pago cobra comisión).
  columna(MARGEN + 12, 'Transferencia bancaria', [
    { texto: DATOS_PAGO.razonSocial },
    { texto: `RUT ${DATOS_PAGO.rut}` },
    { texto: `${DATOS_PAGO.tipoCuenta} ${DATOS_PAGO.banco} N° ${DATOS_PAGO.numeroCuenta}` },
  ]);
  columna(MARGEN + mitad + 12, 'Envíe su comprobante a', [
    { texto: CONTACTO_COBRANZA.correo, link: `mailto:${CONTACTO_COBRANZA.correo}` },
    { texto: `Con copia a ${CONTACTO_COBRANZA.copia}` },
  ]);
  y += ALTO_CUERPO;

  // Las consultas van en negrita y con un solo correo: el del comprobante no
  // atiende preguntas, y así no se confunde con el bloque de arriba.
  doc.font('Helvetica').fontSize(8).fillColor(COLOR.tintaSuave)
    .text('Si ya pagó alguno de estos documentos, por favor omítalo. ', MARGEN, y + 10, {
      width: ANCHO_UTIL,
      continued: true,
    })
    .font('Helvetica-Bold').fillColor(COLOR.tinta)
    .text(LINEA_CONSULTAS);
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel
// ═══════════════════════════════════════════════════════════════════════════

const FORMATO_CLP = '"$"#,##0';
/** En la tabla un cero se lee mejor como guion: la mitad de las celdas de Vencido y Por vencer lo son. */
const FORMATO_CLP_TABLA = '"$"#,##0;-"$"#,##0;"-"';
const FORMATO_FECHA = 'dd-mm-yyyy';
const ARGB_MARCA = 'FFFD6301';
const ARGB_FONDO_TOTAL = 'FFFFF7ED';
const ARGB_VENCIDO = 'FFDC2626';
const ARGB_TENUE = 'FF6B7280';

export async function generarEstadoCuentaExcel(
  credito: CreditoCliente,
  generadoEn: Date = new Date(),
): Promise<Buffer> {
  const { client: c, credit, docs } = credito;
  const cliente = c?.name?.trim() || 'Cliente';
  const fechaCorte = fecha(hoyEnChile(generadoEn));

  const wb = new ExcelJS.Workbook();
  wb.creator = EMPRESA;
  wb.created = generadoEn;
  // exceljs no guarda un resultado precalculado en 0: sin recálculo al abrir,
  // la suma del abonado quedaría en blanco en vez de mostrar el guion.
  wb.calcProperties.fullCalcOnLoad = true;

  const hoja = wb.addWorksheet('Estado de cuenta', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const columnas: Array<{ titulo: string; ancho: number; alinear: 'left' | 'center' | 'right' }> = [
    { titulo: 'Tipo', ancho: 9, alinear: 'left' },
    { titulo: 'Folio', ancho: 14, alinear: 'left' },
    { titulo: 'Ficha', ancho: 13, alinear: 'left' },
    // Excel alinea las fechas a la derecha: la cabecera las acompaña.
    { titulo: 'Fecha emisión', ancho: 15, alinear: 'right' },
    { titulo: 'Fecha vencimiento', ancho: 20, alinear: 'right' },
    { titulo: 'Días vencido', ancho: 14, alinear: 'right' },
    { titulo: 'Estado', ancho: 13, alinear: 'center' },
    { titulo: 'Monto facturado', ancho: 18, alinear: 'right' },
    { titulo: 'Abonado', ancho: 15, alinear: 'right' },
    { titulo: 'Saldo', ancho: 16, alinear: 'right' },
    { titulo: 'Vencido', ancho: 16, alinear: 'right' },
    { titulo: 'Por vencer', ancho: 16, alinear: 'right' },
  ];
  columnas.forEach((col, i) => {
    hoja.getColumn(i + 1).width = col.ancho;
  });
  const ULTIMA = columnas.length;

  // ── Encabezado ──
  hoja.mergeCells(1, 1, 1, 7);
  hoja.getCell(1, 1).value = 'Estado de cuenta';
  hoja.getCell(1, 1).font = { bold: true, size: 16 };
  hoja.mergeCells(2, 1, 2, 7);
  hoja.getCell(2, 1).value = `${DATOS_PAGO.razonSocial} · RUT ${DATOS_PAGO.rut}`;
  hoja.getCell(2, 1).font = { size: 10, color: { argb: ARGB_TENUE } };
  hoja.mergeCells(3, 1, 3, 7);
  hoja.getCell(3, 1).value = `Documentos pendientes al ${fechaCorte}`;
  hoja.getCell(3, 1).font = { size: 10, color: { argb: ARGB_TENUE } };

  // ── Datos del cliente y resumen: etiqueta en A:B, valor en C:G ──
  let fila = 5;
  const dato = (etiqueta: string, valor: string | number | null | undefined, formato?: string) => {
    if (valor == null || valor === '') return;
    hoja.mergeCells(fila, 1, fila, 2);
    hoja.mergeCells(fila, 3, fila, 7);
    const celdaEtiqueta = hoja.getCell(fila, 1);
    celdaEtiqueta.value = etiqueta;
    celdaEtiqueta.font = { bold: true, color: { argb: ARGB_TENUE } };
    const celdaValor = hoja.getCell(fila, 3);
    celdaValor.value = valor;
    celdaValor.alignment = { horizontal: 'left' };
    if (formato) celdaValor.numFmt = formato;
    fila++;
  };

  dato('Cliente', cliente);
  if (c) {
    dato('RUT', c.rut ? formatRutDisplay(c.rut) : null);
    dato('Código', c.clientCode);
    dato('Dirección', lineaDireccion(c) || null);
    dato('Teléfono', c.phone);
    dato('Condición de pago', c.paymentCondition);
    if (c.branchCount > 1) dato('Fichas', `${c.branchCount} (casa matriz y sucursales)`);
  }
  fila++;
  dato('Total adeudado', credit.used, FORMATO_CLP);
  dato('Vencido', credit.overdue, FORMATO_CLP);
  dato('Por vencer', credit.upcoming, FORMATO_CLP);
  dato('Documentos', docs.length);
  fila++;

  // ── Tabla ──
  const filaCabecera = fila;
  const cabecera = hoja.getRow(filaCabecera);
  columnas.forEach((col, i) => {
    const celda = cabecera.getCell(i + 1);
    celda.value = col.titulo;
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_MARCA } };
    celda.alignment = { vertical: 'middle', horizontal: col.alinear };
  });
  cabecera.height = 20;

  docs.forEach((d, i) => {
    const r = hoja.getRow(filaCabecera + 1 + i);
    r.values = [
      d.tido || '',
      d.nudo || '',
      d.clientCode || '',
      fechaExcel(d.emision),
      fechaExcel(d.vencimiento),
      d.vencida ? d.diasVencido : null,
      d.vencida ? 'Vencido' : 'Por vencer',
      d.facturado,
      d.abonado,
      d.saldo,
      d.vencida ? d.saldo : 0,
      d.vencida ? 0 : d.saldo,
    ];
    r.getCell(4).numFmt = FORMATO_FECHA;
    r.getCell(5).numFmt = FORMATO_FECHA;
    r.getCell(7).alignment = { horizontal: 'center' };
    for (let col = 8; col <= ULTIMA; col++) r.getCell(col).numFmt = FORMATO_CLP_TABLA;
    if (d.vencida) {
      r.getCell(6).font = { color: { argb: ARGB_VENCIDO } };
      r.getCell(7).font = { color: { argb: ARGB_VENCIDO } };
      r.getCell(11).font = { color: { argb: ARGB_VENCIDO } };
    }
  });

  const primeraDato = filaCabecera + 1;
  const ultimaDato = filaCabecera + docs.length;

  if (docs.length > 0) {
    // SUBTOTAL(109, …) suma solo las filas visibles: filtrando por "Vencido" el
    // total sigue al filtro. El resultado va precalculado para los visores que
    // no recalculan (la vista previa del correo, por ejemplo).
    const filaTotal = hoja.getRow(ultimaDato + 1);
    filaTotal.getCell(1).value = `Total · ${documentos(docs.length)}`;
    const sumas: Record<number, number> = {
      8: docs.reduce((t, d) => t + d.facturado, 0),
      9: docs.reduce((t, d) => t + d.abonado, 0),
      10: credit.used,
      11: credit.overdue,
      12: credit.upcoming,
    };
    for (const [col, resultado] of Object.entries(sumas)) {
      const letra = hoja.getColumn(Number(col)).letter;
      const celda = filaTotal.getCell(Number(col));
      celda.value = { formula: `SUBTOTAL(109,${letra}${primeraDato}:${letra}${ultimaDato})`, result: resultado };
      celda.numFmt = FORMATO_CLP_TABLA;
    }
    for (let col = 1; col <= ULTIMA; col++) {
      const celda = filaTotal.getCell(col);
      celda.font = { bold: true };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_FONDO_TOTAL } };
      celda.border = { top: { style: 'thin', color: { argb: ARGB_MARCA } } };
    }

    // El filtro cubre solo los documentos: si tomara la fila de totales, al
    // ordenar la mezclaría con ellos.
    hoja.autoFilter = {
      from: { row: filaCabecera, column: 1 },
      to: { row: ultimaDato, column: ULTIMA },
    };
  } else {
    hoja.getCell(primeraDato, 1).value = `El cliente no registra documentos pendientes al ${fechaCorte}.`;
    hoja.getCell(primeraDato, 1).font = { italic: true, color: { argb: ARGB_TENUE } };
  }

  // La cabecera de la tabla queda fija al bajar.
  hoja.views = [{ state: 'frozen', ySplit: filaCabecera }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ═══════════════════════════════════════════════════════════════════════════
// Rutas
// ═══════════════════════════════════════════════════════════════════════════

export function generarEstadoCuenta(
  credito: CreditoCliente,
  formato: FormatoEstadoCuenta,
  generadoEn: Date = new Date(),
): Promise<Buffer> {
  return formato === 'xlsx'
    ? generarEstadoCuentaExcel(credito, generadoEn)
    : generarEstadoCuentaPdf(credito, generadoEn);
}

/**
 * GET /api/clients/estado-cuenta?name=&rut=&formato=pdf|xlsx&ver=1
 *
 * name y rut son los mismos con los que la pantalla consultó /api/clients/credito:
 * con otros, el alcance de fichas podría ser otro y el archivo no cuadraría con
 * lo que se está viendo. `ver=1` lo abre en el navegador en vez de descargarlo.
 *
 * Se registra desde routes.ts, al lado de /api/clients/credito y ANTES de
 * /api/clients/:koen: registrada después, esa ruta la tomaría como un código de
 * cliente y respondería "Cliente no encontrado".
 */
export function registerEstadoCuentaRoutes(app: Express): void {
  app.get('/api/clients/estado-cuenta', requireAuth, async (req: any, res: any) => {
    const ver = req.query.ver === '1';
    const error = (status: number, message: string) =>
      // En una pestaña nueva un JSON se ve como código: ahí va en texto plano.
      ver ? res.status(status).type('text/plain; charset=utf-8').send(message) : res.status(status).json({ message });

    try {
      // Un usuario del Market es un cliente: no puede pedir la cartera de otro.
      if (req.user?.role === 'client') return error(403, 'No autorizado');

      const name = String(req.query.name || '').trim();
      const rut = String(req.query.rut || '').trim();
      if (!name && !rut) return error(400, 'name o rut es requerido');
      const formato: FormatoEstadoCuenta = req.query.formato === 'xlsx' ? 'xlsx' : 'pdf';

      const credito = await obtenerCreditoCliente({ name, rut });
      if (!credito.client) return error(404, 'Cliente no encontrado');

      const generadoEn = new Date();
      const archivo = await generarEstadoCuenta(credito, formato, generadoEn);
      const nombre = nombreArchivoEstadoCuenta(credito, formato, generadoEn);

      res.setHeader('Content-Type', TIPO_CONTENIDO[formato]);
      res.setHeader('Content-Disposition', contentDisposition(ver && formato === 'pdf' ? 'inline' : 'attachment', nombre));
      // Es la deuda de hoy: una copia en caché sería un estado de cuenta viejo.
      res.setHeader('Cache-Control', 'no-store');
      res.send(archivo);
    } catch (e: any) {
      console.error('[estado-cuenta] error:', e);
      if (res.headersSent) return res.end();
      error(500, 'No se pudo generar el estado de cuenta');
    }
  });
}
