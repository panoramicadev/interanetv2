/**
 * Reportes de rendición de gastos — PDF y Excel generados en el servidor.
 *
 * Portado de primerosresultados/rendicion-gastos (server/src/modules/reports)
 * y adaptado al modelo de interanetv2. Cambios respecto del original:
 *  - Lee `gastos_empresariales` (no `expenses`) y resuelve el usuario por
 *    first_name/last_name en vez de `users.name`.
 *  - Los comprobantes se descargan desde `archivo_url`, que puede ser una URL
 *    pública (Supabase / Object Storage) o una ruta relativa servida desde
 *    `public/` — no hay una capa StorageProvider como en el origen.
 *  - Paleta de marca Pinturas Panorámica (naranja #fd6301) en vez del negro.
 *
 * Streaming-first: el PDF y el XLSX se pipean a la respuesta HTTP mientras se
 * escriben; no se acumulan páginas ni filas completas en memoria.
 */
import type { Express } from 'express';
import path from 'path';
import { Buffer } from 'node:buffer';
import type { Writable } from 'node:stream';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { requireAuth } from '../auth';
import { gastosEmpresariales, informesRendicion, users } from '../../shared/schema';

// ─── Marca ──────────────────────────────────────────────────────────────────

const COLORS = {
  /** Naranja de marca Panorámica — el mismo del logo y del sidebar. */
  brand: '#fd6301',
  ink: '#17181c',
  inkSoft: '#4b5563',
  inkMuted: '#9ca3af',
  surface: '#ffffff',
  border: '#e5e7eb',
  rowAlt: '#f9fafb',
  aprobado: '#16a34a',
  pendiente: '#d97706',
  rechazado: '#dc2626',
  pagado: '#0ea5e9',
  /** Arranca en el naranja de marca y se abre a tonos que contrastan entre sí. */
  donut: [
    '#fd6301',
    '#17181c',
    '#0ea5e9',
    '#16a34a',
    '#d97706',
    '#7c3aed',
    '#dc2626',
    '#14b8a6',
    '#9ca3af',
    '#ea580c',
  ],
};

const MARGIN = 40;
const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 56;
const FOOTER_H = 28;
const CONTENT_TOP = MARGIN + HEADER_H + 8;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H - 8;

const EMPRESA = 'Pinturas Panorámica';

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  pagado: 'Pagado',
};

const ETIQUETA_FUNDING: Record<string, string> = {
  reembolso: 'Reembolso',
  con_fondo: 'Con fondo',
};

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface FiltrosReporte {
  fechaDesde?: string;
  fechaHasta?: string;
  userId?: string;
  categoria?: string;
  centroCostos?: string;
  segmentCode?: string;
  estado?: string;
  informeId?: string;
  incluirComprobantes: boolean;
}

interface GastoReporte {
  id: string;
  fecha: string; // YYYY-MM-DD
  userId: string | null;
  usuario: string;
  descripcion: string;
  categoria: string | null;
  centroCostos: string | null;
  proyecto: string | null;
  fundingMode: string;
  monto: number;
  /** Estado efectivo: si el informe que lo contiene está pagado, "pagado". */
  estado: string;
  proveedor: string | null;
  rutProveedor: string | null;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
  ruta: string | null;
  ciudad: string | null;
  clientes: string | null;
  informeTitulo: string | null;
  archivoUrl: string | null;
}

interface DatasetReporte {
  generadoEn: Date;
  generadoPor: string;
  etiquetaPeriodo: string;
  filtros: FiltrosReporte;
  gastos: GastoReporte[];
  kpis: {
    total: number;
    aprobadoMonto: number;
    aprobadoCant: number;
    pendienteMonto: number;
    pendienteCant: number;
    rechazadoMonto: number;
    rechazadoCant: number;
    pagadoMonto: number;
    pagadoCant: number;
  };
  porCategoria: { categoria: string; monto: number; cantidad: number }[];
  porUsuario: { usuario: string; monto: number; cantidad: number }[];
}

// ─── Helpers de formato ─────────────────────────────────────────────────────

