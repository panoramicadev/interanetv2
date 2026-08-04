const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://ai.pinturaspanoramica.cl';
const LOGO_URL = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/panoramica-logo-white.png`;

export function getEmailHeader(): string {
  return `
    <div style="background-color: #1a1f2e; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <img src="${LOGO_URL}" alt="Panoramica" width="280" style="max-width: 280px; height: auto; display: inline-block; border: 0;" />
    </div>
  `;
}

export function getPaymentInfoBlock(): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0 8px 0; border-collapse: separate;">
      <tr>
        <td style="background-color: #1a1f2e; padding: 14px 18px; border-radius: 6px 6px 0 0;">
          <p style="color: #ffffff; margin: 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">
            DATOS PARA EL PAGO
          </p>
        </td>
      </tr>
      <tr>
        <td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-top: 0; padding: 18px; border-radius: 0 0 6px 6px;">
          <p style="color: #1a1f2e; margin: 0 0 12px 0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6;">
            <strong style="color: #fd6301;">Transferencia bancaria</strong><br>
            <span style="color: #333;">Pintureria Panoramica Limitada</span><br>
            <span style="color: #333;">RUT: <strong>78.652.260-9</strong></span><br>
            <span style="color: #333;">Cuenta Corriente <strong>Banco Santander</strong>: <strong>2592916-0</strong></span><br>
            <span style="color: #333;">Email: <a href="mailto:contacto@pinturaspanoramica.cl" style="color: #fd6301; text-decoration: none;">contacto@pinturaspanoramica.cl</a></span>
          </p>
          <p style="color: #1a1f2e; margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #f0f0f0; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6;">
            <strong style="color: #fd6301;">Pago con tarjeta</strong><br>
            <a href="https://micrositios.getnet.cl/pinturaspanoramica" style="color: #fd6301; text-decoration: none; word-break: break-all;">https://micrositios.getnet.cl/pinturaspanoramica</a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

export function getEmailFooter(): string {
  return `
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
      <p style="color: #6c757d; font-size: 12px; margin: 0 0 5px 0; font-family: Arial, sans-serif;">
        <strong>Pinturas Panorámica</strong>
      </p>
      <p style="color: #6c757d; font-size: 11px; margin: 0; font-family: Arial, sans-serif;">
        Este es un correo automático del sistema de gestión.
      </p>
    </div>
  `;
}

interface SaleNotificationData {
  clientName: string;
  clientRut?: string;
  monto?: number | string;
  detalle?: string;
  numeroDocumento?: string;
  fecha?: Date;
}

export function buildSaleNotificationEmail(data: SaleNotificationData): { subject: string; html: string } {
  const fechaStr = (data.fecha || new Date()).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const montoStr = data.monto !== undefined && data.monto !== ''
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(data.monto))
    : null;

  const subject = `Notificación de Venta${data.numeroDocumento ? ` - ${data.numeroDocumento}` : ''} - ${data.clientName}`;

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">
      Notificación de Venta
    </h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Estimado(a) <strong>${data.clientName}</strong>,
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Le confirmamos los siguientes datos de su operación con Pinturas Panorámica:
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px 0;">
      ${data.numeroDocumento ? `
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">N° Documento:</span>
        <span style="color: #333; margin-left: 8px;">${data.numeroDocumento}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>` : ''}
      ${data.clientRut ? `
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">RUT:</span>
        <span style="color: #333; margin-left: 8px;">${data.clientRut}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>` : ''}
      ${montoStr ? `
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Monto:</span>
        <span style="color: #333; margin-left: 8px; font-size: 16px;"><strong>${montoStr}</strong></span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>` : ''}
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Fecha:</span>
        <span style="color: #333; margin-left: 8px;">${fechaStr}</span>
      </td></tr>
    </table>

    ${data.detalle ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="color: #1a1f2e; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.detalle}</p>
    </div>` : ''}

    ${getPaymentInfoBlock()}

    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0;">
      Si tiene cualquier consulta sobre esta operación, no dude en contactarnos.
    </p>
  `);

  return { subject, html };
}

interface CobranzaData {
  clientName: string;
  clientRut?: string;
  montoAdeudado: number | string;
  fechaVencimiento: Date | string;
  numeroDocumento?: string;
  mensajeAdicional?: string;
}

export function buildCobranzaEmail(data: CobranzaData): { subject: string; html: string } {
  const venc = typeof data.fechaVencimiento === 'string' ? new Date(data.fechaVencimiento) : data.fechaVencimiento;
  const vencStr = venc.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  const montoStr = new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0
  }).format(Number(data.montoAdeudado));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const vencDay = new Date(venc);
  vencDay.setHours(0, 0, 0, 0);
  const vencido = vencDay.getTime() < today.getTime();
  const diasDiff = Math.round((vencDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const estadoBox = vencido
    ? `<div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
         <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>Documento vencido</strong> hace ${Math.abs(diasDiff)} día(s).</p>
       </div>`
    : `<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
         <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Vence en ${diasDiff} día(s)</strong>.</p>
       </div>`;

  const subject = vencido
    ? `Recordatorio de pago vencido${data.numeroDocumento ? ` - ${data.numeroDocumento}` : ''} - ${data.clientName}`
    : `Recordatorio de pago próximo a vencer${data.numeroDocumento ? ` - ${data.numeroDocumento}` : ''} - ${data.clientName}`;

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">
      ${vencido ? 'Recordatorio de Pago Vencido' : 'Recordatorio de Pago'}
    </h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Estimado(a) <strong>${data.clientName}</strong>,
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Le recordamos que registra el siguiente saldo pendiente con Pinturas Panorámica:
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px 0;">
      ${data.numeroDocumento ? `
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">N° Documento:</span>
        <span style="color: #333; margin-left: 8px;">${data.numeroDocumento}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>` : ''}
      ${data.clientRut ? `
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">RUT:</span>
        <span style="color: #333; margin-left: 8px;">${data.clientRut}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>` : ''}
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Monto adeudado:</span>
        <span style="color: #333; margin-left: 8px; font-size: 18px;"><strong>${montoStr}</strong></span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Fecha de vencimiento:</span>
        <span style="color: ${vencido ? '#dc2626' : '#333'}; margin-left: 8px;"><strong>${vencStr}</strong></span>
      </td></tr>
    </table>

    ${estadoBox}

    ${data.mensajeAdicional ? `
    <div style="background-color: #f8f9fa; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="color: #1a1f2e; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.mensajeAdicional}</p>
    </div>` : ''}

    ${getPaymentInfoBlock()}

    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 25px 0 5px 0;">
      Si ya realizó el pago, por favor haga caso omiso de este mensaje. Para coordinar el pago o regularizar este saldo, comuníquese con nuestro equipo de cobranzas.
    </p>
  `);

  return { subject, html };
}

