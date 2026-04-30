import fs from 'fs';
import path from 'path';

const LOGO_PATH = path.join(process.cwd(), 'attached_assets', 'Captura_de_pantalla_2025-12-15_a_la(s)_10.12.05_a.m._1765804326176.png');

let cachedLogoBase64: string | null = null;

function getLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;
  
  try {
    const logoBuffer = fs.readFileSync(LOGO_PATH);
    cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    return cachedLogoBase64;
  } catch (error) {
    console.warn('Could not load logo for email template:', error);
    return '';
  }
}

export function getEmailHeader(): string {
  const logoDataUri = getLogoBase64();
  
  return `
    <div style="background-color: #1a1f2e; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Panoramica" style="max-width: 280px; height: auto;" />` : '<h1 style="color: white; margin: 0; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold;">PANORAMICA</h1>'}
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
