// Server-side PDF rendering using headless Chromium (Puppeteer-core).
// Renders the shared HTML template into a real application/pdf binary.
// Uses the system-installed Chromium via PUPPETEER_EXECUTABLE_PATH (set in
// nixpacks.toml for Railway deploys, or auto-detected locally).

import puppeteer, { Browser } from 'puppeteer-core';
import { renderQuoteHtml } from '@shared/quote-pdf-template';

let browserPromise: Promise<Browser> | null = null;

function findChromiumExecutable(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  // Common paths for local development
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  // We don't actually check FS here (puppeteer.launch will error if wrong);
  // just pick the first as a hint. Production sets PUPPETEER_EXECUTABLE_PATH.
  return candidates[0];
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: findChromiumExecutable(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    }).catch((err) => {
      browserPromise = null; // Allow retry on next call
      throw err;
    });
  }
  return browserPromise;
}

export async function renderQuotePdf(quote: any, items: any[], logoUrl?: string | null): Promise<Buffer> {
  const html = renderQuoteHtml(quote, items, { logoUrl: logoUrl ?? null, autoPrint: false });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// Cleanup on process shutdown
process.on('SIGINT', async () => {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close();
  }
});
process.on('SIGTERM', async () => {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close();
  }
});
