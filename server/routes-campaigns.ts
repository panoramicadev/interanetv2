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
  insertEmailCampaignSchema,
  insertEmailCampaignTemplateSchema,
} from '../shared/schema';
import { launchCampaignSend, sendCampaignTest, isValidEmail } from './services/campaigns';

const requireCampaigns = requirePermission('market.campanas');

type Candidate = { email: string; name: string | null; sourceId: string | null; source: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      out.push({ email, name: name || null, sourceId: null, source: 'manual' });
    }
  }
  return out;
}

/** Resuelve destinatarios candidatos desde una fuente del sistema. */
async function resolveCandidates(source: string, params: any): Promise<Candidate[]> {
  const LIMIT = 20000;
  if (source === 'clients') {
    const q = (params?.q || '').trim();
    const conds: any[] = [or(isNotNull(clients.email), isNotNull(clients.emailcomer))];
    if (q) {
      conds.push(or(ilike(clients.nokoen, `%${q}%`), ilike(clients.koen, `%${q}%`), ilike(clients.rten, `%${q}%`)));
    }
    const rows = await db
      .select({ koen: clients.koen, nokoen: clients.nokoen, email: clients.email, emailcomer: clients.emailcomer })
      .from(clients)
      .where(and(...conds))
      .limit(LIMIT);
    const out: Candidate[] = [];
    for (const r of rows) {
      const email = (r.email || r.emailcomer || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) continue;
      out.push({ email, name: r.nokoen, sourceId: r.koen, source: 'client' });
    }
    return dedupe(out);
  }

  if (source === 'crm') {
    const stages: string[] = Array.isArray(params?.stages) ? params.stages : [];
    const conds: any[] = [isNotNull(crmLeads.clientEmail)];
    if (stages.length) conds.push(inArray(crmLeads.stage, stages));
    const rows = await db
      .select({ id: crmLeads.id, name: crmLeads.clientName, email: crmLeads.clientEmail })
      .from(crmLeads)
      .where(and(...conds))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({ email: (r.email || '').trim().toLowerCase(), name: r.name, sourceId: r.id, source: 'crm' }))
        .filter((c) => EMAIL_RE.test(c.email)),
    );
  }

  if (source === 'seguimiento') {
    const estados: string[] = Array.isArray(params?.estados) ? params.estados : [];
    const conds: any[] = [isNotNull(crmSeguimientoClientes.email), eq(crmSeguimientoClientes.active, true)];
    if (estados.length) conds.push(inArray(crmSeguimientoClientes.estado, estados));
    const rows = await db
      .select({ id: crmSeguimientoClientes.id, name: crmSeguimientoClientes.nombre, email: crmSeguimientoClientes.email })
      .from(crmSeguimientoClientes)
      .where(and(...conds))
      .limit(LIMIT);
    return dedupe(
      rows
        .map((r) => ({ email: (r.email || '').trim().toLowerCase(), name: r.name, sourceId: r.id, source: 'seguimiento' }))
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
  // Previsualiza cuántos destinatarios resultarían de una fuente (sin insertar).
  app.post('/api/campanas/audience/preview', requireAuth, requireCampaigns, async (req, res) => {
    try {
      const { source, ...params } = req.body || {};
      let cands: Candidate[];
      if (source === 'manual') cands = parseManualList(params?.raw || '');
      else cands = await resolveCandidates(source, params);
      res.json({ count: cands.length, sample: cands.slice(0, 20) });
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