interface OrderReceivedData {
  clientName: string;
  orderNumber: string;
  total?: number;
  items?: Array<{ name: string; quantity: number; price?: number }>;
}

export function buildOrderReceivedEmail(data: OrderReceivedData): { subject: string; html: string } {
  const totalStr = typeof data.total === 'number'
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(data.total)
    : null;
  const subject = `Hemos recibido tu pedido #${data.orderNumber} - Pinturas Panorámica`;
  const itemsRows = (data.items || []).slice(0, 30).map(it => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333;">${it.name}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center;">${it.quantity}</td>
      ${typeof it.price === 'number' ? `<td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: right;">${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(it.price)}</td>` : ''}
    </tr>`).join('');

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">¡Recibimos tu pedido!</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      Hola <strong>${data.clientName}</strong>, gracias por elegir Pinturas Panorámica.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Tu pedido fue ingresado correctamente y está siendo procesado por nuestro equipo. Te contactaremos a la brevedad para confirmar la entrega o el retiro.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0;">
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">N° Pedido:</span>
        <span style="color: #333; margin-left: 8px;">${data.orderNumber}</span>
      </td></tr>
      ${totalStr ? `<tr><td style="height: 6px;"></td></tr>
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Total:</span>
        <span style="color: #333; margin-left: 8px; font-size: 16px;"><strong>${totalStr}</strong></span>
      </td></tr>` : ''}
    </table>
    ${itemsRows ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; border: 1px solid #eee; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #1a1f2e;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRODUCTO</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #fff; letter-spacing: 0.5px;">CANT.</th>
          ${(data.items || []).some(i => typeof i.price === 'number') ? '<th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRECIO</th>' : ''}
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>` : ''}
    ${getPaymentInfoBlock()}
    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
      Si necesitas modificar algo o tienes dudas, escríbenos a
      <a href="mailto:contacto@pinturaspanoramica.cl" style="color: #fd6301; text-decoration: none;">contacto@pinturaspanoramica.cl</a>.
    </p>
  `);
  return { subject, html };
}

interface OrderInternalNotifyData {
  orderNumber: string;
  clientName: string;
  clientEmail?: string | null;
  clientRut?: string | null;
  clientPhone?: string | null;
  total: number;
  subtotal?: number;
  tax?: number;
  paymentCondition?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  status?: string | null;
  items: Array<{ name: string; quantity: number; price?: number }>;
}

export function buildOrderInternalNotifyEmail(data: OrderInternalNotifyData): { subject: string; html: string } {
  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
  const subject = `🛒 Nuevo pedido en Panorámica Market #${data.orderNumber} — ${data.clientName}`;

  const row = (label: string, value?: string | null) => value ? `
    <tr>
      <td style="padding: 6px 12px; font-size: 13px; color: #888; white-space: nowrap;">${label}</td>
      <td style="padding: 6px 12px; font-size: 13px; color: #1a1f2e; font-weight: bold;">${value}</td>
    </tr>` : '';

  const itemsRows = (data.items || []).slice(0, 80).map(it => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333;">${it.name}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center;">${it.quantity}</td>
      ${typeof it.price === 'number' ? `<td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: right;">${fmt(it.price)}</td>` : '<td style="padding: 8px 12px; border-bottom: 1px solid #eee;"></td>'}
    </tr>`).join('');

  const orderUrl = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/ecommerce`;

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 16px 0; font-family: Arial, sans-serif;">Nuevo pedido en Panorámica Market</h2>
    <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
      Se ha registrado un nuevo pedido desde la tienda. Datos del cliente:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; background-color: #f8f9fa; border-radius: 6px;">
      ${row('N° Pedido', data.orderNumber)}
      ${row('Cliente', data.clientName)}
      ${row('Email', data.clientEmail)}
      ${row('RUT', data.clientRut)}
      ${row('Teléfono', data.clientPhone)}
      ${row('Condición de pago', data.paymentCondition)}
      ${row('Estado', data.status)}
      ${row('Dirección de envío', data.shippingAddress)}
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; border: 1px solid #eee; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #1a1f2e;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRODUCTO</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #fff; letter-spacing: 0.5px;">CANT.</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRECIO</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0;">
      ${typeof data.subtotal === 'number' ? `<tr><td style="padding: 6px 12px; text-align: right; font-size: 13px; color: #555;">Subtotal: <strong style="color: #1a1f2e;">${fmt(data.subtotal)}</strong></td></tr>` : ''}
      ${typeof data.tax === 'number' ? `<tr><td style="padding: 6px 12px; text-align: right; font-size: 13px; color: #555;">IVA: <strong style="color: #1a1f2e;">${fmt(data.tax)}</strong></td></tr>` : ''}
      <tr><td style="padding: 10px 12px; text-align: right; font-size: 15px; color: #1a1f2e; background-color: #fff7ed; border-radius: 4px;">
        Total: <strong style="color: #fd6301; font-size: 17px;">${fmt(data.total)}</strong>
      </td></tr>
    </table>
    ${data.notes ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 12px 16px; border-radius: 4px; margin: 0 0 16px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Notas del cliente:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.notes}</p>
    </div>` : ''}
    <p style="text-align: center; margin: 20px 0 0 0;">
      <a href="${orderUrl}" style="display: inline-block; background-color: #fd6301; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Gestionar pedido
      </a>
    </p>
  `);
  return { subject, html };
}

