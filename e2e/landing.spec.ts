import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "./fixtures";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

// The public landing page at `/` for signed-out visitors (owner, 2 Oct 2026): leads with payments, privacy, financial
// controls and security — described, never claimed as certification.
test.describe("Landing page", () => {
  test("signed-out visitors see the landing page with the four commitments; signed-in creators get Home", async ({ browser, page, creator }, info) => {
    const visitor = await (await browser.newContext()).newPage();
    for (const [vp, size] of [
      ["mobile", { width: 390, height: 844 }],
      ["desktop", { width: 1280, height: 900 }],
    ] as const) {
      await visitor.setViewportSize(size);
      await visitor.goto("/");
      await expect(visitor).toHaveURL(/\/$/);
      await expect(visitor.getByRole("heading", { name: "For creators who mean business" })).toBeVisible();
      for (const h of ["Get paid through Stripe & Razorpay", "Your data, your rights — GDPR & DPDP", "Books that add up — SOX-style controls", "Security by default"]) {
        await expect(visitor.getByRole("heading", { name: h })).toBeVisible();
      }
      // Honest wording: designed to support, never "certified".
      await expect(visitor.getByText(/certified|fully compliant|100% secure/i)).toHaveCount(0);
      await expect(visitor.getByText(/designed to support/)).toBeVisible();
      const width = await visitor.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(size.width);
      await info.attach(`landing-${vp}.png`, { body: await visitor.screenshot({ fullPage: true }), contentType: "image/png" });
      if (process.env.LANDING_SHOTS) await visitor.screenshot({ path: `${process.env.LANDING_SHOTS}/landing-${vp}.png`, fullPage: true });
    }
    // The highlight chips jump to their section; the CTA starts sign-up.
    await visitor.getByRole("list", { name: "Highlights" }).getByRole("link", { name: "GDPR & DPDP" }).click();
    await expect(visitor).toHaveURL(/#privacy$/);
    await visitor.getByRole("link", { name: "Read the Privacy notice" }).click();
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Privacy notice");
    await visitor.goto("/");
    await visitor.getByRole("link", { name: "Create your studio" }).first().click();
    await expect(visitor).toHaveURL(/\/sign-up$/);

    // No serious accessibility problems.
    await visitor.goto("/");
    await visitor.addScriptTag({ content: axeSource });
    const serious = await visitor.evaluate(async () => {
      const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
      return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
    });
    expect(serious).toEqual([]);

    // Signed in, `/` is still Home.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(creator.firstName);
  });
});
