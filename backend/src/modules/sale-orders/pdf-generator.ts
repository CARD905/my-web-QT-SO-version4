import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

let browserPromise: Promise<Browser> | null = null;

/**
 * Singleton Puppeteer browser - reused across requests for performance
 */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });
    const b = await browserPromise;
    b.on('disconnected', () => {
      logger.warn('Puppeteer browser disconnected, will relaunch on next use');
      browserPromise = null;
    });
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
    await page.setContent(html, { waitUntil: 'networkidle0' });

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
