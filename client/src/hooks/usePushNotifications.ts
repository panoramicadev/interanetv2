import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type PushStatus =
  | 'loading'           // detectando soporte / estado actual
  | 'unsupported'       // navegador sin soporte de Web Push
  | 'ios-needs-install' // iPhone/iPad: falta instalar la app en la pantalla de inicio
  | 'server-disabled'   // el servidor no tiene llaves VAPID configuradas
  | 'denied'            // el usuario bloqueó las notificaciones en el navegador
  | 'unsubscribed'      // soportado pero sin activar en este dispositivo
  | 'subscribed';       // notificaciones activas en este dispositivo

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isIOSDevice(): boolean {
  // iPadOS 13+ se reporta como Mac, pero con pantalla táctil
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

function hasPushSupport(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Maneja el ciclo de vida de la suscripción Web Push de este dispositivo.
 * En iOS requiere la app instalada en pantalla de inicio (iOS 16.4+).
 */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!hasPushSupport()) {
        // En Safari de iOS (pestaña normal) no existe PushManager: la app debe
        // instalarse en la pantalla de inicio para poder recibir push.
        setStatus(isIOSDevice() && !isStandalonePWA() ? 'ios-needs-install' : 'unsupported');
        return;
      }

      try {
        const res = await apiRequest('/api/push/vapid-public-key');
        const data = await res.json();
        if (cancelled) return;
        if (!data.enabled) {
          setStatus('server-disabled');
          return;
        }

        if (Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        setStatus(subscription ? 'subscribed' : 'unsubscribed');
      } catch {
        if (!cancelled) setStatus('unsupported');
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (isBusy) return false;
    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return false;
      }

      const res = await apiRequest('/api/push/vapid-public-key');
      const { enabled, publicKey } = await res.json();
      if (!enabled || !publicKey) {
        setStatus('server-disabled');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await apiRequest('/api/push/subscribe', {
        method: 'POST',
        data: subscription.toJSON(),
      });

      setStatus('subscribed');
      return true;
    } catch (error) {
      console.error('[push] Error al suscribir:', error);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isBusy]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (isBusy) return false;
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiRequest('/api/push/unsubscribe', {
          method: 'POST',
          data: { endpoint: subscription.endpoint },
        }).catch(() => {}); // si falla el server igual desuscribimos localmente
        await subscription.unsubscribe();
      }
      setStatus('unsubscribed');
      return true;
    } catch (error) {
      console.error('[push] Error al desuscribir:', error);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isBusy]);

  const sendTest = useCallback(async (): Promise<number> => {
    const res = await apiRequest('/api/push/test', { method: 'POST' });
    const data = await res.json();
    return data.sent ?? 0;
  }, []);

  return { status, isBusy, subscribe, unsubscribe, sendTest };
}
