import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = process.env.SHOT_DIR || join(tmpdir(), 'cloud-console-shots');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://127.0.0.1:5182';
const ADMIN_SECRET = 'cloud-admin-secret';

// width 1440 x height 900 = typical laptop
const VIEWPORTS = (process.env.VIEWPORTS || 'desktop,narrow').split(',');
const VIEWPORT_PRESETS = {
  desktop: { width: 1440, height: 900 },
  narrow: { width: 1024, height: 768 },
  mobile: { width: 414, height: 896 },
};

const ROUTES = (process.env.ROUTES || [
  '/',
  '/worlds',
  '/jobs',
  '/sessions',
  '/waiting-sync',
  '/users',
  '/subscription-plans',
  '/configs',
  '/invite-audit',
  '/feedbacks',
  '/revenue-sharing',
].join(',')).split(',');

const browser = await chromium.launch({ headless: true });

for (const vpName of VIEWPORTS) {
  const viewport = VIEWPORT_PRESETS[vpName];
  if (!viewport) {
    console.warn('unknown viewport', vpName);
    continue;
  }
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  // pre-seed admin secret via localStorage
  await context.addInitScript((secret) => {
    try {
      window.localStorage.setItem('yinjie_cloud_admin_secret', secret);
    } catch (e) {}
  }, ADMIN_SECRET);

  const page = await context.newPage();

  const pageMessages = [];
  page.on('console', (msg) => pageMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageMessages.push(`[pageerror] ${err.message}`));

  for (const route of ROUTES) {
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'index';
    const file = join(OUT_DIR, `${vpName}_${slug}.png`);
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      console.log(`[goto ${route}] err:`, e.message);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`==SHOT== ${vpName} ${route} -> ${file}`);
  }

  console.log(`==CONSOLE [${vpName}]==`);
  console.log(pageMessages.slice(0, 80).join('\n'));
  await context.close();
}

await browser.close();
console.log('done');
