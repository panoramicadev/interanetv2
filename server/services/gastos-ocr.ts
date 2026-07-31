/**
 * OCR de comprobantes de gasto — multi-proveedor con soporte PDF.
 *
 * Portado de primerosresultados/rendicion-gastos (server/src/modules/ocr) y
 * fusionado con el prompt chileno que ya tenía interanetv2 (peajes, folios,
 * RUT con formato XX.XXX.XXX-X).
 *
 * Mejoras sobre la versión anterior del endpoint:
 *  - Acepta PDF: se rasteriza la primera página con `convertPdfToImage` antes
 *    de mandarla al modelo (antes devolvía "OCR solo disponible para imágenes").
 *  - Fuerza salida JSON (`response_format: json_object` / prefill en Anthropic).
 *    Sin esto el modelo envuelve el objeto en ```json y el parse falla, que era
 *    la causa de los "no se pudo interpretar el documento".
 *  - Proveedor configurable: OpenAI (default) o Anthropic, con fallback al otro
 *    si el primero falla.
 *  - Normaliza montos ("$ 12.500" → 12500) y fechas (DD/MM/YYYY → YYYY-MM-DD).
 */
import { convertPdfToImage, isPdfFile } from '../pdf-to-image';

export interface DatosComprobante {
  monto: number | null;
  descripcion: string | null;
  numeroDocumento: string | null;
  rutProveedor: string | null;
  proveedor: string | null;
  fechaEmision: string | null;
  tipoDocumento: 'Boleta' | 'Factura' | 'Recibo' | 'Peaje' | 'Otro' | null;
  /** Autoevaluación del modelo, 0–1. La UI avisa cuando baja de 0.6. */
  confianza: number;
}

export interface ResultadoOcr {
  success: boolean;
  message: string;
  data: DatosComprobante | null;
  proveedor?: string;
}

const PROMPT = `Eres un OCR experto en boletas, facturas y comprobantes de gasto chilenos.
Recibirás la imagen de un comprobante y debes extraer los datos en JSON.

REGLAS:
- NO inventes datos. Si un campo no está visible o no tienes certeza alta, devuélvelo como null.
- monto: el TOTAL final a pagar (con impuestos), como número entero sin símbolo ni separadores de miles. Busca la palabra TOTAL.
- descripcion: resumen corto (máx. 80 caracteres) del concepto principal. Si es un ticket de peaje, indícalo.
- numeroDocumento: número de folio, boleta, factura o ticket.
- rutProveedor: RUT del emisor en formato XX.XXX.XXX-X. Suele estar en la parte superior.
- proveedor: razón social o nombre del emisor (o el nombre de la autopista si es peaje).
- fechaEmision: formato ISO YYYY-MM-DD. Si ves DD/MM/YYYY, conviértelo. Si no hay fecha, null.
- tipoDocumento: exactamente uno de "Boleta", "Factura", "Recibo", "Peaje", "Otro".
  Si es un ticket de peaje o de autopista, usa "Peaje".
- confianza: tu autoevaluación de la calidad de la extracción, entre 0.0 y 1.0.
- Si no puedes identificar un campo con certeza, busca sinónimos (Folio = numeroDocumento) antes de rendirte.

Devuelve SOLO un JSON válido con esta estructura, sin markdown ni texto adicional:
{
  "monto": <número o null>,
  "descripcion": <string o null>,
  "numeroDocumento": <string o null>,
  "rutProveedor": <string o null>,
  "proveedor": <string o null>,
  "fechaEmision": <"YYYY-MM-DD" o null>,
  "tipoDocumento": <"Boleta"|"Factura"|"Recibo"|"Peaje"|"Otro" o null>,
  "confianza": <número 0.0-1.0>
}`;

// ─── Normalización ──────────────────────────────────────────────────────────

function comoTexto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** "$ 12.500", "12.500,00", 12500 → 12500. */
function comoNumero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== 'string') return null;

  let limpio = v.replace(/[^\d.,-]/g, '').trim();
  if (!limpio) return null;

  // Formato chileno: el punto es separador de miles y la coma decimal.
  const tieneComa = limpio.includes(',');
  const tienePunto = limpio.includes('.');
  if (tieneComa && tienePunto) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    // "12,50" es decimal; "12,500" con 3 dígitos es separador de miles.
    limpio = /,\d{3}$/.test(limpio) ? limpio.replace(',', '') : limpio.replace(',', '.');
  } else if (tienePunto && /\.\d{3}$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '');
  }

  const n = Number(limpio);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Acepta YYYY-MM-DD y DD/MM/YYYY (o con guiones); todo lo demás → null. */
