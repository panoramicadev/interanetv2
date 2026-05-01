// HMAC-signed short-lived URLs for public PDF download.
// Avoids exposing the API key in the link while keeping the URL stateless
// (no DB table needed — the signature carries quote id + expiry).

import crypto from 'node:crypto';

function getSecret(): string {
  // Reuse SESSION_SECRET if available (already configured on the server).
  return (
    process.env.PDF_URL_SECRET ||
    process.env.SESSION_SECRET ||
    'panoramica-default-pdf-secret-change-in-production'
  );
}

export interface PdfTokenPayload {
  q: string; // quote id
  e: number; // expiry timestamp (ms)
}

export function signPdfToken(quoteId: string, ttlMs = 60 * 60 * 1000): string {
  const payload: PdfTokenPayload = { q: quoteId, e: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

export function verifyPdfToken(token: string): PdfTokenPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;

    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(data)
      .digest('base64url');

    // Constant-time comparison
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as PdfTokenPayload;
    if (typeof payload.q !== 'string' || typeof payload.e !== 'number') return null;
    if (payload.e < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
