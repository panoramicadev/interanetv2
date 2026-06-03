/**
 * Orden de Compra (Purchase Order) PDF parser.
 *
 * Extracts header metadata (OC number, RUT, fecha, observaciones) plus line-items
 * (SKU + quantity) from a Chilean B2B purchase-order PDF, then resolves SKUs
 * against the ecommerce_products catalog to produce cart-ready items.
 *
 * Layout is heuristic: PDFs from different ERPs ship wildly different formats,
 * so we lean on regex over the linear text dump rather than try table reconstruction.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export interface ParsedOcItem {
  sku: string;
  quantity: number;
  rawLine?: string;
}

export interface ParsedOcMetadata {
  ocNumber: string | null;
  rut: string | null;
  razonSocial: string | null;
  email: string | null;
  fecha: string | null;
  direccion: string | null;
  observaciones: string | null;
  total: string | null;
  rawTextPreview: string;
}

export interface MatchedOcItem {
  sku: string;
  productName: string;
  color: string;
  format: string;
  price: number;
  minUnit: number;
  stepSize: number;
  imageUrl: string | null;
  genericName: string;
  requestedQuantity: number;
  validQuantity: number;
  adjusted: boolean;
}

export interface OcParseResult {
  metadata: ParsedOcMetadata;
  matched: MatchedOcItem[];
  unmatched: ParsedOcItem[];
  textLength: number;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const mod: any = await import('pdf-parse');
  const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
  if (!PDFParse) throw new Error('pdf-parse: PDFParse class no disponible');

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    if (typeof result?.text === 'string') return result.text;
    if (Array.isArray(result?.pages)) {
      return result.pages
        .map((p: any) => p?.text ?? '')
        .join('\n');
    }
    return '';
  } finally {
    try { await parser.destroy?.(); } catch { /* ignore */ }
  }
}

// SKU pattern matches structured codes like EP-001-BL-GL, PCA-960-COPP-BL1, etc.
const STRUCTURED_SKU = /\b([A-Z]{1,5}-\d{1,5}(?:-[A-Z0-9]{1,6}){1,4})\b/g;

// Fallback alnum pattern (e.g. PCA960COPPBL1). Only used when no structured SKU is found.
const FLAT_SKU = /\b([A-Z]{2,5}\d{2,6}[A-Z0-9]{2,8})\b/g;

export function extractMetadata(text: string): ParsedOcMetadata {
  const oneLine = text.replace(/\s+/g, ' ');

  const ocMatch =
    text.match(/orden\s+de\s+compra\s*(?:n[°ºo]?)?\s*[:#\-]?\s*([A-Z0-9\-\/]{2,20})/i) ||
    text.match(/\b(?:O\.?\s*C\.?|N[°ºo]?\s*OC)\s*[:#\-]?\s*([A-Z0-9\-\/]{2,20})/i);

  const rutMatch = text.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[0-9kK])\b/);
  const emailMatch = text.match(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  const dateMatch =
    text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/) ||
    text.match(/\b(\d{4}-\d{2}-\d{2})\b/);

  const rsMatch =
    text.match(/(?:raz[oó]n\s+social|cliente|empresa|adquiriente)\s*[:\-]?\s*([^\n\r]{3,200})/i);

  const dirMatch =
    text.match(/(?:direcci[oó]n|domicilio|despachar\s+a)\s*[:\-]?\s*([^\n\r]{3,200})/i);

  const obsMatch =
    text.match(/(?:observaciones|notas|comentarios|glosa)\s*[:\-]?\s*([^\n\r]{3,500})/i);

  const totalMatch =
    text.match(/\bTOTAL\b[^\n\r]{0,30}?\$\s*([\d.,]+)/i) ||
    text.match(/\bMonto\s+total\b[^\n\r]{0,30}?\$\s*([\d.,]+)/i);

  return {
    ocNumber: ocMatch ? ocMatch[1].trim() : null,
    rut: rutMatch ? rutMatch[1].trim() : null,
    email: emailMatch ? emailMatch[1].trim() : null,
    fecha: dateMatch ? dateMatch[1].trim() : null,
    razonSocial: rsMatch ? rsMatch[1].trim().replace(/\s+/g, ' ').slice(0, 200) : null,
    direccion: dirMatch ? dirMatch[1].trim().replace(/\s+/g, ' ').slice(0, 200) : null,
    observaciones: obsMatch ? obsMatch[1].trim().replace(/\s+/g, ' ').slice(0, 500) : null,
    total: totalMatch ? totalMatch[1].trim() : null,
    rawTextPreview: oneLine.slice(0, 1500),
  };
}

function detectQuantityForLine(line: string): number {
  // Try labelled quantity first ("Cantidad: 5", "Cant 10").
  const labelled = line.match(/\bcant(?:idad)?\s*[:.\-]?\s*(\d+(?:[.,]\d+)?)/i);
  if (labelled) return parseFloat(labelled[1].replace(',', '.'));

  // Quantity followed by common Spanish-Chilean unit tokens
  const unit = line.match(/\b(\d+(?:[.,]\d+)?)\s*(?:UN|UND|UNID|UNIDS?|GL|GAL|LTR?S?|PCS?|PZAS?|TAMBOR(?:ES)?|CAJAS?|BIDONES?)\b/i);
  if (unit) return parseFloat(unit[1].replace(',', '.'));

  // Leading integer (typical for "8 EP-001-BL-GL Esmalte ...")
  const leading = line.match(/^\s*(\d+(?:[.,]\d+)?)\b/);
  if (leading) {
    const n = parseFloat(leading[1].replace(',', '.'));
    if (n > 0 && n < 100000) return n;
  }

  return 1;
}

export function extractItemCandidates(text: string): ParsedOcItem[] {
  const lines = text.split(/\r?\n+/);
  const candidates = new Map<string, ParsedOcItem>();
  let foundStructured = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    STRUCTURED_SKU.lastIndex = 0;
    const skuMatches = [...line.matchAll(STRUCTURED_SKU)];
    if (skuMatches.length === 0) continue;
    foundStructured = true;

    const qty = detectQuantityForLine(line);

    for (const m of skuMatches) {
      const sku = m[1].toUpperCase();
      const existing = candidates.get(sku);
      if (existing) {
        existing.quantity += qty > 0 ? qty : 1;
      } else {
        candidates.set(sku, {
          sku,
          quantity: qty > 0 ? qty : 1,
          rawLine: line.slice(0, 200),
        });
      }
    }
  }

  // Fallback: try a flatter pattern if nothing structured was found.
  if (!foundStructured) {
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      FLAT_SKU.lastIndex = 0;
      const flat = [...line.matchAll(FLAT_SKU)];
      if (flat.length === 0) continue;
      const qty = detectQuantityForLine(line);
      for (const m of flat) {
        const sku = m[1].toUpperCase();
        if (candidates.has(sku)) continue;
        candidates.set(sku, { sku, quantity: qty > 0 ? qty : 1, rawLine: line.slice(0, 200) });
      }
    }
  }

  return Array.from(candidates.values());
}

