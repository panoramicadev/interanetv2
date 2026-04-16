/**
 * CatalogService — Shared catalog logic for B2B and B2C
 * Extracts the core buildStoreCatalog logic so both systems can consume it.
 * B2C calls getPublicCatalog() which strips all price data.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ── Cache ──
let _publicCatalogCache: { catalog: any[]; totalProducts: number; builtAt: number } | null = null;
const PUBLIC_CACHE_TTL = 120_000; // 2 minutes

export function invalidatePublicCatalogCache() {
  _publicCatalogCache = null;
}

/**
 * Build a public catalog with NO price information.
 * Reuses the same DB tables as the B2B store but strips all sensitive fields.
 */
export async function getPublicCatalog(options?: { search?: string; category?: string }) {
  // Check cache
  if (_publicCatalogCache && Date.now() - _publicCatalogCache.builtAt < PUBLIC_CACHE_TTL) {
    return applyFilters(_publicCatalogCache, options);
  }

  const result = await db.execute(sql`
    SELECT
      ep.id as ecom_id,
      ep.categoria as group_name,
      ep.descripcion as description,
      ep.variant_generic_display_name,
      ep.color,
      ep.format_unit,
      ep.min_unit,
      ep.step_size,
      ep.tags,
      ep.imagen_url,
      pl.codigo as sku,
      pl.producto as product_name,
      pl.unidad as unit,
      COALESCE(stk.total_stock, 0) as total_stock,
      pc.breve_resena,
      pc.descripcion as content_descripcion,
      pc.usos,
      pc.presentacion,
      pc.imagen_destacada
    FROM ecommerce_products ep
    LEFT JOIN price_list pl ON ep.price_list_id = pl.id
    LEFT JOIN (
      SELECT kopr, SUM(COALESCE(physical_stock2, 0)) as total_stock
      FROM product_stock
      GROUP BY kopr
    ) stk ON stk.kopr = pl.codigo
    LEFT JOIN product_content pc ON pc.codigo = pl.codigo
    WHERE ep.activo = true
    ORDER BY ep.variant_generic_display_name, ep.color, ep.format_unit
  `);
  const rows = Array.isArray(result) ? result : (result as any).rows || [];

  // Load multi-category assignments
  let multiCatAssignments: Record<string, string[]> = {};
  try {
    const mcResult = await db.execute(sql`
      SELECT value FROM app_config WHERE key = 'product_category_assignments'
    `);
    const mcRow = (mcResult as any).rows?.[0];
    multiCatAssignments = mcRow?.value || {};
  } catch {}

  // Group products by genericName (same as B2B logic)
  const productsMap = new Map<string, {
    genericName: string;
    groupName: string | null;
    categories: string[];
    tags: string[];
    breveResena: string | null;
    descripcion: string | null;
    usos: string | null;
    presentacion: string | null;
    imageUrl: string | null;
    imageUrlPriority: number;
    colors: Map<string, any[]>;
  }>();

  for (const row of rows as any[]) {
    const groupName = row.group_name || null;
    const genericName = (row.variant_generic_display_name || row.product_name || 'Sin Nombre').trim();
    const color = (row.color || 'Sin Color').trim();
    const formatUnit = row.format_unit || row.unit || 'Sin formato';
    const sku = row.sku || '';
    let rowTags: string[] = [];
    try { rowTags = JSON.parse(row.tags || '[]'); } catch { rowTags = []; }

    const assignedCategories = multiCatAssignments[genericName] || (groupName ? [groupName] : []);

    if (!productsMap.has(genericName)) {
      productsMap.set(genericName, {
        genericName,
        groupName: assignedCategories[0] || groupName,
        categories: assignedCategories,
        tags: rowTags,
        breveResena: row.breve_resena || null,
        descripcion: row.content_descripcion || null,
        usos: row.usos || null,
        presentacion: row.presentacion || null,
        imageUrl: null,
        imageUrlPriority: 0,
        colors: new Map(),
      });
    }
    const product = productsMap.get(genericName)!;
    if (rowTags.length > 0 && product.tags.length === 0) product.tags = rowTags;
    if (!product.breveResena && row.breve_resena) product.breveResena = row.breve_resena;
    if (!product.descripcion && row.content_descripcion) product.descripcion = row.content_descripcion;
    if (!product.usos && row.usos) product.usos = row.usos;
    if (!product.presentacion && row.presentacion) product.presentacion = row.presentacion;

    // Image priority logic (same as B2B — prefer GALON + BLANCO)
    const rowImageUrl = row.imagen_url || row.imagen_destacada || null;
    if (rowImageUrl) {
      let priority = 1;
      const colorUpper = color.toUpperCase();
      const formatUpper = formatUnit.toUpperCase();
      if (colorUpper.includes('BLANCO') || colorUpper === 'BLANCO') priority += 10;
      const is14 = formatUpper.includes('1/4') || formatUpper.includes('CUARTO');
      const isGalon = !is14 && (formatUpper.includes('GALON') || formatUpper.includes('GALÓN') || /\bGL\b/.test(formatUpper));
      const isBalde = formatUpper.includes('BALDE') || formatUpper.includes('BLD') || formatUpper.includes('BD4') || formatUpper.includes('BD5');
      if (isGalon) priority += 20;
      else if (isBalde) priority += 10;
      else if (is14) priority -= 5;
      if (priority > product.imageUrlPriority) {
        product.imageUrl = rowImageUrl;
        product.imageUrlPriority = priority;
      }
    }

    if (!product.colors.has(color)) {
      product.colors.set(color, []);
    }

    // B2C variant: NO price, NO offerPrice, NO originalPrice
    product.colors.get(color)!.push({
      ecomId: row.ecom_id,
      sku,
      name: row.product_name || genericName,
      color,
      format: formatUnit,
      groupName,
      // Stock as simple availability indicator
      available: parseFloat(row.total_stock) > 0,
      minUnit: row.min_unit || 1,
      stepSize: row.step_size || 1,
      description: row.description,
      imageUrl: row.imagen_url || null,
    });
  }

  let catalog = Array.from(productsMap.values()).map(p => ({
    genericName: p.genericName,
    groupName: p.groupName,
    categories: p.categories,
    tags: p.tags,
    breveResena: p.breveResena,
    descripcion: p.descripcion,
    usos: p.usos,
    presentacion: p.presentacion,
    imageUrl: p.imageUrl,
    colors: Object.fromEntries(p.colors),
    _searchText: [
      p.genericName,
      p.groupName || '',
      p.tags?.join(' ') || '',
      p.breveResena || '',
      p.descripcion || '',
      p.usos || '',
      ...(Array.from(p.colors.values()).flat().map((v: any) =>
        `${v.sku} ${v.name || ''} ${v.color} ${v.format} ${v.description || ''}`
      )),
    ].join(' ').toLowerCase(),
  }));

  // Apply custom display order
  try {
    const orderResult = await db.execute(sql`
      SELECT value FROM app_config WHERE key = 'ecommerce_product_order'
    `);
    const orderRow = (orderResult as any).rows?.[0];
    const productOrder: string[] = orderRow?.value || [];
    if (productOrder.length > 0) {
      const orderMap = new Map<string, number>();
      productOrder.forEach((name, idx) => orderMap.set(name, idx));
      catalog.sort((a, b) => {
        const orderA = orderMap.has(a.genericName) ? orderMap.get(a.genericName)! : Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.has(b.genericName) ? orderMap.get(b.genericName)! : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.genericName.localeCompare(b.genericName);
      });
    }
  } catch {}

  // Apply manual image overrides
  try {
    const imgResult = await db.execute(sql`
      SELECT value FROM app_config WHERE key = 'ecommerce_product_group_images'
    `);
    const imgRow = (imgResult as any).rows?.[0];
    const manualImages: Record<string, string> = imgRow?.value || {};
    if (Object.keys(manualImages).length > 0) {
      catalog.forEach(p => {
        if (manualImages[p.genericName]) {
          p.imageUrl = manualImages[p.genericName];
        }
      });
    }
  } catch {}

  const cacheEntry = { catalog, totalProducts: (rows as any[]).length, builtAt: Date.now() };
  _publicCatalogCache = cacheEntry;
  console.log(`[B2C CATALOG] Built public catalog: ${catalog.length} groups, ${(rows as any[]).length} products`);

  return applyFilters(cacheEntry, options);
}

function applyFilters(
  data: { catalog: any[]; totalProducts: number },
  options?: { search?: string; category?: string }
) {
  let filtered = data.catalog;

  if (options?.category && options.category !== 'all') {
    filtered = filtered.filter((p: any) => {
      const cats: string[] = p.categories || (p.groupName ? [p.groupName] : []);
      return cats.includes(options.category!);
    });
  }

  if (options?.search) {
    const s = options.search.toLowerCase().trim();
    filtered = filtered.filter((p: any) => p._searchText.includes(s));
  }

  // Strip _searchText before sending to client
  const cleanCatalog = filtered.map(({ _searchText, ...rest }: any) => rest);

  return { catalog: cleanCatalog, totalProducts: data.totalProducts };
}

/**
 * Get unique categories from the public catalog
 */
export async function getPublicCategories(): Promise<string[]> {
  const { catalog } = await getPublicCatalog();
  const categories = new Set<string>();
  catalog.forEach((p: any) => {
    const cats: string[] = p.categories || (p.groupName ? [p.groupName] : []);
    cats.forEach(c => categories.add(c));
  });
  return Array.from(categories).sort();
}