function formatoMoneda(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatoFecha(yyyyMmDd: string | null | undefined): string {
  if (!yyyyMmDd) return '—';
  const [y, m, d] = String(yyyyMmDd).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(yyyyMmDd);
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "Junio 2026" si el rango cubre un mes exacto; si no, "01/06/2026 — 15/07/2026". */
function etiquetaPeriodo(desde?: string, hasta?: string): string {
  if (!desde && !hasta) return 'Todos los períodos';
  if (desde && hasta) {
    const [y1, m1, d1] = desde.split('-').map(Number);
    const [y2, m2] = hasta.split('-').map(Number);
    const ultimoDia = new Date(y2, m2, 0).getDate();
    const esMesCompleto =
      y1 === y2 && m1 === m2 && d1 === 1 && Number(hasta.split('-')[2]) === ultimoDia;
    if (esMesCompleto) return `${MESES[m1 - 1]} ${y1}`;
    return `${formatoFecha(desde)} — ${formatoFecha(hasta)}`;
  }
  return desde ? `Desde ${formatoFecha(desde)}` : `Hasta ${formatoFecha(hasta!)}`;
}

function nombreUsuario(u: { firstName?: string | null; lastName?: string | null; email?: string | null }): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return n || u.email || 'Usuario';
}

// ─── Construcción del dataset ───────────────────────────────────────────────

/** Roles que ven los gastos de todos. El resto solo los propios. */
const ROLES_PRIVILEGIADOS = ['admin', 'supervisor', 'encargado_area', 'recursos_humanos'];

async function construirDataset(
  filtros: FiltrosReporte,
  actor: { id: string; role: string; firstName?: string | null; lastName?: string | null; email?: string | null },
): Promise<DatasetReporte> {
  const condiciones = [];

  // Alcance por rol: un colaborador solo puede reportar lo suyo, aunque pida
  // otro userId en la query.
  if (!ROLES_PRIVILEGIADOS.includes(actor.role)) {
    condiciones.push(eq(gastosEmpresariales.userId, actor.id));
  } else if (filtros.userId) {
    condiciones.push(eq(gastosEmpresariales.userId, filtros.userId));
  }

  if (filtros.fechaDesde) condiciones.push(gte(gastosEmpresariales.fechaEmision, filtros.fechaDesde));
  if (filtros.fechaHasta) condiciones.push(lte(gastosEmpresariales.fechaEmision, filtros.fechaHasta));
  if (filtros.categoria) condiciones.push(eq(gastosEmpresariales.categoria, filtros.categoria));
  if (filtros.centroCostos) condiciones.push(eq(gastosEmpresariales.centroCostos, filtros.centroCostos));
  if (filtros.segmentCode) condiciones.push(eq(gastosEmpresariales.segmentCode, filtros.segmentCode));
  if (filtros.estado) condiciones.push(eq(gastosEmpresariales.estado, filtros.estado));
  if (filtros.informeId) condiciones.push(eq(gastosEmpresariales.informeId, filtros.informeId));

  const filas = await db
    .select({
      g: gastosEmpresariales,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      informeTitulo: informesRendicion.titulo,
      informeEstado: informesRendicion.estado,
    })
    .from(gastosEmpresariales)
    .leftJoin(users, eq(users.id, gastosEmpresariales.userId))
    .leftJoin(informesRendicion, eq(informesRendicion.id, gastosEmpresariales.informeId))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(gastosEmpresariales.fechaEmision), desc(gastosEmpresariales.createdAt));

  const gastos: GastoReporte[] = filas.map((f) => {
    // Un gasto aprobado cuyo informe ya se pagó cuenta como "pagado": es el
    // único punto del modelo donde el pago queda registrado.
    const estado =
      f.informeEstado === 'pagado' && f.g.estado === 'aprobado' ? 'pagado' : f.g.estado;

    return {
      id: f.g.id,
      fecha: String(f.g.fechaEmision ?? f.g.createdAt?.toISOString().slice(0, 10) ?? ''),
      userId: f.g.userId,
      usuario: nombreUsuario({
        firstName: f.userFirstName,
        lastName: f.userLastName,
        email: f.userEmail,
      }),
      descripcion: f.g.descripcion,
      categoria: f.g.categoria,
      centroCostos: f.g.centroCostos,
      proyecto: f.g.proyecto,
      fundingMode: f.g.fundingMode ?? 'reembolso',
      monto: Number(f.g.monto ?? 0),
      estado,
      proveedor: f.g.proveedor,
      rutProveedor: f.g.rutProveedor,
      numeroDocumento: f.g.numeroDocumento,
      tipoDocumento: f.g.tipoDocumento,
      ruta: f.g.ruta,
      ciudad: f.g.ciudad,
      clientes: f.g.clientes,
      informeTitulo: f.informeTitulo,
      archivoUrl: f.g.archivoUrl,
    };
  });

  const kpis = {
    total: 0,
    aprobadoMonto: 0,
    aprobadoCant: 0,
    pendienteMonto: 0,
    pendienteCant: 0,
    rechazadoMonto: 0,
    rechazadoCant: 0,
    pagadoMonto: 0,
    pagadoCant: 0,
  };
  const mapaCategoria = new Map<string, { monto: number; cantidad: number }>();
  const mapaUsuario = new Map<string, { monto: number; cantidad: number }>();

  for (const g of gastos) {
    // Los rechazados no suman al total del período: no son gasto real.
    if (g.estado !== 'rechazado') kpis.total += g.monto;

    if (g.estado === 'aprobado') {
      kpis.aprobadoMonto += g.monto;
      kpis.aprobadoCant += 1;
    } else if (g.estado === 'pagado') {
      kpis.pagadoMonto += g.monto;
      kpis.pagadoCant += 1;
      // Un pagado también estuvo aprobado; lo contamos en ambos cubos para
      // que "aprobados" siga leyéndose como "todo lo que pasó el filtro".
      kpis.aprobadoMonto += g.monto;
      kpis.aprobadoCant += 1;
    } else if (g.estado === 'rechazado') {
      kpis.rechazadoMonto += g.monto;
      kpis.rechazadoCant += 1;
    } else {
      kpis.pendienteMonto += g.monto;
      kpis.pendienteCant += 1;
    }

    if (g.estado !== 'rechazado') {
      const cat = g.categoria || 'Sin categoría';
      const acuCat = mapaCategoria.get(cat) ?? { monto: 0, cantidad: 0 };
      mapaCategoria.set(cat, { monto: acuCat.monto + g.monto, cantidad: acuCat.cantidad + 1 });

      const acuUsr = mapaUsuario.get(g.usuario) ?? { monto: 0, cantidad: 0 };
      mapaUsuario.set(g.usuario, { monto: acuUsr.monto + g.monto, cantidad: acuUsr.cantidad + 1 });
    }
  }

  return {
    generadoEn: new Date(),
    generadoPor: nombreUsuario(actor),
    etiquetaPeriodo: etiquetaPeriodo(filtros.fechaDesde, filtros.fechaHasta),
    filtros,
    gastos,
    kpis,
    porCategoria: Array.from(mapaCategoria.entries())
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.monto - a.monto),
    porUsuario: Array.from(mapaUsuario.entries())
      .map(([usuario, v]) => ({ usuario, ...v }))
      .sort((a, b) => b.monto - a.monto),
  };
}