export async function matchSkusToCatalog(items: ParsedOcItem[]): Promise<{ matched: MatchedOcItem[]; unmatched: ParsedOcItem[] }> {
  if (items.length === 0) return { matched: [], unmatched: [] };

  const skus = items.map(it => it.sku);
  const rows = await db.execute(sql`
    SELECT
      pl.codigo AS sku,
      pl.producto AS product_name,
      ep.color,
      ep.format_unit AS format,
      COALESCE(ep.precio_ecommerce, 0) AS price,
      COALESCE(ep.min_unit, 1) AS min_unit,
      COALESCE(ep.step_size, 1) AS step_size,
      ep.imagen_url AS image_url,
      COALESCE(ep.variant_generic_display_name, pl.producto) AS generic_name
    FROM ecommerce_products ep
    INNER JOIN price_list pl ON pl.id = ep.price_list_id
    WHERE UPPER(pl.codigo) = ANY(${skus}::text[])
      AND COALESCE(ep.activo, true) = true
  `);

  const catalog = new Map<string, any>();
  for (const r of (rows as any).rows || []) {
    catalog.set(String(r.sku).toUpperCase(), r);
  }

  const matched: MatchedOcItem[] = [];
  const unmatched: ParsedOcItem[] = [];

  for (const item of items) {
    const c = catalog.get(item.sku);
    if (!c) {
      unmatched.push(item);
      continue;
    }
    const minUnit = Number(c.min_unit) || 1;
    const stepSize = Number(c.step_size) || 1;
    const requested = Math.max(1, Math.round(item.quantity));

    let validQty = Math.max(requested, minUnit);
    const rem = (validQty - minUnit) % stepSize;
    if (rem !== 0) validQty += stepSize - rem;

    matched.push({
      sku: String(c.sku),
      productName: String(c.product_name || ''),
      color: String(c.color || ''),
      format: String(c.format || ''),
      price: Number(c.price) || 0,
      minUnit,
      stepSize,
      imageUrl: c.image_url ? String(c.image_url) : null,
      genericName: String(c.generic_name || c.product_name || ''),
      requestedQuantity: requested,
      validQuantity: validQty,
      adjusted: validQty !== requested,
    });
  }

  return { matched, unmatched };
}

export async function parseOrdenDeCompra(buffer: Buffer): Promise<OcParseResult> {
  const text = await extractTextFromPdf(buffer);
  const metadata = extractMetadata(text);
  const candidates = extractItemCandidates(text);
  const { matched, unmatched } = await matchSkusToCatalog(candidates);
  return { metadata, matched, unmatched, textLength: text.length };
}
