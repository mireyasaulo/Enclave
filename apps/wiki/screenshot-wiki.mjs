import pkg from '/home/ps/claude/yinjie-app/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

const OUT_DIR = process.env.SHOT_DIR || '/tmp/wiki-shots';
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.WIKI_BASE || 'http://127.0.0.1:5184';
const ADMIN_USERNAME = process.env.WIKI_ADMIN_USER || 'wiki_screenshot_admin';
const ADMIN_PASSWORD = process.env.WIKI_ADMIN_PASS || 'wiki-shot-1234';
const SAMPLE_CHARACTER_ID = process.env.SAMPLE_CHARACTER_ID || 'char-default-bar-expert';

const VIEWPORTS = (process.env.VIEWPORTS || 'desktop,narrow,mobile').split(',');
const VIEWPORT_PRESETS = {
  desktop: { width: 1440, height: 900 },
  narrow: { width: 1024, height: 768 },
  mobile: { width: 414, height: 896 },
};

const ROUTES = (process.env.ROUTES || [
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
  '/create',
].join(',')).split(',');

async function loginAndGetSession() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed (${res.status}): ${await res.text()}`);
  return res.json();
}

const session = await loginAndGetSession();
console.log(`logged in as ${session.user.username} (${session.user.role})`);

const browser = await chromium.launch({ headless: true });

for (const vpName of VIEWPORTS) {
  const viewport = VIEWPORT_PRESETS[vpName];
  if (!viewport) {
    console.warn('unknown viewport', vpName);
    continue;
  }
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(({ token, user }) => {
    try {
      window.localStorage.setItem('yinjie.wiki.token', token);
      window.localStorage.setItem('yinjie.wiki.user', JSON.stringify(user));
    } catch (e) {}
  }, { token: session.token, user: session.user });

  const page = await context.newPage();

  const pageMessages = [];
  page.on('console', (msg) => pageMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageMessages.push(`[pageerror] ${err.message}`));

  for (const route of ROUTES) {
    const slug = route.replace(/[/?=&]/g, '_').replace(/^_/, '') || 'index';
    const file = `${OUT_DIR}/${vpName}_${slug}.png`;
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