function leerFiltros(query: any): FiltrosReporte {
  const fecha = (v: unknown) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  return {
    fechaDesde: fecha(query.fechaDesde),
    fechaHasta: fecha(query.fechaHasta),
    userId: texto(query.userId),
    categoria: texto(query.categoria),
    centroCostos: texto(query.centroCostos),
    segmentCode: texto(query.segmentCode),
    estado: texto(query.estado),
    informeId: texto(query.informeId),
    incluirComprobantes: query.incluirComprobantes === 'true' || query.incluirComprobantes === '1',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════════

async function generarPdf(salida: Writable, ds: DatasetReporte): Promise<void> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: CONTENT_TOP, bottom: PAGE_H - CONTENT_BOTTOM, left: MARGIN, right: MARGIN },
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: `Rendición de gastos — ${EMPRESA} — ${ds.etiquetaPeriodo}`,
      Author: ds.generadoPor,
      Creator: EMPRESA,
    },
  });

  doc.pipe(salida);

  dibujarPortada(doc, ds);

  doc.addPage();
  dibujarKpisYGraficos(doc, ds);

  const aprobados = ds.gastos.filter((g) => g.estado === 'aprobado' || g.estado === 'pagado');
  const pendientes = ds.gastos.filter((g) => g.estado === 'pendiente');
  const rechazados = ds.gastos.filter((g) => g.estado === 'rechazado');

  dibujarTabla(doc, 'Aprobados', aprobados, COLORS.aprobado);
  dibujarTabla(doc, 'Pendientes', pendientes, COLORS.pendiente);
  dibujarTabla(doc, 'Rechazados', rechazados, COLORS.rechazado);

  if (ds.filtros.incluirComprobantes) {
    const conBoleta = [...aprobados, ...pendientes].filter((g) => g.archivoUrl);
    doc.addPage();
    dibujarTituloSeccion(doc, 'Comprobantes adjuntos');
    if (conBoleta.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .fillColor(COLORS.inkSoft)
        .text('No hay gastos con comprobante adjunto en este reporte.', MARGIN, doc.y);
    } else {
      await dibujarComprobantesPorLotes(doc, conBoleta);
    }
  }

  // Header y footer se pintan al final: recién ahí se conoce el total de páginas.
  //
  // Ambos viven FUERA del área de contenido (el header sobre el margen superior,
  // el footer bajo el inferior). Si se escriben con los márgenes normales pdfkit
  // interpreta cada uno como desborde y agrega una página en blanco — por eso se
  // anulan los márgenes mientras se dibujan.
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    const margenes = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    dibujarHeader(doc, ds);
    dibujarFooter(doc, ds, i + 1, rango.count);
    doc.page.margins = margenes;
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    salida.on('finish', () => resolve());
    salida.on('error', reject);
  });
}

function dibujarPortada(doc: PDFKit.PDFDocument, ds: DatasetReporte): void {
  doc.y = CONTENT_TOP + 90;

  const logo = 64;
  const logoX = (PAGE_W - logo) / 2;
  doc.roundedRect(logoX, doc.y, logo, logo, 14).fill(COLORS.brand);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(34)
    .text('P', logoX, doc.y + 15, { width: logo, align: 'center' });
  doc.y += logo + 34;

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(28)
    .text('Rendición de gastos', MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.4);
  doc
    .font('Helvetica')
    .fontSize(14)
    .fillColor(COLORS.inkSoft)
    .text(EMPRESA, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.2);
  doc
    .fontSize(12)
    .fillColor(COLORS.inkMuted)
    .text(ds.etiquetaPeriodo, { width: CONTENT_W, align: 'center' });
  doc.moveDown(2.4);

  const filtros = describirFiltros(ds);
  if (filtros) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink).text('Filtros aplicados:', MARGIN, doc.y);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.inkSoft).text(filtros, { width: CONTENT_W });
  }
}

function describirFiltros(ds: DatasetReporte): string {
  const f = ds.filtros;
  const partes: string[] = [];
  if (f.userId) partes.push('colaborador específico');
  if (f.categoria) partes.push(`categoría: ${f.categoria}`);
  if (f.centroCostos) partes.push(`centro de costo: ${f.centroCostos}`);
  if (f.segmentCode) partes.push(`segmento: ${f.segmentCode}`);
  if (f.estado) partes.push(`estado: ${ETIQUETA_ESTADO[f.estado] ?? f.estado}`);
  if (f.informeId) partes.push('un solo informe');
  return partes.join(' · ');
}

