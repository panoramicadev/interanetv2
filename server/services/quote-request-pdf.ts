/**
 * quote-request-pdf — Renders an HTML printable (→ PDF via browser print)
 * for a B2C quote_request after prices have been assigned.
 * Matches the visual style of the B2B quote PDF in server/routes.ts.
 */

import type { QuoteRequest, QuoteRequestItem } from '@shared/schema';

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

export function renderQuoteRequestPdfHtml(
  request: QuoteRequest,
  options: { logoUrl?: string } = {}
): string {
  const items = ((request.items as QuoteRequestItem[]) || []).filter(
    i => typeof i.unitPrice === 'number'
  );

  const subtotal = parseFloat(String(request.subtotal || '0')) || 0;
  const tax = parseFloat(String(request.taxAmount || '0')) || 0;
  const total = parseFloat(String(request.totalAmount || '0')) || 0;

  const quoteDate = fmtDate(request.pricedAt || request.createdAt);
  const validUntil = fmtDate(request.validUntilDate);
  const logoUrl = options.logoUrl || '/panoramica-logo.png';

  const productRows = items
    .map(item => {
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
    ? `<div style="grid-column:1/-1;margin-top:8px;padding-top:8px;border-top:1px solid #fdba74"><p style="margin:0"><strong>Mensaje del cliente:</strong> ${escHtml(request.message).replace(/\n/g, '<br>')}</p></div>`
    : '';

  const internalNotes = request.internalNotes
    ? `<div style="grid-column:1/-1;margin-top:6px"><p style="margin:0;color:#374151"><strong>Observaciones:</strong> ${escHtml(request.internalNotes).replace(/\n/g, '<br>')}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cotización ${escHtml(request.quoteNumber || '')}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #fd6301; padding-bottom: 15px; }
  .header h1 { color: #fd6301; margin: 0; font-size: 24px; }
  .header-info { font-size: 13px; color: #374151; margin-top: 8px; }
  .header-info p { margin: 4px 0; }
  .section { margin-bottom: 15px; }
  .section h3 { color: #fd6301; margin: 0 0 10px 0; font-size: 16px; }
  .client-info { background: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
  .client-info p { margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; }
  th { background: linear-gradient(to right, #fd6301, #e55100); color: white; padding: 8px; text-align: left; font-size: 12px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .totals { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
  .total-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
  .total-row span:first-child { color: #374151; font-weight: 500; }
  .total-row span:last-child { font-weight: 600; }
  .final-total { font-size: 16px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 8px; }
  .final-total span:last-child { color: #fd6301; }
  .terms { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
  .terms h4 { margin: 0 0 8px 0; font-size: 14px; color: #374151; }
  .terms ul { margin: 0; padding-left: 16px; font-size: 12px; color: #6b7280; }
  .terms li { margin-bottom: 4px; }
  .payment-info { background: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; font-size: 12px; }
  .payment-info h4 { color: #ea580c; margin: 0 0 10px 0; font-size: 14px; }
  .payment-info p { margin: 0 0 8px 0; }
  .payment-info a { color: #2563eb; }
  .no-print { margin-top: 20px; text-align: center; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style></head><body>
<div>
  <div class="header">
    <div><img src="${escHtml(logoUrl)}" alt="Panorámica" style="width:220px;height:auto" /></div>
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
      <th>Producto</th><th style="text-align:center">Formato</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th>
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
  <div class="section">
    <div class="payment-info"><h4>Información de Pagos</h4>
      <p><strong>Link de pagos con tarjetas:</strong><br><a href="https://micrositios.getnet.cl/pinturaspanoramica">https://micrositios.getnet.cl/pinturaspanoramica</a></p>
      <p><strong>Pagos con transferencia dirigirlos a:</strong><br>Pintureria Panoramica Limitada<br>RUT: 78.652.260-9<br>Cuenta Corriente Banco Santander: 2592916-0<br>Email: <a href="mailto:contacto@pinturaspanoramica.cl">contacto@pinturaspanoramica.cl</a></p>
    </div>
  </div>
</div>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 20px;background:#fd6301;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:14px">
    Imprimir / Descargar PDF
  </button>
</div>
</body></html>`;
}
