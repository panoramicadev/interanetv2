/**
 * Puente del asistente (MCP) a módulos de la intranet
 * ---------------------------------------------------------------
 * Algunos módulos tienen reglas finas que dependen de quién es la persona:
 * quién ve qué solicitud de muestra, quién la aprueba, quién la deja lista o
 * la cierra, quién edita una solicitud de crédito ya enviada, qué roles ven el
 * detalle de facturación... Copiar esas reglas en la API externa haría que
 * tarde o temprano se desfasaran.
 *
 * En vez de copiarlas, el asistente usa las mismas rutas de la intranet con la
 * cuenta de quien lo conectó: se arma la misma cuenta que arma el inicio de
 * sesión (passport.deserializeUser en server/auth.ts) y se pasa por un router
 * aparte donde están registrados esos módulos. Así el asistente ve y hace
 * exactamente lo que esa persona ve y hace en la intranet, ni más ni menos.
 *
 * Solo sirve con un usuario conectado por OAuth (las API keys compartidas no
 * son una persona). Un token de solo lectura (scope sin mcp:write) solo puede
 * consultar.
 *
 * Se publica en /api/external/intranet/<ruta de la intranet sin /api>, p. ej.
 *   GET  /api/external/intranet/solicitudes-muestra
 *   POST /api/external/intranet/solicitudes-muestra/:id/lista
 */
import express from 'express';
import type { Response, NextFunction } from 'express';
import { storage } from './storage';
import type { ApiAuthRequest } from './middleware/api-auth';

const puente = express.Router();
let armado: Promise<void> | null = null;

/** Los módulos que el asistente usa tal cual los usa la intranet. */
function armarPuente(): Promise<void> {
  if (!armado) {
    armado = (async () => {
      const r = puente as any;
      const { registerSolicitudesMuestraRoutes } = await import('./routes-solicitudes-muestra');
      registerSolicitudesMuestraRoutes(r);
      const { registerSolicitudesCreditoRoutes } = await import('./routes-solicitudes-credito');
      registerSolicitudesCreditoRoutes(r);
      const { registerNuevoClienteRoutes } = await import('./routes-nuevo-cliente');
      registerNuevoClienteRoutes(r);
      const { registerDetalleFacturacionRoutes } = await import('./routes-detalle-facturacion');
      registerDetalleFacturacionRoutes(r);
      const { registerTintometriaRoutes } = await import('./routes-tintometria');
      registerTintometriaRoutes(r);
    })().catch((error) => {
      armado = null; // se reintenta en la próxima llamada
      throw error;
    });
  }
  return armado;
}

/** La misma cuenta que arma passport al iniciar sesión (server/auth.ts). */
async function cuentaDeSesion(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;
  return {
    ...user,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    profileImageUrl: user.profileImageUrl || undefined,
    salespersonName: (user as any).salespersonName || undefined,
    publicSlug: (user as any).publicSlug || undefined,
    role: user.role || 'user',
  };
}

export async function usarPuenteIntranet(req: ApiAuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.oauthUser) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Estos módulos funcionan con la cuenta de una persona: conecta el asistente con tu usuario (OAuth).',
      });
    }
    if (req.method !== 'GET' && req.apiKey?.role === 'readonly') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tu conexión del asistente es de solo lectura (sin permiso mcp:write).',
      });
    }

    const cuenta = await cuentaDeSesion(req.oauthUser.userId);
    if (!cuenta) return res.status(401).json({ error: 'Unauthorized', message: 'Tu usuario ya no existe en la intranet.' });

    await armarPuente();

    const r = req as any;
    r.user = cuenta;
    r.isAuthenticated = () => true;
    // Montado en /intranet: lo que queda de la ruta es la de la intranet sin /api.
    req.url = `/api${req.url}`;

    puente(req, res, (err?: any) => {
      if (err) return next(err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'Not Found', message: 'Esa ruta no está disponible para el asistente.' });
      }
    });
  } catch (error) {
    console.error('[puente-intranet-mcp] error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
}
