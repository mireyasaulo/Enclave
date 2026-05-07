import pkg from '/home/ps/claude/yinjie-app/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

const OUT_DIR = process.env.SHOT_DIR || '/tmp/wiki-vp';
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.WIKI_BASE || 'http://127.0.0.1:5184';
const ADMIN_USERNAME = process.env.WIKI_ADMIN_USER || 'wiki_screenshot_admin';
const ADMIN_PASSWORD = process.env.WIKI_ADMIN_PASS || 'wiki-shot-1234';
const SAMPLE_CHARACTER_ID = process.env.SAMPLE_CHARACTER_ID || 'char-default-bar-expert';

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

const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('[err] ' + m.text()); });

await page.goto(`${BASE}/character/${SAMPLE_CHARACTER_ID}`, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('goto', e.message));
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/character-detail.png`, fullPage: false });
await page.screenshot({ path: `${OUT_DIR}/character-detail-full.png`, fullPage: true });

// edit tab
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const editBtn = buttons.find(b => /编辑|Edit/i.test(b.textContent || ''));
  if (editBtn) editBtn.click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/character-edit-full.png`, fullPage: true });

// history tab
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const histBtn = buttons.find(b => /历史|History/i.test(b.textContent || ''));
  if (histBtn) histBtn.click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/character-history-full.png`, fullPage: true });

// talk tab
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const talkBtn = buttons.find(b => /讨论|Talk/i.test(b.textContent || ''));
  if (talkBtn) talkBtn.click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/character-talk-full.png`, fullPage: true });

console.log('errs:', errs.join('\n'));
await browser.close();
