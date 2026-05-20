// Limitador de tasa en memoria, simple y sin dependencias.
// Suficiente como higiene para endpoints públicos (no es protección anti-DDoS).
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        hits.forEach((v, k) => {
          if (now > v.resetAt) hits.delete(k);
        });
      }
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  };
}
