import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs/promises';
import path from 'path';
import { env, isProd } from '../../config/env';
import { logger } from '../../utils/logger';

let browserPromise: Promise<Browser> | null = null;

/**
 * Singleton browser - reused across requests for performance.
 * Uses @sparticuz/chromium on production (lightweight ~50MB,
 * works on Render Free plan with 512MB RAM).
 * Falls back to local Chrome on dev.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      if (isProd) {
        // Production: use bundled lightweight Chromium
        const executablePath = await chromium.executablePath();
        return puppeteer.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        });
      } else {
        // Development: try to find local Chrome/Chromium
        const localPath =
          process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : process.platform === 'darwin'
              ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
              : '/usr/bin/google-chrome';

        return puppeteer.launch({
          headless: true,
          executablePath: localPath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        });
      }
    })();

    const b = await browserPromise;
    b.on('disconnected', () => {
      logger.warn('Puppeteer browser disconnected, will relaunch on next use');
      browserPromise = null;
    });
    return b;
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

/**
 * Generate PDF from HTML, save to disk, return file path
 */
export async function generatePdfFromHtml(
  html: string,
  fileName: string,
): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Ensure web fonts loaded (Sarabun)
    await page.evaluateHandle('document.fonts.ready');

    const outputDir = env.PDF_OUTPUT_DIR;
    await fs.mkdir(outputDir, { recursive: true });

    const filePath = path.join(outputDir, fileName);
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    return filePath;
  } finally {
    await page.close();
  }
}