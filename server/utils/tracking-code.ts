import { customAlphabet } from 'nanoid';

// Alfabeto sin caracteres ambiguos (sin 0/O/1/I/L) para que sea fácil de leer y dictar.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const nano = customAlphabet(ALPHABET, 10);

const PREFIX = 'PM-'; // Panorámica Market

/** Genera un código de seguimiento opaco, p.ej. "PM-7K2QD9XR4T". */
export function generateTrackingCode(): string {
  return PREFIX + nano();
}

/** Normaliza la entrada del usuario (mayúsculas, sin espacios) para buscar por código. */
export function normalizeTrackingCode(input: string): string {
  return (input || '').trim().toUpperCase().replace(/\s+/g, '');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True si la entrada es un UUID de pedido (también aceptado como identificador). */
export function looksLikeUuid(input: string): boolean {
  return UUID_RE.test((input || '').trim());
}
