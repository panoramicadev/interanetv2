/**
 * Asistente de Woob — firma del token de sesión
 * ---------------------------------------------------------------
 * Woob sirve su asistente como un widget que se monta en un iframe. Para que
 * dibuje algo necesita un token corto, firmado por nosotros, que le diga con
 * qué usuario de la intranet está hablando: sin token no aparece nada.
 *
 * El secreto vive solo acá, en el servidor de Express. Al navegador baja
 * únicamente el token ya firmado, que además dura 30 minutos (Woob rechaza
 * cualquiera más viejo que eso, por `iat`), así que se pide de nuevo cada vez
 * que se carga la pantalla y no se guarda en ninguna parte.
 *
 * Si `WOOB_ASISTENTE_SECRET` no está puesta, el endpoint responde 503 y el
 * widget simplemente no se monta: no es una falla que le importe al usuario ni
 * rompe nada más de la intranet.
 *
 * No toca la base de datos: acá no se guarda nada.
 */

import type { Express } from "express";
import { createHmac } from "node:crypto";
import { requireAuth, requireRoles } from "./auth";

/** El proyecto de la intranet dentro de Woob. */
const PROYECTO_WOOB = 38;

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/**
 * Arma el JWT HS256 a mano —no hace falta una dependencia nueva para tres
 * concatenaciones y un HMAC—. Devuelve `null` cuando no hay secreto
 * configurado.
 */
export function firmarTokenWoob(u: { nombre: string; email: string }): string | null {
  const secreto = process.env.WOOB_ASISTENTE_SECRET?.trim();
  if (!secreto) return null;

  const head = b64({ alg: "HS256", typ: "JWT" });
  // `iat` es obligatorio: Woob rechaza el token pasados 30 minutos.
  const body = b64({
    proyecto: PROYECTO_WOOB,
    nombre: u.nombre,
    email: u.email,
    iat: Math.floor(Date.now() / 1000),
  });
  const firma = createHmac("sha256", secreto).update(`${head}.${body}`).digest("base64url");

  return `${head}.${body}.${firma}`;
}

export function registerWoobAsistenteRoutes(app: Express) {
  app.get("/api/woob-asistente/token", requireAuth, requireRoles(["admin"]), (req: any, res: any) => {
    const u = req.user!;
    // El nombre es solo para que el asistente sepa a quién le habla: se usa el
    // del vendedor si lo tiene, si no el nombre del perfil, y en última
    // instancia el correo, que siempre está.
    const nombre =
      u.salespersonName ||
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.email;

    const token = firmarTokenWoob({ nombre, email: u.email });
    if (!token) return res.status(503).json({ error: "Asistente no configurado" });

    res.json({ token });
  });
}
