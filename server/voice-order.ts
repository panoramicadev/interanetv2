/**
 * Voice / Text Order Parser
 *
 * Interpreta un pedido dictado o escrito en lenguaje natural por un vendedor
 * (ej: "presupuesto para terrandina, dos stain a precio mix, un latex a precio lista")
 * y lo convierte en un borrador estructurado:
 *   - cliente resuelto contra la base (storage.getClients)
 *   - productos resueltos contra la lista de precios (storage.getPriceList)
 *   - cantidad y lista de precio (tier) por producto
 *
 * Soporta refinamiento iterativo: se le pasa el borrador actual + una nueva
 * instrucción ("el latex que sean 3", "saca el stain", "cambia el cliente a ...")
 * y devuelve el pedido completo actualizado.
 */
import { getOpenAI } from "./ai-agent";
import { storage } from "./storage";
import { normalizeFormat, PRODUCT_FORMATS } from "@shared/format-utils";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Tiers de precio válidos (deben coincidir con PriceTier del frontend). "" = no especificado.
const VALID_TIERS = [
  "lista",
  "mix",
  "oferta",
  "desc10",
  "desc10_5",
  "desc10_5_3",
  "minimo",
  "canalDigital",
  "",
] as const;
type PriceTierValue = (typeof VALID_TIERS)[number];

export interface ParsedOrderItemIntent {
  productQuery: string;
  quantity: number;
  priceTier: PriceTierValue;
}

export interface ParsedOrderIntent {
  clientQuery: string;
  notes: string;
  items: ParsedOrderItemIntent[];
}

export interface ResolvedClient {
  query: string;
  match: any | null;
  alternatives: any[];
}

export interface ResolvedItem {
  query: string;
  quantity: number;
  requestedTier: PriceTierValue;
  product: any | null;
  alternatives: any[];
}

export interface ParsedOrderResult {
  intent: ParsedOrderIntent;
  client: ResolvedClient;
  items: ResolvedItem[];
  notes: string;
}

const SYSTEM_PROMPT = `Eres un asistente que interpreta pedidos de venta de Pinturas Panorámica (Chile), dictados o escritos por un vendedor en lenguaje natural chileno.

Tu tarea: extraer del texto el CLIENTE, los PRODUCTOS (con cantidad y lista de precio) y notas, y devolver SOLO un JSON válido con esta forma exacta:
{
  "clientQuery": string,   // nombre o pista del cliente mencionado (ej: "terrandina"). "" si no se menciona.
  "notes": string,         // notas u observaciones extra para el presupuesto. "" si no hay.
  "items": [
    { "productQuery": string, "quantity": number, "priceTier": string }
  ]
}

Reglas:
- "productQuery": el nombre/pista del producto tal como lo dice el vendedor, INCLUYENDO SIEMPRE el formato/envase si se menciona (ej: "stain caoba galón", "latex satinado blanco 1/4", "esmalte balde 5 galones"). No inventes productos ni códigos; mantén el término cercano a lo dicho.
- Formatos/envases posibles (consérvalos textualmente en "productQuery", no los traduzcas a otro): "1/4 galón" (cuarto), "galón", "balde 4 galones", "balde 5 galones", "unidad". Ojo: el vendedor suele llamar "tonel" al balde (ej: "tonel de 5" = "balde 5 galones"); déjalo escrito tal cual lo diga.
- "quantity": número entero. Convierte números en palabras: "un"/"una"/"uno" = 1, "dos" = 2, "tres" = 3, "medio"/"media" = 1, etc. Si no se indica cantidad, usa 1.
- "priceTier": normaliza la lista de precio a uno de estos valores EXACTOS:
    "lista"        ← "precio lista", "a lista", "lista"
    "mix"          ← "precio mix", "lista mix", "mix"
    "oferta"       ← "oferta", "en oferta", "precio oferta"
    "minimo"       ← "mínimo", "precio mínimo"
    "desc10"       ← "menos 10", "descuento 10", "10%", "diez por ciento"
    "desc10_5"     ← "10 y 5", "10+5", "10 5"
    "desc10_5_3"   ← "10 5 3", "10+5+3"
    "canalDigital" ← "digital", "canal digital"
    ""             ← si NO se especifica lista de precio para ese producto
- Si el texto incluye "PEDIDO ACTUAL (JSON)", aplica la nueva instrucción del vendedor como una MODIFICACIÓN de ese pedido: agrega, quita o reemplaza productos, cambia cantidades, listas de precio o el cliente según se indique, y devuelve el pedido COMPLETO actualizado (no solo el cambio).
- Devuelve ÚNICAMENTE el JSON, sin texto adicional ni explicaciones.

Ejemplo:
Texto: "presupuesto para terrandina, dos stain a precio mix y un latex a precio lista"
JSON: {"clientQuery":"terrandina","notes":"","items":[{"productQuery":"stain","quantity":2,"priceTier":"mix"},{"productQuery":"latex","quantity":1,"priceTier":"lista"}]}`;

function sanitizeTier(value: any): PriceTierValue {
  const v = String(value || "").trim();
  return (VALID_TIERS as readonly string[]).includes(v) ? (v as PriceTierValue) : "";
}

