/**
 * quote-request-pdf — Renders an HTML printable (→ PDF via browser print)
 * for a B2C quote_request after prices have been assigned.
 * Matches the visual style of the B2B quote PDF in server/routes.ts.
 */

import type { QuoteRequest, QuoteRequestItem } from '@shared/schema';
import { normalizeFormat, PRODUCT_FORMATS } from '@shared/format-utils';
import type { DatosPagoCotizacion, MarcaCotizacion } from '@shared/empresas-externas';

const getItemSortOrder = (item: QuoteRequestItem): number => {
  const canonical = normalizeFormat((item as any).format || '');
  if (canonical && PRODUCT_FORMATS[canonical]) return PRODUCT_FORMATS[canonical].sortOrder;
  const fromName = normalizeFormat(item.productName || '');
  if (fromName && PRODUCT_FORMATS[fromName]) return PRODUCT_FORMATS[fromName].sortOrder;
  return 50;
};

const escHtml = (s: unknown): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const fmtCLP = (n: number): string =>
  `$${Math.round(n).toLocaleString('es-CL').replace(/,/g, '.')}`;

const fmtDate = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Bloque "Información de Pagos". Sin `pago`, los datos de Panorámica de siempre.
 * Con `pago` (cotización hecha por una empresa externa, ver
 * shared/empresas-externas.ts), solo lo que esa empresa tenga cargado: un dato
 * vacío no se imprime y nunca se cae a los de Panorámica.
 */
function bloquePagos(pago?: DatosPagoCotizacion): string {
  if (!pago) {
    return `<div class="section">
    <div class="payment-info"><h4>Información de Pagos</h4>
      <p><strong>Link de pagos con tarjetas:</strong><br><a href="https://micrositios.getnet.cl/pinturaspanoramica">https://micrositios.getnet.cl/pinturaspanoramica</a></p>
      <p><strong>Pagos con transferencia dirigirlos a:</strong><br>Pintureria Panoramica Limitada<br>RUT: 78.652.260-9<br>Cuenta Corriente Banco Santander: 2592916-0<br>Email: <a href="mailto:contacto@pinturaspanoramica.cl">contacto@pinturaspanoramica.cl</a></p>
    </div>
  </div>`;
  }
  // Diseño de la hoja "Datos para transferencia" de la empresa (nov-2026):
  // "¡Gracias por tu compra!", tarjeta gris con razón social, RUT y banco, y el
  // número de cuenta grande al centro.
  const link = (pago.linkTarjetas || '').trim();
  const bloqueLink = /^https?:\/\//i.test(link)
    ? `<p class="tr-link">Pago con tarjetas: <a href="${escHtml(link)}">${escHtml(link)}</a></p>`
    : '';
  const numero = (pago.numeroCuenta || '').trim();
  if (!numero) {
    return bloqueLink ? `<div class="section transferencia">${bloqueLink}</div>` : '';
  }
  const email = (pago.email || '').trim();
  const tipo = (pago.tipoCuenta || 'Cuenta').trim();
  return `<div class="section transferencia">
    <p class="tr-gracias">¡Gracias por tu compra!</p>
    <h2 class="tr-titulo">Datos para transferencia</h2>
    <div class="tr-tarjeta">
      <p class="tr-etq">Razón social</p>
      <p class="tr-val">${escHtml(pago.razonSocial)}</p>
      <div class="tr-dos">
        <div><p class="tr-etq">RUT</p><p class="tr-val">${escHtml(pago.rut)}</p></div>
        ${pago.banco ? `<div><p class="tr-etq">Banco</p><p class="tr-val">${escHtml(pago.banco)}</p></div>` : ''}
      </div>
      <div class="tr-linea"></div>
      <p class="tr-etq tr-centro">${escHtml(tipo)} N°</p>
      <p class="tr-cuenta">${escHtml(numero)}</p>
    </div>
    ${email ? `<p class="tr-comprobante">Envíanos el comprobante a</p><p class="tr-mail"><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></p>` : ''}
    ${bloqueLink}
  </div>`;
}

/** Franja de colores de la hoja de la empresa (8 tramos, el de abajo invertido). */
const COLORES_FRANJA = ['#f3c500', '#f7941d', '#ff4560', '#e1007a', '#6a1f7a', '#0058b1', '#00adef', '#8dc73f'];
function franja(invertida = false): string {
  const cols = invertida ? [...COLORES_FRANJA].reverse() : COLORES_FRANJA;
  const paso = 100 / cols.length;
  const tramos = cols.map((c, i) => `${c} ${(i * paso).toFixed(2)}% ${((i + 1) * paso).toFixed(2)}%`).join(', ');
  return `<div class="franja" style="background:linear-gradient(to right, ${tramos})"></div>`;
}

