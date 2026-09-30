import type { Page } from "@playwright/test";
import { expect, newCreator, seedCarousel, test, uid } from "./fixtures";

// Creator Page templates (docs/creator-page-templates.md): one curated page, five visual lenses.
const TEMPLATES = ["immersive_artistic", "minimal_editorial", "cinematic_dark", "creative_collage", "soft_gradient"] as const;

async function publishWork(page: Page, artifactType: string, title: string, content: string, opts: { featured?: boolean } = {}) {
  const a = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType, title, content } })).json()).artifact as { id: string };
  expect((await page.request.post(`/api/v1/artifacts/${a.id}/publication`, { data: { visibility: "public", featured: opts.featured ?? false } })).ok()).toBe(true);
  return a.id;
}

test.describe("Creator Page templates", () => {
  test("Profile → Creator Page → preview → use a template → publish: same address, same content, settings restored when switching back", async ({ page, creator, browser }) => {
    const tag = uid();
    await publishWork(page, "poem", `Chand Amavas ${tag}`, "The moon wanes,\n  slipping into the new moon's pocket.");

    await page.goto(`/creators/${creator.handle}`);
    await page.getByRole("region", { name: "Profile" }).getByRole("link", { name: "Creator Page" }).click();
    await expect(page).toHaveURL(/\/creator-page$/);
    const look = page.getByRole("region", { name: "Appearance" });
    await expect(look).toContainText("Current: Soft Gradient");

    // Picking a card only previews it, with the creator's own work.
    await look.getByRole("button", { name: "Preview Cinematic Dark" }).click();
    await expect(look.locator('[data-template="cinematic_dark"]')).toContainText(`Chand Amavas ${tag}`);
    await look.getByRole("radio", { name: "Desktop" }).click();
    await expect(look.getByRole("img", { name: "Preview of your page in Cinematic Dark" })).toBeVisible();
    await look.getByRole("button", { name: "Use this template" }).click();
    await expect(look.getByRole("status")).toContainText("Your page now uses Cinematic Dark");
    await expect(look).toContainText("Current: Cinematic Dark");
    await look.getByRole("group", { name: "Cinematic Dark settings" }).getByRole("radio", { name: "Cool" }).click();

    await page.getByRole("switch", { name: "Page is public" }).click();
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const guest = await (await browser.newContext()).newPage();
    const url = `/p/${creator.handle}`;
    await guest.goto(url);
    await expect(guest.locator('[data-template="cinematic_dark"]')).toBeVisible();
    await expect(guest.getByRole("heading", { level: 1 })).toHaveText(creator.name);
    await expect(guest.getByText("Previewing your page")).toHaveCount(0);

    // Switch to Editorial and back: same address, same work, Cinematic's own settings kept.
    await page.reload();
    await look.getByRole("button", { name: "Preview Minimal Editorial" }).click();
    await look.getByRole("button", { name: "Use this template" }).click();
    await expect(look).toContainText("Current: Minimal Editorial");
    await guest.reload();
    await expect(guest).toHaveURL(new RegExp(`${url}$`));
    await expect(guest.locator('[data-template="minimal_editorial"]')).toContainText(`Chand Amavas ${tag}`);
    await look.getByRole("button", { name: /Preview Cinematic Dark/ }).click();
    await expect(look.getByRole("group", { name: "Cinematic Dark settings" }).getByRole("radio", { name: "Cool" })).toHaveAttribute("aria-checked", "true");

    // The owner sees a quiet way back to editing on their public page.
    await page.goto(url);
    await expect(page.getByText("Previewing your page")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Creator Page" })).toHaveAttribute("href", "/creator-page");
  });

  test("every template × phone and desktop × rich and sparse content renders cleanly (screenshots attached)", async ({ page, creator, browser }, info) => {
    test.setTimeout(240_000);
    const tag = uid();
    // Rich: mixed work — poem (text only), essay, carousel (featured), spoken word — plus moments, a DejaVu, open-to, links.
    const poem = await publishWork(page, "poem", `Between Here and Home ${tag}`, "Stillness finds me\nin the spaces between\ndaylight and dreams.");
    await publishWork(page, "essay", `Notes from a Moving Train ${tag}`, "Reflections on travel, home and belonging.");
    const c = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Small Joys ${tag}`, content: "One. Two. Three." } })).json()).artifact as { id: string };
    await seedCarousel(creator.id, c.id, ["Tea", "Light", "Rain"]);
    expect((await page.request.post(`/api/v1/artifacts/${c.id}/publication`, { data: { visibility: "public", featured: true } })).ok()).toBe(true);
    const dv = (await (await page.request.post("/api/v1/dejavus", { data: { name: `railways ${tag}` } })).json()).dejavu.id as string;
    expect((await page.request.post(`/api/v1/dejavus/${dv}/moments`, { data: { entityType: "creation", entityId: poem } })).ok()).toBe(true);
    const moments: string[] = [];
    for (const body of ["that kind of a day", "“Same sky, different chapter.”", "So much to do, so less time!"]) moments.push((await (await page.request.post("/api/v1/scrapbook", { data: { body } })).json()).id);
    expect((await page.request.patch("/api/v1/creator-page", { data: { isPublished: true, headline: "Stories, places and everyday moments that stay with us.", publicDejaVuIds: [dv], publicMomentIds: moments, links: [{ label: "kunal.me", url: "https://kunal.me" }] } })).ok()).toBe(true);

    // Sparse: one creation, nothing else.
    const sparsePage = await (await browser.newContext()).newPage();
    const sparse = await newCreator(sparsePage);
    await publishWork(sparsePage, "poem", `Only one ${tag}`, "A single small poem.");
    expect((await sparsePage.request.patch("/api/v1/creator-page", { data: { isPublished: true } })).ok()).toBe(true);

    const guest = await (await browser.newContext()).newPage();
    for (const [label, owner, handle] of [
      ["rich", page, creator.handle],
      ["sparse", sparsePage, sparse.handle],
    ] as const) {
      for (const t of TEMPLATES) {
        expect((await owner.request.patch("/api/v1/creator-page", { data: { templateId: t } })).ok()).toBe(true);
        for (const [vp, size] of [
          ["mobile", { width: 390, height: 844 }],
          ["desktop", { width: 1280, height: 900 }],
        ] as const) {
          await guest.setViewportSize(size);
          await guest.goto(`/p/${handle}`);
          await expect(guest.locator(`[data-template="${t}"]`)).toBeVisible();
          await expect(guest.getByRole("heading", { level: 1 })).toBeVisible();
          // No sideways scrolling, no empty sections, no zero counts, no popularity.
          expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
          await expect(guest.getByText(/\b0 (pieces|creations|moments)\b|followers|likes/i)).toHaveCount(0);
          if (label === "rich") {
            await expect(guest.getByRole("region", { name: "Featured" })).toContainText(`Small Joys ${tag}`);
            await expect(guest.getByRole("region", { name: "DejaVu" })).toContainText(`railways ${tag}`);
            await expect(guest.getByRole("region", { name: "Moments" })).toContainText("Same sky, different chapter.");
          } else {
            await expect(guest.getByRole("region", { name: "DejaVu" })).toHaveCount(0);
            await expect(guest.getByRole("region", { name: "Moments" })).toHaveCount(0);
          }
          const shot = await guest.screenshot({ fullPage: true });
          await info.attach(`${t}-${vp}-${label}.png`, { body: shot, contentType: "image/png" });
          if (process.env.CREATOR_PAGE_SHOTS) {
            const { writeFileSync } = await import("node:fs");
            writeFileSync(`${process.env.CREATOR_PAGE_SHOTS}/${t}-${vp}-${label}.png`, shot);
          }
        }
      }
    }
  });
});
