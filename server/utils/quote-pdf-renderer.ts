// Server-side PDF rendering using headless Chromium via puppeteer-core +
// @sparticuz/chromium. The Chromium binary ships INSIDE @sparticuz/chromium
// (~50MB), so it works on any container without needing the OS to provide
// chromium or its libs (Railway, Vercel, AWS Lambda, etc.).
//
// Local dev (Mac/Linux): if @sparticuz fails (it expects Linux), falls back
// to PUPPETEER_EXECUTABLE_PATH or system Chrome.

import puppeteer, { Browser } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { renderQuoteHtml, type QuotePdfOptions } from '@shared/quote-pdf-template';

let browserPromise: Promise<Browser> | null = null;

async function findExecutablePath(): Promise<string> {
  // 1. Explicit override
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. @sparticuz/chromium (works on Linux containers — Railway, Vercel, Lambda)
  if (process.platform === 'linux') {
    try {
      const { default: chromium } = await import('@sparticuz/chromium');
      const path = await chromium.executablePath();
      if (path && existsSync(path)) {
        console.log(`[pdf-renderer] Using @sparticuz/chromium: ${path}`);
        return path;
      }
    } catch (err) {
      console.warn('[pdf-renderer] @sparticuz/chromium not available:', (err as Error).message);
    }
  }

  // 3. Local dev fallbacks
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const found = execSync(`which ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (found && existsSync(found)) return found;
    } catch { /* not in PATH */ }
  }
  for (const path of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]) {
    if (existsSync(path)) return path;
  }

  throw new Error(
    'Chromium not found. @sparticuz/chromium failed to provide a binary, and no system Chrome was detected.'
  );
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const executablePath = await findExecutablePath();
      console.log(`[pdf-renderer] Launching Chromium from ${executablePath}`);

      // Use sparticuz args when on Linux container, otherwise minimal args.
      let args: string[] = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ];
      if (process.platform === 'linux') {
        try {
          const { default: chromium } = await import('@sparticuz/chromium');
          args = chromium.args;
        } catch { /* keep defaults */ }
      }

      return puppeteer.launch({ headless: true, executablePath, args });
    })().catch((err) => {
      browserPromise = null;
      console.error('[pdf-renderer] Failed to launch Chromium:', err);
      throw err;
    });
  }
  return browserPromise;
}

export async function renderQuotePdf(
  quote: any,
  items: any[],
  logoUrl?: string | null,
  pdfOptions?: Omit<QuotePdfOptions, 'logoUrl' | 'autoPrint'>,
): Promise<Buffer> {
  const html = renderQuoteHtml(quote, items, { logoUrl: logoUrl ?? null, autoPrint: false, ...pdfOptions });

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
