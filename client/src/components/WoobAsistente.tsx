import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Asistente de Woob — la burbuja de abajo a la derecha.
 *
 * Woob entrega el asistente como un script que se inyecta en el `body` y se
 * dibuja solo. Lo único que necesita de nosotros es un token firmado por el
 * servidor con el usuario que ya tiene sesión acá (ver `server/woob-asistente.ts`):
 * sin token no dibuja nada.
 *
 * Tres decisiones que conviene tener presentes:
 *
 *  1. Es solo para `admin`. Con cualquier otro rol el componente no hace nada
 *     —ni siquiera pide el token— y el endpoint igual responde 403.
 *  2. El token dura 30 minutos y no se guarda: se pide al montar. Como el
 *     script se inserta una sola vez por carga de página, no hace falta
 *     renovarlo mientras el usuario navega (la intranet es una SPA).
 *  3. Si el endpoint responde 401/403/503 —o si no hay secreto configurado en
 *     el servidor— no se muestra ningún error: que no haya asistente no es una
 *     falla que le importe al usuario.
 */
export function WoobAsistente() {
  const { user } = useAuth();
  const esAdmin = (user as any)?.role === "admin";

  useEffect(() => {
    if (!esAdmin) return;
    // El script de Woob se protege solo con `window.__woobAsistente`, pero de
    // todos modos no lo insertamos dos veces: en un re-render ya está puesto.
    if (document.getElementById("woob-asistente")) return;

    let cancelado = false;

    (async () => {
      try {
        const res = await fetch("/api/woob-asistente/token", { credentials: "include" });
        if (!res.ok) return; // 401 / 403 / 503: sin asistente, y en silencio.

        const { token } = await res.json();
        if (!token || cancelado) return;
        if (document.getElementById("woob-asistente")) return;

        const script = document.createElement("script");
        script.id = "woob-asistente";
        script.src = "https://woob.cl/asistente.js";
        script.dataset.token = token;
        script.defer = true;
        document.body.appendChild(script);
      } catch {
        // Red caída o respuesta rara: tampoco es algo que el usuario deba ver.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [esAdmin]);

  return null;
}

export default WoobAsistente;