interface OrderModifiedData {
  clientName: string;
  orderNumber: string;
  newTotal: number;
  previousTotal?: number;
  paymentCondition?: string;
  requiresReceiptUpdate: boolean;
  orderUrl: string;
}

export function buildOrderModifiedEmail(data: OrderModifiedData): { subject: string; html: string } {
  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
  const totalStr = fmt(data.newTotal);
  const prevStr = typeof data.previousTotal === 'number' && data.previousTotal !== data.newTotal ? fmt(data.previousTotal) : null;
  const diff = prevStr ? data.newTotal - (data.previousTotal as number) : 0;
  const diffSign = diff > 0 ? '+' : '';
  const subject = `Tu pedido #${data.orderNumber} fue modificado - Pinturas Panorámica`;

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">Tu pedido fue modificado</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      Hola <strong>${data.clientName}</strong>, queremos avisarte que nuestro equipo ajustó tu pedido <strong>#${data.orderNumber}</strong>.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 20px 0;">
      ${prevStr ? `
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="color: #555;">Total anterior:</span>
        <span style="color: #999; margin-left: 8px; text-decoration: line-through;">${prevStr}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>` : ''}
      <tr><td style="padding: 12px; background-color: #fff7ed; border-left: 4px solid #fd6301; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Nuevo total:</span>
        <span style="color: #1a1f2e; margin-left: 8px; font-size: 17px;"><strong>${totalStr}</strong></span>
        ${prevStr ? `<span style="color: ${diff > 0 ? '#b91c1c' : '#047857'}; margin-left: 10px; font-size: 13px;">(${diffSign}${fmt(diff)})</span>` : ''}
      </td></tr>
    </table>
    ${data.requiresReceiptUpdate ? `
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin: 0 0 20px 0;">
      <p style="color: #92400e; margin: 0 0 6px 0; font-size: 14px; font-weight: bold;">⚠️ Acción requerida: actualiza tu comprobante</p>
      <p style="color: #78350f; margin: 0; font-size: 13px; line-height: 1.6;">
        Como el total cambió, te pedimos que revises el monto transferido. Si corresponde, sube un comprobante actualizado desde tu portal para que podamos seguir procesando el pedido.
      </p>
    </div>` : ''}
    <p style="text-align: center; margin: 24px 0;">
      <a href="${data.orderUrl}" style="display: inline-block; background-color: #fd6301; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Ver mi pedido
      </a>
    </p>
    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
      Si tienes dudas, escríbenos a
      <a href="mailto:contacto@pinturaspanoramica.cl" style="color: #fd6301; text-decoration: none;">contacto@pinturaspanoramica.cl</a>.
    </p>
  `);
  return { subject, html };
}

interface QuoteReceivedData {
  clientName: string;
  itemCount?: number;
  message?: string;
}

export function buildQuoteReceivedEmail(data: QuoteReceivedData): { subject: string; html: string } {
  const subject = `Hemos recibido tu solicitud de cotización - Pinturas Panorámica`;
  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">¡Recibimos tu cotización!</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      Hola <strong>${data.clientName}</strong>, gracias por contactar a Pinturas Panorámica.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Recibimos tu solicitud${typeof data.itemCount === 'number' ? ` con <strong>${data.itemCount} producto(s)</strong>` : ''}. Nuestro equipo comercial la está revisando y te enviará la cotización con precios y disponibilidad a la brevedad.
    </p>
    ${data.message ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Tu mensaje:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
    </div>` : ''}
    ${getPaymentInfoBlock()}
    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
      Si necesitas algo urgente, escríbenos a
      <a href="mailto:contacto@pinturaspanoramica.cl" style="color: #fd6301; text-decoration: none;">contacto@pinturaspanoramica.cl</a>.
    </p>
  `);
  return { subject, html };
}

interface QuoteInternalNotifyData {
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string | null;
  visitorCompany?: string | null;
  visitorCity?: string | null;
  visitorRut?: string | null;
  /** Segmento declarado por el visitante (Construcción / Ferretería / Industrial). */
  segmento?: string | null;
  /** Lead creado en el CRM de seguimiento, si se pudo crear. */
  crmLeadId?: string | null;
  message?: string | null;
  items: Array<{ productName: string; color?: string; format?: string; quantity: number }>;
}

export function buildQuoteInternalNotifyEmail(data: QuoteInternalNotifyData): { subject: string; html: string } {
  const segmentoTag = data.segmento ? `[${data.segmento}] ` : '';
  const subject = `📋 ${segmentoTag}Nueva cotización web: ${data.visitorName} (${data.items.length} producto${data.items.length === 1 ? '' : 's'})`;

  const contactRow = (label: string, value?: string | null) => value ? `
    <tr>
      <td style="padding: 6px 12px; font-size: 13px; color: #888; white-space: nowrap;">${label}</td>
      <td style="padding: 6px 12px; font-size: 13px; color: #1a1f2e; font-weight: bold;">${value}</td>
    </tr>` : '';

  const itemsRows = data.items.slice(0, 50).map(it => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333;">${it.productName}${it.color ? ` — ${it.color}` : ''}${it.format ? ` (${it.format})` : ''}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center;">${it.quantity}</td>
    </tr>`).join('');

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 16px 0; font-family: Arial, sans-serif;">Nueva solicitud de cotización</h2>
    <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
      Llegó una solicitud desde el cotizador web. Datos de contacto:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; background-color: #f8f9fa; border-radius: 6px;">
      ${contactRow('Segmento', data.segmento)}
      ${contactRow('Nombre', data.visitorName)}
      ${contactRow('Email', data.visitorEmail)}
      ${contactRow('Teléfono', data.visitorPhone)}
      ${contactRow('Empresa', data.visitorCompany)}
      ${contactRow('Ciudad', data.visitorCity)}
      ${contactRow('RUT', data.visitorRut)}
    </table>
    ${data.crmLeadId ? `
    <p style="color: #16a34a; font-size: 13px; margin: 0 0 16px 0;">
      ✅ Ya quedó en el CRM de ${data.segmento || 'su segmento'} con la etiqueta <strong>COTIZACIÓN WEB</strong>.
      <a href="${PUBLIC_BASE_URL.replace(/\/$/, '')}/seguimiento-clientes/${data.crmLeadId}" style="color: #fd6301;">Ver el lead</a>
    </p>` : ''}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; border: 1px solid #eee; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #1a1f2e;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRODUCTO</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #fff; letter-spacing: 0.5px;">CANT.</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
    ${data.message ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 12px 16px; border-radius: 4px; margin: 0 0 16px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Mensaje del cliente:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
    </div>` : ''}
    <p style="text-align: center; margin: 20px 0 0 0;">
      <a href="${PUBLIC_BASE_URL.replace(/\/$/, '')}/cotizaciones-b2c" style="display: inline-block; background-color: #fd6301; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Gestionar cotización
      </a>
    </p>
  `);
  return { subject, html };
}

