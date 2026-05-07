import { chromium } from "@playwright/test";
import {
  installApiMocks,
  resolveAuditServer,
  routePaths,
  routeIdleTimeoutMs,
  routeSettleMs,
  runtimeConfigTemplate,
  seedAuditLocalStorage,
  shouldIgnoreConsoleError,
  systemStatus,
} from "./lib/mobile-audit-fixtures.mjs";

async function main() {
  const server = await resolveAuditServer();

  try {
    await runBrowserAudit(server.baseUrl);
  } finally {
    await server.stop();
  }
}

async function runBrowserAudit(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  });
  const runtimeConfig = {
    ...runtimeConfigTemplate,
    apiBaseUrl: baseUrl,
    socketBaseUrl: baseUrl,
  };

  await seedAuditLocalStorage(context, runtimeConfig);

  try {
    const errors = [];
    for (const routePath of routePaths) {
      const pageErrors = [];
      const page = await createAuditedPage(context, pageErrors, systemStatus);
      await auditRoute(page, baseUrl, routePath, pageErrors);
      if (pageErrors.length) {
        errors.push(`${routePath}\n  ${pageErrors.join("\n  ")}`);
      }
      await page.close();
    }

    const malformedStatusErrors = [];
    const malformedStatusPage = await createAuditedPage(
      context,
      malformedStatusErrors,
      { worldSurface: { ownerCount: 1 } },
    );
    await auditRoute(
      malformedStatusPage,
      baseUrl,
      "/tabs/chat",
      malformedStatusErrors,
    );
    if (malformedStatusErrors.length) {
      errors.push(
        `/tabs/chat with malformed system status\n  ${malformedStatusErrors.join(
          "\n  ",
        )}`,
      );
    }
    await malformedStatusPage.close();

    if (errors.length) {
      throw new Error(errors.join("\n"));
    }

    console.log(
      `mobile route audit passed: ${routePaths.length} routes + malformed status guard`,
    );
  } finally {
    await browser.close();
  }
}

async function createAuditedPage(context, errors, statusPayload) {
  const page = await context.newPage();
  await installApiMocks(page, statusPayload);
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (shouldIgnoreConsoleError(text)) {
      return;
    }

    errors.push(`console.error: ${text}`);
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return page;
}

async function auditRoute(page, baseUrl, routePath, errors) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: routeIdleTimeoutMs })
    .catch(() => undefined);
  await page.waitForTimeout(routeSettleMs);

  const bodyText = (await page.locator("body").innerText()).trim();
  if (!bodyText) {
    errors.push("empty body text");
  }

  const rootText = await page.locator("#root").innerText().catch(() => "");
  if (
    /Maximum update depth exceeded|Cannot read properties|The above error occurred|Minified React error/.test(
      rootText,
    )
  ) {
    errors.push(`error text rendered: ${rootText.slice(0, 300)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
