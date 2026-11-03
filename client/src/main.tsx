import { createRoot } from "react-dom/client";
import "./index.css";

// tienda.pinturaspanoramica.cl carga solo el cotizador; el resto de los dominios, la intranet.
// Import dinámico para que cada uno descargue únicamente su propio código.
const esTienda = window.location.hostname.startsWith("tienda.");
const cargarApp = esTienda ? import("./TiendaApp") : import("./App");

cargarApp.then(({ default: Root }) => {
  createRoot(document.getElementById("root")!).render(<Root />);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado exitosamente:', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent('sw-update-available', { 
                  detail: { registration } 
                }));
              }
            });
          }
        });

        setInterval(() => {
          registration.update();
        }, 60000);
      })
      .catch((error) => {
        console.log('[PWA] Error al registrar Service Worker:', error);
      });
  });
}
