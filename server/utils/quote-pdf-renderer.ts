// Server-side PDF rendering using headless Chromium (Puppeteer-core).
// Renders the shared HTML template into a real application/pdf binary.
// Resolves the Chromium binary at runtime: env var → which chromium → known paths.

import puppeteer, { Browser } from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { renderQuoteHtml } from '@shared/quote-pdf-template';

let browserPromise: Promise<Browser> | null = null;
let resolvedExecutablePath: string | null = null;

function findChromiumExecutable(): string {
  if (resolvedExecutablePath) return resolvedExecutablePath;

  // 1. Explicit env var wins.
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    resolvedExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`[pdf-renderer] Using Chromium from PUPPETEER_EXECUTABLE_PATH: ${resolvedExecutablePath}`);
    return resolvedExecutablePath;
  }

  // 2. Try `which` for binaries in PATH (works on Railway/nixpacks).
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const found = execSync(`which ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (found && existsSync(found)) {
        resolvedExecutablePath = found;
        console.log(`[pdf-renderer] Found Chromium via which: ${resolvedExecutablePath}`);
        return resolvedExecutablePath;
      }
    } catch { /* not found, continue */ }
  }

  // 3. Try common absolute paths (Linux containers + Mac dev).
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      resolvedExecutablePath = path;
      console.log(`[pdf-renderer] Found Chromium at: ${resolvedExecutablePath}`);
      return resolvedExecutablePath;
    }
  }

  throw new Error(
    'Chromium not found. Install chromium (nixpacks: nixPkgs = ["chromium"]) or set PUPPETEER_EXECUTABLE_PATH to its absolute path.'
  );
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = findChromiumExecutable();
    console.log(`[pdf-renderer] Launching Chromium from ${executablePath}`);
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath,
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
      console.error('[pdf-renderer] Failed to launch Chromium:', err);
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