/** Estilos del bloque de transferencia y la franja (solo PDFs de empresa externa). */
const CSS_MARCA = `
  .franja { height: 8px; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .franja-arriba { margin-bottom: 18px; } .franja-abajo { margin-top: 18px; }
  .transferencia { font-family: 'Poppins', Arial, sans-serif; text-align: center; padding: 8px 0 4px; page-break-inside: avoid; }
  .tr-gracias { color: #c2187a; font-weight: 600; font-size: 14px; margin: 0 0 2px; }
  .tr-titulo { color: #1f1f1f; font-weight: 800; font-size: 26px; line-height: 1.1; margin: 0 0 14px; letter-spacing: -0.5px; }
  .tr-tarjeta { background: #f4f4f3; border-radius: 16px; padding: 18px 26px; text-align: left; max-width: 520px; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tr-etq { text-transform: uppercase; letter-spacing: 1.5px; font-size: 10px; font-weight: 600; color: #555; margin: 0 0 4px; }
  .tr-val { font-size: 17px; font-weight: 700; color: #1f1f1f; margin: 0 0 12px; }
  .tr-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .tr-linea { height: 1px; background: #dcdcdc; margin: 4px 0 12px; }
  .tr-centro { text-align: center; }
  .tr-cuenta { text-align: center; font-size: 34px; font-weight: 800; letter-spacing: 1px; color: #111; margin: 0; }
  .tr-comprobante { margin: 14px 0 2px; font-size: 13px; color: #333; }
  .tr-mail { margin: 0; font-size: 16px; font-weight: 700; }
  .tr-mail a { color: #1f4aa8; text-decoration: none; }
  .tr-link { margin: 10px 0 0; font-size: 12px; }
  .pie-marca { text-align: center; font-size: 12px; color: #444; margin-top: 14px; }
  .pie-marca strong { color: #111; }
`;