function dibujarHeader(doc: PDFKit.PDFDocument, ds: DatasetReporte): void {
  const y = MARGIN;
  doc.save();
  doc.roundedRect(MARGIN, y, 28, 28, 7).fill(COLORS.brand);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(15)
    .text('P', MARGIN, y + 6, { width: 28, align: 'center' });
  doc.restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.ink)
    .text(EMPRESA, MARGIN + 36, y + 2, { width: CONTENT_W - 36 });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.inkMuted)
    .text(`Rendición de gastos · ${ds.etiquetaPeriodo}`, MARGIN + 36, y + 16, {
      width: CONTENT_W - 36,
    });

  doc
    .moveTo(MARGIN, y + 36)
    .lineTo(PAGE_W - MARGIN, y + 36)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();
}

function dibujarFooter(
  doc: PDFKit.PDFDocument,
  ds: DatasetReporte,
  actual: number,
  total: number,
): void {
  const y = PAGE_H - MARGIN - 14;
  doc
    .moveTo(MARGIN, y - 6)
    .lineTo(PAGE_W - MARGIN, y - 6)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.inkMuted);
  const fecha = ds.generadoEn.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
  doc.text(`Generado el ${fecha} por ${ds.generadoPor}`, MARGIN, y, {
    width: CONTENT_W,
    align: 'left',
  });
  doc.text(`Página ${actual} de ${total}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
}

function dibujarTituloSeccion(doc: PDFKit.PDFDocument, titulo: string): void {
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.ink).text(titulo, MARGIN, doc.y);
  doc.moveDown(0.4);
}

function dibujarKpisYGraficos(doc: PDFKit.PDFDocument, ds: DatasetReporte): void {
  dibujarTituloSeccion(doc, 'Resumen del período');

  const k = ds.kpis;
  const anchoTarjeta = (CONTENT_W - 12) / 2;
  const altoTarjeta = 72;
  const y0 = doc.y;

  dibujarKpi(doc, MARGIN, y0, anchoTarjeta, altoTarjeta, 'Total del período', formatoMoneda(k.total), `${ds.gastos.length} gastos`, COLORS.brand);
  dibujarKpi(doc, MARGIN + anchoTarjeta + 12, y0, anchoTarjeta, altoTarjeta, 'Aprobados', formatoMoneda(k.aprobadoMonto), `${k.aprobadoCant} gastos`, COLORS.aprobado);
  dibujarKpi(doc, MARGIN, y0 + altoTarjeta + 12, anchoTarjeta, altoTarjeta, 'Pendientes', formatoMoneda(k.pendienteMonto), `${k.pendienteCant} gastos`, COLORS.pendiente);
  dibujarKpi(doc, MARGIN + anchoTarjeta + 12, y0 + altoTarjeta + 12, anchoTarjeta, altoTarjeta, 'Rechazados', formatoMoneda(k.rechazadoMonto), `${k.rechazadoCant} gastos`, COLORS.rechazado);

  doc.y = y0 + (altoTarjeta + 12) * 2 + 20;

  dibujarTituloSeccion(doc, 'Distribución');

  if (ds.porCategoria.length === 0) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor(COLORS.inkSoft)
      .text('Sin datos suficientes para graficar.', MARGIN, doc.y);
    return;
  }

  const yGraf = doc.y;
  const anchoIzq = (CONTENT_W - 16) * 0.45;
  const anchoDer = (CONTENT_W - 16) * 0.55;
  const altoDonut = dibujarDonut(doc, MARGIN, yGraf, anchoIzq, ds.porCategoria);
  const altoBarras = dibujarBarras(doc, MARGIN + anchoIzq + 16, yGraf, anchoDer, ds.porUsuario);
  doc.y = yGraf + Math.max(altoDonut, altoBarras) + 12;
}

function dibujarKpi(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  etiqueta: string,
  valor: string,
  sub: string,
  acento: string,
): void {
  doc.save();
  doc.rect(x, y, w, h).fillAndStroke(COLORS.surface, COLORS.border);
  doc.rect(x, y, 4, h).fill(acento);
  doc
    .fillColor(COLORS.inkMuted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(etiqueta.toUpperCase(), x + 14, y + 12, { width: w - 24, characterSpacing: 0.5 });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(valor, x + 14, y + 28, { width: w - 24 });
  doc
    .fillColor(COLORS.inkSoft)
    .font('Helvetica')
    .fontSize(9)
    .text(sub, x + 14, y + 52, { width: w - 24 });
  doc.restore();
}

function arco(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${grande} 1 ${x1} ${y1} Z`;
}

