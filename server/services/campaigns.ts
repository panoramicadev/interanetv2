import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  emailCampaigns,
  emailCampaignRecipients,
  crmLeads,
  crmSeguimientoClientes,
  users,
  type EmailCampaign,
} from '../../shared/schema';
import { emailService } from './email';
import { renderCampaignEmail } from '../../shared/campaign-email';

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://ai.pinturaspanoramica.cl').replace(/\/$/, '');
const CAMPAIGN_LOGO_URL = `${PUBLIC_BASE_URL}/panoramica-logo-white.png`;

// Pacing entre envíos para respetar los rate limits de Resend (~2 req/s en
// planes base). Enviamos secuencialmente con una pausa; para volúmenes muy
// grandes se puede migrar a la Batch API de Resend más adelante.
const SEND_DELAY_MS = 350;

// Campañas que se están procesando ahora mismo, para evitar dobles envíos si
// el endpoint se llama dos veces o el scheduler pisa un envío manual.
const processing = new Set<string>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email.trim());
}

/** Reemplaza variables de personalización ({{nombre}}, {{email}}) en un texto. */
function personalize(text: string, recipient: { name?: string | null; email: string }): string {
  const nombre = (recipient.name || '').trim() || 'Estimado/a cliente';
  return (text || '')
    .replace(/\{\{\s*nombre\s*\}\}/gi, nombre)
    .replace(/\{\{\s*email\s*\}\}/gi, recipient.email);
}

/** Construye el HTML final de un correo de campaña (cuerpo + branding). */
export function buildCampaignHtml(campaign: Pick<EmailCampaign, 'bodyHtml' | 'preheader'>, recipient: { name?: string | null; email: string }): string {
  return renderCampaignEmail({
    body: personalize(campaign.bodyHtml || '', recipient),
    preheader: campaign.preheader ? personalize(campaign.preheader, recipient) : null,
    logoUrl: CAMPAIGN_LOGO_URL,
  });
}

function fromAddress(campaign: EmailCampaign): string | undefined {
  const from = process.env.RESEND_FROM || 'notificaciones@pinturaspanoramica.cl';
  if (campaign.fromName) {
    // Si RESEND_FROM ya trae "Nombre <correo>", extraemos el correo.
    const m = from.match(/<([^>]+)>/);
    const addr = m ? m[1] : from;
    return `${campaign.fromName} <${addr}>`;
  }
  return undefined; // deja que emailService use su default configurado
}

/**
 * Inserta los contactos "manuales" de la campaña en el CRM y en Seguimiento
 * (si aún no existen por email). Los leads se marcan con stage 'campana', que
 * existe justo para este flujo. Best-effort: nunca bloquea el envío.
 */
async function registerManualContactsInCrm(campaignId: string, userId?: string | null): Promise<void> {
  try {
    // Resolvemos el "dueño" comercial de estos contactos. CRM y Seguimiento
    // exigen vendedor; usamos el creador de la campaña como responsable.
    let ownerId = userId || 'sistema';
    let ownerName = 'Marketing';
    if (userId) {
      try {
        const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (u) {
          const nm = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
          ownerName = nm || u.email || ownerName;
        }
      } catch {}
    }

    const recips = await db
      .select()
      .from(emailCampaignRecipients)
      .where(and(eq(emailCampaignRecipients.campaignId, campaignId), eq(emailCampaignRecipients.source, 'manual')));

    for (const r of recips) {
      const email = r.email.trim().toLowerCase();
      if (!isValidEmail(email)) continue;
      const nombre = (r.name || '').trim() || email;

      // CRM lead (por email). stage 'campana' existe justo para este flujo.
      try {
        const existingLead = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.clientEmail, email)).limit(1);
        if (existingLead.length === 0) {
          await db.insert(crmLeads).values({
            clientName: nombre,
            clientEmail: email,
            stage: 'campana',
            salespersonId: ownerId,
            salespersonName: ownerName,
          } as any);
        }
      } catch (e: any) {
        console.warn('[campaigns] no se pudo insertar lead CRM:', e?.message);
      }

      // Seguimiento (por email)
      try {
        const existingSeg = await db
          .select({ id: crmSeguimientoClientes.id })
          .from(crmSeguimientoClientes)
          .where(eq(crmSeguimientoClientes.email, email))
          .limit(1);
        if (existingSeg.length === 0) {
          await db.insert(crmSeguimientoClientes).values({
            nombre,
            email,
            estado: 'nuevo',
            origen: 'campana_mailing',
            vendedorId: ownerId,
            vendedorNombre: ownerName,
            active: true,
          } as any);
        }
      } catch (e: any) {
        console.warn('[campaigns] no se pudo insertar en seguimiento:', e?.message);
      }
    }
  } catch (e: any) {
    console.warn('[campaigns] registerManualContactsInCrm falló:', e?.message);
  }
}

/**
 * Procesa el envío de una campaña: envía a cada destinatario pendiente,
 * actualiza su estado y los contadores de la campaña. Corre en background
 * (no bloquear el request). Idempotente por campaña vía `processing`.
 */
