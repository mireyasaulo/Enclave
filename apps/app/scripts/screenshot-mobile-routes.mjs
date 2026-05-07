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

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, "..", "..");
const logsRoot = resolve(repoRoot, "logs", "mobile-audit");

const viewports = [
  {
    name: "sm320",
    label: "iPhone SE 1st",
    width: 320,
    height: 568,
  },
  {
    name: "md375",
    label: "iPhone X",
    width: 375,
    height: 812,
  },
  {
    name: "lg414",
    label: "iPhone XR",
    width: 414,
    height: 896,
  },
];

const userAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

async function main() {
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = resolve(logsRoot, runStamp);
  await mkdir(runDir, { recursive: true });

  const server = await resolveAuditServer();

  try {
    const summary = await captureAllViewports(server.baseUrl, runDir);
    await writeFile(
      resolve(runDir, "report.json"),
      JSON.stringify(summary, null, 2),
      "utf8",
    );
    printTopIssues(summary);
    console.log(`\nscreenshots + report → ${runDir}`);
  } finally {
    await server.stop();
  }
}

async function captureAllViewports(baseUrl, runDir) {
  const browser = await chromium.launch({ headless: true });
  const summary = {
    runDir,
    baseUrl,
    viewports: viewports.map((v) => ({ ...v })),
    routes: [...extendedRoutePaths],
    findings: [],
  };

  try {
    for (const viewport of viewports) {
      const viewportDir = resolve(runDir, viewport.name);
      await mkdir(viewportDir, { recursive: true });

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: true,
        hasTouch: true,
        userAgent,
        deviceScaleFactor: 2,
      });

      const runtimeConfig = {
        ...runtimeConfigTemplate,
        apiBaseUrl: baseUrl,
        socketBaseUrl: baseUrl,
      };
      await seedAuditLocalStorage(context, runtimeConfig);

      for (const routePath of extendedRoutePaths) {
        const finding = await captureRoute({
          context,
          baseUrl,
          routePath,
          viewport,
          viewportDir,
        });
        summary.findings.push(finding);
        process.stdout.write(
          `[${viewport.name}] ${routePath} ` +
            `overflow=${finding.diagnostics.horizontalOverflowPx}px ` +
            `tinyText=${finding.diagnostics.tinyText.length} ` +
            `smallTap=${finding.diagnostics.smallTapTargets.length}\n`,
        );
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  return summary;
}

async function captureRoute({
  context,
  baseUrl,
  routePath,
  viewport,
  viewportDir,
}) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  await installApiMocks(page, systemStatus);
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (shouldIgnoreConsoleError(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  let navigationError = null;
  try {
    await page.goto(`${baseUrl}${routePath}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: routeIdleTimeoutMs })
      .catch(() => undefined);
    await page.waitForTimeout(routeSettleMs);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  let diagnostics = emptyDiagnostics();
  let screenshotPath = null;

  if (!navigationError) {
    try {
      diagnostics = await page.evaluate(collectDiagnostics);
    } catch (error) {
      navigationError = `diagnostics: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }

    const slug = routePath.replace(/^\/+/, "").replace(/[/?]/g, "_") || "root";
    screenshotPath = resolve(viewportDir, `${slug}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      navigationError = `screenshot: ${
        error instanceof Error ? error.message : String(error)
      }`;
      screenshotPath = null;
    }
  }

  await page.close();

  return {
    viewport: viewport.name,
    route: routePath,
    screenshot: screenshotPath
      ? screenshotPath.replace(`${viewportDir}/`, `${viewport.name}/`)
      : null,
    navigationError,
    consoleErrors,
    pageErrors,
    diagnostics,
  };
}

function emptyDiagnostics() {
  return {
    horizontalOverflowPx: 0,
    tinyText: [],
    smallTapTargets: [],
    offscreenFixed: [],
  };
}

function collectDiagnostics() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const horizontalOverflowPx = Math.max(
    0,
    document.documentElement.scrollWidth - vw,
  );

  function describe(el) {
    let path = el.tagName.toLowerCase();
    if (el.id) path += `#${el.id}`;
    if (el.className && typeof el.className === "string") {
      const cls = el.className.trim().split(/\s+/).slice(0, 3).join(".");
      if (cls) path += `.${cls}`;
    }
    return path;
  }

  function visibleRect(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return null;
    if (parseFloat(style.opacity || "1") === 0) return null;
    return rect;
  }

  const tinyText = [];
  const allElements = document.querySelectorAll("body *");
  for (const el of allElements) {
    if (tinyText.length >= 25) break;
    if (!(el instanceof HTMLElement)) continue;
    const text = (el.textContent || "").trim();
    if (!text) continue;
    if (el.children.length > 0) {
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent || "").trim())
        .join("");
      if (!directText) continue;
    }
    const rect = visibleRect(el);
    if (!rect) continue;
    const fontSize = parseFloat(getComputedStyle(el).fontSize || "0");
    if (fontSize > 0 && fontSize < 12) {
      tinyText.push({
        path: describe(el),
        fontSize: Math.round(fontSize * 10) / 10,
        text: text.slice(0, 60),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
  }

  const smallTapTargets = [];
  const interactiveSelector =
    'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea, [role="tab"], [role="link"], [role="menuitem"]';
  const interactives = document.querySelectorAll(interactiveSelector);
  for (const el of interactives) {
    if (smallTapTargets.length >= 25) break;
    if (!(el instanceof HTMLElement)) continue;
    const rect = visibleRect(el);
    if (!rect) continue;
    const minSide = Math.min(rect.width, rect.height);
    if (minSide < 36) {
      smallTapTargets.push({
        path: describe(el),
        text: (el.textContent || "").trim().slice(0, 40),
        ariaLabel: el.getAttribute("aria-label") || null,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      });
    }
  }

  const offscreenFixed = [];
  for (const el of allElements) {
    if (offscreenFixed.length >= 15) break;
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    if (style.position !== "fixed") continue;
    const rect = visibleRect(el);
    if (!rect) continue;
    if (rect.right < 0 || rect.left > vw || rect.bottom < 0 || rect.top > vh) {
      offscreenFixed.push({
        path: describe(el),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        vw,
        vh,
      });
    }
  }

  return {
    horizontalOverflowPx,
    tinyText,
    smallTapTargets,
    offscreenFixed,
  };
}

function printTopIssues(summary) {
  const byViewport = new Map();
  for (const f of summary.findings) {
    if (!byViewport.has(f.viewport)) byViewport.set(f.viewport, []);
    byViewport.get(f.viewport).push(f);
  }

  for (const [vp, findings] of byViewport) {
    console.log(`\n=== ${vp} top issues ===`);
    const sorted = [...findings].sort((a, b) => issueScore(b) - issueScore(a));
    for (const f of sorted.slice(0, 10)) {
      const score = issueScore(f);
      if (score === 0) continue;
      console.log(
        `  ${f.route}  overflow=${f.diagnostics.horizontalOverflowPx}px ` +
          `tinyText=${f.diagnostics.tinyText.length} ` +
          `smallTap=${f.diagnostics.smallTapTargets.length} ` +
          `offscreen=${f.diagnostics.offscreenFixed.length}`,
      );
    }
  }
}

function issueScore(finding) {
  const d = finding.diagnostics;
  return (
    (d.horizontalOverflowPx > 0 ? 100 : 0) +
    d.tinyText.length * 3 +
    d.smallTapTargets.length * 2 +
    d.offscreenFixed.length * 5 +
    (finding.pageErrors.length || 0) * 50 +
    (finding.consoleErrors.length || 0) * 10 +
    (finding.navigationError ? 200 : 0)
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
