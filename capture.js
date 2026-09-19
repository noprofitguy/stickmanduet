import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

export const SOURCE_URL = 'https://sites.google.com/view/classroom6x/stickman-duel?pli=1&authuser=0';
export const CACHE_FILE = path.join(process.cwd(), 'data', 'cache.json');

async function findFullscreenButton(page) {
  for (const frame of page.frames()) {
    const button = frame.getByRole('button', { name: /fullscreen\s*\(alt\)/i }).first();
    if (await button.count() && await button.isVisible().catch(() => false)) {
      return button;
    }
  }
  return null;
}

async function findGameUrl(popup) {
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(4000);

  const ignoredHosts = /(?:imasdk|doubleclick|googlesyndication|googleadservices|googleapis|gstatic|accounts\.google)/i;
  for (const frame of popup.frames().reverse()) {
    const frameUrl = frame.url();
    if (frameUrl.startsWith('http') && !ignoredHosts.test(frameUrl)) return frameUrl;
  }

  for (const frame of popup.frames()) {
    const iframes = frame.locator('iframe[src]');
    for (let index = 0; index < await iframes.count(); index += 1) {
      const src = await iframes.nth(index).getAttribute('src');
      if (src && !src.startsWith('about:') && !src.startsWith('blob:') && !ignoredHosts.test(src)) {
        return new URL(src, SOURCE_URL).href;
      }
    }
  }

  return popup.url().startsWith('http') ? popup.url() : null;
}

async function findSourceGameUrl(page) {
  const html = await page.content();
  const match = html.match(/googleScriptUrl=(?:&quot;|")([^&"]+)(?:&quot;|")/i);
  return match ? match[1] : null;
}

export async function captureGameUrl() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    const button = await findFullscreenButton(page);
    if (!button) throw new Error('Could not find FULLSCREEN (Alt) inside the embedded page.');

    const popupPromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
    await button.click({ timeout: 15000 });
    const popup = await popupPromise;
    const gameUrl = (popup ? await findGameUrl(popup) : null) || await findSourceGameUrl(page);
    if (!gameUrl) {
      throw new Error('Fullscreen opened, but no playable game URL was found.');
    }

    const cache = { sourceUrl: SOURCE_URL, gameUrl, capturedAt: new Date().toISOString() };
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
    return cache;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  captureGameUrl()
    .then((cache) => console.log(`Captured ${cache.gameUrl}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}