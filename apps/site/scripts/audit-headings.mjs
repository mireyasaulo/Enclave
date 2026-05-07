#!/usr/bin/env node
/**
 * Audit heading hierarchy across the 16 site routes (4 locales × 4 paths).
 *
 * Rules (Google / WCAG aligned):
 *   - Each page must have exactly one <h1>.
 *   - Heading levels must not skip (H2 directly to H4 is a violation).
 *   - No empty headings.
 *
 * Usage:
 *   pnpm --filter @yinjie/site exec node scripts/audit-headings.mjs
 *   (assumes a server is already running; defaults to PORT=6183)
 */
const PORT = process.env.SITE_AUDIT_PORT || 6183;
const HOST = process.env.SITE_AUDIT_HOST || `http://127.0.0.1:${PORT}`;
const LOCALES = ["zh-CN", "en-US", "ja-JP", "ko-KR"];
const PATHS = ["", "download", "privacy", "terms"];

const HEADING_RE = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": "audit-headings" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function extractHeadings(html) {
  const out = [];
  for (const m of html.matchAll(HEADING_RE)) {
    const level = Number(m[1]);
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    out.push({ level, text });
  }
  return out;
}

function audit(headings) {
  const issues = [];
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) issues.push("missing H1");
  if (h1s.length > 1) issues.push(`${h1s.length} H1s (expected 1)`);
  let prev = 0;
  for (const h of headings) {
    if (h.level - prev > 1 && prev > 0) {
      issues.push(`level skip: H${prev} → H${h.level} ("${h.text.slice(0, 40)}")`);
    }
    if (!h.text) issues.push(`empty H${h.level}`);
    prev = Math.max(prev, h.level);
  }
  return issues;
}

let totalRoutes = 0;
let failed = 0;
for (const locale of LOCALES) {
  for (const path of PATHS) {
    const url = `${HOST}/${locale}${path ? `/${path}` : ""}`;
    totalRoutes++;
    try {
      const html = await fetchHtml(url);
      const headings = extractHeadings(html);
      const issues = audit(headings);
      const summary = headings
        .map((h) => `H${h.level}`)
        .join(" ");
      if (issues.length === 0) {
        console.log(`✓ ${url}\n    ${summary}`);
      } else {
        failed++;
        console.error(`✗ ${url}`);
        for (const i of issues) console.error(`    - ${i}`);
        console.error(`    ${summary}`);
      }
    } catch (e) {
      failed++;
      console.error(`✗ ${url}: ${e.message}`);
    }
  }
}

console.log(`\nDone: ${totalRoutes - failed}/${totalRoutes} routes pass`);
process.exit(failed > 0 ? 1 : 0);
