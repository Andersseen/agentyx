import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/packs", "/providers", "/docs/getting-started"];

test("home routes one definition to every provider and explains doctor", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();

  await expect(
    page.getByRole("heading", { level: 1, name: /One definition, wired into every agent/ }),
  ).toBeVisible();

  // The first viewport shows the product model with real destinations, not only a claim.
  const board = page.getByRole("figure");
  for (const provider of ["Codex", "Claude Code", "Kimi Code", "Qwen Code"]) {
    await expect(board.getByText(provider, { exact: true })).toBeVisible();
  }
  await expect(board.getByText(".qwen/skills")).toBeVisible();
  await expect(board.getByText(".agentyx.lock.json")).toBeVisible();

  await expect(page.getByText("pnpm dlx @agentyx/cli init", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Know what your agent setup is doing." }),
  ).toBeVisible();
  await expect(page.getByText("Illustrative report")).toBeVisible();
  await expect(page.getByText("9 / 12 sessions")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("home shows the design pair and the provider matrix", async ({ page }) => {
  await page.goto("/");

  const resolve = page.locator("#resolve");
  await expect(resolve.getByRole("heading", { name: "ui-ux" })).toBeVisible();
  await expect(resolve.getByRole("heading", { name: "creative-web" })).toBeVisible();
  await expect(resolve.getByText("design-system-practice")).toBeVisible();
  await expect(resolve.getByText("creative-direction")).toBeVisible();

  const table = page.locator("#providers").getByRole("table").first();
  await expect(table.getByRole("columnheader", { name: "Qwen Code" })).toBeVisible();
});

test("catalogue filters, selects and keeps its layout stable", async ({ page }, testInfo) => {
  await page.goto("/packs");

  await page.getByRole("button", { name: "language", exact: true }).click();
  await expect(page.getByRole("button", { name: /rust Idiomatic Rust/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /security Handle untrusted input/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /rust Idiomatic Rust/ }).click();
  await expect(page.getByText("pnpm dlx @agentyx/cli pack show rust")).toBeVisible();

  await page.getByRole("button", { name: "design", exact: true }).click();
  await page.getByRole("button", { name: /^creative-web / }).click();
  const detail = page.locator("#catalogue aside");
  await expect(detail.getByText("9 Skills, in resolution order")).toBeVisible();
  await expect(detail.getByText("creative-direction", { exact: true })).toBeVisible();
  await expect(detail.getByText("design-critique", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "All packs", exact: true }).click();
  if (testInfo.project.name === "mobile") return;

  const list = page.getByTestId("pack-list");
  const firstWidth = (await list.boundingBox())?.width;
  const firstDetailX = (await detail.boundingBox())?.x;
  expect(firstWidth).toBeDefined();
  expect(firstDetailX).toBeDefined();

  for (const name of ["observability", "data", "agentic", "technical"]) {
    await page.getByRole("button", { name: new RegExp(`^${name} `) }).click();
    await expect(detail.getByText(`pnpm dlx @agentyx/cli pack show ${name}`)).toBeVisible();
    expect((await list.boundingBox())?.width).toBeCloseTo(firstWidth as number, 0);
    expect((await detail.boundingBox())?.x).toBeCloseTo(firstDetailX as number, 0);
    const commandFits = await detail
      .locator("code")
      .evaluate((node) => node.scrollWidth <= node.clientWidth);
    expect(commandFits).toBe(true);
  }
});

test("the packs page explains ui-ux versus creative-web", async ({ page }) => {
  await page.goto("/packs");

  await expect(
    page.getByRole("heading", { level: 1, name: "Pick capabilities with a purpose." }),
  ).toBeVisible();
  const pair = page.locator("#design-packs");
  await expect(pair.getByText("Does the product behave well?")).toBeVisible();
  await expect(pair.getByText("What should the site feel like?")).toBeVisible();
  await expect(pair.getByText("Shared Skills resolve once and keep both origins")).toBeVisible();
});

test("no route overflows horizontally in either theme", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} (${theme})`).toBeLessThanOrEqual(0);
    }
  }
});

test("reduced motion renders the finished routing diagram", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");

  const stub = page.locator(".port").last();
  await expect(stub).toBeVisible();
  const animation = await stub.evaluate((node) => getComputedStyle(node, "::before").animationName);
  expect(animation).toBe("none");
  await context.close();
});

test("keyboard users can skip to content and see focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Keyboard path is exercised on desktop");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element));
  expect(outline.outlineStyle).not.toBe("none");
});
