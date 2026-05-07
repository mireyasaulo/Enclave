import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = process.env.SHOT_DIR || join(tmpdir(), 'cloud-console-vp');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://127.0.0.1:5182';
const ADMIN_SECRET = 'cloud-admin-secret';
const WORLD_ID = '29805eaf-f269-490f-9713-201a849e228a';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((s) => { try { localStorage.setItem('yinjie_cloud_admin_secret', s); } catch(e){} }, ADMIN_SECRET);
const page = await context.newPage();

const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
page.on('console', m => { if (m.type()==='error') errs.push('[err] ' + m.text()); });

await page.goto(`${BASE}/worlds/${WORLD_ID}`, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('goto', e.message));
await page.waitForTimeout(2000);
await page.screenshot({ path: join(OUT_DIR, 'world-detail.png'), fullPage: false });
await page.screenshot({ path: join(OUT_DIR, 'world-detail-full.png'), fullPage: true });

// also user detail
await page.goto(`${BASE}/users`, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('goto', e.message));
await page.waitForTimeout(1000);
const firstUserPhone = await page.evaluate(() => {
  const a = document.querySelector('a[href*="/users/"]');
  return a ? a.href : null;
});
if (firstUserPhone) {
  await page.goto(firstUserPhone, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('goto-user', e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT_DIR, 'user-detail.png'), fullPage: false });
  await page.screenshot({ path: join(OUT_DIR, 'user-detail-full.png'), fullPage: true });
}

console.log('errs:', errs.join('\n'));
await browser.close();
