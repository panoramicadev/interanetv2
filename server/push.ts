import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, users } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { storage } from './storage';

/**
 * Servicio de notificaciones Web Push (PWA).
 *
 * Usa el estándar Web Push con llaves VAPID — no requiere cuenta de Apple ni
 * Firebase. Funciona en iOS 16.4+ SOLO si la app fue instalada en la pantalla
 * de inicio ("Añadir a pantalla de inicio" desde Safari).
 *
 * Config por variables de entorno:
 *   VAPID_PUBLIC_KEY  / VAPID_PRIVATE_KEY  (generar con: npx web-push generate-vapid-keys)
 *   VAPID_SUBJECT     (opcional, mailto: de contacto)
 * Si faltan las llaves, el servicio queda deshabilitado y la app funciona igual.
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contacto@pinturaspanoramica.cl';

let pushEnabled = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    pushEnabled = true;
    console.log('📲 Web Push habilitado (VAPID configurado)');
  } catch (error: any) {
    console.error('❌ Web Push deshabilitado — llaves VAPID inválidas:', error.message);
  }
} else {
  console.log('📴 Web Push deshabilitado — faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
}

export function isPushEnabled(): boolean {
  return pushEnabled;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: string; // 'baja' | 'media' | 'alta' | 'critica'
}

/**
 * Envía el payload a una suscripción. Si el endpoint ya no existe (usuario
 * revocó el permiso o desinstaló la PWA), elimina la fila para no reintentarla.
 */
async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      {
        TTL: 24 * 60 * 60, // si el dispositivo está offline, el push espera hasta 24h
        urgency: payload.priority === 'critica' || payload.priority === 'alta' ? 'high' : 'normal',
      },
    );
    return true;
  } catch (error: any) {
    const statusCode = error?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Suscripción muerta: limpiar
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
      console.log(`[push] Suscripción expirada eliminada (${sub.endpoint.slice(0, 60)}…)`);
    } else {
      console.error(`[push] Error enviando push (status ${statusCode}):`, error?.message);
    }
    return false;
  }
}

/** Envía una notificación push a todos los dispositivos de los usuarios dados. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!pushEnabled || userIds.length === 0) return 0;
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
  const results = await Promise.all(subs.map((sub) => sendToSubscription(sub, payload)));
  return results.filter(Boolean).length;
}

/** Envía una notificación push a todos los dispositivos suscritos. */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  if (!pushEnabled) return 0;
  const subs = await db.select().from(pushSubscriptions);
  const results = await Promise.all(subs.map((sub) => sendToSubscription(sub, payload)));
  return results.filter(Boolean).length;
}

// Roles con acceso al Panel de Trabajo (sidebar /tareas). Mantener en sync con
// client/src/config/sidebar-config.ts (entrada "Panel de Trabajo").
const PANEL_ROLES = ['admin', 'supervisor', 'encargado_area', 'salesperson', 'marketing'];

/**
 * Push a los usuarios que usan el Panel de Trabajo, excluyendo a los ids
 * dados (típicamente el autor del cambio y los asignados que ya reciben una
 * notificación personal). Con onlyUserIds el envío se limita además a esa
 * lista (audiencia del cambio: admins, el autor y su supervisor).
 */
export async function sendPushToPanelUsers(
  payload: PushPayload,
  excludeUserIds: string[] = [],
  onlyUserIds?: string[] | null,
): Promise<number> {
  if (!pushEnabled) return 0;
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      userId: pushSubscriptions.userId,
    })
    .from(pushSubscriptions)
    .innerJoin(users, eq(pushSubscriptions.userId, users.id))
    .where(inArray(users.role, PANEL_ROLES));

  const excluded = new Set(excludeUserIds);
  // onlyUserIds acota el envío a quienes pueden VER ese cambio en el panel
  // (mismo criterio que /api/panel-changes/summary): sin esto un vendedor
  // recibía el push de un cambio que después no aparece en su campana.
  const allowed = onlyUserIds ? new Set(onlyUserIds) : null;
  const targets = subs.filter(
    (sub) => !excluded.has(sub.userId) && (!allowed || allowed.has(sub.userId)),
  );
  const results = await Promise.all(targets.map((sub) => sendToSubscription(sub, payload)));
  return results.filter(Boolean).length;
}

/** Normaliza nombres de departamento: 'Producción' → 'produccion'. */
function normalizeDept(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Replica la lógica de visibilidad de getNotificationsForUser para decidir a
 * quién enviar el push de una notificación:
 *  - personal      → solo el usuario destino
 *  - general       → todos los suscritos
 *  - departamento  → usuarios cuyo rol mapea a ese departamento
 * Nunca lanza: el push es "mejor esfuerzo" y no debe romper la creación de la
 * notificación in-app.
 */
export async function sendPushForNotification(data: {
  targetType: string;
  targetUserId?: string | null;
  targetDepartment?: string | null;
  title: string;
  message: string;
  actionUrl?: string | null;
  priority?: string | null;
}): Promise<number> {
  if (!pushEnabled) return 0;
  try {
    const payload: PushPayload = {
      title: data.title,
      body: data.message,
      url: data.actionUrl || '/notificaciones',
      priority: data.priority || 'media',
    };

    if (data.targetType === 'personal') {
      if (!data.targetUserId) return 0;
      return await sendPushToUsers([data.targetUserId], payload);
    }

    if (data.targetType === 'general') {
      return await sendPushToAll(payload);
    }

    if (data.targetType === 'departamento' && data.targetDepartment) {
      // Los helpers históricos usan nombres con mayúsculas/acentos ('Producción');
      // el mapeo rol→departamentos usa claves normalizadas ('produccion').
      const target = normalizeDept(data.targetDepartment);
      const subsWithRole = await db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
          role: users.role,
        })
        .from(pushSubscriptions)
        .innerJoin(users, eq(pushSubscriptions.userId, users.id));

      const matching = subsWithRole.filter((sub) => {
        const departments = storage.getUserDepartments(sub.role || '');
        return departments.some((dept) => normalizeDept(dept) === target);
      });

      const results = await Promise.all(matching.map((sub) => sendToSubscription(sub, payload)));
      return results.filter(Boolean).length;
    }

    return 0;
  } catch (error: any) {
    console.error('[push] Error en sendPushForNotification:', error?.message);
    return 0;
  }
}