/** Devuelve el alto total que ocupó (anillo + leyenda), para encuadrar la sección. */
function dibujarDonut(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  datos: { categoria: string; monto: number }[],
): number {
  const cx = x + w / 2;
  const cy = y + 100;
  const r = 70;
  const total = datos.reduce((s, d) => s + d.monto, 0);
  if (total <= 0) return 0;

  let acumulado = -Math.PI / 2;
  datos.forEach((d, i) => {
    const angulo = (d.monto / total) * Math.PI * 2;
    const color = COLORS.donut[i % COLORS.donut.length];
    doc.save();
    if (angulo >= Math.PI * 2 - 1e-6) {
      // Una sola categoría: el arco de 360° es degenerado (inicio = fin) y no
      // pinta nada. Se dibuja el círculo completo.
      doc.circle(cx, cy, r).fill(color);
    } else {
      doc.path(arco(cx, cy, r, acumulado, acumulado + angulo)).fill(color);
    }
    doc.restore();
    acumulado += angulo;
  });

  doc.save();
  doc.circle(cx, cy, r * 0.55).fill(COLORS.surface);
  doc.restore();

  doc
    .fillColor(COLORS.inkMuted)
    .font('Helvetica')
    .fontSize(9)
    .text('Total', x, cy - 14, { width: w, align: 'center' });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(formatoMoneda(total), x, cy + 1, { width: w, align: 'center' });

  // La leyenda arranca DEBAJO del anillo (cy + r + 12); si se la centra en un
  // alto fijo se monta sobre el donut cuando hay pocas categorías.
  const visibles = datos.slice(0, 6);
  let ly = cy + r + 12;
  visibles.forEach((d, i) => {
    doc.save();
    doc.rect(x + 4, ly + 1, 8, 8).fill(COLORS.donut[i % COLORS.donut.length]);
    doc.restore();
    doc
      .fillColor(COLORS.inkSoft)
      .font('Helvetica')
      .fontSize(8.5)
      .text(`${d.categoria} — ${formatoMoneda(d.monto)}`, x + 16, ly, {
        width: w - 20,
        ellipsis: true,
        lineBreak: false,
      });
    ly += 12;
  });

  return ly - y;
}

/** Devuelve el alto total que ocupó, para encuadrar la sección. */
function dibujarBarras(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  datos: { usuario: string; monto: number }[],
): number {
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Top colaboradores', x, y, { width: w });
  if (datos.length === 0) return 18;

  const max = Math.max(...datos.map((d) => d.monto));
  const altoFila = 18;
  const y0 = y + 18;
  const anchoEtiqueta = 100;
  const anchoBarra = w - anchoEtiqueta - 76;

  datos.slice(0, 8).forEach((d, i) => {
    const fy = y0 + i * altoFila;
    doc
      .fillColor(COLORS.inkSoft)
      .font('Helvetica')
      .fontSize(8.5)
      .text(d.usuario, x, fy + 4, { width: anchoEtiqueta - 4, ellipsis: true, lineBreak: false });
    const ancho = max === 0 ? 0 : Math.max(2, (d.monto / max) * anchoBarra);
    doc.save();
    doc.rect(x + anchoEtiqueta, fy + 3, anchoBarra, 10).fill(COLORS.rowAlt);
    doc.rect(x + anchoEtiqueta, fy + 3, ancho, 10).fill(COLORS.brand);
    doc.restore();
    doc
      .fillColor(COLORS.inkSoft)
      .font('Helvetica')
      .fontSize(8.5)
      .text(formatoMoneda(d.monto), x + anchoEtiqueta + anchoBarra + 4, fy + 4, {
        width: 70,
        align: 'right',
        lineBreak: false,
      });
  });

  return 18 + Math.min(8, datos.length) * altoFila;
}

/**
 * Las filas arrancan con 8pt de sangría y dejan otros 8 a la derecha, así que
 * los anchos deben sumar CONTENT_W − 16: si suman CONTENT_W, la columna Monto
 * se pasa del margen derecho y el encabezado sale cortado.
 */
const SANGRIA_TABLA = 8;
const COLUMNAS = [
  { label: 'Fecha', w: 58 },
  { label: 'Colaborador', w: 88 },
  { label: 'Descripción', w: 140 },
  { label: 'Categoría', w: 76 },
  { label: 'Tipo', w: 56 },
  {
    label: 'Monto',
    w: CONTENT_W - SANGRIA_TABLA * 2 - 58 - 88 - 140 - 76 - 56,
    align: 'right' as const,
  },
];

function dibujarTabla(
  doc: PDFKit.PDFDocument,
  titulo: string,
  filas: GastoReporte[],
  acento: string,
): void {
  doc.addPage();
  dibujarTituloSeccion(doc, `${titulo} (${filas.length})`);

  if (filas.length === 0) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor(COLORS.inkSoft)
      .text('Sin gastos en este estado.', MARGIN, doc.y);
    return;
  }

  const dibujarCabecera = () => {
    const hy = doc.y;
    doc.rect(MARGIN, hy, CONTENT_W, 22).fill(acento);
    let cx = MARGIN + SANGRIA_TABLA;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    for (const col of COLUMNAS) {
      doc.text(col.label, cx, hy + 7, { width: col.w - 4, align: col.align ?? 'left', lineBreak: false });
      cx += col.w;
    }
    doc.y = hy + 22;
  };

  dibujarCabecera();

  let subtotal = 0;
  filas.forEach((f, idx) => {
    if (doc.y + 18 > CONTENT_BOTTOM) {
      doc.addPage();
      doc.y = CONTENT_TOP;
      dibujarCabecera();
    }
    if (idx % 2 === 1) doc.rect(MARGIN, doc.y, CONTENT_W, 18).fill(COLORS.rowAlt);

    const fy = doc.y;
    let cx = MARGIN + SANGRIA_TABLA;
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9);
    const celdas = [
      formatoFecha(f.fecha),
      f.usuario,
      f.descripcion,
      f.categoria ?? '—',
      ETIQUETA_FUNDING[f.fundingMode] ?? f.fundingMode,
      formatoMoneda(f.monto),
    ];
    for (let i = 0; i < COLUMNAS.length; i++) {
      doc.text(celdas[i] ?? '', cx, fy + 5, {
        width: COLUMNAS[i].w - 4,
        align: COLUMNAS[i].align ?? 'left',
        ellipsis: true,
        lineBreak: false,
      });
      cx += COLUMNAS[i].w;
    }
    doc.y = fy + 18;
    subtotal += f.monto;
  });

  if (doc.y + 24 > CONTENT_BOTTOM) {
    doc.addPage();
    doc.y = CONTENT_TOP;
  }
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(COLORS.border).stroke();
  doc.y += 4;
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text(`Subtotal: ${formatoMoneda(subtotal)} · ${filas.length} gastos`, MARGIN, doc.y, {
      width: CONTENT_W,
      align: 'right',
    });
  doc.y += 16;
}

