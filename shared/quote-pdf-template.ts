// Quote PDF HTML template — single source of truth.
// Used by:
//   - client/src/lib/quote-pdf-html.tsx (tomador de pedidos)
//   - server/routes-external.ts (/api/external/cotizaciones/:id/pdf for MCP / Claude)
// If the design changes, edit it HERE and both flows update at once.

import { normalizeFormat, PRODUCT_FORMATS } from './format-utils';

export interface QuotePdfOptions {
  /** Logo URL. Browser uses window.location.origin + '/panoramica-logo.png';
   *  server can pass an absolute URL or omit (uses text fallback). */
  logoUrl?: string | null;
  /** Whether to include auto-print JS (browser-only). */
  autoPrint?: boolean;
  /** Big label in the top-right corner. Default 'COTIZACIÓN'. */
  documentLabel?: string;
  /** Label preceding the document number. Default 'Cotización N°'. */
  documentNumberLabel?: string;
}

/** HTML-escape that works in both browser and Node. */
function escapeHtml(text: unknown): string {
  if (text === null || text === undefined || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFormatSortOrder(item: any): number {
  const name = item.productName?.toString() || '';
  if (name.startsWith('Despacho') || /flete/i.test(name)) return 100;
  const canonical = normalizeFormat(item.productUnit || item.unidad || '');
  if (canonical && PRODUCT_FORMATS[canonical]) return PRODUCT_FORMATS[canonical].sortOrder;
  const fromName = normalizeFormat(name);
  if (fromName && PRODUCT_FORMATS[fromName]) return PRODUCT_FORMATS[fromName].sortOrder;
  return 50;
}

const PAYMENT_CONDITIONS: Array<{ value: string; label: string }> = [
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'boton_pago', label: 'Botón de Pago (Tarjeta)' },
  { value: 'credito', label: 'Crédito' },
  { value: 'credito_30', label: 'Crédito a 30 días' },
  { value: 'credito_45', label: 'Crédito a 45 días' },
  { value: 'credito_60', label: 'Crédito a 60 días' },
];

export function renderQuoteHtml(
  quote: any,
  items: any[],
  options: QuotePdfOptions = {}
): string {
  const {
    logoUrl = null,
    autoPrint = false,
    documentLabel = 'COTIZACIÓN',
    documentNumberLabel = 'Cotización N°',
  } = options;

  const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const itemsSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
  const shippingItemsTotal = items
    .filter((item) => {
      const name = item.productName?.toString() || '';
      return name.startsWith('Despacho') || name.includes('flete') || name.includes('Flete');
    })
    .reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
  const productsSubtotal = itemsSubtotal - shippingItemsTotal;
  const discount = 0;
  const tax = itemsSubtotal * 0.19;
  const total = itemsSubtotal * 1.19;

  const formatCurrency = (amount: number) =>
    `$${Math.round(amount).toLocaleString('es-CL').replace(/,/g, '.')}`;

  const sortedItems = [...items].sort((a, b) => getFormatSortOrder(a) - getFormatSortOrder(b));

  const productRows = sortedItems
    .map((item, idx) => {
      const unitPrice = parseFloat(item.unitPrice);
      const lineTotal = parseFloat(item.totalPrice);
      const productUnit = escapeHtml(item.productUnit) || 'UN';

      return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>
              <div class="product-name">${escapeHtml(item.productName)}</div>
              ${
                item.productCode || item.customSku
                  ? `<div class="product-code">SKU: ${escapeHtml(item.productCode || item.customSku)}</div>`
                  : ''
              }
            </td>
            <td class="text-center">${productUnit}</td>
            <td class="text-center">${parseFloat(item.quantity)}</td>
            <td class="text-right">${formatCurrency(unitPrice)}</td>
            <td class="text-right" style="color: #fd6301; font-weight: 600;">${formatCurrency(lineTotal)}</td>
          </tr>`;
    })
    .join('');

  const paymentLabel =
    PAYMENT_CONDITIONS.find((p) => p.value === ((quote as any).paymentCondition || ''))?.label ??
    'Según acuerdo comercial';

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo Panoramica 30 Años" style="width:220px;height:auto;display:block" />`
    : `<h1 style="color:#fd6301;margin:0;font-size:22px;font-weight:bold">PINTURAS PANORÁMICA</h1>`;

  const autoPrintScript = autoPrint
    ? `<script>
    window.addEventListener('load', function() {
      var img = document.querySelector('.header-left img');
      function doPrint() {
        window.focus();
        window.print();
        setTimeout(function() { window.close(); }, 250);
      }
      if (img && !img.complete) {
        img.onload = doPrint;
        img.onerror = doPrint;
        setTimeout(doPrint, 3000);
      } else {
        doPrint();
      }
    });
  </script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(documentLabel)} ${escapeHtml(quote.quoteNumber)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 14px; line-height: 1.4; }
    .container { max-width: 100%; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #fd6301; padding-bottom: 15px; }
    .header-left { flex-shrink: 0; }
    .header-right { text-align: right; }
    .header img { max-height: 60px; width: auto; }
    .header-left svg { height: 60px; width: auto; }
    .header h1 { color: #fd6301; margin: 0; font-size: 24px; font-weight: bold; }
    .header-info { font-size: 13px; color: #374151; margin-top: 8px; }
    .section { margin-bottom: 15px; }
    .section h3 { color: #fd6301; margin: 0 0 10px 0; font-size: 16px; font-weight: bold; }
    .client-info { background-color: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
    .client-info p { margin: 0 0 8px 0; }
    .client-observations { grid-column: 1 / -1; margin-top: 8px; padding-top: 8px; border-top: 1px solid #fdba74; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; table-layout: fixed; }
    th { background: linear-gradient(to right, #fd6301, #e55100); color: white; padding: 8px; text-align: left; font-weight: bold; font-size: 12px; }
    th:nth-child(1) { width: 5%; text-align: center; }
    th:nth-child(2) { width: 42%; }
    th:nth-child(3) { width: 12%; text-align: center; }
    th:nth-child(4) { width: 9%; text-align: center; }
    th:nth-child(5) { width: 15%; text-align: right; }
    th:nth-child(6) { width: 17%; text-align: right; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    td:nth-child(1) { text-align: center; }
    td:nth-child(3) { text-align: center; }
    td:nth-child(4) { text-align: center; }
    td:nth-child(5) { text-align: right; }
    td:nth-child(6) { text-align: right; }
    tr:hover { background-color: #fff7ed; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .product-name { font-weight: 600; color: #1f2937; font-size: 13px; }
    .product-code { color: #6b7280; font-size: 11px; margin-top: 2px; }
    .totals { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
    .total-row { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; padding: 0 12px; font-size: 14px; min-height: 24px; }
    .total-row span:first-child { color: #374151; font-weight: 500; flex-shrink: 0; }
    .total-row span:last-child { display: inline-block; font-weight: 600; text-align: right; width: 120px; flex-shrink: 0; }
    .final-total { font-size: 16px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 8px; }
    .final-total span:last-child { color: #fd6301; }
    .discount-row span:last-child { color: #10b981; }
    .terms { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
    .terms h4 { margin: 0 0 8px 0; font-size: 14px; color: #374151; }
    .terms ul { margin: 0; padding-left: 16px; font-size: 12px; color: #6b7280; }
    .terms li { margin-bottom: 4px; }
    .payment-info { background-color: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; font-size: 12px; }
    .payment-info h4 { color: #ea580c; margin: 0 0 10px 0; font-size: 14px; }
    .payment-info p { margin: 0 0 8px 0; }
    .payment-info a { color: #2563eb; text-decoration: underline; word-break: break-all; }
    .payment-section { margin-bottom: 10px; }
    .payment-section:last-child { margin-bottom: 0; }
    @media print {
      body { margin: 0; font-size: 12px; }
      .no-print { display: none; }
      .container { max-width: 100%; }
      .header { margin-bottom: 15px; padding-bottom: 10px; }
      .section { margin-bottom: 12px; }
      .totals { padding: 12px; }
      .payment-info { padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${logoBlock}
      </div>
      <div class="header-right">
        <h1>${escapeHtml(documentLabel)}</h1>
        <div class="header-info">
          <p><strong>Fecha:</strong> ${quoteDate}</p>
          <p><strong>${escapeHtml(documentNumberLabel)}:</strong> ${escapeHtml(quote.quoteNumber)}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Información del Cliente</h3>
      <div class="client-info">
        <p><strong>RUT:</strong> ${escapeHtml(quote.clientRut) || 'No especificado'}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(quote.clientName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(quote.clientEmail) || 'No especificado'}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(quote.clientPhone) || 'No especificado'}</p>
        <p><strong>Dirección:</strong> ${escapeHtml(quote.clientAddress) || 'No especificada'}</p>
        <p><strong>Ubicación:</strong> Chile</p>
        ${
          quote.notes
            ? `<div class="client-observations"><p><strong>Observaciones:</strong> ${escapeHtml(quote.notes)}</p></div>`
            : ''
        }
      </div>
    </div>

    <div class="section">
      <h3>Detalle de Productos</h3>
      <table>
        <thead>
          <tr>
            <th class="text-center">#</th>
            <th>Producto</th>
            <th class="text-center">Unidad</th>
            <th class="text-center">Cant.</th>
            <th class="text-right">Precio</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="totals">
        <div class="total-row">
          <span>Subtotal Productos:</span>
          <span style="text-align: right;">${formatCurrency(productsSubtotal)}</span>
        </div>
        ${
          shippingItemsTotal > 0
            ? `
        <div class="total-row">
          <span>Subtotal Flete:</span>
          <span style="color: #fd6301; font-weight: 600; text-align: right;">${formatCurrency(shippingItemsTotal)}</span>
        </div>
        `
            : ''
        }
        <div class="total-row" style="font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px;">
          <span>Subtotal:</span>
          <span style="text-align: right;">${formatCurrency(itemsSubtotal)}</span>
        </div>
        ${
          discount > 0
            ? `<div class="total-row discount-row">
          <span>Descuento aplicado:</span>
          <span style="text-align: right;">-${formatCurrency(discount)}</span>
        </div>`
            : ''
        }

        <div class="total-row">
          <span>IVA (19%):</span>
          <span style="text-align: right;">${formatCurrency(tax)}</span>
        </div>
        <div class="total-row final-total">
          <span>Total Final:</span>
          <span style="text-align: right;">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="terms">
        <h4>Términos y Condiciones</h4>
        <ul>
          <li>Precios válidos por 7 días hábiles desde la emisión de esta cotización.</li>
          <li>Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.</li>
          <li>Los productos están sujetos a disponibilidad de stock.</li>
          <li><strong>Condición de pago:</strong> ${paymentLabel}</li>
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="payment-info">
        <h4>Información de Pagos</h4>
        <div class="payment-section">
          <p><strong>Link de pagos con tarjetas:</strong><br>
          <a href="https://micrositios.getnet.cl/pinturaspanoramica">https://micrositios.getnet.cl/pinturaspanoramica</a></p>
        </div>
        <div class="payment-section">
          <p><strong>Pagos con transferencia dirigirlos a:</strong><br>
          Pintureria Panoramica Limitada<br>
          RUT: 78.652.260-9<br>
          Cuenta Corriente Banco Santander: 2592916-0<br>
          Email: <a href="mailto:contacto@pinturaspanoramica.cl">contacto@pinturaspanoramica.cl</a></p>
        </div>
      </div>
    </div>
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; background-color: #fd6301; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
      Imprimir / Descargar PDF
    </button>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}
