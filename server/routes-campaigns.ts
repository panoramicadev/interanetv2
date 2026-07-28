import type { Express } from 'express';
import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { requirePermission } from './permissions';
import {
  emailCampaigns,
  emailCampaignRecipients,
  emailCampaignTemplates,
  clients,
  crmLeads,
  crmSeguimientoClientes,
  crmAyudaMemoria,
  clientesInactivos,
  quoteRequests,
  ecommerceOrders,
  contactosVisita,
  retailLocations,
  insertEmailCampaignSchema,
  insertEmailCampaignTemplateSchema,
} from '../shared/schema';
import { launchCampaignSend, sendCampaignTest, isValidEmail } from './services/campaigns';

const requireCampaigns = requirePermission('market.campanas');

/**
 * Candidato a destinatario. `source` identifica el módulo del que salió y
 * `detail` es la evidencia legible que se guarda con el destinatario para que
 * después se pueda auditar de dónde vino cada correo.
 */
type Candidate = { email: string; name: string | null; sourceId: string | null; source: string; detail: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fuentes válidas de destinatarios (el valor que queda persistido en `source`). */
const VALID_SOURCES = [
  'client', 'crm', 'seguimiento', 'cotizador', 'market',
  'inactivo', 'ayuda_memoria', 'obra', 'distribuidor', 'manual',
];

const CRM_STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', contacto: 'Contacto', visita: 'Visita', lista_precio: 'Lista de precios',
  campana: 'Campaña', primera_venta: 'Primera venta', promesa: 'Promesa', venta: 'Venta',
};
const SEG_ESTADO_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizacion: 'Cotización', venta: 'Venta',
  despacho: 'Despacho', completado: 'Completado', perdido: 'Perdido',
};
const COTIZADOR_ESTADO_LABEL: Record<string, string> = {
  pending: 'Pendiente', contacted: 'Contactado', quoted: 'Cotizado', closed: 'Cerrado',
};
const RETAIL_TYPE_LABEL: Record<string, string> = {
  sucursal_propia: 'Sucursal propia', distribuidor: 'Distribuidor', ferreteria: 'Ferretería',
};
const OBRA_ROL_LABEL: Record<string, string> = {
  contratista: 'Contratista', administrador: 'Administrador de obra', supervisor: 'Supervisor/Capataz',
};

const fmtFecha = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? null : date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Une las partes no vacías de la evidencia de origen con separador " · ". */
const detailOf = (...parts: (string | null | undefined)[]): string | null => {
  const line = parts.map((p) => (p || '').trim()).filter(Boolean).join(' · ');
  return line || null;
};