export function renderQuoteRequestPdfHtml(
  request: QuoteRequest,
  options: { logoUrl?: string; pago?: DatosPagoCotizacion; marca?: MarcaCotizacion } = {}
): string {
  const marca = options.marca;
  const items = ((request.items as QuoteRequestItem[]) || [])
    .filter(i => typeof i.unitPrice === 'number')
    .slice()
    .sort((a, b) => getItemSortOrder(a) - getItemSortOrder(b));

  const subtotal = parseFloat(String(request.subtotal || '0')) || 0;
  const tax = parseFloat(String(request.taxAmount || '0')) || 0;
  const total = parseFloat(String(request.totalAmount || '0')) || 0;

  const quoteDate = fmtDate(request.pricedAt || request.createdAt);
  const validUntil = fmtDate(request.validUntilDate);
  const logoUrl = marca?.logoUrl || options.logoUrl || '/panoramica-logo.png';

  const productRows = items
    .map((item, idx) => {
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal =
        Number(item.lineTotal ?? unitPrice * (item.quantity || 0));
      const isCustom = item.itemType === 'custom_color';

      const customTag = isCustom
        ? `<div style="display:inline-block;background:linear-gradient(120deg,#D946EF,#EC4899);color:white;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:0.3px;margin-top:4px">🎨 COLOR PERSONALIZADO</div>`
        : '';

      const customDetail = isCustom
        ? `<div style="color:#7e22ce;font-size:11px;margin-top:3px">
            ${escHtml(item.customColorBrand)}: <strong>${escHtml(item.customColorCode)}</strong>
            ${item.customColorHex ? `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escHtml(item.customColorHex)};border:1px solid #ccc;vertical-align:middle;margin-left:4px"></span> <span style="font-family:monospace">${escHtml(item.customColorHex)}</span>` : ''}
          </div>`
        : item.color && item.color !== 'Sin Color'
          ? `<div style="color:#6b7280;font-size:11px">Color: ${escHtml(item.color)}</div>`
          : '';

      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>
          <div style="font-weight:600">${escHtml(item.productName)}</div>
          ${item.sku ? `<div style="color:#6b7280;font-size:11px">SKU: ${escHtml(item.sku)}</div>` : ''}
          ${customDetail}
          ${customTag}
        </td>
        <td style="text-align:center">${escHtml(item.format) || 'UN'}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${fmtCLP(unitPrice)}</td>
        <td style="text-align:right;color:#fd6301;font-weight:600">${fmtCLP(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const clientMessage = request.message
    ? `<div style="grid-column:1/-1;margin-top:8px;padding-top:8px;border-top:1px solid #dcdcdc"><p style="margin:0"><strong>Mensaje del cliente:</strong> ${escHtml(request.message).replace(/\n/g, '<br>')}</p></div>`
    : '';

  const internalNotes = request.internalNotes
    ? `<div style="grid-column:1/-1;margin-top:6px"><p style="margin:0;color:#111"><strong>Observaciones:</strong> ${escHtml(request.internalNotes).replace(/\n/g, '<br>')}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cotización ${escHtml(request.quoteNumber || '')}</title>
<style>
  @page { size: A4; margin: 15mm; }
  html, body { background: #fff; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #fd6301; padding-bottom: 15px; }
  .header h1 { color: #fd6301; margin: 0; font-size: 24px; }
  .header-info { font-size: 13px; color: #374151; margin-top: 8px; }
  .header-info p { margin: 4px 0; }
  .section { margin-bottom: 15px; }
  .section h3 { color: #fd6301; margin: 0 0 10px 0; font-size: 16px; }
  /* Cuadros con texto: el gris de la tarjeta "Datos para transferencia" (#f4f4f3),
     sin borde, y el texto en negro (nov-2026). */
  .client-info, .totals, .terms, .payment-info { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .client-info { background: #f4f4f3; border: 0; padding: 14px 16px; border-radius: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #111; }
  .client-info p { margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; }
  /* Naranjo plano, el mismo de "COTIZACIÓN" y los títulos: el degradado se
     repetía en cada celda y la barra quedaba con franjas. */
  th { background: #fd6301; color: white; padding: 8px; text-align: left; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .totals { background: #f4f4f3; border: 0; padding: 15px 16px; border-radius: 12px; margin-bottom: 15px; color: #111; }
  .total-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
  .total-row span:first-child { color: #111; font-weight: 500; }
  .total-row span:last-child { font-weight: 600; }
  .final-total { font-size: 16px; font-weight: bold; border-top: 1px solid #dcdcdc; padding-top: 10px; margin-top: 8px; }
  .final-total span:last-child { color: #fd6301; }
  .terms { background: #f4f4f3; border: 0; padding: 14px 16px; border-radius: 12px; margin-bottom: 15px; }
  .terms h4 { margin: 0 0 8px 0; font-size: 14px; color: #111; }
  .terms ul { margin: 0; padding-left: 16px; font-size: 12px; color: #111; }
  .terms li { margin-bottom: 4px; }
  .payment-info { background: #f4f4f3; border: 0; padding: 14px 16px; border-radius: 12px; font-size: 12px; color: #111; }
  .payment-info h4 { color: #ea580c; margin: 0 0 10px 0; font-size: 14px; }
  .payment-info p { margin: 0 0 8px 0; }
  .payment-info a { color: #2563eb; }
  .no-print { margin-top: 20px; text-align: center; }
  @media print { .no-print { display: none; } body { padding: 0; } }
  ${marca ? CSS_MARCA : ''}
</style>
${marca ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">` : ''}
</head><body>
<div>
  ${marca ? `<div class="franja-arriba">${franja()}</div>` : ''}
  <div class="header">
    <div><img src="${escHtml(logoUrl)}" alt="${marca ? 'Panorámica Store' : 'Panorámica'}" style="${marca ? 'width:110px' : 'width:220px'};height:auto" /></div>
    <div style="text-align:right">
      <h1>COTIZACIÓN</h1>
      <div class="header-info">
        <p><strong>Fecha:</strong> ${quoteDate}</p>
        <p><strong>Cotización N°:</strong> ${escHtml(request.quoteNumber)}</p>
        ${validUntil ? `<p><strong>Válida hasta:</strong> ${validUntil}</p>` : ''}
      </div>
    </div>
  </div>
  <div class="section">
    <h3>Información del Cliente</h3>
    <div class="client-info">
      <p><strong>Cliente:</strong> ${escHtml(request.visitorName)}</p>
      <p><strong>Email:</strong> ${escHtml(request.visitorEmail) || 'No especificado'}</p>
      <p><strong>Teléfono:</strong> ${escHtml(request.visitorPhone) || 'No especificado'}</p>
      <p><strong>Empresa:</strong> ${escHtml(request.visitorCompany) || 'No especificada'}</p>
      <p><strong>RUT:</strong> ${escHtml(request.visitorRut) || 'No especificado'}</p>
      <p><strong>Ciudad:</strong> ${escHtml(request.visitorCity) || 'No especificada'}</p>
      ${clientMessage}
      ${internalNotes}
    </div>
  </div>
  <div class="section">
    <h3>Detalle de Productos</h3>
    <table><thead><tr>
      <th style="text-align:center;width:5%">#</th><th>Producto</th><th style="text-align:center">Formato</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th>
    </tr></thead><tbody>${productRows}</tbody></table>
  </div>
  <div class="section">
    <div class="totals">
      <div class="total-row"><span>Subtotal:</span><span>${fmtCLP(subtotal)}</span></div>
      <div class="total-row"><span>IVA (19%):</span><span>${fmtCLP(tax)}</span></div>
      <div class="total-row final-total"><span>Total Final:</span><span>${fmtCLP(total)}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="terms"><h4>Términos y Condiciones</h4><ul>
      <li>Precios válidos ${validUntil ? `hasta el ${validUntil}` : 'por 7 días hábiles desde la emisión de esta cotización'}.</li>
      <li>Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.</li>
      <li>Los productos están sujetos a disponibilidad de stock.</li>
      <li>Los colores personalizados se fabrican a pedido, con un mínimo de 5 tinetas.</li>
      <li>Condiciones de pago: según acuerdo comercial.</li>
    </ul></div>
  </div>
  ${bloquePagos(options.pago)}
  ${marca && (marca.direccion || marca.web)
    ? `<p class="pie-marca">${[marca.direccion ? escHtml(marca.direccion) : '', marca.web ? `<strong>${escHtml(marca.web)}</strong>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</p>`
    : ''}
  ${marca ? `<div class="franja-abajo">${franja(true)}</div>` : ''}
</div>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 20px;background:#fd6301;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:14px">
    Imprimir / Descargar PDF
  </button>
</div>
</body></html>`;
}
