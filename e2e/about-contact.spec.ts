import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { adminSelect, expect, test, uid } from "./fixtures";

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

  // "Send us a message" (owner, 8 Oct 2026, like WonderJobs): open to anyone; saved on our side first, then mailed when a
  // mailbox is connected (it isn't here, so the row says it wasn't).
  test("anyone can send a message from Contact: it's saved once, a retry doesn't duplicate it, bots are told it worked and nothing is kept", async ({ browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    const tag = uid();
    const email = `visitor-${tag}@example.com`;
    await visitor.goto("/contact");
    const form = visitor.getByRole("form", { name: "Send us a message" });
    await expect(form).toBeVisible();
    // The bot trap is out of sight (far off-screen, hidden from screen readers) and out of the tab order.
    const trap = visitor.locator("#contact-company");
    expect((await trap.boundingBox())!.x).toBeLessThan(-1000);
    await expect(trap).toHaveAttribute("tabindex", "-1");
    await expect(visitor.getByRole("textbox", { name: "Company" })).toHaveCount(0);
    // Too short is said plainly, in the browser, before anything is sent.
    await form.getByLabel("Your name").fill("Asha Rao");
    await form.getByLabel("Your email").fill(email);
    await form.getByLabel("About").selectOption("feedback");
    await form.getByLabel("Your message").fill("Short");
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(visitor.getByRole("status")).toHaveCount(0);
    expect(await adminSelect("contact_messages", `email=eq.${encodeURIComponent(email)}&select=id`)).toHaveLength(0);

    await form.getByLabel("Your message").fill(`The Contact page is lovely, ${tag}.\nOne small idea inside.`);
    await form.getByRole("button", { name: "Send message" }).click();
    const done = visitor.getByRole("status").filter({ hasText: "Message sent" });
    await expect(done).toBeVisible();
    await expect(done).toContainText(`We’ll reply to ${email}`);
    const rows = await adminSelect<{ name: string; topic: string; message: string; page: string; notified_at: string | null; client_id: string }>("contact_messages", `email=eq.${encodeURIComponent(email)}&select=name,topic,message,page,notified_at,client_id`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Asha Rao", topic: "feedback", page: "/contact", notified_at: null });
    expect(rows[0]!.message).toContain(`lovely, ${tag}`);

    // The same message sent again (a double tap, a retry) lands once.
    const again = await visitor.request.post("/api/v1/contact", { data: { clientId: rows[0]!.client_id, name: "Asha Rao", email, topic: "feedback", message: `The Contact page is lovely, ${tag}.\nOne small idea inside.` } });
    expect(await again.json()).toMatchObject({ ok: true, duplicate: true });
    expect(await adminSelect("contact_messages", `email=eq.${encodeURIComponent(email)}&select=id`)).toHaveLength(1);

    // A bot that fills the hidden field is told it worked; nothing is kept.
    const botEmail = `bot-${tag}@example.com`;
    const bot = await visitor.request.post("/api/v1/contact", { data: { clientId: crypto.randomUUID(), name: "Bot Bot", email: botEmail, message: "Buy my thing, buy my thing.", company: "Acme" } });
    expect(await bot.json()).toMatchObject({ ok: true });
    expect(await adminSelect("contact_messages", `email=eq.${encodeURIComponent(botEmail)}&select=id`)).toHaveLength(0);

    // The server says what's wrong in plain words, too.
    const bad = await visitor.request.post("/api/v1/contact", { data: { clientId: crypto.randomUUID(), name: "Asha Rao", email: "nope", message: "A message long enough to pass." } });
    expect(bad.status()).toBe(422);
    expect((await bad.json()).error.message).toBe("Add a valid email so we can reply.");

    // Send another starts clean.
    await visitor.getByRole("button", { name: "Send another" }).click();
    await expect(form.getByLabel("Your message")).toHaveValue("");
  });
});