interface CustomColorPricedData {
  clientName: string;
  productName: string;
  format?: string | null;
  colorCode: string;
  colorBrand?: string | null;
  colorHex?: string | null;
  colorNotes?: string | null;
  unitPrice: number;
  quantity: number;
  /** Token de la variante: el enlace es lo que efectivamente carga el carrito. */
  token: string;
  quoteNumber?: string | null;
}

/**
 * Le avisa al cliente que su color a medida ya tiene precio y quedó listo para
 * pedir. El botón abre /tienda con el token y ahí la tienda mete el producto al
 * carrito — el carrito vive en el navegador, así que sin este clic no hay forma
 * de dejárselo cargado.
 */
export function buildCustomColorPricedEmail(data: CustomColorPricedData): { subject: string; html: string } {
  const subject = `¡Ya tenemos precio para tu color personalizado! - Pinturas Panorámica`;
  const cartUrl = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/tienda?colorPersonalizado=${encodeURIComponent(data.token)}`;
  const swatch = data.colorHex && /^#[0-9a-f]{6}$/i.test(data.colorHex) ? data.colorHex : '#e5e7eb';
  const lineTotal = data.unitPrice * data.quantity;
  const money = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">¡Ya tenemos precio para tu producto!</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      Hola <strong>${data.clientName}</strong>, preparamos el precio de tu color personalizado
      y <strong>ya está en tu carrito</strong>, listo para que lo pidas cuando quieras.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #f0abfc; border-radius: 8px; margin: 20px 0; background-color: #fdf4ff;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="64" valign="top">
                <div style="width: 56px; height: 56px; border-radius: 8px; background-color: ${swatch}; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #e9d5ff;"></div>
              </td>
              <td valign="top" style="padding-left: 14px;">
                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #a21caf; letter-spacing: 0.5px; text-transform: uppercase;">
                  Color personalizado
                </p>
                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: bold; color: #1a1f2e;">
                  ${data.productName}
                </p>
                <p style="margin: 0; font-size: 13px; color: #555;">
                  ${data.colorCode}${data.colorBrand ? ` · ${data.colorBrand}` : ''}${data.format ? ` · ${data.format}` : ''}
                </p>
              </td>
            </tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 14px; border-top: 1px solid #f0abfc;">
            <tr>
              <td style="padding: 10px 0 0 0; font-size: 13px; color: #666;">Precio unitario</td>
              <td style="padding: 10px 0 0 0; font-size: 13px; color: #1a1f2e; text-align: right; font-weight: bold;">${money(data.unitPrice)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0 0 0; font-size: 13px; color: #666;">Cantidad cotizada</td>
              <td style="padding: 4px 0 0 0; font-size: 13px; color: #1a1f2e; text-align: right; font-weight: bold;">${data.quantity}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0 0 0; font-size: 14px; color: #1a1f2e; font-weight: bold;">Total</td>
              <td style="padding: 8px 0 0 0; font-size: 18px; color: #a21caf; text-align: right; font-weight: bold;">${money(lineTotal)}</td>
            </tr>
          </table>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">Valores netos, no incluyen IVA.</p>
        </td>
      </tr>
    </table>

    ${data.colorNotes ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 12px 16px; border-radius: 4px; margin: 0 0 20px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Tus indicaciones de color:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.colorNotes}</p>
    </div>` : ''}

    <p style="text-align: center; margin: 24px 0 8px 0;">
      <a href="${cartUrl}" style="display: inline-block; background-color: #fd6301; color: #fff; text-decoration: none; padding: 14px 34px; border-radius: 6px; font-weight: bold; font-size: 15px;">
        Ver mi carrito y pedir
      </a>
    </p>
    <p style="text-align: center; color: #888; font-size: 12px; margin: 0 0 16px 0;">
      El enlace deja el producto cargado en tu carrito automáticamente.
    </p>

    ${data.colorHex && /^#[0-9a-f]{6}$/i.test(data.colorHex) ? `
    <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 0 0 12px 0; text-align: center;">
      El color que ves arriba es una referencia aproximada en pantalla: el tono final se ajusta según la carta original.
    </p>` : ''}

    ${getPaymentInfoBlock()}

    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
      ${data.quoteNumber ? `Cotización <strong>${data.quoteNumber}</strong>. ` : ''}Cualquier duda, escríbenos a
      <a href="mailto:contacto@pinturaspanoramica.cl" style="color: #fd6301; text-decoration: none;">contacto@pinturaspanoramica.cl</a>.
    </p>
  `);
  return { subject, html };
}

