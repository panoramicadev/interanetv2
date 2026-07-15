/**
 * CRM Seguimiento — intérprete de actividad dictada por voz (o escrita).
 *
 * Recibe el texto libre que el vendedor dictó sobre un cliente y lo separa
 * en interacciones estructuradas del composer de Actividad: qué tipo de
 * hito/bitácora es cada una (llamada, visita, problema…), si es un registro
 * de algo que ya pasó o un evento a agendar, y su fecha/hora si corresponde.
 * El resultado NO se inserta acá: el frontend lo muestra para confirmar y
 * recién ahí lo envía a los endpoints de hito/bitácora existentes.
 */
import { getOpenAI } from "./ai-agent";

// Mismo universo de tipos que el composer del detalle: HITO_TIPOS +
// AGENDA_TIPOS + tipos de bitácora (seguimiento/problema van a pedido_bitacora,
// criterio BIT_COMPOSER_VALUES de seguimiento-cliente-detalle.tsx).
const TIPOS_VALIDOS = new Set([
  "contacto", "llamada", "whatsapp", "cotizacion", "visita", "venta", "despacho", "nota",
  "reunion", "videollamada", "correo", "seguimiento", "problema",
]);

export interface ActividadDetectada {
  modo: "registrar" | "agendar";
  tipo: string;
  descripcion: string;
  fecha: string | null; // YYYY-MM-DD (zona America/Santiago)
  hora: string | null;  // HH:MM 24h
}

const SYSTEM_PROMPT = `Eres un asistente del CRM de Pinturas Panorámica (Chile). Un vendedor dicta por voz (o escribe) lo que pasó con un cliente y/o lo que quiere agendar. El dictado puede contener VARIAS interacciones distintas en un solo texto.

Tu tarea: separar el texto en interacciones y devolver SOLO un JSON válido con esta forma exacta:
{
  "entradas": [
    { "modo": "registrar" | "agendar", "tipo": string, "descripcion": string, "fecha": "YYYY-MM-DD" | null, "hora": "HH:MM" | null }
  ]
}

Reglas:
- "modo": "registrar" si relata algo que YA pasó (llamé, visité, se quejó, cotizamos…). "agendar" si es algo pendiente o a futuro (agéndame, hay que llamar, reunión el martes, recordar enviar…).
- "tipo" si modo="registrar", uno de: "contacto" | "llamada" | "whatsapp" | "cotizacion" | "visita" | "venta" | "despacho" | "nota" | "seguimiento" | "problema". Usa "whatsapp" para mensajes de WhatsApp/chat. Usa "problema" para reclamos, atrasos, productos dañados o cualquier inconveniente. Usa "nota" si no calza con ninguno.
- "tipo" si modo="agendar", uno de: "reunion" | "llamada" | "whatsapp" | "videollamada" | "correo" | "visita" | "seguimiento".
- "descripcion": redacción breve y clara de ESA interacción, en español, conservando nombres, montos, productos y acuerdos mencionados. No repitas la fecha dentro de la descripción si ya va en "fecha".
- "fecha": resuelve expresiones relativas usando la fecha de HOY que se te indica ("mañana", "pasado mañana", "el viernes" = el viernes que viene, "en dos semanas"…). null si no se menciona cuándo.
- "hora": formato 24h "HH:MM" ("a las 3 de la tarde" = "15:00", "a las 10 y media" = "10:30"). null si no se menciona.
- Devuelve ÚNICAMENTE el JSON, sin texto adicional ni explicaciones.

Ejemplo (HOY = jueves 2026-07-02):
Texto: "llamé a don pedro quedó de mandar la orden de compra la próxima semana, agéndame una visita para el martes a las 10 y media, y ojo que reclamó porque la última tineta llegó abierta"
JSON: {"entradas":[
  {"modo":"registrar","tipo":"llamada","descripcion":"Llamada con don Pedro: quedó de enviar la orden de compra la próxima semana.","fecha":null,"hora":null},
  {"modo":"agendar","tipo":"visita","descripcion":"Visita a don Pedro.","fecha":"2026-07-07","hora":"10:30"},
  {"modo":"registrar","tipo":"problema","descripcion":"Reclamo: la última tineta llegó abierta.","fecha":null,"hora":null}
]}`;

function sanitizeEntrada(raw: any): ActividadDetectada | null {
  const descripcion = String(raw?.descripcion || "").trim().slice(0, 2000);
  if (!descripcion) return null;
  const modo = raw?.modo === "agendar" ? "agendar" as const : "registrar" as const;
  let tipo = String(raw?.tipo || "").trim().toLowerCase();
  if (!TIPOS_VALIDOS.has(tipo)) tipo = modo === "agendar" ? "reunion" : "nota";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.fecha || "")) ? String(raw.fecha) : null;
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw?.hora || "")) ? String(raw.hora) : null;
  return { modo, tipo, descripcion, fecha, hora };
}

/** Interpreta el texto dictado y devuelve las interacciones detectadas. */
export async function parseActividadCrm(text: string): Promise<ActividadDetectada[]> {
  const openai = getOpenAI();

  // Fecha de HOY en Chile (el server puede correr en UTC), con día de semana
  // para que el modelo resuelva "el martes", "mañana", etc.
  const now = new Date();
  const hoyLegible = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(now);
  const hoyIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `HOY es ${hoyLegible} (${hoyIso}).\n\nTexto dictado:\n${text}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  const entradas = Array.isArray(parsed?.entradas) ? parsed.entradas : [];
  return entradas
    .map(sanitizeEntrada)
    .filter((e: ActividadDetectada | null): e is ActividadDetectada => e !== null)
    .slice(0, 12);
}
