/**
 * QuoteRequestService — Handles B2C public quotation requests
 * Creates, lists, and manages quote requests from public visitors.
 */

import { db } from '../db';
import { quoteRequests, type InsertQuoteRequestInput, type QuoteRequestItem } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const TAX_RATE = 0.19;

let quoteRequestsTableChecked = false;

/**
 * Self-healing: ensure the quote_requests table + expected columns exist.
 * Runs once per process on the first insert, or after an insert fails with
 * "undefined_table" / "undefined_column" from Postgres.
 */
async function ensureQuoteRequestsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_name VARCHAR NOT NULL,
        visitor_email VARCHAR NOT NULL,
        visitor_phone VARCHAR,
        visitor_company VARCHAR,
        visitor_city VARCHAR,
        visitor_rut VARCHAR,
        segmento VARCHAR,
        message TEXT,
        items JSONB NOT NULL,
        item_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR NOT NULL DEFAULT 'pending',
        assigned_to_user_id VARCHAR,
        internal_notes TEXT,
        quote_number VARCHAR,
        subtotal NUMERIC(15, 2),
        tax_amount NUMERIC(15, 2),
        total_amount NUMERIC(15, 2),
        priced_at TIMESTAMP,
        priced_by_user_id VARCHAR,
        valid_until_date TIMESTAMP,
        source VARCHAR DEFAULT 'b2c_cotizador',
        crm_seguimiento_id VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const cols: Array<[string, string]> = [
      ['visitor_phone', 'VARCHAR'],
      ['visitor_company', 'VARCHAR'],
      ['visitor_city', 'VARCHAR'],
      ['visitor_rut', 'VARCHAR'],
      ['segmento', 'VARCHAR'],
      ['crm_seguimiento_id', 'VARCHAR'],
      ['message', 'TEXT'],
      ['assigned_to_user_id', 'VARCHAR'],
      ['internal_notes', 'TEXT'],
      ['quote_number', 'VARCHAR'],
      ['subtotal', 'NUMERIC(15, 2)'],
      ['tax_amount', 'NUMERIC(15, 2)'],
      ['total_amount', 'NUMERIC(15, 2)'],
      ['priced_at', 'TIMESTAMP'],
      ['priced_by_user_id', 'VARCHAR'],
      ['valid_until_date', 'TIMESTAMP'],
    ];
    for (const [name, type] of cols) {
      await db.execute(
        sql.raw(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS ${name} ${type}`)
      );
    }

    // Migrate legacy INTEGER user-id columns to VARCHAR so UUID user ids fit.
    for (const col of ['priced_by_user_id', 'assigned_to_user_id']) {
      try {
        await db.execute(
          sql.raw(
            `ALTER TABLE quote_requests ALTER COLUMN ${col} TYPE VARCHAR USING ${col}::varchar`
          )
        );
      } catch {
        /* already varchar or no rows to cast — ignore */
      }
    }

    quoteRequestsTableChecked = true;
  } catch (err: any) {
    console.error('[QuoteRequests] ensureQuoteRequestsTable failed:', err?.message || err);
  }
}

export interface PricingItemInput {
  sku: string;
  color?: string;
  format?: string;
  unitPrice: number;
  priceListCode?: string;
}

export interface ShippingItemInput {
  sku?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  format?: string;
}

/**
 * Create a new quote request from a public visitor
 */
export async function createQuoteRequest(data: InsertQuoteRequestInput) {
  if (!quoteRequestsTableChecked) {
    await ensureQuoteRequestsTable();
  }

  const values = {
    visitorName: data.visitorName,
    visitorEmail: data.visitorEmail,
    visitorPhone: data.visitorPhone || null,
    visitorCompany: data.visitorCompany || null,
    visitorCity: data.visitorCity || null,
    visitorRut: data.visitorRut || null,
    segmento: data.segmento || null,
    message: data.message || null,
    items: data.items,
    itemCount: data.items.length,
    status: 'pending',
    source: 'b2c_cotizador',
  };

  let request;
  try {
    [request] = await db.insert(quoteRequests).values(values).returning();
  } catch (err: any) {
    const code = err?.code;
    // 42P01 = undefined_table, 42703 = undefined_column
    if (code === '42P01' || code === '42703') {
      console.warn(`[QuoteRequests] Schema mismatch (${code}), self-healing and retrying…`);
      quoteRequestsTableChecked = false;
      await ensureQuoteRequestsTable();
      [request] = await db.insert(quoteRequests).values(values).returning();
    } else {
      throw err;
    }
  }

  console.log(`[B2C] New quote request from ${data.visitorName} (${data.visitorEmail}) — ${data.items.length} products`);
  return request;
}

/**
 * Get all quote requests (for admin panel)
 */
export async function getQuoteRequests(options?: { status?: string; limit?: number }) {
  let query = db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt));

  const results = await query;

  let filtered = results;
  if (options?.status) {
    filtered = filtered.filter(r => r.status === options.status);
  }
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Update quote request status and/or internal notes.
 * Either `status` or `internalNotes` (or both) can be provided.
 */
export async function updateQuoteRequestStatus(
  id: string,
  status?: string,
  internalNotes?: string,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) patch.status = status;
  if (internalNotes !== undefined) patch.internalNotes = internalNotes;

  const [updated] = await db.update(quoteRequests)
    .set(patch)
    .where(eq(quoteRequests.id, id))
    .returning();

  return updated;
}

/**
 * Delete a quote request permanently.
 */
export async function deleteQuoteRequest(id: string) {
  const [deleted] = await db.delete(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .returning({ id: quoteRequests.id });
  return deleted || null;
}

/**
 * Get a single quote request by id
 */
export async function getQuoteRequestById(id: string) {
  const [row] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1);
  return row || null;
}

/**
 * Assign prices to a quote request, compute totals, generate quote number,
 * and mark the request as 'quoted'.
 */
export async function updateQuoteRequestPricing(
  id: string,
  pricingItems: PricingItemInput[],
  options: {
    userId?: string | null;
    internalNotes?: string;
    validDays?: number;
    shippingItems?: ShippingItemInput[];
  } = {}
) {
  const current = await getQuoteRequestById(id);
  if (!current) return null;

  const currentItems: QuoteRequestItem[] = (current.items as QuoteRequestItem[]) || [];

  const keyOf = (sku: string, color?: string, format?: string) =>
    `${sku}__${color || ''}__${format || ''}`.toUpperCase();

  const priceMap = new Map<string, number>();
  const listMap = new Map<string, string | undefined>();
  for (const p of pricingItems) {
    const k = keyOf(p.sku, p.color, p.format);
    priceMap.set(k, Number(p.unitPrice) || 0);
    listMap.set(k, p.priceListCode);
  }

  let subtotal = 0;
  const pricedItems: QuoteRequestItem[] = currentItems.map(item => {
    const k = keyOf(item.sku, item.color, item.format);
    const unitPrice =
      priceMap.get(k) ??
      priceMap.get(keyOf(item.sku)) ??
      item.unitPrice ??
      0;
    const lineTotal = Math.round(unitPrice * (item.quantity || 0));
    subtotal += lineTotal;
    return {
      ...item,
      unitPrice,
      lineTotal,
      priceListCode: listMap.get(k) ?? listMap.get(keyOf(item.sku)) ?? item.priceListCode,
    };
  });

  const shippingLines: QuoteRequestItem[] = (options.shippingItems || [])
    .filter(s => s && s.productName && Number(s.quantity) > 0 && Number(s.unitPrice) >= 0)
    .map(s => {
      const qty = Number(s.quantity) || 0;
      const unit = Number(s.unitPrice) || 0;
      const line = Math.round(qty * unit);
      subtotal += line;
      return {
        sku: (s.sku || 'DESPACHO').toString(),
        productName: s.productName,
        quantity: qty,
        format: s.format || 'UN',
        itemType: 'shipping' as const,
        unitPrice: unit,
        lineTotal: line,
      };
    });

  const mergedItems = [...pricedItems, ...shippingLines];

  const taxAmount = Math.round(subtotal * TAX_RATE);
  const total = subtotal + taxAmount;

  const quoteNumber =
    current.quoteNumber ||
    `COT-B2C-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;

  const validDays = options.validDays ?? 7;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validDays);

  if (!quoteRequestsTableChecked) {
    await ensureQuoteRequestsTable();
  }

  const updateValues = {
    items: mergedItems,
    quoteNumber,
    subtotal: String(subtotal),
    taxAmount: String(taxAmount),
    totalAmount: String(total),
    pricedAt: new Date(),
    pricedByUserId: options.userId ?? null,
    validUntilDate: validUntil,
    status: 'quoted' as const,
    ...(options.internalNotes !== undefined ? { internalNotes: options.internalNotes } : {}),
    updatedAt: new Date(),
  };

  const runUpdate = () =>
    db.update(quoteRequests).set(updateValues).where(eq(quoteRequests.id, id)).returning();

  let updated;
  try {
    [updated] = await runUpdate();
  } catch (err: any) {
    const code = err?.code;
    // 42P01 undefined_table, 42703 undefined_column, 22P02 invalid_text_representation
    // (UUID → INTEGER cast fails when legacy priced_by_user_id column still has INTEGER type)
    if (code === '42P01' || code === '42703' || code === '22P02') {
      console.warn(`[QuoteRequests] Schema/type mismatch on pricing update (${code}), self-healing and retrying…`);
      quoteRequestsTableChecked = false;
      await ensureQuoteRequestsTable();
      [updated] = await runUpdate();
    } else {
      throw err;
    }
  }

  return updated;
}
