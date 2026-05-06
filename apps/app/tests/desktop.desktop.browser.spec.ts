import { expect, test } from "@playwright/test";
import {
  installDesktopRuntime,
  prepareDesktopSmokeData,
  startDesktopBrowserStack,
  type DesktopBrowserStack,
  type DesktopSmokeData,
} from "./desktop-browser-harness";

let stack: DesktopBrowserStack;
let smokeData: DesktopSmokeData;

type SmokeMoment = {
  id: string;
  text: string;
};

test.beforeAll(async () => {
  stack = await startDesktopBrowserStack();
  smokeData = await prepareDesktopSmokeData(stack.coreApi.baseUrl);
}, 90_000);

test.afterAll(async () => {
  await stack?.cleanup();
});

test.beforeEach(async ({ page }) => {
  await installDesktopRuntime(page, {
    coreApiBaseUrl: stack.coreApi.baseUrl,
    smokeData,
  });
});

test("boots into the desktop workspace and primary navigation stays usable", async ({
  page,
}) => {
  await page.goto(stack.app.baseUrl);

  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    "/tabs/chat",
  );
  await expect(page.locator('button[title="消息"]')).toBeVisible();

  const navTargets = [
    ["通讯录", "/tabs/contacts"],
    ["收藏", "/tabs/favorites"],
    ["朋友圈", "/tabs/moments"],
    ["广场动态", "/tabs/feed"],
    ["视频号", "/tabs/channels"],
    ["搜一搜", "/tabs/search"],
    ["游戏中心", "/tabs/games"],
    ["小程序面板", "/tabs/mini-programs"],
    ["消息", "/tabs/chat"],
  ] as const;

  for (const [label, pathname] of navTargets) {
    await page.locator(`button[title="${label}"]`).click();
    await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
      pathname,
    );
  }
});

test("self-heals legacy desktop paths into desktop workspace protocols", async ({
  page,
}) => {
  await page.goto(
    `${stack.app.baseUrl}/chat/${smokeData.conversation.id}#chat-message-legacy`,
  );

  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    "/tabs/chat",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.hash.slice(1)).get(
          "conversationId",
        ),
      ),
    )
    .toBe(smokeData.conversation.id);

  await page.goto(
    `${stack.app.baseUrl}/discover/feed#postId=missing&returnPath=%2Fdiscover%2Ffeed`,
  );
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    "/tabs/feed",
  );

  await page.goto(`${stack.app.baseUrl}/profile/settings`);
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    "/desktop/settings",
  );

  await page.goto(
    `${stack.app.baseUrl}/contacts/tags#pane=tags&tag=Desktop&characterId=${smokeData.character.id}`,
  );
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    "/tabs/contacts",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.hash.slice(1)).get("pane"),
      ),
    )
    .toBe("tags");
});

test("preserves desktop chat route state across reloads", async ({ page }) => {
  await page.goto(
    `${stack.app.baseUrl}/tabs/chat#conversationId=${smokeData.conversation.id}`,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.hash.slice(1)).get(
          "conversationId",
        ),
      ),
    )
    .toBe(smokeData.conversation.id);

  await page.reload();

  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    "/tabs/chat",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        new URLSearchParams(window.location.hash.slice(1)).get(
          "conversationId",
        ),
      ),
    )
    .toBe(smokeData.conversation.id);
  await expect(
    page.locator('button[title="消息"][aria-current="page"]'),
  ).toBeVisible();
});

test("accepts typing in moments comment composers", async ({ page }) => {
  const moment = await createSmokeMoment("朋友圈评论输入回归测试");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${stack.app.baseUrl}/discover/moments`);

  const mobileCard = page.locator(`#moment-post-${moment.id}`);
  await expect(mobileCard).toBeVisible();
  const mobileInput = mobileCard.getByPlaceholder("写评论...");
  await mobileInput.fill("移动端评论输入");
  await expect(mobileInput).toHaveValue("移动端评论输入");

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${stack.app.baseUrl}/tabs/moments`);

  const desktopCard = page.locator(`#desktop-moment-post-${moment.id}`);
  await expect(desktopCard).toBeVisible();
  const desktopInput = desktopCard.getByPlaceholder("写评论...");
  await expect(desktopInput).toBeVisible();
  await desktopInput.fill("桌面端评论输入");
  await expect(desktopInput).toHaveValue("桌面端评论输入");
  await desktopCard.getByRole("button", { name: "发送" }).click();
  await expect(desktopInput).toHaveValue("");
  await expect(desktopCard.getByText("桌面端评论输入")).toBeVisible();
});

test("desktop moments support replying to a specific comment", async ({
  page,
}) => {
  const moment = await createSmokeMoment("朋友圈评论回复回归");

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${stack.app.baseUrl}/tabs/moments`);

  const desktopCard = page.locator(`#desktop-moment-post-${moment.id}`);
  await expect(desktopCard).toBeVisible();

  const composerInput = desktopCard.getByPlaceholder("写评论...");
  await composerInput.fill("被回复的原始评论");
  await desktopCard.getByRole("button", { name: "发送" }).click();
  await expect(desktopCard.getByText("被回复的原始评论")).toBeVisible();

  // 点击刚才那条评论本身就是开始回复
  const targetComment = desktopCard
    .getByRole("button", { name: /被回复的原始评论$/ })
    .first();
  await targetComment.click();

  // 出现回复指示条 + placeholder 切换
  await expect(desktopCard.getByText(/^正在回复 /)).toBeVisible();
  const replyInput = desktopCard.getByPlaceholder(/^回复 /);
  await replyInput.fill("这是一条针对评论的回复");
  await desktopCard.getByRole("button", { name: "发送" }).click();

  // 新评论显示「X 回复 Y：内容」
  await expect(
    desktopCard.getByText("这是一条针对评论的回复"),
  ).toBeVisible();
  await expect(desktopCard.getByText(/^正在回复 /)).toBeHidden();

  // 关键：新评论必须以 "X 回复 Y：内容" 的形式渲染，不能是裸的 "X：内容"
  const replyComment = desktopCard
    .getByRole("button", { name: /这是一条针对评论的回复$/ })
    .first();
  const replyText = (await replyComment.innerText()).replace(/\s+/g, "");
  expect(replyText).toMatch(/回复.+：这是一条针对评论的回复/);

  // 原始评论也仍然在
  await expect(desktopCard.getByText("被回复的原始评论")).toBeVisible();
});

async function createSmokeMoment(text: string) {
  const response = await fetch(
    `${stack.coreApi.baseUrl}/api/moments/user-post`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        contentType: "text",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create smoke moment: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as SmokeMoment;
}