interface SuggestedOrderData {
  clientName: string;
  orderNumber: string;
  total: number;
  items: Array<{ name: string; quantity: number; price?: number }>;
  suggestedByName?: string;
  notes?: string | null;
  orderUrl: string;
}

export function buildSuggestedOrderEmail(data: SuggestedOrderData): { subject: string; html: string } {
  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
  const totalStr = fmt(data.total);
  const subject = `Tu pedido sugerido #${data.orderNumber} ya está listo — revísalo en 1 minuto`;

  const itemsRows = (data.items || []).slice(0, 50).map(it => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333;">${it.name}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center;">${it.quantity}</td>
      ${typeof it.price === 'number' ? `<td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: right;">${fmt(it.price)}</td>` : ''}
    </tr>`).join('');

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">Preparamos un pedido pensado para ti</h2>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      Hola <strong>${data.clientName}</strong>, ${data.suggestedByName ? `<strong>${data.suggestedByName}</strong> del equipo de Pinturas Panorámica` : 'nuestro equipo'} armó este pedido pensando en lo que sueles necesitar, y lo dejó listo para que no tengas que empezar de cero.
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Revísalo en segundos: <strong>acéptalo</strong> tal cual, <strong>ajústalo</strong> a tu gusto o <strong>descártalo</strong>, todo desde tu portal. No se cobra nada hasta que tú lo confirmes. Adjuntamos el detalle completo en PDF.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0;">
      <tr><td style="padding: 10px 12px; background-color: #f8f9fa; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">N° Sugerido:</span>
        <span style="color: #333; margin-left: 8px;">${data.orderNumber}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>
      <tr><td style="padding: 12px; background-color: #fff7ed; border-left: 4px solid #fd6301; border-radius: 4px;">
        <span style="font-weight: bold; color: #fd6301;">Total estimado:</span>
        <span style="color: #1a1f2e; margin-left: 8px; font-size: 17px;"><strong>${totalStr}</strong></span>
      </td></tr>
    </table>
    ${itemsRows ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; border: 1px solid #eee; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #1a1f2e;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRODUCTO</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #fff; letter-spacing: 0.5px;">CANT.</th>
          ${(data.items || []).some(i => typeof i.price === 'number') ? '<th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRECIO</th>' : ''}
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>` : ''}
    ${data.notes ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 14px 16px; border-radius: 4px; margin: 0 0 20px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Nota del equipo:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.notes}</p>
    </div>` : ''}
    <p style="text-align: center; margin: 24px 0 8px 0;">
      <a href="${data.orderUrl}" style="display: inline-block; background-color: #fd6301; color: #fff; text-decoration: none; padding: 14px 34px; border-radius: 6px; font-weight: bold; font-size: 15px;">
        Revisar mi pedido ahora
      </a>
    </p>
    <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
      Solo te tomará un minuto · Sin compromiso
    </p>
    <p style="color: #555; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
      Si tienes dudas, escríbenos a
      <a href="mailto:contacto@pinturaspanoramica.cl" style="color: #fd6301; text-decoration: none;">contacto@pinturaspanoramica.cl</a>.
    </p>
  `);
  return { subject, html };
}

