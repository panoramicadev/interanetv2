/**
 * Coincidencia difusa de texto para tolerar errores de tipeo y de
 * reconocimiento de voz al resolver consultas libres (ej: producto dictado
 * "stein" cuando el catálogo dice "stain").
 *
 * Estrategia: similitud por token basada en distancia de edición (Levenshtein)
 * sobre texto normalizado. Cada token de la consulta se puntúa contra su mejor
 * token coincidente del candidato, y el puntaje final es el promedio de esas
 * mejores similitudes. Se eligió Levenshtein en lugar de trigramas porque una
 * sustitución de un carácter ("stein"->"stain") casi no comparte trigramas pero
 * tiene distancia de edición 1.
 */

/** minúsculas + sin acentos/diacríticos + sin puntuación + espacios colapsados. */
export function normalizeText(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  const norm = normalizeText(input);
  return norm.length ? norm.split(" ") : [];
}

/** Distancia de edición de Levenshtein entre dos strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // borrado
        curr[j - 1] + 1, // inserción
        prev[j - 1] + cost, // sustitución
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lb];
}

/** Similitud 0..1 derivada de la distancia de edición (1 = idénticos). */
export function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Puntúa qué tan bien una consulta libre coincide con un texto candidato (0..1).
 * Promedia, por cada token de la consulta, la mejor similitud contra cualquier
 * token del candidato. Un token de la consulta contenido en (o que contiene a)
 * un token del candidato puntúa 1, pero solo para tokens de 3+ caracteres para
 * evitar falsos positivos con palabras cortas.
 */
export function fuzzyScore(query: string, candidate: string): number {
  const qTokens = tokenize(query);
  const cTokens = tokenize(candidate);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  let total = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const ct of cTokens) {
      let sim: number;
      if (ct === qt) {
        sim = 1;
      } else if (qt.length >= 3 && ct.length >= 3 && (ct.includes(qt) || qt.includes(ct))) {
        sim = 1;
      } else {
        sim = similarityRatio(qt, ct);
      }
      if (sim > best) best = sim;
      if (best >= 1) break;
    }
    total += best;
  }
  return total / qTokens.length;
}

export interface FuzzyRankOptions {
  /** Puntaje mínimo 0..1 para considerarse coincidencia. Default 0.7. */
  threshold?: number;
  /** Máximo de resultados a devolver. Default 8. */
  limit?: number;
}

/**
 * Ordena candidatos por similitud difusa con la consulta. `getText` extrae el
 * texto buscable de cada candidato. Devuelve los candidatos que superan el
 * umbral, del mejor puntaje al peor.
 */
export function fuzzyRank<T>(
  query: string,
  candidates: T[],
  getText: (c: T) => string,
  options: FuzzyRankOptions = {},
): T[] {
  const threshold = options.threshold ?? 0.7;
  const limit = options.limit ?? 8;
  if (!normalizeText(query)) return [];

  const scored: Array<{ item: T; score: number }> = [];
  for (const item of candidates) {
    const score = fuzzyScore(query, getText(item));
    if (score >= threshold) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
