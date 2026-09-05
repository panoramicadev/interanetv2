/**
 * Mención del asistente IA en los chats del Panel de Trabajo.
 *
 * Fuente única de la convención: el cliente la usa para pintar el chip del
 * composer y para disparar la respuesta, y el servidor para validar antes de
 * gastar tokens. Si cambia acá, cambia en los dos lados.
 */

/** Autor de los mensajes del asistente en task_comments (no es un usuario real). */
export const IA_AUTHOR_ID = "ia-panoramica";

/** Nombre con el que firma el asistente en el hilo. */
export const IA_AUTHOR_NAME = "Panorámica AI";

/** Cómo se lo nombra en el chat (lo que inserta el botón del composer). */
export const IA_MENTION = "@IA";

// @IA / @ia / @asistente, sin importar mayúsculas. El lookbehind no se usa
// (Safari viejo no lo soporta): alcanza con exigir que arranque en @.
const MENTION_RE = /@(ia|asistente)\b/i;

/** ¿El mensaje llama al asistente? */
export function mencionaIA(texto: string | null | undefined): boolean {
  return !!texto && MENTION_RE.test(texto);
}

/** El mensaje sin la mención, para mandarle al modelo solo la pregunta. */
export function limpiarMencionIA(texto: string): string {
  return texto
    .replace(new RegExp(MENTION_RE.source, "gi"), " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** ¿Este mensaje del hilo lo escribió el asistente? */
export function esMensajeDeIA(authorId: string | null | undefined): boolean {
  return authorId === IA_AUTHOR_ID;
}
