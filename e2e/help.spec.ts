import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { accountMenu, expect, test } from "./fixtures";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

// Help (owner, 8 Oct 2026: "update the get help page for each app — match the latest features"): a public page, opened
// from the landing footer and, signed in, from the account menu. Its words are data (lib/help/content.ts, covered by
// unit tests); this checks the page works: sections, search, deep links, the one way to reach us, and every size.
test.describe("Help", () => {
  test("a visitor finds it in the footer, browses and searches it, and can always reach us", async ({ browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto("/");
    await visitor.getByRole("navigation", { name: "Wonder Creator" }).getByRole("link", { name: "Help" }).click();
    await expect(visitor).toHaveURL(/\/help$/);
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText("A little help along the way.");

    // Every section is there, as a heading and a chip that jumps to it.
    const sections = ["Getting started", "Capturing and keeping", "Making a Creation", "CreativeMind and AI", "Publishing and sharing", "Together", "Rights and licensing", "Your data and privacy", "When something isn’t working", "Reaching us"];
    const chips = visitor.getByRole("navigation", { name: "Help sections" });
    for (const s of sections) {
      await expect(visitor.getByRole("heading", { level: 2, name: s })).toBeVisible();
      await expect(chips.getByRole("link", { name: s })).toBeVisible();
    }
    // Nothing promised that the product doesn't do: no email address, no reply time.
    await expect(visitor.getByText(/@[a-z0-9-]+\.[a-z]{2,}|within \d+ (hours|days)|24\/7/i)).toHaveCount(0);

    // A topic opens in place, from the keyboard too.
    const topic = visitor.locator("#quick-capture");
    await expect(topic).not.toHaveAttribute("open", "");
    await topic.locator("summary").focus();
    await visitor.keyboard.press("Enter");
    await expect(topic).toHaveAttribute("open", "");
    await expect(topic.getByText("A recording stops by itself at 20 minutes.", { exact: false })).toBeVisible();
    await visitor.keyboard.press("Enter");
    await expect(topic).not.toHaveAttribute("open", "");

    // Search narrows to the topics a question is about, says how many, and opens a lone match.
    const search = visitor.getByRole("searchbox", { name: "Search help" });
    await search.fill("own api key");
    await expect(visitor.getByRole("status")).toContainText("topic matches");
    const results = visitor.getByRole("region", { name: "Search results" });
    await expect(results.getByRole("heading", { level: 3, name: "Using your own AI key" })).toBeVisible();
    await expect(visitor.locator("#own-key")).toHaveAttribute("open", "");
    await expect(visitor.getByRole("heading", { level: 2, name: "Getting started" })).toHaveCount(0);
    // Something we don't cover says so, plainly, and clearing brings everything back.
    await search.fill("zzzqqxx");
    await expect(visitor.getByRole("status")).toHaveText("No topic matches “zzzqqxx”.");
    await expect(results.getByText("Nothing matches that yet.")).toBeVisible();
    await visitor.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toBeFocused();
    await expect(visitor.getByRole("heading", { level: 2, name: "Getting started" })).toBeVisible();

    // A link to a topic opens it.
    await visitor.goto("/help#huddles");
    await expect(visitor.locator("#huddles")).toHaveAttribute("open", "");
    await expect(visitor.locator("#huddles").getByText("nothing is recorded or transcribed", { exact: false })).toBeVisible();

    // The one way to write to us is the Contact page; the product's own links in the topics resolve.
    await visitor.getByRole("link", { name: "Send us a message" }).click();
    await expect(visitor).toHaveURL(/\/contact$/);
    await expect(visitor.getByRole("form", { name: "Send us a message" })).toBeVisible();

    await visitor.goto("/help");
    for (const href of ["/legal/privacy", "/legal/security"]) {
      const res = await visitor.request.get(href);
      expect(res.status(), href).toBe(200);
    }
    // Signed out, the header offers Sign in.
    await expect(visitor.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("reads well at phone and desktop widths, with motion on or off, and is accessible", async ({ browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      await visitor.setViewportSize(size);
      await visitor.goto("/help");
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth), `no sideways scrolling at ${size.width}px`).toBeLessThanOrEqual(size.width);
      // The search box and every topic's header are comfortable to hit.
      const box = await visitor.getByRole("searchbox", { name: "Search help" }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      for (const summary of await visitor.locator("details > summary").all()) expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Open topics stay inside the page, too.
      await visitor.locator("#first-five-minutes summary").click();
      await visitor.locator("#own-key summary").click();
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    }

    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await visitor.emulateMedia({ reducedMotion });
      await visitor.goto("/help");
      for (const slug of ["first-five-minutes", "working-table", "licenses"]) await visitor.locator(`#${slug} summary`).click();
      await visitor.addScriptTag({ content: axeSource });
      const serious = await visitor.evaluate(async () => {
        const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
      });
      expect(serious).toEqual([]);
    }
    // With reduced motion the chevron doesn't animate.
    const transition = await visitor.locator("#first-five-minutes summary svg").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(transition)).toBeLessThan(0.001);
  });

  test("signed in, Get help is in the account menu, and the page offers the way back", async ({ page, creator: _creator }) => {
    await accountMenu(page, "Get help");
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A little help along the way.");
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("link", { name: "Open Wonder Creator" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  });
});
