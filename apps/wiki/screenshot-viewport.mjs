import pkg from '/home/ps/claude/yinjie-app/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

const OUT_DIR = process.env.SHOT_DIR || '/tmp/wiki-vp';
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.WIKI_BASE || 'http://127.0.0.1:5184';
const ADMIN_USERNAME = process.env.WIKI_ADMIN_USER || 'wiki_screenshot_admin';
const ADMIN_PASSWORD = process.env.WIKI_ADMIN_PASS || 'wiki-shot-1234';
const SAMPLE_CHARACTER_ID = process.env.SAMPLE_CHARACTER_ID || 'char-default-bar-expert';

const ROUTES = [
  '/',
  '/login',
  '/register',
  '/search?q=阿',
  `/character/${SAMPLE_CHARACTER_ID}`,
  '/recent-changes',
  '/watchlist',
  '/pending-reviews',
  '/admin/users',
  '/admin/blocks',
  '/admin/protection',
  '/admin/reports',
  '/admin/abuse-filters',
  '/admin/wiki-stats',
];

const res = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
});
if (!res.ok) throw new Error(`login failed (${res.status})`);
const session = await res.json();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ token, user }) => {
  try {
    window.localStorage.setItem('yinjie.wiki.token', token);
    window.localStorage.setItem('yinjie.wiki.user', JSON.stringify(user));
  } catch (e) {}
}, { token: session.token, user: session.user });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
});

for (const route of ROUTES) {
  const slug = route.replace(/[/?=&]/g, '_').replace(/^_/, '') || 'index';
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
