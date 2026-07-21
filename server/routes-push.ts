import type { Express } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth';
import { db } from './db';
import { pushSubscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { isPushEnabled, getVapidPublicKey, sendPushToUsers } from './push';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/**
 * Endpoints de Web Push (PWA). Montados en server/index.ts junto a las rutas B2C.
 */
export function registerPushRoutes(app: Express) {
  // Llave pública VAPID para que el cliente se suscriba
  app.get('/api/push/vapid-public-key', requireAuth, (_req, res) => {
    res.json({
      enabled: isPushEnabled(),
      publicKey: isPushEnabled() ? getVapidPublicKey() : null,
    });
  });

  // Registrar (o reasignar) la suscripción del dispositivo actual
  app.post('/api/push/subscribe', requireAuth, async (req: any, res) => {
    try {
      const parsed = subscribeSchema.parse(req.body);
      await db
        .insert(pushSubscriptions)
        .values({
          userId: req.user.id,
          endpoint: parsed.endpoint,
          p256dh: parsed.keys.p256dh,
          auth: parsed.keys.auth,
          userAgent: req.headers['user-agent'] || null,
          lastUsedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: req.user.id,
            p256dh: parsed.keys.p256dh,
            auth: parsed.keys.auth,
            userAgent: req.headers['user-agent'] || null,
            lastUsedAt: new Date(),
          },
        });
      res.status(201).json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Suscripción inválida' });
      }
      console.error('[push] Error guardando suscripción:', error.message);
      res.status(500).json({ message: 'Error guardando la suscripción' });
    }
  });

  // Eliminar la suscripción del dispositivo actual
  app.post('/api/push/unsubscribe', requireAuth, async (req: any, res) => {
    try {
      const parsed = unsubscribeSchema.parse(req.body);
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, parsed.endpoint));
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Endpoint inválido' });
      }
      console.error('[push] Error eliminando suscripción:', error.message);
      res.status(500).json({ message: 'Error eliminando la suscripción' });
    }
  });

  // Enviar una notificación de prueba a los dispositivos del usuario actual
  app.post('/api/push/test', requireAuth, async (req: any, res) => {
    try {
      if (!isPushEnabled()) {
        return res.status(503).json({ message: 'Web Push no está configurado en el servidor' });
      }
      const sent = await sendPushToUsers([req.user.id], {
        title: '🔔 Notificación de prueba',
        body: 'Las notificaciones push de Panorámica están funcionando en este dispositivo.',
        url: '/notificaciones',
        priority: 'media',
      });
      res.json({ sent });
    } catch (error: any) {
      console.error('[push] Error enviando prueba:', error.message);
      res.status(500).json({ message: 'Error enviando la notificación de prueba' });
    }
  });
}
