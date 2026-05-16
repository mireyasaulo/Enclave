// 多语言走查：对每个 mobile route × 每个非中文 locale 真打开页面，
// 取 body.innerText，按"出现了简体中文专属字符"判定有未翻译漏出。
//
// 用法：
//   node apps/app/scripts/walkthrough-mobile-i18n.mjs [--locale ja-JP,ko-KR,en-US]
//     [--route /tabs/chat,...] [--out logs/i18n-walkthrough]
//
// 退出码：发现 leak 时 1，否则 0。

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  appDir,
  extendedRoutePaths,
  installApiMocks,
  resolveAuditServer,
  routeIdleTimeoutMs,
  routeSettleMs,
  runtimeConfigTemplate,
  seedAuditLocalStorage,
  shouldIgnoreConsoleError,
  systemStatus,
} from "./lib/mobile-audit-fixtures.mjs";

const repoRoot = resolve(appDir, "..", "..");

// 简体中文专属字符（日语 kanji 不使用 / 用其它写法的简体字）。
// 命中说明文本是从 zh-CN 漏出来的，不是 ja-JP 偶然撞到的相同 kanji。
const SIMP_CN_ONLY = new RegExp(
  "[" +
    [
      "这", "为", "时", "对", "队", "关", "务", "续", "联", "调", "实",
      "测", "门", "复", "义", "错", "读", "优", "级", "险", "备", "启",
      "线", "题", "饭", "顾", "顺", "颜", "顶", "频", "顿", "频", "饮",
      "馆", "馈", "馆", "饮", "饿", "馍", "饼",
      // 仅简体 / 不是日语常用写法的
      "贝", "财", "买", "卖", "费", "贵", "资", "贷", "购", "贸",
      "门", "问", "间", "闻", "闹", "闭", "闪",
      "马", "驾", "驶", "骑", "驱", "驻", "骄",
      "鸟", "鸡", "鸭", "鹅", "鸿",
      "鱼", "鲜", "鳥",
      "见", "现", "观", "规", "视", "览",
      "车", "辆", "运", "连", "进",
      "国", "图", "园", "围", "团", "圆",
      "电", "无", "众", "众",
      // 已经在前两轮里发现过的标记字
      "题", "复", "继", "续", "终",
    ].join("") +
    "]",
);

// 提取 viewport 里"可见可读"的文本节点的最小 puppeteer 函数。
function buildTextScraper() {
  return () => {
    const isVisible = (el) => {
      if (!(el instanceof Element)) return true;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") {
        return false;
      }
      if (Number(style.opacity || "1") === 0) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue?.trim() ?? "";
        if (!text) return NodeFilter.FILTER_REJECT;
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
            return NodeFilter.FILTER_REJECT;
          }
          if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const out = [];
    let node;
    while ((node = walker.nextNode())) {
      const tag = node.parentElement?.tagName ?? "BODY";
      const cls = node.parentElement?.className ?? "";
      out.push({ text: node.nodeValue.trim(), tag, cls: typeof cls === "string" ? cls.slice(0, 80) : "" });
    }
    // Also include aria-label / placeholder / title attributes that render to AT
    const attrEls = document.querySelectorAll(
      "[aria-label],[placeholder],[title]",
    );
    for (const el of attrEls) {
      if (!isVisible(el)) continue;
      for (const attr of ["aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(attr);
        if (v && v.trim()) out.push({ text: v.trim(), tag: el.tagName, cls: "@" + attr });
      }
    }
    return out;
  };
}

function parseArgs(argv) {
  const opts = { locales: ["en-US", "ja-JP", "ko-KR"], routes: extendedRoutePaths, outDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--locale") opts.locales = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--locale=")) opts.locales = a.slice("--locale=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--route") opts.routes = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--route=")) opts.routes = a.slice("--route=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--out") opts.outDir = argv[++i];
    else if (a.startsWith("--out=")) opts.outDir = a.slice("--out=".length);
  }
  return opts;
}

// Native language names that are intentionally shown in their own script
// (so users can find their language in the picker regardless of current UI locale).
const NATIVE_LOCALE_LABELS = new Set([
  "简体中文",
  "日本語",
  "한국어",
  "English",
]);