function sanitizeIntent(raw: any): ParsedOrderIntent {
  const itemsRaw = Array.isArray(raw?.items) ? raw.items : [];
  const items: ParsedOrderItemIntent[] = itemsRaw
    .map((it: any) => {
      const productQuery = String(it?.productQuery || "").trim();
      let quantity = Math.floor(Number(it?.quantity));
      if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
      if (quantity > 99999) quantity = 99999;
      return { productQuery, quantity, priceTier: sanitizeTier(it?.priceTier) };
    })
    .filter((it: ParsedOrderItemIntent) => it.productQuery.length > 0)
    .slice(0, 40);

  return {
    clientQuery: String(raw?.clientQuery || "").trim(),
    notes: String(raw?.notes || "").trim(),
    items,
  };
}

/** Llama a OpenAI para extraer la intención estructurada del texto. */
async function extractIntent(
  text: string,
  currentIntent?: ParsedOrderIntent | null,
): Promise<ParsedOrderIntent> {
  const openai = getOpenAI();

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (currentIntent && (currentIntent.items.length > 0 || currentIntent.clientQuery)) {
    messages.push({
      role: "user",
      content: `PEDIDO ACTUAL (JSON):\n${JSON.stringify(currentIntent)}\n\nNUEVA INSTRUCCIÓN DEL VENDEDOR:\n${text}`,
    });
  } else {
    messages.push({ role: "user", content: text });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  return sanitizeIntent(parsed);
}

async function resolveClient(query: string): Promise<ResolvedClient> {
  const q = query.trim();
  if (q.length < 2) return { query: q, match: null, alternatives: [] };
  try {
    const rows = await storage.getClients({ search: q, limit: 5, offset: 0 });
    const list = Array.isArray(rows) ? rows : [];
    return { query: q, match: list[0] || null, alternatives: list.slice(0, 5) };
  } catch (error) {
    console.error("[voice-order] resolveClient error:", error);
    return { query: q, match: null, alternatives: [] };
  }
}

/**
 * Detecta el formato/envase canónico pedido en el texto del producto
 * (ej: "stain caoba galón" → "Galon", "latex 1/4" → "1/4 Galon", "esmalte tonel 5" → "Balde 5 Galones").
 * Devuelve null si no se menciona un formato reconocible.
 */
function detectRequestedFormat(query: string): string | null {
  const canonical = normalizeFormat(query);
  return canonical && PRODUCT_FORMATS[canonical] ? canonical : null;
}

/**
 * Quita del texto las palabras de formato/envase para buscar sólo por el nombre del
 * producto. El vendedor usa sinónimos que no existen en la base (ej: "tonel"=balde,
 * "cuarto"=1/4), que como término de búsqueda harían que no matchee ninguna fila.
 */
function stripFormatTokens(query: string): string {
  let s = ` ${query} `;
  s = s.replace(/\s(?:balde|tonel|bd)(?:\s+de)?(?:\s+[45])?(?:\s+(?:galones|gal[oó]n|gl))?\b/gi, " ");
  s = s.replace(/\s1\s*[\/\-]\s*4(?:\s+de)?(?:\s+(?:galones|gal[oó]n|gl))?\b/gi, " ");
  s = s.replace(/\scuarto(?:\s+de)?(?:\s+(?:galones|gal[oó]n|gl))?\b/gi, " ");
  s = s.replace(/\s(?:galones|gal[oó]n|gl)\b/gi, " ");
  s = s.replace(/\s(?:unidad|und)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

async function resolveItem(item: ParsedOrderItemIntent): Promise<ResolvedItem> {
  const base: ResolvedItem = {
    query: item.productQuery,
    quantity: item.quantity,
    requestedTier: item.priceTier,
    product: null,
    alternatives: [],
  };
  if (item.productQuery.trim().length < 2) return base;
  try {
    const requestedFormat = detectRequestedFormat(item.productQuery);

    // Si se pidió un envase, buscamos sólo por el nombre del producto (sin la palabra
    // de formato) para traer todas las variantes; luego elegimos la del envase pedido.
    let searchQuery = item.productQuery;
    if (requestedFormat) {
      const nameOnly = stripFormatTokens(item.productQuery);
      if (nameOnly.length >= 2) searchQuery = nameOnly;
    }

    const result = await storage.getPriceList({ search: searchQuery, limit: 12, offset: 0 });
    let list = result?.items || [];

    // Fallback difuso: si la búsqueda exacta no encuentra nada, tolera errores
    // de tipeo / voz (ej: "stein" -> "stain") buscando por similitud.
    if (list.length === 0) {
      list = await storage.getPriceListFuzzy(searchQuery, 12);
    }

    // getPriceList ordena siempre el formato 1/4 primero, así que el envase pedido
    // por el vendedor (galón, balde/tonel, etc.) se pierde. Priorizamos la variante
    // cuyo `unidad` coincide con el envase solicitado.
    if (requestedFormat && list.length > 1) {
      const matchIdx = list.findIndex(
        (p: any) => normalizeFormat(p?.unidad) === requestedFormat,
      );
      if (matchIdx > 0) {
        const [matched] = list.splice(matchIdx, 1);
        list = [matched, ...list];
      }
    }

    return { ...base, product: list[0] || null, alternatives: list.slice(0, 8) };
  } catch (error) {
    console.error("[voice-order] resolveItem error:", error);
    return base;
  }
}

/**
 * Punto de entrada: interpreta el texto y resuelve cliente + productos.
 */
export async function parseAndResolveOrder(
  text: string,
  currentIntent?: ParsedOrderIntent | null,
): Promise<ParsedOrderResult> {
  const intent = await extractIntent(text, currentIntent);

  const [client, items] = await Promise.all([
    resolveClient(intent.clientQuery),
    Promise.all(intent.items.map((it) => resolveItem(it))),
  ]);

  return { intent, client, items, notes: intent.notes };
}
