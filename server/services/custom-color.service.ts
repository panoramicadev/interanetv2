/**
 * CustomColorService — Colores personalizados ya cotizados.
 *
 * Cuando el equipo comercial le asigna precio a un ítem `itemType: 'custom_color'`
 * de una cotización web, acá se materializa como variante privada del producto:
 * queda comprable por el cliente vía el enlace del correo (token) o desde su
 * cuenta, sin aparecer nunca en el catálogo público.
 *
 * Deliberadamente NO escribe en `price_list` ni en `ecommerce_products`: esas dos
 * tablas alimentan el catálogo público, los informes de margen y la integración
 * con el ERP. Un SKU sintético por cada color cotizado las ensuciaría y el precio
 * negociado quedaría expuesto a cualquier visitante.
 */

import { randomBytes } from 'crypto';
import { db } from '../db';
import { customColorVariants, users, type CustomColorVariantPublic, type QuoteRequestItem } from '@shared/schema';
import { and, eq, sql } from 'drizzle-orm';

let tableChecked = false;

/**
 * Self-healing: garantiza la tabla antes de escribir, igual que hace
 * quote-request.service con quote_requests. El runner de .sql corre después del
 * bootstrap y este servicio se llama desde una ruta que puede pegar antes.
 */
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS custom_color_variants (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_request_id VARCHAR,
        quote_number VARCHAR(60),
        token VARCHAR(64) NOT NULL UNIQUE,
        client_email VARCHAR(160) NOT NULL,
        client_name VARCHAR(200),
        client_user_id VARCHAR,
        base_sku VARCHAR(60),
        base_product_name TEXT NOT NULL,
        generic_name TEXT,
        format_unit VARCHAR(60),
        image_url TEXT,
        color_code VARCHAR(120) NOT NULL,
        color_brand VARCHAR(120),
        color_hex VARCHAR(9),
        color_notes TEXT,
        color_label VARCHAR(240) NOT NULL,
        unit_price NUMERIC(15, 2) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        min_unit INTEGER NOT NULL DEFAULT 1,
        step_size INTEGER NOT NULL DEFAULT 1,
        estado VARCHAR(20) NOT NULL DEFAULT 'active',
        claimed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_custom_color_variants_email" ON custom_color_variants (client_email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_custom_color_variants_quote" ON custom_color_variants (quote_request_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_custom_color_variants_estado" ON custom_color_variants (estado)`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_custom_color_variants_quote_item"
        ON custom_color_variants (quote_request_id, base_sku, color_code, format_unit)
    `);
    tableChecked = true;
  } catch (err) {
    console.error('[CustomColor] No se pudo asegurar la tabla:', err);
  }
}

/** Token URL-safe para el enlace del correo. 32 hex = 128 bits, no adivinable. */
function generateToken(): string {
  return randomBytes(16).toString('hex');
}

/** "SW 7008 · Sherwin Williams" — lo que el cliente ve como color de la línea. */
export function buildColorLabel(code: string, brand?: string | null): string {
  const clean = (code || '').trim();
  const b = (brand || '').trim();
  return b ? `${clean} · ${b}` : clean;
}

function toPublic(row: any): CustomColorVariantPublic {
  return {
    token: row.token,
    baseSku: row.baseSku ?? row.base_sku ?? null,
    baseProductName: row.baseProductName ?? row.base_product_name,
    formatUnit: row.formatUnit ?? row.format_unit ?? null,
    imageUrl: row.imageUrl ?? row.image_url ?? null,
    colorCode: row.colorCode ?? row.color_code,
    colorBrand: row.colorBrand ?? row.color_brand ?? null,
    colorHex: row.colorHex ?? row.color_hex ?? null,
    colorNotes: row.colorNotes ?? row.color_notes ?? null,
    colorLabel: row.colorLabel ?? row.color_label,
    unitPrice: Number(row.unitPrice ?? row.unit_price) || 0,
    quantity: Number(row.quantity) || 1,
    minUnit: Number(row.minUnit ?? row.min_unit) || 1,
    stepSize: Number(row.stepSize ?? row.step_size) || 1,
    quoteNumber: row.quoteNumber ?? row.quote_number ?? null,
    estado: row.estado || 'active',
  };
}

export interface CreateVariantInput {
  quoteRequestId: string;
  quoteNumber?: string | null;
  clientEmail: string;
  clientName?: string | null;
  item: QuoteRequestItem;
}

/**
 * Crea (o actualiza, si ya se había cotizado antes) la variante de un ítem de
 * color personalizado que acaba de recibir precio.
 *
 * Reasignar precio a la misma cotización pisa la fila y CONSERVA el token, para
 * que un enlace ya enviado por correo siga funcionando con el precio nuevo.
 * Devuelve null si el ítem no es un color personalizado o no tiene precio.
 */
export async function upsertCustomColorVariant(input: CreateVariantInput) {
  const { item } = input;
  if (item.itemType !== 'custom_color') return null;

  const unitPrice = Number(item.unitPrice) || 0;
  if (unitPrice <= 0) return null;

  const colorCode = (item.customColorCode || '').trim();
  if (!colorCode) return null;

  if (!tableChecked) await ensureTable();

  const baseSku = item.sku || null;
  const formatUnit = item.format || null;

  // Si el email calza con una cuenta, la variante queda enganchada a ella y
  // aparece sola al iniciar sesión, sin depender del enlace.
  let clientUserId: string | null = null;
  try {
    const [account] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.clientEmail.toLowerCase().trim()))
      .limit(1);
    clientUserId = account?.id ? String(account.id) : null;
  } catch {
    /* sin cuenta asociada, se compra por token */
  }

  const [existing] = await db
    .select()
    .from(customColorVariants)
    .where(
      and(
        eq(customColorVariants.quoteRequestId, input.quoteRequestId),
        eq(customColorVariants.colorCode, colorCode),
      ),
    )
    .limit(1);

  const values = {
    quoteRequestId: input.quoteRequestId,
    quoteNumber: input.quoteNumber ?? null,
    clientEmail: input.clientEmail.toLowerCase().trim(),
    clientName: input.clientName ?? null,
    clientUserId,
    baseSku,
    baseProductName: item.productName || 'Producto',
    genericName: item.productName || null,
    formatUnit,
    imageUrl: item.imageUrl || null,
    colorCode,
    colorBrand: item.customColorBrand || null,
    colorHex: item.customColorHex || null,
    colorNotes: item.customColorNotes || null,
    colorLabel: buildColorLabel(colorCode, item.customColorBrand),
    unitPrice: String(Math.round(unitPrice)),
    quantity: Math.max(1, Number(item.quantity) || 1),
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(customColorVariants)
      .set(values)
      .where(eq(customColorVariants.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(customColorVariants)
    .values({ ...values, token: generateToken(), estado: 'active' })
    .returning();
  return created;
}

/**
 * Busca la variante del enlace mágico y la marca como reclamada la primera vez.
 * Devuelve null si el token no existe o la variante fue dada de baja.
 */
export async function getVariantByToken(token: string): Promise<CustomColorVariantPublic | null> {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return null;
  if (!tableChecked) await ensureTable();

  const [row] = await db
    .select()
    .from(customColorVariants)
    .where(eq(customColorVariants.token, token))
    .limit(1);

  if (!row || row.estado === 'disabled') return null;

  if (!row.claimedAt) {
    await db
      .update(customColorVariants)
      .set({ claimedAt: new Date() })
      .where(eq(customColorVariants.id, row.id));
  }

  return toPublic(row);
}

/**
 * Colores personalizados activos de un cliente, para que la tienda los deje
 * cargados en el carrito apenas inicia sesión, sin tener que abrir el correo.
 */
export async function getVariantsForClient(opts: {
  email?: string | null;
  userId?: string | null;
}): Promise<CustomColorVariantPublic[]> {
  const email = opts.email?.toLowerCase().trim();
  const userId = opts.userId ? String(opts.userId) : null;
  if (!email && !userId) return [];

  if (!tableChecked) await ensureTable();

  const rows = await db
    .select()
    .from(customColorVariants)
    .where(
      and(
        eq(customColorVariants.estado, 'active'),
        email
          ? eq(customColorVariants.clientEmail, email)
          : eq(customColorVariants.clientUserId, userId!),
      ),
    );

  return rows.map(toPublic);
}