function isLeak(text, locale) {
  // Native language picker labels are not leaks.
  if (NATIVE_LOCALE_LABELS.has(text.trim())) return false;
  // CJK ideograph range
  const CJK = /[㐀-䶿一-鿿]/;
  const KANA = /[぀-ヿ]/;
  const HANGUL = /[가-힯]/;
  // Stage-1 filter: must contain CJK ideograph at all
  if (!CJK.test(text)) return false;

  // Strip placeholders like {0}, {name} that are not leaks
  const stripped = text.replace(/\{[^}]*\}/g, "");
  if (!CJK.test(stripped)) return false;

  if (locale === "en-US") return true; // any CJK in en-US is a leak
  if (locale === "ja-JP") {
    // ja-JP: leak only if there's a simplified-Chinese-only char AND no kana
    if (KANA.test(stripped)) return false;
    return SIMP_CN_ONLY.test(stripped);
  }
  if (locale === "ko-KR") {
    // ko-KR: any CJK without Hangul anywhere in the string is a leak
    if (HANGUL.test(stripped)) return false;
    return true;
  }
  return false;
}

async function visitRoute(page, baseUrl, route, locale) {
  const url = `${baseUrl}${route}?locale=${encodeURIComponent(locale)}`;
  const errors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (e) => errors.push(`pageerror: ${e?.message ?? e}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !shouldIgnoreConsoleError(msg.text())) {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
  } catch (err) {
    errors.push(`goto: ${err?.message ?? err}`);
  }
  await page.waitForLoadState("networkidle", { timeout: routeIdleTimeoutMs }).catch(() => undefined);
  await page.waitForTimeout(routeSettleMs);
  // Wait up to 8s for the bootstrap screen to disappear (catalog hydrate).
  // The bootstrap screen renders raw zh-CN text by design — if we measure
  // before it disappears we'll falsely flag the source strings.
  try {
    await page.waitForFunction(
      () => !document.querySelector(".boot-logo"),
      null,
      { timeout: 8000 },
    );
  } catch {
    // If the boot screen never goes away in 8s, the page itself is stuck —
    // record what we have and move on.
  }
  const items = await page.evaluate(buildTextScraper());
  const leaks = items.filter((it) => isLeak(it.text, locale));
  return { url, errors, totalNodes: items.length, leaks };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = opts.outDir
    ? resolve(repoRoot, opts.outDir)
    : resolve(repoRoot, "logs", "i18n-walkthrough", runStamp);
  await mkdir(outDir, { recursive: true });
  const server = await resolveAuditServer();

  const summary = { runStamp, baseUrl: server.baseUrl, locales: opts.locales, routes: opts.routes, results: [] };
  let totalLeaks = 0;
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const locale of opts.locales) {
        const context = await browser.newContext({
          viewport: { width: 375, height: 812 },
          isMobile: true,
          hasTouch: true,
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        });
        const runtimeConfig = { ...runtimeConfigTemplate, apiBaseUrl: server.baseUrl, socketBaseUrl: server.baseUrl };
        await seedAuditLocalStorage(context, runtimeConfig);
        await context.addInitScript((targetLocale) => {
          localStorage.setItem("yinjie-i18n-locale:app", targetLocale);
        }, locale);

        const page = await context.newPage();
        await installApiMocks(page, systemStatus);

        for (const route of opts.routes) {
          const result = await visitRoute(page, server.baseUrl, route, locale);
          totalLeaks += result.leaks.length;
          summary.results.push({ locale, route, ...result });
          if (result.leaks.length || result.errors.length) {
            const prefix = `[${locale} ${route}]`;
            for (const e of result.errors.slice(0, 3)) console.warn(`${prefix} ${e}`);
            for (const leak of result.leaks.slice(0, 5)) {
              console.warn(`${prefix} leak: ${JSON.stringify(leak.text)} <${leak.tag}.${leak.cls}>`);
            }
            if (result.leaks.length > 5) console.warn(`${prefix} ...and ${result.leaks.length - 5} more leaks`);
          } else {
            console.log(`[${locale} ${route}] OK (${result.totalNodes} text nodes)`);
          }
        }
        await page.close();
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.stop();
  }
  await writeFile(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nWrote ${resolve(outDir, "summary.json")} · total leaks: ${totalLeaks}`);
  process.exit(totalLeaks > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
