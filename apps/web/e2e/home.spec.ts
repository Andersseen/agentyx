import { expect, test } from "@playwright/test";

test("presents a usable and accurate first-run path", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Agentyx builds reusable environments for coding agents" }),
  ).toBeVisible();
  await expect(page.getByText("pnpm dlx @agentyx/cli resolve angular")).toBeVisible();
  await expect(page.getByRole("link", { name: /Get started on GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/Andersseen/agentyx",
  );
  const localPacks = page.getByText("Project-owned packs", { exact: true });
  await localPacks.scrollIntoViewIfNeeded();
  await expect(localPacks).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