// ─── Comprobantes ───────────────────────────────────────────────────────────

const TIMEOUT_COMPROBANTE_MS = 12_000;

/**
 * Descarga el comprobante. `archivoUrl` puede ser absoluta (Supabase / Object
 * Storage) o relativa a `public/` cuando el deploy usa disco local.
 */
interface ComprobanteCargado {
  ok: true;
  buffer: Buffer;
  mime: string;
  /** Alto que ocupará ya escalado al ancho del PDF. Ver `medirImagen`. */
  altoRenderizado: number;
}
type ComprobanteFallido = { ok: false; motivo: string };

const IMG_MAX_W = 460;
const IMG_MAX_H = 420;

/**
 * Alto real que ocupará la imagen con `fit: [IMG_MAX_W, IMG_MAX_H]`.
 *
 * pdfkit no actualiza `doc.y` cuando se usa `fit`, así que sin esto había que
 * avanzar siempre el máximo (420pt) y una boleta apaisada dejaba media página
 * en blanco. `sharp` ya es dependencia del repo (se usa para los previews).
 */
async function medirImagen(buffer: Buffer): Promise<number> {
  try {
    const sharp = (await import('sharp')).default;
    const { width, height } = await sharp(buffer).metadata();
    if (!width || !height) return IMG_MAX_H;
    const escala = Math.min(IMG_MAX_W / width, IMG_MAX_H / height, 1);
    return Math.ceil(height * escala);
  } catch {
    return IMG_MAX_H;
  }
}

async function cargarComprobante(
  url: string,
): Promise<ComprobanteCargado | ComprobanteFallido> {
  const conMedida = async (
    buffer: Buffer,
    mime: string,
  ): Promise<ComprobanteCargado> => ({
    ok: true,
    buffer,
    mime,
    altoRenderizado: /^image\/(jpeg|jpg|png)$/i.test(mime) ? await medirImagen(buffer) : 0,
  });

  try {
    if (/^https?:\/\//i.test(url)) {
      const controlador = new AbortController();
      const t = setTimeout(() => controlador.abort(), TIMEOUT_COMPROBANTE_MS);
      try {
        const resp = await fetch(url, { signal: controlador.signal });
        if (!resp.ok) return { ok: false, motivo: `HTTP ${resp.status}` };
        const buffer = Buffer.from(await resp.arrayBuffer());
        return conMedida(buffer, resp.headers.get('content-type') ?? 'application/octet-stream');
      } finally {
        clearTimeout(t);
      }
    }

    // Ruta relativa: se sirve desde public/. Normalizamos para no salir de ahí.
    const fs = await import('fs/promises');
    const raiz = path.join(process.cwd(), 'public');
    const destino = path.resolve(raiz, url.replace(/^\/+/, ''));
    if (!destino.startsWith(raiz)) return { ok: false, motivo: 'ruta inválida' };
    const buffer = await fs.readFile(destino);
    const ext = path.extname(destino).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : ext === '.pdf' ? 'application/pdf'
      : 'image/jpeg';
    return conMedida(buffer, mime);
  } catch (error: any) {
    return { ok: false, motivo: error?.message ?? 'no se pudo leer el comprobante' };
  }
}

/** De a 5 en paralelo: acota memoria y no satura el storage. */
async function dibujarComprobantesPorLotes(
  doc: PDFKit.PDFDocument,
  gastos: GastoReporte[],
): Promise<void> {
  const LOTE = 5;
  for (let i = 0; i < gastos.length; i += LOTE) {
    const lote = gastos.slice(i, i + LOTE);
    const cargados = await Promise.all(lote.map((g) => cargarComprobante(g.archivoUrl!)));
    for (let j = 0; j < lote.length; j++) {
      dibujarComprobante(doc, lote[j], cargados[j]);
    }
  }
}