/** Extrae correos válidos de un pegado libre (coma, ;, salto de línea, "Nombre <correo>"). */
function parseManualList(raw: string): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const line of (raw || '').split(/[\n\r]+/)) {
    for (const part of line.split(/[,;\t]+/)) {
      const entry = part.trim();
      if (!entry) continue;
      const angle = entry.match(/^(.*?)<([^>]+)>$/);
      const email = (angle ? angle[2] : entry).trim().toLowerCase();
      const name = angle ? angle[1].trim().replace(/^["']|["']$/g, '') : null;
      if (!EMAIL_RE.test(email) || seen.has(email)) continue;
      seen.add(email);
      out.push({ email, name: name || null, sourceId: null, source: 'manual', detail: 'Cargado a mano en esta campaña' });
    }
  }
  return out;
}

/** Normaliza una lista de contactos elegidos uno por uno en el picker del panel. */
function parseSelection(items: any): Candidate[] {
  if (!Array.isArray(items)) return [];
  const out: Candidate[] = [];
  for (const it of items) {
    const email = String(it?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const source = VALID_SOURCES.includes(it?.source) ? it.source : 'manual';
    out.push({
      email,
      name: it?.name ? String(it.name).trim() : null,
      sourceId: it?.sourceId ? String(it.sourceId) : null,
      source,
      detail: it?.detail ? String(it.detail).slice(0, 240) : null,
    });
  }
  return dedupe(out);
}

/** Resuelve destinatarios candidatos desde una fuente del sistema. */
async function resolveCandidates(source: string, params: any): Promise<Candidate[]> {
  const LIMIT = 20000;
  const q = (params?.q || '').trim();

  if (source === 'clients') {
    const conds: any[] = [or(isNotNull(clients.email), isNotNull(clients.emailcomer))];
    if (q) {
      conds.push(or(ilike(clients.nokoen, `%${q}%`), ilike(clients.koen, `%${q}%`), ilike(clients.rten, `%${q}%`), ilike(clients.email, `%${q}%`)));
    }
    const rows = await db
      .select({
        koen: clients.koen, nokoen: clients.nokoen, rten: clients.rten, comuna: clients.comuna,
        sien: clients.sien, email: clients.email, emailcomer: clients.emailcomer,
      })
      .from(clients)
      .where(and(...conds))
      .limit(LIMIT);
    const out: Candidate[] = [];
    for (const r of rows) {
      const usaComercial = !r.email && !!r.emailcomer;
      const email = (r.email || r.emailcomer || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) continue;
      out.push({
        email,
        name: r.nokoen,
        sourceId: r.koen,
        source: 'client',
        detail: detailOf(
          `Cliente ERP${r.koen ? ` ${r.koen}` : ''}`,
          r.rten ? `RUT ${r.rten}` : null,
          r.sien,
          r.comuna,
          usaComercial ? 'correo comercial' : null,
        ),
      });
    }
    return dedupe(out);
  }

  if (source === 'crm') {
    const stages: string[] = Array.isArray(params?.stages) ? params.stages : [];
    const conds: any[] = [isNotNull(crmLeads.clientEmail)];
    if (stages.length) conds.push(inArray(crmLeads.stage, stages));
    if (q) conds.push(or(ilike(crmLeads.clientName, `%${q}%`), ilike(crmLeads.clientEmail, `%${q}%`)));
    const rows = await db
      .select({
        id: crmLeads.id, name: crmLeads.clientName, email: crmLeads.clientEmail,
        stage: crmLeads.stage, salesperson: crmLeads.salespersonName,
        company: crmLeads.clientCompany, city: crmLeads.clientCity,
      })
      .from(crmLeads)
      .where(and(...conds))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.name,
          sourceId: r.id,
          source: 'crm',
          detail: detailOf(
            `Lead CRM · etapa ${CRM_STAGE_LABEL[r.stage] || r.stage}`,
            r.salesperson ? `vendedor ${r.salesperson}` : null,
            r.company,
            r.city,
          ),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  if (source === 'seguimiento') {
    const estados: string[] = Array.isArray(params?.estados) ? params.estados : [];
    const conds: any[] = [isNotNull(crmSeguimientoClientes.email), eq(crmSeguimientoClientes.active, true)];
    if (estados.length) conds.push(inArray(crmSeguimientoClientes.estado, estados));
    if (q) conds.push(or(ilike(crmSeguimientoClientes.nombre, `%${q}%`), ilike(crmSeguimientoClientes.email, `%${q}%`)));
    const rows = await db
      .select({
        id: crmSeguimientoClientes.id, name: crmSeguimientoClientes.nombre, email: crmSeguimientoClientes.email,
        estado: crmSeguimientoClientes.estado, vendedor: crmSeguimientoClientes.vendedorNombre,
        empresa: crmSeguimientoClientes.empresa, segmento: crmSeguimientoClientes.segmento,
        origen: crmSeguimientoClientes.origen,
      })
      .from(crmSeguimientoClientes)
      .where(and(...conds))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.name,
          sourceId: r.id,
          source: 'seguimiento',
          detail: detailOf(
            `Seguimiento · estado ${SEG_ESTADO_LABEL[r.estado] || r.estado}`,
            r.vendedor ? `vendedor ${r.vendedor}` : null,
            r.empresa,
            r.segmento,
            r.origen && r.origen !== 'manual' ? `origen ${r.origen}` : null,
          ),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  // Solicitudes de cotización del sitio público: el lead más caliente que hay.
  if (source === 'cotizador') {
    const estados: string[] = Array.isArray(params?.estados) ? params.estados : [];
    const conds: any[] = [isNotNull(quoteRequests.visitorEmail)];
    if (estados.length) conds.push(inArray(quoteRequests.status, estados));
    if (q) {
      conds.push(or(
        ilike(quoteRequests.visitorName, `%${q}%`),
        ilike(quoteRequests.visitorEmail, `%${q}%`),
        ilike(quoteRequests.visitorCompany, `%${q}%`),
      ));
    }
    const rows = await db
      .select({
        id: quoteRequests.id, name: quoteRequests.visitorName, email: quoteRequests.visitorEmail,
        company: quoteRequests.visitorCompany, city: quoteRequests.visitorCity,
        status: quoteRequests.status, itemCount: quoteRequests.itemCount, createdAt: quoteRequests.createdAt,
      })
      .from(quoteRequests)
      .where(and(...conds))
      // El más reciente primero: el dedupe deja la solicitud más nueva de cada correo.
      .orderBy(desc(quoteRequests.createdAt))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.name,
          sourceId: r.id,
          source: 'cotizador',
          detail: detailOf(
            'Cotizador web',
            fmtFecha(r.createdAt),
            COTIZADOR_ESTADO_LABEL[r.status] || r.status,
            r.itemCount ? `${r.itemCount} producto${r.itemCount === 1 ? '' : 's'}` : null,
            r.company,
            r.city,
          ),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  // Compradores del Market (pedidos del eCommerce), agrupados por correo.
  if (source === 'market') {
    const conds: any[] = [isNotNull(ecommerceOrders.clientEmail)];
    if (q) conds.push(or(ilike(ecommerceOrders.clientName, `%${q}%`), ilike(ecommerceOrders.clientEmail, `%${q}%`)));
    const rows = await db
      .select({
        email: ecommerceOrders.clientEmail,
        name: sql<string>`max(${ecommerceOrders.clientName})`,
        pedidos: sql<number>`count(*)::int`,
        ultimo: sql<string>`max(${ecommerceOrders.createdAt})`,
      })
      .from(ecommerceOrders)
      .where(and(...conds))
      .groupBy(ecommerceOrders.clientEmail)
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.name,
          sourceId: null,
          source: 'market',
          detail: detailOf(
            `Compró en Market · ${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'}`,
            r.ultimo ? `último ${fmtFecha(r.ultimo)}` : null,
          ),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  // Clientes que dejaron de comprar: base natural de campañas de reactivación.
  if (source === 'inactivos') {
    const minDias = Number(params?.minDias) > 0 ? Number(params.minDias) : null;
    const conds: any[] = [isNotNull(clientesInactivos.clientEmail)];
    if (minDias) conds.push(sql`${clientesInactivos.daysSinceLastPurchase} >= ${minDias}`);
    if (q) {
      conds.push(or(
        ilike(clientesInactivos.clientName, `%${q}%`),
        ilike(clientesInactivos.clientEmail, `%${q}%`),
        ilike(clientesInactivos.clientRut, `%${q}%`),
      ));
    }
    const rows = await db
      .select({
        id: clientesInactivos.id, name: clientesInactivos.clientName, email: clientesInactivos.clientEmail,
        koen: clientesInactivos.clientKoen, dias: clientesInactivos.daysSinceLastPurchase,
        ultima: clientesInactivos.lastPurchaseDate, segment: clientesInactivos.segment,
        vendedor: clientesInactivos.salespersonName,
      })
      .from(clientesInactivos)
      .where(and(...conds))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.name,
          sourceId: r.koen || r.id,
          source: 'inactivo',
          detail: detailOf(
            'Cliente inactivo',
            r.dias ? `${r.dias} días sin comprar` : null,
            r.ultima ? `última compra ${fmtFecha(r.ultima)}` : null,
            r.segment,
            r.vendedor ? `vendedor ${r.vendedor}` : null,
          ),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  // Fichas de Ayuda Memoria levantadas por los vendedores en terreno.
  if (source === 'ayuda_memoria') {
    const conds: any[] = [isNotNull(crmAyudaMemoria.emailContacto)];
    if (q) {
      conds.push(or(
        ilike(crmAyudaMemoria.clienteNombre, `%${q}%`),
        ilike(crmAyudaMemoria.emailContacto, `%${q}%`),
        ilike(crmAyudaMemoria.contactoPrincipal, `%${q}%`),
      ));
    }
    const rows = await db
      .select({
        id: crmAyudaMemoria.id, cliente: crmAyudaMemoria.clienteNombre, contacto: crmAyudaMemoria.contactoPrincipal,
        email: crmAyudaMemoria.emailContacto, tipo: crmAyudaMemoria.tipoCliente, ciudad: crmAyudaMemoria.ciudad,
        creadoPor: crmAyudaMemoria.creadoPorNombre, createdAt: crmAyudaMemoria.createdAt,
      })
      .from(crmAyudaMemoria)
      .where(and(...conds))
      .orderBy(desc(crmAyudaMemoria.createdAt))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.contacto || r.cliente,
          sourceId: r.id,
          source: 'ayuda_memoria',
          detail: detailOf(
            `Ayuda Memoria · ${r.cliente}`,
            r.tipo,
            r.ciudad,
            r.creadoPor ? `levantado por ${r.creadoPor}` : null,
            fmtFecha(r.createdAt),
          ),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  // Contactos de obra registrados en las visitas técnicas (contratista,
  // administrador y supervisor viven en columnas distintas de la misma fila).
  if (source === 'obras') {
    const roles: string[] = Array.isArray(params?.roles) && params.roles.length
      ? params.roles
      : ['contratista', 'administrador', 'supervisor'];
    const rows = await db
      .select()
      .from(contactosVisita)
      .orderBy(desc(contactosVisita.createdAt))
      .limit(LIMIT);
    const out: Candidate[] = [];
    const term = q.toLowerCase();
    for (const r of rows) {
      const porRol: { rol: string; nombre: string | null; email: string | null }[] = [
        { rol: 'contratista', nombre: r.contratistaNombre, email: r.contratistaEmail },
        { rol: 'administrador', nombre: r.administradorNombre, email: r.administradorEmail },
        { rol: 'supervisor', nombre: r.supervisorNombre, email: r.supervisorEmail },
      ];
      for (const c of porRol) {
        if (!roles.includes(c.rol)) continue;
        const email = (c.email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) continue;
        if (term && !email.includes(term) && !(c.nombre || '').toLowerCase().includes(term)) continue;
        out.push({
          email,
          name: c.nombre || null,
          sourceId: r.visitaId,
          source: 'obra',
          detail: detailOf('Contacto de obra (visita técnica)', OBRA_ROL_LABEL[c.rol], fmtFecha(r.createdAt)),
        });
      }
    }
    return dedupe(out);
  }

  // Puntos de venta del mapa "Dónde Comprar": ferreterías y distribuidores.
  if (source === 'distribuidores') {
    const tipos: string[] = Array.isArray(params?.tipos) ? params.tipos : [];
    const conds: any[] = [isNotNull(retailLocations.email), eq(retailLocations.active, true)];
    if (tipos.length) conds.push(inArray(retailLocations.type, tipos));
    if (q) {
      conds.push(or(
        ilike(retailLocations.name, `%${q}%`),
        ilike(retailLocations.email, `%${q}%`),
        ilike(retailLocations.comuna, `%${q}%`),
      ));
    }
    const rows = await db
      .select({
        id: retailLocations.id, name: retailLocations.name, email: retailLocations.email,
        type: retailLocations.type, comuna: retailLocations.comuna, region: retailLocations.region,
      })
      .from(retailLocations)
      .where(and(...conds))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({
          email: (r.email || '').trim().toLowerCase(),
          name: r.name,
          sourceId: r.id,
          source: 'distribuidor',
          detail: detailOf('Dónde Comprar', RETAIL_TYPE_LABEL[r.type] || r.type, r.comuna, r.region),
        }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  return [];
}

function dedupe(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of cands) {
    if (seen.has(c.email)) continue;
    seen.add(c.email);
    out.push(c);
  }
  return out;
}

async function refreshTotals(campaignId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, campaignId));
  await db.update(emailCampaigns).set({ totalRecipients: count, updatedAt: new Date() }).where(eq(emailCampaigns.id, campaignId));
  return count;
}

async function getCampaignOr404(id: string, res: any) {
  const [c] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
  if (!c) {
    res.status(404).json({ message: 'Campaña no encontrada' });
    return null;
  }
  return c;
}

export function registerCampaignRoutes(app: Express) {
  // ── Plantillas ────────────────────────────────────────────────
  app.get('/api/campanas/templates', requireAuth, requireCampaigns, async (_req, res) => {
    try {
      const rows = await db.select().from(emailCampaignTemplates).orderBy(desc(emailCampaignTemplates.updatedAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'Error al listar plantillas' });
    }
  });

  app.post('/api/campanas/templates', requireAuth, requireCampaigns, async (req: any, res) => {
    try {
      const parsed = insertEmailCampaignTemplateSchema.parse(req.body);
      const [row] = await db
        .insert(emailCampaignTemplates)
        .values({ ...parsed, createdBy: req.user?.id })
        .returning();
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || 'Datos inválidos' });
    }
  });

  app.delete('/api/campanas/templates/:id', requireAuth, requireCampaigns, async (req, res) => {
    try {
      await db.delete(emailCampaignTemplates).where(eq(emailCampaignTemplates.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  // ── Campañas ──────────────────────────────────────────────────
  app.get('/api/campanas', requireAuth, requireCampaigns, async (_req, res) => {
    try {
      const rows = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'Error al listar campañas' });
    }
  });

  app.post('/api/campanas', requireAuth, requireCampaigns, async (req: any, res) => {
    try {
      const parsed = insertEmailCampaignSchema.parse(req.body);
      const [row] = await db
        .insert(emailCampaigns)
        .values({ ...parsed, status: 'draft', createdBy: req.user?.id })
        .returning();
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || 'Datos inválidos' });
    }
  });

  app.get('/api/campanas/:id', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      const recipients = await db
        .select()
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, campaign.id))
        .orderBy(desc(emailCampaignRecipients.createdAt))
        .limit(2000);
      const stats = await db
        .select({ status: emailCampaignRecipients.status, count: sql<number>`count(*)::int` })
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.campaignId, campaign.id))
        .groupBy(emailCampaignRecipients.status);
      res.json({ campaign, recipients, stats });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  app.patch('/api/campanas/:id', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (['sending', 'sent'].includes(campaign.status)) {
        return res.status(409).json({ message: 'No se puede editar una campaña enviada o en envío.' });
      }
      const allowed = ['name', 'subject', 'preheader', 'fromName', 'replyTo', 'bodyHtml', 'registerInCrm'] as const;
      const patch: any = { updatedAt: new Date() };
      for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
      const [row] = await db.update(emailCampaigns).set(patch).where(eq(emailCampaigns.id, campaign.id)).returning();
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ message: e?.message });
    }
  });

  app.delete('/api/campanas/:id', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (campaign.status === 'sending') return res.status(409).json({ message: 'No se puede eliminar una campaña en envío.' });
      await db.delete(emailCampaignRecipients).where(eq(emailCampaignRecipients.campaignId, campaign.id));
      await db.delete(emailCampaigns).where(eq(emailCampaigns.id, campaign.id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  // ── Audiencia ─────────────────────────────────────────────────
  // Resumen de cuántos contactos con correo hay disponibles en cada fuente.
  // Es lo que le muestra al usuario de dónde puede sacar leads y cuántos.
  // Se resuelve con COUNT(DISTINCT …) en la base: no trae filas al proceso.
  app.get('/api/campanas/audience/sources', requireAuth, requireCampaigns, async (_req, res) => {
    // Mismo criterio de validez que EMAIL_RE, pero evaluado en Postgres.
    const VALID = `~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`;
    const COUNT_SQL: Record<string, string> = {
      // El correo principal manda; si viene vacío se usa el comercial (igual que el listado).
      clients: `SELECT count(DISTINCT lower(coalesce(nullif(trim(email), ''), nullif(trim(emailcomer), '')))) AS n
                FROM clients WHERE lower(coalesce(nullif(trim(email), ''), nullif(trim(emailcomer), ''))) ${VALID}`,
      crm: `SELECT count(DISTINCT lower(client_email)) AS n FROM crm_leads WHERE lower(client_email) ${VALID}`,
      seguimiento: `SELECT count(DISTINCT lower(email)) AS n FROM crm_seguimiento_clientes WHERE active = true AND lower(email) ${VALID}`,
      cotizador: `SELECT count(DISTINCT lower(visitor_email)) AS n FROM quote_requests WHERE lower(visitor_email) ${VALID}`,
      market: `SELECT count(DISTINCT lower(client_email)) AS n FROM ecommerce_orders WHERE lower(client_email) ${VALID}`,
      inactivos: `SELECT count(DISTINCT lower(client_email)) AS n FROM clientes_inactivos WHERE lower(client_email) ${VALID}`,
      ayuda_memoria: `SELECT count(DISTINCT lower(email_contacto)) AS n FROM crm_ayuda_memoria WHERE lower(email_contacto) ${VALID}`,
      obras: `SELECT count(DISTINCT e) AS n FROM (
                SELECT lower(contratista_email) AS e FROM contactos_visita
                UNION ALL SELECT lower(administrador_email) FROM contactos_visita
                UNION ALL SELECT lower(supervisor_email) FROM contactos_visita
              ) t WHERE e ${VALID}`,
      distribuidores: `SELECT count(DISTINCT lower(email)) AS n FROM retail_locations WHERE active = true AND lower(email) ${VALID}`,
    };

    const sources = await Promise.all(
      Object.entries(COUNT_SQL).map(async ([source, query]) => {
        try {
          const r: any = await db.execute(sql.raw(query));
          const n = Number((r?.rows?.[0]?.n ?? r?.[0]?.n) || 0);
          return { source, count: n };
        } catch (e: any) {
          // Una fuente rota (tabla ausente en un ambiente) no debe tumbar el resumen.
          console.warn(`[campanas] conteo de la fuente ${source} falló:`, e?.message);
          return { source, count: 0, error: true };
        }
      }),
    );
    res.json({ sources });
  });

  // Previsualiza cuántos destinatarios resultarían de una fuente (sin insertar).
  app.post('/api/campanas/audience/preview', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const { source, ...params } = req.body || {};
      let cands: Candidate[];
      if (source === 'manual') cands = parseManualList(params?.raw || '');
      else if (source === 'selection') cands = parseSelection(params?.items);
      else cands = await resolveCandidates(source, params);
      res.json({ count: cands.length, sample: cands.slice(0, 20) });
    } catch (e: any) {
      res.status(400).json({ message: e?.message });
    }
  });

  // Lista los candidatos de una fuente para elegirlos uno por uno en el panel.
  // Devuelve el total real y una página acotada (el picker no puede pintar 20k filas).
  app.post('/api/campanas/audience/list', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const { source, limit, ...params } = req.body || {};
      const max = Math.min(Number(limit) || 300, 1000);
      let cands: Candidate[];
      if (source === 'manual') cands = parseManualList(params?.raw || '');
      else cands = await resolveCandidates(source, params);
      res.json({ total: cands.length, truncated: cands.length > max, items: cands.slice(0, max) });
    } catch (e: any) {
      res.status(400).json({ message: e?.message });
    }
  });

  // Agrega destinatarios a la campaña desde una fuente (clients|crm|seguimiento|manual).
  app.post('/api/campanas/:id/recipients', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (['sending', 'sent'].includes(campaign.status)) {
        return res.status(409).json({ message: 'La campaña ya fue enviada; no se pueden agregar destinatarios.' });
      }
      const { source, ...params } = req.body || {};
      let cands: Candidate[];
      if (source === 'manual') cands = parseManualList(params?.raw || '');
      else if (source === 'selection') cands = parseSelection(params?.items);
      else cands = await resolveCandidates(source, params);

      if (cands.length === 0) return res.json({ added: 0, total: campaign.totalRecipients });

      // Insert en lotes con dedup por (campaign_id, email).
      let added = 0;
      const CHUNK = 500;
      for (let i = 0; i < cands.length; i += CHUNK) {
        const chunk = cands.slice(i, i + CHUNK).map((c) => ({
          campaignId: campaign.id,
          email: c.email,
          name: c.name,
          source: c.source,
          sourceId: c.sourceId,
          sourceDetail: c.detail,
          status: 'pending' as const,
        }));
        const inserted = await db.insert(emailCampaignRecipients).values(chunk).onConflictDoNothing().returning({ id: emailCampaignRecipients.id });
        added += inserted.length;
      }
      const total = await refreshTotals(campaign.id);
      res.json({ added, total });
    } catch (e: any) {
      res.status(400).json({ message: e?.message });
    }
  });

  app.delete('/api/campanas/:id/recipients/:rid', requireAuth, requireCampaigns, async (req, res) => {
    try {
      await db
        .delete(emailCampaignRecipients)
        .where(and(eq(emailCampaignRecipients.campaignId, req.params.id), eq(emailCampaignRecipients.id, req.params.rid)));
      const total = await refreshTotals(req.params.id);
      res.json({ ok: true, total });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  // Vaciar todos los destinatarios (solo si no está enviada).
  app.delete('/api/campanas/:id/recipients', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (['sending', 'sent'].includes(campaign.status)) return res.status(409).json({ message: 'Campaña ya enviada.' });
      await db.delete(emailCampaignRecipients).where(eq(emailCampaignRecipients.campaignId, campaign.id));
      await refreshTotals(campaign.id);
      res.json({ ok: true, total: 0 });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  // ── Envío ─────────────────────────────────────────────────────
  app.post('/api/campanas/:id/test', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      const email = (req.body?.email || '').trim();
      if (!isValidEmail(email)) return res.status(400).json({ message: 'Email de prueba inválido' });
      await sendCampaignTest(campaign, email);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'Error al enviar prueba' });
    }
  });

  app.post('/api/campanas/:id/send', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (['sending', 'sent'].includes(campaign.status)) {
        return res.status(409).json({ message: 'La campaña ya fue enviada o está en curso.' });
      }
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailCampaignRecipients)
        .where(and(eq(emailCampaignRecipients.campaignId, campaign.id), eq(emailCampaignRecipients.status, 'pending')));
      if (count === 0) return res.status(400).json({ message: 'No hay destinatarios pendientes para enviar.' });
      if (!campaign.bodyHtml?.trim()) return res.status(400).json({ message: 'La campaña no tiene contenido.' });

      await db.update(emailCampaigns).set({ status: 'sending', scheduledAt: null, updatedAt: new Date() }).where(eq(emailCampaigns.id, campaign.id));
      launchCampaignSend(campaign.id);
      res.json({ ok: true, message: `Envío iniciado para ${count} destinatarios.` });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  app.post('/api/campanas/:id/schedule', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (['sending', 'sent'].includes(campaign.status)) return res.status(409).json({ message: 'Campaña ya enviada.' });
      const when = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null;
      if (!when || isNaN(when.getTime())) return res.status(400).json({ message: 'Fecha de programación inválida' });
      if (when.getTime() < Date.now()) return res.status(400).json({ message: 'La fecha debe ser futura' });
      const [row] = await db
        .update(emailCampaigns)
        .set({ status: 'scheduled', scheduledAt: when, updatedAt: new Date() })
        .where(eq(emailCampaigns.id, campaign.id))
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ message: e?.message });
    }
  });

  app.post('/api/campanas/:id/cancel', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (campaign.status !== 'scheduled') return res.status(409).json({ message: 'Solo se pueden cancelar campañas programadas.' });
      const [row] = await db
        .update(emailCampaigns)
        .set({ status: 'draft', scheduledAt: null, updatedAt: new Date() })
        .where(eq(emailCampaigns.id, campaign.id))
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ message: e?.message });
    }
  });

  // Reintenta los destinatarios fallidos: los vuelve a 'pending' y relanza.
  app.post('/api/campanas/:id/resend-failed', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const campaign = await getCampaignOr404(req.params.id, res);
      if (!campaign) return;
      if (campaign.status === 'sending') return res.status(409).json({ message: 'La campaña está en envío.' });
      const reset = await db
        .update(emailCampaignRecipients)
        .set({ status: 'pending', errorMessage: null })
        .where(and(eq(emailCampaignRecipients.campaignId, campaign.id), eq(emailCampaignRecipients.status, 'failed')))
        .returning({ id: emailCampaignRecipients.id });
      if (reset.length === 0) return res.status(400).json({ message: 'No hay destinatarios fallidos para reintentar.' });
      await db.update(emailCampaigns).set({ status: 'sending', failedCount: 0, updatedAt: new Date() }).where(eq(emailCampaigns.id, campaign.id));
      launchCampaignSend(campaign.id);
      res.json({ ok: true, retrying: reset.length });
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });
}