function comoFecha(v: unknown): string | null {
  const s = comoTexto(v);
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const latino = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (latino) {
    const [, d, m, y] = latino;
    const anio = y.length === 2 ? `20${y}` : y;
    return `${anio}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

const TIPOS_VALIDOS = ['Boleta', 'Factura', 'Recibo', 'Peaje', 'Otro'] as const;

function normalizar(bruto: Record<string, unknown>): DatosComprobante {
  const tipo = comoTexto(bruto.tipoDocumento);
  const confianza = comoNumero(bruto.confianza);

  return {
    monto: comoNumero(bruto.monto),
    descripcion: comoTexto(bruto.descripcion),
    numeroDocumento: comoTexto(bruto.numeroDocumento),
    rutProveedor: comoTexto(bruto.rutProveedor),
    proveedor: comoTexto(bruto.proveedor),
    fechaEmision: comoFecha(bruto.fechaEmision),
    tipoDocumento: TIPOS_VALIDOS.includes(tipo as any) ? (tipo as DatosComprobante['tipoDocumento']) : null,
    // El modelo suele devolver 0-1; si manda 85 lo interpretamos como porcentaje.
    confianza:
      confianza === null ? 0.5 : Math.max(0, Math.min(1, confianza > 1 ? confianza / 100 : confianza)),
  };
}

/** Red de seguridad por si el modelo igual envuelve el JSON en ```json … ```. */
function extraerJson(texto: string): string {
  const t = texto.trim();
  const conFences = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const cuerpo = (conFences?.[1] ?? t).trim();
  const inicio = cuerpo.indexOf('{');
  const fin = cuerpo.lastIndexOf('}');
  return inicio !== -1 && fin > inicio ? cuerpo.slice(inicio, fin + 1) : cuerpo;
}

// ─── Proveedores ────────────────────────────────────────────────────────────

async function extraerConOpenAI(imagen: Buffer, mime: string): Promise<DatosComprobante> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI no está configurado');

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const respuesta = await openai.chat.completions.create({
    model: process.env.OCR_OPENAI_MODEL || 'gpt-4o',
    // Sin esto el modelo envuelve el objeto en markdown y JSON.parse falla.
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${imagen.toString('base64')}` },
          },
        ],
      },
    ],
  });

  const contenido = respuesta.choices[0]?.message?.content;
  if (!contenido) throw new Error('OpenAI respondió sin contenido');
  return normalizar(JSON.parse(extraerJson(contenido)));
}

async function extraerConAnthropic(imagen: Buffer, mime: string): Promise<DatosComprobante> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic no está configurado');

  const tipoMedia =
    mime === 'image/png' ? 'image/png'
    : mime === 'image/webp' ? 'image/webp'
    : mime === 'image/gif' ? 'image/gif'
    : 'image/jpeg';

  const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.OCR_ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 800,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: tipoMedia, data: imagen.toString('base64') },
            },
            { type: 'text', text: PROMPT },
          ],
        },
        // Prefill: arranca la respuesta con "{" para que no anteponga prosa.
        { role: 'assistant', content: '{' },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Anthropic API ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }

  const cuerpo: any = await respuesta.json();
  const texto = cuerpo?.content?.[0]?.text;
  if (!texto) throw new Error('Anthropic respondió sin contenido');
  // El prefill consumió la llave de apertura, hay que reponerla.
  return normalizar(JSON.parse(extraerJson(`{${texto}`)));
}

// ─── Orquestación ───────────────────────────────────────────────────────────

/**
 * Rasteriza si hace falta y prueba los proveedores en orden. Nunca lanza: el
 * formulario de gasto tiene que seguir siendo usable con carga manual.
 */
export async function extraerComprobante(
  archivo: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<ResultadoOcr> {
  let imagen = archivo.buffer;
  let mime = archivo.mimetype;

  if (isPdfFile(archivo.mimetype, archivo.originalname)) {
    try {
      const rasterizada = await convertPdfToImage(archivo.buffer, 1400);
      if (!rasterizada) {
        return {
          success: false,
          message: 'No se pudo convertir el PDF a imagen. Ingresa los datos manualmente.',
          data: null,
        };
      }
      imagen = rasterizada;
      mime = 'image/png';
    } catch (error: any) {
      console.error('[ocr] Error rasterizando PDF:', error.message);
      return {
        success: false,
        message: 'No se pudo leer el PDF. Ingresa los datos manualmente.',
        data: null,
      };
    }
  } else if (!mime.startsWith('image/')) {
    return {
      success: false,
      message: 'Formato no soportado. Sube una imagen o un PDF.',
      data: null,
    };
  }

  // Orden configurable: si OCR_PROVIDER=anthropic se prueba Anthropic primero.
  const preferido = (process.env.OCR_PROVIDER || 'openai').toLowerCase();
  const orden: [string, (b: Buffer, m: string) => Promise<DatosComprobante>][] =
    preferido === 'anthropic'
      ? [['anthropic', extraerConAnthropic], ['openai', extraerConOpenAI]]
      : [['openai', extraerConOpenAI], ['anthropic', extraerConAnthropic]];

  const fallos: string[] = [];
  for (const [nombre, extraer] of orden) {
    try {
      const data = await extraer(imagen, mime);
      return { success: true, message: 'Datos extraídos correctamente', data, proveedor: nombre };
    } catch (error: any) {
      fallos.push(`${nombre}: ${error.message}`);
      console.warn(`[ocr] Proveedor "${nombre}" falló:`, error.message);
    }
  }

  console.error('[ocr] Todos los proveedores fallaron:', fallos.join(' | '));
  return {
    success: false,
    message: 'No se pudo interpretar el documento. Ingresa los datos manualmente.',
    data: null,
  };
}