function dibujarComprobante(
  doc: PDFKit.PDFDocument,
  g: GastoReporte,
  cargado: ComprobanteCargado | ComprobanteFallido,
): void {
  // Alto del bloque: ficha (58pt) + imagen o marcador. Si no entra completo en
  // lo que queda de página, arranca en una nueva para no partir el comprobante.
  const altoContenido = cargado.ok && cargado.altoRenderizado > 0 ? cargado.altoRenderizado : 110;
  if (doc.y + 58 + altoContenido + 16 > CONTENT_BOTTOM) {
    doc.addPage();
    doc.y = CONTENT_TOP;
  }

  const hy = doc.y;
  doc.rect(MARGIN, hy, CONTENT_W, 50).fillAndStroke(COLORS.rowAlt, COLORS.border);
  doc
    .fillColor(COLORS.inkMuted)
    .font('Helvetica')
    .fontSize(8)
    .text(`${formatoFecha(g.fecha)} · ${g.tipoDocumento ?? 'Documento'} ${g.numeroDocumento ?? ''}`.trim(), MARGIN + 10, hy + 8, { lineBreak: false });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(g.descripcion, MARGIN + 10, hy + 20, { width: CONTENT_W * 0.62, ellipsis: true, lineBreak: false });
  doc
    .fillColor(COLORS.inkSoft)
    .font('Helvetica')
    .fontSize(9)
    .text(`${g.usuario} · ${g.categoria ?? '—'}`, MARGIN + 10, hy + 34, { width: CONTENT_W * 0.62, ellipsis: true, lineBreak: false });
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(formatoMoneda(g.monto), MARGIN, hy + 16, { width: CONTENT_W - 12, align: 'right' });
  doc.y = hy + 58;

  const marcador = (texto: string, alto = 110) => {
    doc.rect(MARGIN, doc.y, CONTENT_W, alto).fillAndStroke('#f3f4f6', COLORS.border);
    doc
      .fillColor(COLORS.inkSoft)
      .font('Helvetica-Oblique')
      .fontSize(10)
      .text(texto, MARGIN, doc.y + alto / 2 - 6, { width: CONTENT_W, align: 'center' });
    doc.y += alto + 12;
  };

  if (!cargado.ok) {
    marcador(`Comprobante no disponible (${cargado.motivo})`);
    return;
  }
  // pdfkit solo embebe JPEG y PNG.
  if (!/^image\/(jpeg|jpg|png)$/i.test(cargado.mime)) {
    marcador('Comprobante en PDF — adjunto al gasto, no embebible en el reporte', 80);
    return;
  }

  try {
    doc.image(cargado.buffer, (PAGE_W - IMG_MAX_W) / 2, doc.y, {
      fit: [IMG_MAX_W, IMG_MAX_H],
      align: 'center',
    });
    // pdfkit no avanza `doc.y` con `fit`: usamos el alto medido con sharp.
    doc.y += (cargado.altoRenderizado || IMG_MAX_H) + 16;
  } catch (error: any) {
    marcador(`No se pudo renderizar la imagen (${error?.message ?? 'error'})`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel
// ═══════════════════════════════════════════════════════════════════════════

async function generarExcel(salida: Writable, ds: DatasetReporte): Promise<void> {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: salida, useStyles: true });
  wb.creator = EMPRESA;
  wb.created = ds.generadoEn;

  // ── Hoja "Gastos" ──
  const hoja = wb.addWorksheet('Gastos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Colaborador', key: 'usuario', width: 24 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Categoría', key: 'categoria', width: 18 },
    { header: 'Centro de costo', key: 'centroCostos', width: 20 },
    { header: 'Proyecto', key: 'proyecto', width: 18 },
    { header: 'Financiamiento', key: 'funding', width: 16 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Tipo doc.', key: 'tipoDocumento', width: 14 },
    { header: 'N° doc.', key: 'numeroDocumento', width: 16 },
    { header: 'Proveedor', key: 'proveedor', width: 26 },
    { header: 'RUT proveedor', key: 'rutProveedor', width: 16 },
    { header: 'Ruta', key: 'ruta', width: 18 },
    { header: 'Ciudad', key: 'ciudad', width: 16 },
    { header: 'Informe', key: 'informe', width: 24 },
    { header: 'Monto', key: 'monto', width: 16, style: { numFmt: '"$"#,##0' } },
  ];
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFD6301' }, // naranja de marca Panorámica
  };
  hoja.getRow(1).commit();

  for (const g of ds.gastos) {
    hoja
      .addRow({
        fecha: formatoFecha(g.fecha),
        usuario: g.usuario,
        descripcion: g.descripcion,
        categoria: g.categoria ?? '',
        centroCostos: g.centroCostos ?? '',
        proyecto: g.proyecto ?? '',
        funding: ETIQUETA_FUNDING[g.fundingMode] ?? g.fundingMode,
        estado: ETIQUETA_ESTADO[g.estado] ?? g.estado,
        tipoDocumento: g.tipoDocumento ?? '',
        numeroDocumento: g.numeroDocumento ?? '',
        proveedor: g.proveedor ?? '',
        rutProveedor: g.rutProveedor ?? '',
        ruta: g.ruta ?? '',
        ciudad: g.ciudad ?? '',
        informe: g.informeTitulo ?? '',
        monto: g.monto,
      })
      .commit();
  }
  hoja.commit();

  // ── Hoja "Resumen" ──
  const resumen = wb.addWorksheet('Resumen');
  resumen.columns = [
    { header: '', key: 'a', width: 32 },
    { header: '', key: 'b', width: 20, style: { numFmt: '"$"#,##0' } },
    { header: '', key: 'c', width: 12 },
  ];

  const titulo = (texto: string) => {
    const fila = resumen.addRow({ a: texto });
    fila.font = { bold: true, size: 12 };
    fila.commit();
  };

  resumen.addRow({ a: 'Rendición de gastos', b: EMPRESA }).commit();
  resumen.addRow({ a: 'Período', b: ds.etiquetaPeriodo }).commit();
  resumen.addRow({
    a: 'Generado',
    b: ds.generadoEn.toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
  }).commit();
  resumen.addRow({ a: 'Generado por', b: ds.generadoPor }).commit();
  resumen.addRow({}).commit();

  titulo('Indicadores');
  resumen.addRow({ a: 'Total del período', b: ds.kpis.total, c: ds.gastos.length }).commit();
  resumen.addRow({ a: 'Aprobados', b: ds.kpis.aprobadoMonto, c: ds.kpis.aprobadoCant }).commit();
  resumen.addRow({ a: 'Pendientes', b: ds.kpis.pendienteMonto, c: ds.kpis.pendienteCant }).commit();
  resumen.addRow({ a: 'Rechazados', b: ds.kpis.rechazadoMonto, c: ds.kpis.rechazadoCant }).commit();
  resumen.addRow({ a: 'Pagados', b: ds.kpis.pagadoMonto, c: ds.kpis.pagadoCant }).commit();
  resumen.addRow({}).commit();

  titulo('Por categoría');
  for (const c of ds.porCategoria) {
    resumen.addRow({ a: c.categoria, b: c.monto, c: c.cantidad }).commit();
  }
  resumen.addRow({}).commit();

  titulo('Por colaborador');
  for (const u of ds.porUsuario) {
    resumen.addRow({ a: u.usuario, b: u.monto, c: u.cantidad }).commit();
  }
  resumen.commit();

  await wb.commit();
}

// ═══════════════════════════════════════════════════════════════════════════

function nombreArchivo(ds: DatasetReporte, ext: string): string {
  const slug = ds.etiquetaPeriodo.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `rendicion-gastos-${slug || 'reporte'}.${ext}`;
}

export function registerReportesRendicionRoutes(app: Express): void {
  /** Dataset en JSON: alimenta el dashboard con los mismos números que el PDF. */
  app.get('/api/gastos-reportes/preview', requireAuth, async (req: any, res: any) => {
    try {
      const ds = await construirDataset(leerFiltros(req.query), req.user);
      // El preview no necesita el detalle completo de cada gasto.
      res.json({
        etiquetaPeriodo: ds.etiquetaPeriodo,
        generadoEn: ds.generadoEn,
        generadoPor: ds.generadoPor,
        kpis: ds.kpis,
        porCategoria: ds.porCategoria,
        porUsuario: ds.porUsuario,
        cantidadGastos: ds.gastos.length,
        gastos: ds.gastos.slice(0, 200),
      });
    } catch (error: any) {
      console.error('[reportes] Error en preview:', error);
      res.status(500).json({ message: 'Error al generar el reporte', error: error.message });
    }
  });

  app.get('/api/gastos-reportes/pdf', requireAuth, async (req: any, res: any) => {
    try {
      const ds = await construirDataset(leerFiltros(req.query), req.user);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(ds, 'pdf')}"`);
      await generarPdf(res, ds);
    } catch (error: any) {
      console.error('[reportes] Error generando PDF:', error);
      // Si ya empezamos a pipear el PDF no se puede mandar JSON: cortamos.
      if (res.headersSent) return res.end();
      res.status(500).json({ message: 'Error al generar el PDF', error: error.message });
    }
  });

  app.get('/api/gastos-reportes/excel', requireAuth, async (req: any, res: any) => {
    try {
      const ds = await construirDataset(leerFiltros(req.query), req.user);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(ds, 'xlsx')}"`);
      await generarExcel(res, ds);
    } catch (error: any) {
      console.error('[reportes] Error generando Excel:', error);
      if (res.headersSent) return res.end();
      res.status(500).json({ message: 'Error al generar el Excel', error: error.message });
    }
  });

  /** PDF de un informe puntual, con sus comprobantes adjuntos. */
  app.get('/api/informes-rendicion/:id/pdf', requireAuth, async (req: any, res: any) => {
    try {
      const [informe] = await db
        .select()
        .from(informesRendicion)
        .where(eq(informesRendicion.id, req.params.id))
        .limit(1);

      if (!informe) return res.status(404).json({ message: 'Informe no encontrado' });
      if (!ROLES_PRIVILEGIADOS.includes(req.user.role) && informe.userId !== req.user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const ds = await construirDataset(
        { informeId: informe.id, incluirComprobantes: req.query.incluirComprobantes !== 'false' },
        // El dueño del informe siempre puede exportarlo completo.
        { ...req.user, role: 'admin' },
      );
      ds.etiquetaPeriodo = `${informe.titulo} · ${informe.periodo}`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="informe-${informe.periodo}-${informe.id.slice(0, 8)}.pdf"`,
      );
      await generarPdf(res, ds);
    } catch (error: any) {
      console.error('[reportes] Error generando PDF del informe:', error);
      if (res.headersSent) return res.end();
      res.status(500).json({ message: 'Error al generar el PDF', error: error.message });
    }
  });
}
