/**
 * Plantilla del correo de campañas (marketing).
 *
 * Vive en `shared/` a propósito: la usa el servidor para armar el HTML real que
 * sale por Resend y el cliente para la vista previa del editor. Así el "lo que
 * ves es lo que se envía" está garantizado por construcción y no por copiar el
 * mismo HTML en dos lugares.
 */

export const CAMPAIGN_BRAND = {
  /** Cabecera del correo: negra, con el logo centrado. */
  headerBg: '#000000',
  accent: '#fd6301',
  text: '#333333',
  muted: '#8a8f98',
  pageBg: '#f4f4f4',
  cardBg: '#ffffff',
  footerBg: '#0f0f0f',
  logoWidth: 240,
} as const;

export type CampaignEmailOptions = {
  /** Cuerpo HTML ya personalizado ({{nombre}} resuelto). */
  body: string;
  /** URL ABSOLUTA del logo (los clientes de correo no resuelven rutas relativas). */
  logoUrl: string;
  /** Texto oculto de vista previa en la bandeja de entrada. */
  preheader?: string | null;
  /** Línea del pie. Si se omite se usa la de la empresa. */
  footerNote?: string | null;
};

/** Arma el HTML completo del correo de campaña (cabecera + cuerpo + pie). */
export function renderCampaignEmail({ body, logoUrl, preheader, footerNote }: CampaignEmailOptions): string {
  const B = CAMPAIGN_BRAND;
  const hiddenPreheader = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
  </head>
  <body style="margin:0;padding:0;background-color:${B.pageBg};font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    ${hiddenPreheader}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${B.pageBg};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:600px;max-width:600px;margin:0 auto;background-color:${B.cardBg};border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
            <!-- Cabecera: fondo negro + logo centrado -->
            <tr>
              <td align="center" bgcolor="${B.headerBg}" style="background-color:${B.headerBg};padding:28px 24px;text-align:center;">
                <img src="${logoUrl}" alt="Pinturas Panorámica" width="${B.logoWidth}"
                     style="display:block;margin:0 auto;width:${B.logoWidth}px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <!-- Cuerpo -->
            <tr>
              <td style="padding:30px;color:${B.text};font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">
                ${body}
              </td>
            </tr>
            <!-- Pie -->
            <tr>
              <td bgcolor="${B.footerBg}" style="background-color:${B.footerBg};padding:22px 24px;text-align:center;">
                <p style="color:#ffffff;font-size:13px;margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-weight:bold;letter-spacing:0.3px;">
                  Pinturas Panorámica
                </p>
                <p style="color:${B.muted};font-size:11px;margin:0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                  ${footerNote || 'contacto@pinturaspanoramica.cl &middot; pinturaspanoramica.cl'}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