export async function processCampaignSend(campaignId: string): Promise<void> {
  if (processing.has(campaignId)) {
    console.log(`[campaigns] ${campaignId} ya se está procesando, se ignora`);
    return;
  }
  processing.add(campaignId);
  try {
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
    if (!campaign) return;
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      // 'sending' ya está en curso en otra corrida — evitamos duplicar.
      if (campaign.status === 'sent') return;
    }

    await db
      .update(emailCampaigns)
      .set({ status: 'sending', startedAt: campaign.startedAt || new Date(), updatedAt: new Date() })
      .where(eq(emailCampaigns.id, campaignId));

    if (campaign.registerInCrm) {
      await registerManualContactsInCrm(campaignId, campaign.createdBy);
    }

    const pending = await db
      .select()
      .from(emailCampaignRecipients)
      .where(and(eq(emailCampaignRecipients.campaignId, campaignId), eq(emailCampaignRecipients.status, 'pending')));

    const from = fromAddress(campaign);

    for (const r of pending) {
      const email = (r.email || '').trim();
      if (!isValidEmail(email)) {
        await db
          .update(emailCampaignRecipients)
          .set({ status: 'skipped', errorMessage: 'Email inválido' })
          .where(eq(emailCampaignRecipients.id, r.id));
        await db
          .update(emailCampaigns)
          .set({ failedCount: sql`${emailCampaigns.failedCount} + 1`, updatedAt: new Date() })
          .where(eq(emailCampaigns.id, campaignId));
        continue;
      }

      try {
        await emailService.sendEmail({
          to: email,
          subject: personalize(campaign.subject, { name: r.name, email }),
          html: buildCampaignHtml(campaign, { name: r.name, email }),
          from,
          replyTo: campaign.replyTo || undefined,
        });
        await db
          .update(emailCampaignRecipients)
          .set({ status: 'sent', sentAt: new Date(), errorMessage: null })
          .where(eq(emailCampaignRecipients.id, r.id));
        await db
          .update(emailCampaigns)
          .set({ sentCount: sql`${emailCampaigns.sentCount} + 1`, updatedAt: new Date() })
          .where(eq(emailCampaigns.id, campaignId));
      } catch (err: any) {
        await db
          .update(emailCampaignRecipients)
          .set({ status: 'failed', errorMessage: err?.message?.slice(0, 500) || 'Error desconocido' })
          .where(eq(emailCampaignRecipients.id, r.id));
        await db
          .update(emailCampaigns)
          .set({ failedCount: sql`${emailCampaigns.failedCount} + 1`, updatedAt: new Date() })
          .where(eq(emailCampaigns.id, campaignId));
      }

      await sleep(SEND_DELAY_MS);
    }

    // Estado final según resultados.
    const [fresh] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
    const finalStatus = !fresh
      ? 'sent'
      : fresh.sentCount === 0 && fresh.failedCount > 0
        ? 'failed'
        : fresh.failedCount > 0
          ? 'partial'
          : 'sent';
    await db
      .update(emailCampaigns)
      .set({ status: finalStatus, sentAt: new Date(), updatedAt: new Date() })
      .where(eq(emailCampaigns.id, campaignId));

    console.log(`[campaigns] ${campaignId} finalizada: ${finalStatus} (enviados=${fresh?.sentCount}, fallidos=${fresh?.failedCount})`);
  } catch (e: any) {
    console.error('[campaigns] processCampaignSend error:', e?.message);
    try {
      await db.update(emailCampaigns).set({ status: 'failed', updatedAt: new Date() }).where(eq(emailCampaigns.id, campaignId));
    } catch {}
  } finally {
    processing.delete(campaignId);
  }
}

/** Lanza el envío en background sin bloquear el request. */
export function launchCampaignSend(campaignId: string): void {
  setImmediate(() => {
    processCampaignSend(campaignId).catch((e) => console.error('[campaigns] launch error:', e?.message));
  });
}

/** Envía un correo de prueba de la campaña a una dirección puntual. */
export async function sendCampaignTest(campaign: EmailCampaign, toEmail: string): Promise<void> {
  if (!isValidEmail(toEmail)) throw new Error('Email de prueba inválido');
  const recipient = { name: 'Contacto de prueba', email: toEmail };
  await emailService.sendEmail({
    to: toEmail,
    subject: `[PRUEBA] ${personalize(campaign.subject, recipient)}`,
    html: buildCampaignHtml(campaign, recipient),
    from: fromAddress(campaign),
    replyTo: campaign.replyTo || undefined,
  });
}

let schedulerStarted = false;
/**
 * Scheduler in-process: cada minuto busca campañas 'scheduled' cuyo
 * scheduled_at ya venció y las dispara. Simple y suficiente para un solo
 * proceso; si se escala a múltiples instancias conviene un lock distribuido.
 */
export function startCampaignScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = async () => {
    try {
      const due = await db
        .select({ id: emailCampaigns.id })
        .from(emailCampaigns)
        .where(and(eq(emailCampaigns.status, 'scheduled'), lte(emailCampaigns.scheduledAt, new Date())));
      for (const c of due) {
        console.log(`[campaigns] scheduler dispara campaña ${c.id}`);
        launchCampaignSend(c.id);
      }
    } catch (e: any) {
      console.warn('[campaigns] scheduler tick error:', e?.message);
    }
  };
  setInterval(tick, 60_000);
  // Primer chequeo tras un pequeño delay para no competir con el arranque.
  setTimeout(tick, 15_000);
  console.log('[campaigns] scheduler iniciado (chequeo cada 60s)');
}