interface SuggestedTeamCopyData {
  clientName: string;
  clientEmail?: string | null;
  orderNumber: string;
  total: number;
  items: Array<{ name: string; quantity: number; price?: number }>;
  suggestedByName?: string;
  notes?: string | null;
  teamMessage?: string | null;
}

// Copia interna para el equipo cuando se envía un sugerido a un cliente.
// Mantiene la misma estética que el correo de "nuevo pedido" y lleva el PDF adjunto.
export function buildSuggestedTeamCopyEmail(data: SuggestedTeamCopyData): { subject: string; html: string } {
  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
  const totalStr = fmt(data.total);
  const subject = `Pedido sugerido enviado #${data.orderNumber} - ${data.clientName}`;

  const itemsRows = (data.items || []).slice(0, 50).map(it => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333;">${it.name}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center;">${it.quantity}</td>
      ${typeof it.price === 'number' ? `<td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: right;">${fmt(it.price)}</td>` : ''}
    </tr>`).join('');

  const html = wrapEmailContent(`
    <h2 style="color: #1a1f2e; margin: 0 0 8px 0; font-family: Arial, sans-serif;">Pedido sugerido enviado</h2>
    <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px 0;">${data.clientName}${data.clientEmail ? ` · ${data.clientEmail}` : ''}</p>

    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Estimado equipo,
    </p>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      ${data.suggestedByName ? `<strong>${data.suggestedByName}</strong>` : 'Se'} envió un pedido sugerido a <strong>${data.clientName}</strong>. El cliente puede aceptarlo, modificarlo o rechazarlo desde su portal. Se adjunta el PDF del sugerido.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0;">
      <tr><td style="padding: 11px 14px; background-color: #f8f9fa; border-radius: 6px;">
        <span style="font-weight: 600; color: #fd6301; font-size: 13px;">N° Sugerido:</span>
        <span style="color: #1a1f2e; margin-left: 8px; font-size: 14px;">${data.orderNumber}</span>
      </td></tr>
      <tr><td style="height: 6px;"></td></tr>
      <tr><td style="padding: 11px 14px; background-color: #fff7ed; border-left: 3px solid #fd6301; border-radius: 6px;">
        <span style="font-weight: 600; color: #fd6301; font-size: 13px;">Total estimado:</span>
        <span style="color: #1a1f2e; margin-left: 8px; font-size: 15px;"><strong>${totalStr}</strong></span>
      </td></tr>
    </table>
    ${itemsRows ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 16px 0; border: 1px solid #eee; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #1a1f2e;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRODUCTO</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #fff; letter-spacing: 0.5px;">CANT.</th>
          ${(data.items || []).some(i => typeof i.price === 'number') ? '<th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #fff; letter-spacing: 0.5px;">PRECIO</th>' : ''}
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>` : ''}
    ${data.teamMessage ? `
    <div style="background-color: #f8f9fa; border-left: 4px solid #1a1f2e; padding: 14px 16px; border-radius: 4px; margin: 0 0 20px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Comentario interno:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.teamMessage}</p>
    </div>` : ''}
    ${data.notes ? `
    <div style="background-color: #fff7ed; border-left: 4px solid #fd6301; padding: 14px 16px; border-radius: 4px; margin: 0 0 20px 0;">
      <p style="color: #1a1f2e; margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">Nota para el cliente:</p>
      <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.notes}</p>
    </div>` : ''}
  `);
  return { subject, html };
}

export function wrapEmailContent(bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td>
                    ${getEmailHeader()}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    ${bodyContent}
                  </td>
                </tr>
                <tr>
                  <td>
                    ${getEmailFooter()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
