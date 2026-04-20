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
        message TEXT,
        items JSONB NOT NULL,
        item_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR NOT NULL DEFAULT 'pending',
        assigned_to_user_id INTEGER,
        internal_notes TEXT,
        quote_number VARCHAR,
        subtotal NUMERIC(15, 2),
        tax_amount NUMERIC(15, 2),
        total_amount NUMERIC(15, 2),
        priced_at TIMESTAMP,
        priced_by_user_id INTEGER,
        valid_until_date TIMESTAMP,
        source VARCHAR DEFAULT 'b2c_cotizador',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const cols: Array<[string, string]> = [
      ['visitor_phone', 'VARCHAR'],
      ['visitor_company', 'VARCHAR'],
      ['visitor_city', 'VARCHAR'],
      ['visitor_rut', 'VARCHAR'],
      ['message', 'TEXT'],
      ['assigned_to_user_id', 'INTEGER'],
      ['internal_notes', 'TEXT'],
      ['quote_number', 'VARCHAR'],
      ['subtotal', 'NUMERIC(15, 2)'],
      ['tax_amount', 'NUMERIC(15, 2)'],
      ['total_amount', 'NUMERIC(15, 2)'],
      ['priced_at', 'TIMESTAMP'],
      ['priced_by_user_id', 'INTEGER'],
      ['valid_until_date', 'TIMESTAMP'],
    ];
    for (const [name, type] of cols) {
      await db.execute(
        sql.raw(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS ${name} ${type}`)
      );
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
 * Update quote request status
 */
export async function updateQuoteRequestStatus(id: string, status: string, internalNotes?: string) {
  const [updated] = await db.update(quoteRequests)
    .set({
      status,
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quoteRequests.id, id))
    .returning();

  return updated;
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
    userId?: number | null;
    internalNotes?: string;
    validDays?: number;
  } = {}
) {
  const current = await getQuoteRequestById(id);
  if (!current) return null;

  const currentItems: QuoteRequestItem[] = (current.items as QuoteRequestItem[]) || [];

  const keyOf = (sku: string, color?: string, format?: string) =>
    `${sku}__${color || ''}__${format || ''}`.toUpperCase();

  const priceMap = new Map<string, number>();
  for (const p of pricingItems) {
    priceMap.set(keyOf(p.sku, p.color, p.format), Number(p.unitPrice) || 0);
  }

  let subtotal = 0;
  const pricedItems: QuoteRequestItem[] = currentItems.map(item => {
    const unitPrice =
      priceMap.get(keyOf(item.sku, item.color, item.format)) ??
      priceMap.get(keyOf(item.sku)) ??
      item.unitPrice ??
      0;
    const lineTotal = Math.round(unitPrice * (item.quantity || 0));
    subtotal += lineTotal;
    return { ...item, unitPrice, lineTotal };
  });

  const taxAmount = Math.round(subtotal * TAX_RATE);
  const total = subtotal + taxAmount;

  const quoteNumber =
    current.quoteNumber ||
    `COT-B2C-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;

  const validDays = options.validDays ?? 7;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validDays);

  const [updated] = await db.update(quoteRequests)
    .set({
      items: pricedItems,
      quoteNumber,
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      totalAmount: String(total),
      pricedAt: new Date(),
      pricedByUserId: options.userId ?? null,
      validUntilDate: validUntil,
      status: 'quoted',
      ...(options.internalNotes !== undefined ? { internalNotes: options.internalNotes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quoteRequests.id, id))
    .returning();

  return updated;
}
