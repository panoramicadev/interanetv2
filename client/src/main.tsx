import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado exitosamente:', registration.scope);
        
        // Auto-reload on new service worker activation
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            console.log('[PWA] New service worker activated - Auto-reloading...');
            refreshing = true;
            window.location.reload();
          }
        });
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version detected - Activating immediately...');
                // Auto-activate the new service worker
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                // Note: Page will auto-reload via controllerchange listener above
              }
            });
          }
        });

        // Check for updates every minute
        setInterval(() => {
          registration.update();
        }, 60000);
      })
      .catch((error) => {
        console.log('[PWA] Error al registrar Service Worker:', error);
      });
  });
}
