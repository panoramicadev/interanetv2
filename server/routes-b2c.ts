/**
 * B2C Public Routes — Cotizador Público
 * 
 * All routes under /api/b2c/* are PUBLIC (no authentication required).
 * These endpoints NEVER return price, credit, or sensitive commercial data.
 */

import type { Express } from 'express';
import { getPublicCatalog, getPublicCategories } from './services/catalog.service';
import {
  createQuoteRequest,
  getQuoteRequests,
  updateQuoteRequestStatus,
  updateQuoteRequestPricing,
  getQuoteRequestById,
  deleteQuoteRequest,
} from './services/quote-request.service';
import { renderQuoteRequestPdfHtml } from './services/quote-request-pdf';
import { insertQuoteRequestSchema, storeBanners, storeConfig, type QuoteRequestItem } from '@shared/schema';
import { db } from './db';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireAdminOrSupervisor, requireRoles } from './auth';

const requireAdminSupervisorOrReception = requireRoles(['admin', 'supervisor', 'encargado_area', 'reception']);

export function registerB2CRoutes(app: Express) {
  // ═══════════════════════════════════════════════
  // PUBLIC B2C CATALOG (no auth required)
  // ═══════════════════════════════════════════════

  /**
   * GET /api/b2c/catalog — Public catalog without prices
   * Query params: search, category
   */
  app.get('/api/b2c/catalog', async (req: any, res: any) => {
    try {
      const { search, category } = req.query;
      const result = await getPublicCatalog({
        search: search as string | undefined,
        category: category as string | undefined,
      });

      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.json(result);
    } catch (error) {
      console.error('[B2C] Error fetching public catalog:', error);
      res.status(500).json({ message: 'Error al cargar catálogo' });
    }
  });

  /**
   * GET /api/b2c/catalog/categories — Available categories
   */
  app.get('/api/b2c/catalog/categories', async (req: any, res: any) => {
    try {
      const categories = await getPublicCategories();
      res.set('Cache-Control', 'public, max-age=120');
      res.json({ categories });
    } catch (error) {
      console.error('[B2C] Error fetching categories:', error);
      res.status(500).json({ message: 'Error al cargar categorías' });
    }
  });

  /**
   * GET /api/b2c/config — Public store configuration (logo, colors, contact)
   */
  app.get('/api/b2c/config', async (req: any, res: any) => {
    try {
      const [config] = await db.select().from(storeConfig).limit(1);
      if (!config) {
        return res.json({
          siteName: 'Pinturas Panorámica',
          primaryColor: '#FF6B35',
          secondaryColor: '#2C3E50',
          contactInfo: {},
        });
      }
      // Only expose safe public fields
      res.json({
        siteName: config.siteName,
        logoUrl: config.logoUrl,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        contactInfo: config.contactInfo,
        socialMedia: config.socialMedia,
      });
    } catch (error) {
      console.error('[B2C] Error fetching config:', error);
      res.status(500).json({ message: 'Error al cargar configuración' });
    }
  });

  /**
   * GET /api/b2c/banners — Active public banners
   */
  app.get('/api/b2c/banners', async (req: any, res: any) => {
    try {
      const banners = await db.select().from(storeBanners)
        .where(eq(storeBanners.activo, true))
        .orderBy(storeBanners.orden);

      res.set('Cache-Control', 'public, max-age=120');
      res.json({ banners });
    } catch (error) {
      console.error('[B2C] Error fetching banners:', error);
      res.status(500).json({ message: 'Error al cargar banners' });
    }
  });

  // ═══════════════════════════════════════════════
  // QUOTE REQUESTS (public submission, admin management)
  // ═══════════════════════════════════════════════

  /**
   * POST /api/b2c/quote-request — Submit a quotation request (public)
   */
  app.post('/api/b2c/quote-request', async (req: any, res: any) => {
    try {
      const validationResult = insertQuoteRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: 'Datos de cotización inválidos',
          errors: validationResult.error.errors,
        });
      }

      // ▼ Validar cantidades respetan min_unit / step_size del producto (galón = 4, ¼ galón = 6, etc.)
      const items = validationResult.data.items || [];
      const skuList = items.map((i: any) => i.sku).filter(Boolean);
      if (skuList.length > 0) {
        const skuRows = await db.execute(sql`
          SELECT pl.codigo AS sku, ep.min_unit, ep.step_size, ep.format_unit, ep.color, pl.producto AS product_name
          FROM ecommerce_products ep
          INNER JOIN price_list pl ON pl.id = ep.price_list_id
          WHERE pl.codigo IN (${sql.join(skuList.map((s: string) => sql`${s}`), sql`, `)})
        `);
        const rules = new Map<string, { minUnit: number; stepSize: number; format: string; color: string; name: string }>();
        for (const r of (skuRows as any).rows || []) {
          rules.set(r.sku, {
            minUnit: Number(r.min_unit) || 1,
            stepSize: Number(r.step_size) || 1,
            format: r.format_unit || '',
            color: r.color || '',
            name: r.product_name || '',
          });
        }
        const offenders: any[] = [];
        for (const item of items as any[]) {
          const rule = rules.get(item.sku);
          if (!rule) continue;
          const q = Number(item.quantity);
          if (q < rule.minUnit || (q - rule.minUnit) % rule.stepSize !== 0) {
            offenders.push({
              productName: `${rule.name}${rule.color ? ' ' + rule.color : ''} (${rule.format})`,
              quantity: q, minUnit: rule.minUnit, stepSize: rule.stepSize, format: rule.format,
            });
          }
        }
        if (offenders.length > 0) {
          return res.status(400).json({
            code: 'INVALID_QUANTITY',
            message: 'Las cantidades deben respetar el formato de venta del producto.',
            offenders,
          });
        }
      }

      const request = await createQuoteRequest(validationResult.data);

      // Customer-facing auto-confirmation
      try {
        const { sendAutoCustomerEmail } = await import('./notifications-helper');
        const { buildQuoteReceivedEmail } = await import('./email-templates');
        const built = buildQuoteReceivedEmail({
          clientName: validationResult.data.visitorName,
          itemCount: (validationResult.data.items || []).length,
          message: validationResult.data.message || undefined,
        });
        await sendAutoCustomerEmail({
          notificationType: 'ecommerce_quote_auto',
          to: validationResult.data.visitorEmail,
          subject: built.subject,
          html: built.html,
        });
      } catch (autoErr) {
        console.warn('[B2C] auto-confirmation email failed:', autoErr);
      }

      // Internal notification to the commercial team (always sent)
      try {
        const { sendAutoCustomerEmail } = await import('./notifications-helper');
        const { buildQuoteInternalNotifyEmail } = await import('./email-templates');
        const built = buildQuoteInternalNotifyEmail({
          visitorName: validationResult.data.visitorName,
          visitorEmail: validationResult.data.visitorEmail,
          visitorPhone: validationResult.data.visitorPhone,
          visitorCompany: validationResult.data.visitorCompany,
          visitorCity: validationResult.data.visitorCity,
          visitorRut: validationResult.data.visitorRut,
          message: validationResult.data.message,
          items: (validationResult.data.items || []) as any[],
        });
        await sendAutoCustomerEmail({
          notificationType: 'ecommerce_quote_interna',
          to: 'contacto@pinturaspanoramica.cl, dhermosilla@pinturaspanoramica.cl',
          subject: built.subject,
          html: built.html,
          force: true,
        });
      } catch (internalErr) {
        console.warn('[B2C] internal quote notification failed:', internalErr);
      }

      res.status(201).json({
        success: true,
        message: 'Solicitud de cotización recibida. Nos pondremos en contacto pronto.',
        requestId: request.id,
      });
    } catch (error: any) {
      console.error('[B2C] Error creating quote request:', error?.message || error, error?.stack);
      res.status(500).json({ message: 'Error al enviar solicitud de cotización' });
    }
  });

  /**
   * GET /api/b2c/quote-requests — List all quote requests (admin only)
   */
  app.get('/api/b2c/quote-requests', requireAuth, requireAdminSupervisorOrReception, async (req: any, res: any) => {
    try {
      const { status, limit } = req.query;
      const requests = await getQuoteRequests({
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json({ requests });
    } catch (error) {
      console.error('[B2C] Error fetching quote requests:', error);
      res.status(500).json({ message: 'Error al obtener solicitudes' });
    }
  });

  /**
   * PATCH /api/b2c/quote-requests/:id — Update quote request status (admin only)
   */
  app.patch('/api/b2c/quote-requests/:id', requireAuth, requireAdminSupervisorOrReception, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, internalNotes } = req.body;

      if (status !== undefined && !['pending', 'contacted', 'quoted', 'sale', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
      }
      if (status === undefined && internalNotes === undefined) {
        return res.status(400).json({ message: 'Nada que actualizar' });
      }

      const updated = await updateQuoteRequestStatus(id, status, internalNotes);
      if (!updated) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      res.json(updated);
    } catch (error) {
      console.error('[B2C] Error updating quote request:', error);
      res.status(500).json({ message: 'Error al actualizar solicitud' });
    }
  });

  /**
   * DELETE /api/b2c/quote-requests/:id — Delete a quote request (admin only)
   */
  app.delete('/api/b2c/quote-requests/:id', requireAuth, requireAdminSupervisorOrReception, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const deleted = await deleteQuoteRequest(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      res.json({ success: true, id: deleted.id });
    } catch (error: any) {
      console.error('[B2C] Error deleting quote request:', error);
      res.status(500).json({ message: `Error al eliminar solicitud: ${error?.message || error}` });
    }
  });

  /**
   * PATCH /api/b2c/quote-requests/:id/pricing — Assign prices + generate quote
   */
  app.patch('/api/b2c/quote-requests/:id/pricing', requireAuth, requireAdminSupervisorOrReception, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { items, internalNotes, validDays, shippingItems } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un item con precio' });
      }

      const invalid = items.find(
        (i: any) => !i.sku || typeof i.unitPrice !== 'number' || i.unitPrice < 0
      );
      if (invalid) {
        return res.status(400).json({ message: 'Items inválidos: sku y unitPrice son requeridos' });
      }

      const cleanShipping = Array.isArray(shippingItems)
        ? shippingItems
            .map((s: any) => ({
              sku: s?.sku ? String(s.sku) : undefined,
              productName: String(s?.productName || '').trim(),
              quantity: Number(s?.quantity) || 0,
              unitPrice: Number(s?.unitPrice) || 0,
              format: s?.format ? String(s.format) : undefined,
            }))
            .filter(s => s.productName && s.quantity > 0)
        : [];

      const updated = await updateQuoteRequestPricing(id, items, {
        userId: req.user?.id ? String(req.user.id) : null,
        internalNotes,
        validDays: typeof validDays === 'number' ? validDays : undefined,
        shippingItems: cleanShipping,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[B2C] Error assigning pricing:', error);
      const detail = error?.message || String(error);
      res.status(500).json({ message: `Error al asignar precios: ${detail}` });
    }
  });

  /**
   * GET /api/b2c/quote-requests/:id/pdf — Printable HTML (browser → PDF)
   */
  app.get('/api/b2c/quote-requests/:id/pdf', requireAuth, requireAdminSupervisorOrReception, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const request = await getQuoteRequestById(id);
      if (!request) {
        return res.status(404).send('Solicitud no encontrada');
      }

      const items = (request.items as QuoteRequestItem[]) || [];
      const hasPricing = items.some(i => typeof i.unitPrice === 'number' && i.unitPrice > 0);
      if (!hasPricing) {
        return res
          .status(400)
          .send('La solicitud aún no tiene precios asignados. Asigna precios antes de generar el PDF.');
      }

      const [config] = await db.select().from(storeConfig).limit(1);

      const html = renderQuoteRequestPdfHtml(request, {
        logoUrl: config?.logoUrl || '/panoramica-logo.png',
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error: any) {
      console.error('[B2C] Error rendering quote PDF:', error);
      const detail = error?.message || String(error);
      res.status(500).send(`Error al generar el PDF: ${detail}`);
    }
  });

  // ═══════════════════════════════════════════════
  // ADMIN: Price lists for quote pricing modal
  // ═══════════════════════════════════════════════

  /**
   * GET /api/b2c/admin/price-lists — List all available price lists
   * Returns: [{ code, name, type: 'base' | 'custom' | 'offer' }, ...]
   */
  app.get('/api/b2c/admin/price-lists', requireAuth, requireAdminSupervisorOrReception, async (_req: any, res: any) => {
    try {
      const lists: Array<{ code: string; name: string; type: 'base' | 'custom' | 'offer' }> = [
        { code: 'LP01', name: 'Lista base (LP01)', type: 'base' },
        { code: 'OFERTA', name: 'Oferta', type: 'offer' },
      ];

      try {
        const result: any = await db.execute(sql`
          SELECT code, name, active
          FROM custom_price_lists
          WHERE code <> 'LP01'
          ORDER BY code
        `);
        const rows = (result as any).rows || result || [];
        for (const row of rows as any[]) {
          if (!row?.code) continue;
          if (row.active === false) continue;
          lists.push({
            code: row.code,
            name: row.name ? `${row.name} (${row.code})` : row.code,
            type: 'custom',
          });
        }
      } catch (err) {
        // Table may not exist yet — return base + offer only
        console.warn('[B2C] custom_price_lists not available, skipping custom lists');
      }

      res.json({ lists });
    } catch (error) {
      console.error('[B2C] Error fetching price lists:', error);
      res.status(500).json({ message: 'Error al obtener listas de precios' });
    }
  });

  /**
   * POST /api/b2c/admin/resolve-prices — Resolve unit prices for SKUs against a price list
   * Body: { listCode: string, skus: string[] }
   * Returns: { prices: Record<UPPER_SKU, number>, missing: string[] }
   */
  app.post('/api/b2c/admin/resolve-prices', requireAuth, requireAdminSupervisorOrReception, async (req: any, res: any) => {
    try {
      const { listCode, skus } = req.body || {};
      if (!listCode || typeof listCode !== 'string') {
        return res.status(400).json({ message: 'listCode requerido' });
      }
      if (!Array.isArray(skus) || skus.length === 0) {
        return res.json({ prices: {}, missing: [] });
      }

      const upperSkus = Array.from(
        new Set(
          skus
            .map((s: any) => (s || '').toString().trim().toUpperCase())
            .filter(Boolean)
        )
      );
      if (upperSkus.length === 0) {
        return res.json({ prices: {}, missing: [] });
      }

      const code = listCode.trim().toUpperCase();
      const skuList = sql.join(upperSkus.map(s => sql`${s}`), sql`, `);
      const prices: Record<string, number> = {};

      let result: any;
      if (code === 'OFERTA') {
        result = await db.execute(sql`
          SELECT UPPER(pl.codigo) AS codigo,
                 COALESCE(offers.precio, pl.offer_price) AS precio
          FROM price_list pl
          -- Lista genérica "OFERTA" (sin cliente): solo ofertas globales (all_clients).
          -- Las ofertas dirigidas a clientes específicos requieren contexto de cliente.
          LEFT JOIN price_list_offers offers ON UPPER(offers.codigo) = UPPER(pl.codigo) AND (offers.paused IS NULL OR offers.paused = false) AND offers.all_clients = true
          WHERE UPPER(pl.codigo) IN (${skuList})
        `);
      } else if (code === 'LP01' || code === '') {
        result = await db.execute(sql`
          SELECT UPPER(pl.codigo) AS codigo, pl.lista AS precio
          FROM price_list pl
          WHERE UPPER(pl.codigo) IN (${skuList})
        `);
      } else {
        result = await db.execute(sql`
          SELECT UPPER(pl.codigo) AS codigo,
                 COALESCE(cpli.precio, pl.lista) AS precio
          FROM price_list pl
          LEFT JOIN custom_price_list_items cpli
            ON UPPER(cpli.codigo) = UPPER(pl.codigo)
           AND cpli.list_code = ${code}
          WHERE UPPER(pl.codigo) IN (${skuList})
        `);
      }

      const rows = (result as any).rows || result || [];
      for (const row of rows as any[]) {
        if (!row?.codigo) continue;
        const p = row.precio != null ? parseFloat(row.precio) : NaN;
        if (!isNaN(p) && p > 0) prices[row.codigo] = Math.round(p);
      }

      const missing = upperSkus.filter(s => !(s in prices));
      res.json({ prices, missing, listCode: code });
    } catch (error) {
      console.error('[B2C] Error resolving prices:', error);
      res.status(500).json({ message: 'Error al resolver precios' });
    }
  });

  console.log('[B2C] Public quotation routes registered (/api/b2c/*)');
}
