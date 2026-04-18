/**
 * QuoteRequestService — Handles B2C public quotation requests
 * Creates, lists, and manages quote requests from public visitors.
 */

import { db } from '../db';
import { quoteRequests, type InsertQuoteRequestInput, type QuoteRequestItem } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const TAX_RATE = 0.19;

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
  const [request] = await db.insert(quoteRequests).values({
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
  }).returning();

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
