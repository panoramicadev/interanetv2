import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent<{ registration: ServiceWorkerRegistration }>;
      setRegistration(customEvent.detail.registration);
      setShowUpdate(true);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div 
      className="fixed top-4 right-4 max-w-sm md:max-w-md z-50 bg-orange-500 text-white rounded-lg shadow-lg p-4 animate-in slide-in-from-top-5"
      data-testid="notification-update"
    >
      <div className="flex items-start gap-3">
        <RefreshCw className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Nueva versión disponible</h3>
          <p className="text-sm text-white/90 mb-3">
            Hay una actualización lista para instalar. Haz clic en actualizar para obtener las últimas mejoras.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleUpdate}
              size="sm"
              className="bg-white text-orange-600 hover:bg-white/90"
              data-testid="button-update-app"
            >
              Actualizar ahora
            </Button>
            <Button
              onClick={() => setShowUpdate(false)}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20"
              data-testid="button-dismiss-update"
            >
              Más tarde
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
