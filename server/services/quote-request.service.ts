/**
 * QuoteRequestService — Handles B2C public quotation requests
 * Creates, lists, and manages quote requests from public visitors.
 */

import { db } from '../db';
import { quoteRequests, type InsertQuoteRequestInput } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

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
