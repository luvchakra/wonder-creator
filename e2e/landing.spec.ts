import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "./fixtures";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

// The public landing page at `/` for signed-out visitors (owner brief, 2 Oct 2026; docs/landing.md): an editorial
// creative space with one dominant action. Trust details live in the footer, linking to the real pages.
test.describe("Landing page", () => {
  test("signed-out visitors get the landing page; signed-in creators get Home", async ({ browser, page, creator }, info) => {
    const visitor = await (await browser.newContext()).newPage();
    for (const [vp, size] of [
      ["mobile", { width: 390, height: 844 }],
      ["desktop", { width: 1280, height: 900 }],
    ] as const) {
      await visitor.setViewportSize(size);
      await visitor.goto("/");
      await expect(visitor).toHaveURL(/\/$/);
      await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Everything begins with a little wonder.");
      for (const h of ["Your world is full of inspiration.", "From inspiration to Creation.", "Creativity is better when shared.", "Give your Creations a beautiful home.", "Your next Creation is waiting."]) {
        await expect(visitor.getByRole("heading", { name: h })).toBeVisible();
      }
      // The real product, by its own names: Pulse and Communities are different things; the real formats.
      for (const h of ["Pulse", "Communities", "Huddles", "DejaVu", "Moments", "Materials"]) await expect(visitor.getByRole("heading", { name: h, exact: true })).toBeVisible();
      await expect(visitor.getByRole("list", { name: "Creation formats" }).getByRole("listitem")).toHaveText(["Writing", "Carousel", "Images", "Video", "Audio", "Presentation"]);
      // One dominant action, no bottom navigation, nothing invented: no certifications, counts or testimonials.
      await expect(visitor.locator("[data-primary-action]")).toHaveCount(1);
      await expect(visitor.getByRole("navigation", { name: /bottom/i })).toHaveCount(0);
      await expect(visitor.getByText(/certified|fully compliant|100% secure|\d[\d,.]*\+? (creators|users)|testimonial/i)).toHaveCount(0);
      const width = await visitor.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(size.width);
      await info.attach(`landing-${vp}.png`, { body: await visitor.screenshot({ fullPage: true }), contentType: "image/png" });
      if (process.env.LANDING_SHOTS) await visitor.screenshot({ path: `${process.env.LANDING_SHOTS}/landing-${vp}.png`, fullPage: true });
    }

    // Trust lives in the footer and goes to the real pages.
    const legal = visitor.getByRole("navigation", { name: "Legal" });
    for (const l of ["Privacy notice", "Security", "Terms", "Data & subprocessors"]) await expect(legal.getByRole("link", { name: l })).toBeVisible();
    await legal.getByRole("link", { name: "Privacy notice" }).click();
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Privacy notice");

    // The secondary action scrolls on; the CTA starts sign-up.
    await visitor.goto("/");
    await visitor.getByRole("link", { name: /Explore Wonder Creator/ }).click();
    await expect(visitor).toHaveURL(/#world$/);
    await visitor.getByRole("link", { name: "Start Creating" }).first().click();
    await expect(visitor).toHaveURL(/\/sign-up$/);

    // No serious accessibility problems, with motion on and off.
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await visitor.emulateMedia({ reducedMotion });
      await visitor.goto("/");
      await visitor.addScriptTag({ content: axeSource });
      const serious = await visitor.evaluate(async () => {
        const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
      });
      expect(serious).toEqual([]);
    }

    // Signed in, `/` is still Home.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(creator.firstName);
  });
});
