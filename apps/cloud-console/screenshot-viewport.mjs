import pkg from '/home/ps/claude/yinjie-app/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

const OUT_DIR = '/tmp/cloud-console-vp';
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://127.0.0.1:5182';
const ADMIN_SECRET = 'cloud-admin-secret';

const ROUTES = [
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
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((secret) => {
  try { window.localStorage.setItem('yinjie_cloud_admin_secret', secret); } catch (e) {}
}, ADMIN_SECRET);
const page = await context.newPage();

const errors = [];
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
});

for (const route of ROUTES) {
  const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'index';
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) { console.log(`[goto ${route}]`, e.message); }
  await page.waitForTimeout(1500);
  const file = `${OUT_DIR}/${slug}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`shot ${route}`);
}

console.log('==ERRORS==');
console.log(errors.join('\n'));
await browser.close();
