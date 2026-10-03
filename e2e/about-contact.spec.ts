import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "./fixtures";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

// About and Contact (owner, 3 Oct 2026): public pages reached from the landing footer. Nothing invented: Contact
// shows only channels that exist.
test.describe("About and Contact", () => {
  test("reached from the footer, readable at phone and desktop widths, accessible", async ({ browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto("/");
    await visitor.getByRole("navigation", { name: "Wonder Creator" }).getByRole("link", { name: "About" }).click();
    await expect(visitor).toHaveURL(/\/about$/);
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText("A quiet place where the pieces of your world");
    for (const h of ["Your work stays yours", "CreativeMind works beside you", "Feedback, not applause", "Ordinary days count"]) {
      await expect(visitor.getByRole("heading", { name: h })).toBeVisible();
    }
    // No invented proof: no numbers of users, no quotes, no certifications.
    await expect(visitor.getByText(/\d[\d,.]*\+? (creators|users|countries)|certified|testimonial/i)).toHaveCount(0);

    await visitor.getByRole("link", { name: "Get in touch" }).click();
    await expect(visitor).toHaveURL(/\/contact$/);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("We’d love to hear from you.");
    for (const h of ["Your data and privacy", "Security reports", "Something wrong on Wonder Creator"]) {
      await expect(visitor.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(visitor.getByRole("link", { name: /Make a privacy request/ })).toHaveAttribute("href", "/settings?section=privacy");
    await visitor.getByRole("link", { name: "Security", exact: true }).first().click();
    await expect(visitor).toHaveURL(/\/legal\/security$/);
    await visitor.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Contact" }).click();
    await expect(visitor).toHaveURL(/\/contact$/);

    for (const path of ["/about", "/contact"]) {
      for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
        await visitor.setViewportSize(size);
        await visitor.goto(path);
        expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
      }
      await visitor.addScriptTag({ content: axeSource });
      const serious = await visitor.evaluate(async () => {
        const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
      });
      expect(serious).toEqual([]);
    }
  });
});
