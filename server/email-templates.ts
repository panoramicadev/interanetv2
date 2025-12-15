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
