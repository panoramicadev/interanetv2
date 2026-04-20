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
} from './services/quote-request.service';
import { renderQuoteRequestPdfHtml } from './services/quote-request-pdf';
import { insertQuoteRequestSchema, storeBanners, storeConfig, type QuoteRequestItem } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdminOrSupervisor } from './auth';

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

      const request = await createQuoteRequest(validationResult.data);

      // TODO: Send email notification to sales team

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
  app.get('/api/b2c/quote-requests', requireAuth, requireAdminOrSupervisor, async (req: any, res: any) => {
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
  app.patch('/api/b2c/quote-requests/:id', requireAuth, requireAdminOrSupervisor, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, internalNotes } = req.body;

      if (!status || !['pending', 'contacted', 'quoted', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
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
   * PATCH /api/b2c/quote-requests/:id/pricing — Assign prices + generate quote
   */
  app.patch('/api/b2c/quote-requests/:id/pricing', requireAuth, requireAdminOrSupervisor, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { items, internalNotes, validDays } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un item con precio' });
      }

      const invalid = items.find(
        (i: any) => !i.sku || typeof i.unitPrice !== 'number' || i.unitPrice < 0
      );
      if (invalid) {
        return res.status(400).json({ message: 'Items inválidos: sku y unitPrice son requeridos' });
      }

      const updated = await updateQuoteRequestPricing(id, items, {
        userId: req.user?.id ?? null,
        internalNotes,
        validDays: typeof validDays === 'number' ? validDays : undefined,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      res.json(updated);
    } catch (error) {
      console.error('[B2C] Error assigning pricing:', error);
      res.status(500).json({ message: 'Error al asignar precios' });
    }
  });

  /**
   * GET /api/b2c/quote-requests/:id/pdf — Printable HTML (browser → PDF)
   */
  app.get('/api/b2c/quote-requests/:id/pdf', requireAuth, requireAdminOrSupervisor, async (req: any, res: any) => {
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
    } catch (error) {
      console.error('[B2C] Error rendering quote PDF:', error);
      res.status(500).send('Error al generar el PDF');
    }
  });

  console.log('[B2C] Public quotation routes registered (/api/b2c/*)');
}
