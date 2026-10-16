import { expect, test } from "./fixtures";

// Who may read help (docs/help.md › Who can read it; owner, 16 Oct 2026): /help is for signed-in creators only. Signed
// out it redirects to sign-in and comes back afterwards; it's never publicly cached or indexed. What stays public is the
// short Account help page and the pages a visitor needs before signing in.
const PUBLIC_PAGES = ["/", "/sign-in", "/sign-up", "/forgot-password", "/account-help", "/contact", "/about", "/legal/privacy", "/legal/terms", "/legal/security", "/legal/subprocessors"];
// Titles of signed-in help topics that must never appear on a public page.
const PROTECTED_TITLES = ["Quick Capture on Home", "The Working Table: sources, pins and Use together", "Using your own AI key", "Brand work and business"];

test.describe("Help access", () => {
  test("signed out, help redirects to sign-in and is never cached or indexed", async ({ page }) => {
    const res = await page.request.get("/help", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/sign-in\?next=%2Fhelp$/);
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
    expect(res.headers()["cache-control"]).not.toMatch(/public|s-maxage/);
    expect(res.headers()["x-robots-tag"]).toMatch(/noindex/);
    const body = await res.text();
    for (const t of PROTECTED_TITLES) expect(body).not.toContain(t);

    await page.goto("/help#quick-capture");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fhelp/);
  });

  test("there is no help API to reach around the page", async ({ page }) => {
    for (const path of ["/api/v1/help", "/api/v1/help/search?q=capture"]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(404);
      expect(await res.text()).not.toContain("Quick Capture on Home");
    }
  });

  test("signing in from the redirect comes back to help", async ({ page, creator }) => {
    await page.context().clearCookies();
    await page.goto("/help");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fhelp/);
    await page.getByLabel("Email").fill(creator.email);
    await page.getByLabel("Password").fill(creator.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A little help along the way.");
  });

  test("signed in, help loads privately and stays out of search engines", async ({ page, creator: _creator }) => {
    const res = await page.request.get("/help", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toMatch(/private|no-store/);
    expect(res.headers()["x-robots-tag"]).toMatch(/noindex/);
    await page.goto("/help");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the public pages still load signed out, show no signed-in help and link only to Account help", async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page, path).not.toHaveURL(/\/sign-in\?next=/);
      const text = await page.locator("body").innerText();
      for (const t of PROTECTED_TITLES) expect(text, `${path} shows “${t}”`).not.toContain(t);
      await expect(page.locator('a[href^="/help"]'), `${path} links to /help`).toHaveCount(0);
    }
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Account help" })).toHaveAttribute("href", "/account-help");
  });

  test("Account help answers sign-in questions with public links only", async ({ page }) => {
    await page.goto("/account-help");
    await expect(page.getByRole("heading", { level: 1, name: "Account help" })).toBeVisible();
    for (const t of ["Creating an account", "Signing in and account security", "I can’t sign in"]) {
      await expect(page.locator("summary").filter({ hasText: t })).toBeVisible();
    }
    const hrefs = await page.locator("main a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    const allowed = new Set(PUBLIC_PAGES);
    for (const h of hrefs) expect(allowed.has(h.split(/[?#]/)[0]), h).toBe(true);
    await page.goto("/sign-in");
    await expect(page.getByRole("link", { name: "Trouble signing in?" })).toHaveAttribute("href", "/account-help");
  });
});
