import { expect, test } from "@playwright/test";

test("explains the workflow, doctor and packs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();

  await expect(
    page.getByRole("heading", { name: /Give every coding agent the right environment/ }),
  ).toBeVisible();
  await expect(page.getByText("pnpm dlx @agentyx/cli init", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Know what your agent setup is doing." }),
  ).toBeVisible();
  await expect(page.getByText("Illustrative report")).toBeVisible();
  await expect(page.getByText("9 / 12 sessions")).toBeVisible();

  await page.getByRole("button", { name: "language", exact: true }).click();
  await expect(page.getByRole("button", { name: /rust Idiomatic Rust/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /security Handle untrusted input/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /rust Idiomatic Rust/ }).click();
  await expect(page.getByText("pnpm dlx @agentyx/cli pack show rust")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Visit Agentyx website (opens in new tab)" }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("pack details do not resize the catalogue", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop catalogue has two columns");
  await page.goto("/");

  const list = page.getByTestId("pack-list");
  const detail = page.locator("#packs aside");
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

  const firstCard = page.locator("app-pack-card volt-card").first();
  await firstCard.hover();
  await expect
    .poll(() => firstCard.evaluate((node) => getComputedStyle(node).translate))
    .toMatch(/-\d/);
});
