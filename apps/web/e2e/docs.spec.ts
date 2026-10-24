import { expect, test } from "@playwright/test";

/** Doqs renders the documentation sidebar under this accessible name. */
const DOCS_NAV = 'nav[aria-label="Agentyx documentation"]';

test("providers page documents every target including Qwen Code", async ({ page }) => {
  await page.goto("/providers");

  await expect(page.getByRole("heading", { name: "Four agents, one definition." })).toBeVisible();

  const table = page.getByRole("table").first();
  for (const provider of ["Codex", "Claude Code", "Kimi Code", "Qwen Code"]) {
    await expect(table.getByRole("columnheader", { name: provider })).toBeVisible();
  }

  // Qwen Code keeps MCP servers and hooks in one document; the table must say so rather than
  // implying two files.
  await expect(page.getByText(".qwen/settings.json").first()).toBeVisible();
  await expect(page.getByText("shared with MCP")).toBeVisible();
  await expect(page.getByRole("cell", { name: /user-level config only/ })).toBeVisible();

  // Unobservable is not the same as unused.
  await expect(page.getByText("unobservable").first()).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("packs page renders the full catalogue", async ({ page }) => {
  await page.goto("/packs");

  await expect(
    page.getByRole("heading", { name: "Pick capabilities with a purpose." }),
  ).toBeVisible();
  await expect(page.getByTestId("pack-list").getByRole("button")).not.toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");

  // The navbar reports the current route, not a scroll position. CSS selectors, not roles: below
  // the `md` breakpoint the desktop list is display:none and therefore absent from the
  // accessibility tree, while routerLinkActive still sets the attribute on it. Scoped to the link
  // list because the logo is a second `a[href="/"]` inside the same nav.
  const navLinks = page.locator('nav[aria-label="Main navigation"] ul');
  await expect(navLinks.locator('a[href="/packs"]')).toHaveAttribute("aria-current", "page");
  await expect(navLinks.locator('a[href="/"]')).not.toHaveAttribute("aria-current", "page");
});

test("documentation region renders Markdown with its own navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Doqs collapses the sidebar behind a toggle on small viewports",
  );
  await page.goto("/docs/getting-started");

  await expect(page.getByRole("heading", { name: "Getting started" })).toBeVisible();
  // The documentation region keeps the site navbar, and the navbar marks Docs as the current route.
  await expect(page.locator('nav[aria-label="Main navigation"] a[href="/docs"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Rendered from Markdown, not from a component template.
  await expect(
    page.getByRole("heading", { name: "Run it without installing anything" }),
  ).toBeVisible();
  await expect(page.getByText("pnpm dlx @agentyx/cli init").first()).toBeVisible();

  // Exactly one main landmark: the shell renders none and Doqs renders its own.
  await expect(page.locator("main")).toHaveCount(1);

  const sidebar = page.locator(DOCS_NAV);
  const documented = [
    "/docs/getting-started",
    "/docs/configuration",
    "/docs/guides/observability",
    "/docs/guides/reproducibility",
    "/docs/reference/packs",
    "/docs/reference/providers",
    "/docs/reference/compatibility",
    "/docs/reference/cli",
  ];
  // Every page is reachable from the sidebar. Groups other than the active one are collapsed by
  // Doqs, so this asserts the links exist rather than that they are all expanded.
  for (const href of documented) {
    await expect(sidebar.locator(`a[href="${href}"]`)).toHaveCount(1);
  }

  // The active group is expanded, and following it stays inside the documentation region.
  await sidebar.locator('a[href="/docs/configuration"]').click();
  await expect(page).toHaveURL(/\/docs\/configuration\/?$/);
  await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();

  await page.goto("/docs/reference/providers");
  await expect(page.getByRole("heading", { name: "Providers" })).toBeVisible();
  // The Markdown page documents the shared-document rule in its own words.
  await expect(page.getByRole("heading", { name: "Shared destinations" })).toBeVisible();
  await expect(page.getByText(".qwen/settings.json").first()).toBeVisible();
  await expect(page.getByText("kind settings", { exact: false }).first()).toBeVisible();
});

test("landing navigation reaches the new routes", async ({ page }) => {
  await page.goto("/");

  // Below the `md` breakpoint the navbar links move into a toggleable menu that lives outside the
  // `<nav>`, so scope to the banner and take whichever copy is actually visible.
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  const banner = page.getByRole("banner");
  const siteLink = (name: string) =>
    banner.getByRole("link", { name, exact: true }).locator("visible=true").first();
  const follow = async (name: string) => {
    if (await toggle.isVisible()) await toggle.click();
    await siteLink(name).click();
  };

  await follow("Docs");
  await expect(page).toHaveURL(/\/docs\/?$/);
  await expect(page.getByRole("heading", { name: "Agentyx documentation" })).toBeVisible();

  await follow("Providers");
  await expect(page).toHaveURL(/\/providers\/?$/);
  await expect(page.getByRole("heading", { name: "Four agents, one definition." })).toBeVisible();
});
