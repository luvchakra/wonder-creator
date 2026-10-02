import { expect, seedCarousel, test, uid } from "./fixtures";

// CreatorPublish — one public home, many ways to experience a Creation (docs/creator-publish.md).
test.describe("CreatorPublish pages", () => {
  test("publish a poem into your own space: a stable link, lines kept, and edits stay private until you update it", async ({ page, creator, browser }) => {
    const tag = uid();
    const title = `A Softer Morning ${tag}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title, content: "The morning is softer\n  when I don't rush it.\n\nThere is beauty\nin the ordinary." } })).json()).artifact as { id: string };
    await page.goto(`/creations/${art.id}/publish`);
    const on = page.getByRole("region", { name: "On your page" });
    await expect(on).toContainText("Publish into your own space, then share the link anywhere.");
    await on.getByRole("button", { name: "Publish…" }).click();
    const sheet = page.getByRole("dialog", { name: `Publish ${title}` });
    await expect(sheet.getByRole("radio", { name: "Public on my page" })).toHaveAttribute("aria-checked", "true");
    await expect(sheet.getByText("Experience: Read")).toBeVisible();
    await expect(sheet.getByRole("radiogroup", { name: "Treatment" }).getByRole("radio")).toHaveText(["Page", "Centered", "Reading + Voice"]);
    await sheet.getByRole("button", { name: "Publish", exact: true }).click();
    const path = `/p/${creator.handle}/a-softer-morning-${tag.toLowerCase()}`;
    await expect(on.getByRole("link", { name: new RegExp(path) })).toBeVisible();
    await expect(on).toContainText("published version 1");

    // Anyone can read it, signed out: the poem's lines and indentation as written.
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(path);
    await expect(guest.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(guest.getByText("A poem by")).toBeVisible();
    expect(await guest.locator("main .whitespace-pre-wrap").innerText()).toContain("The morning is softer\n  when I don't rush it.\n\nThere is beauty");
    await expect(guest.getByRole("region", { name: "Rights and credits" })).toContainText("published version 1");

    // Keep editing privately: the public page doesn't move.
    const cur = (await (await page.request.get(`/api/v1/artifacts/${art.id}`)).json()).artifact as { current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: `A new ending ${tag}.`, baseVersionId: cur.current_version_id, label: "Rewrite" } });
    await guest.reload();
    await expect(guest.getByText(`A new ending ${tag}.`)).toHaveCount(0);
    await page.reload();
    await expect(on.getByRole("status")).toContainText("Changes since publishing");
    await on.getByRole("button", { name: "Update published version" }).click();
    await expect(on).toContainText("published version 2");
    await guest.reload();
    await expect(guest.getByText(`A new ending ${tag}.`)).toBeVisible();
    await expect(guest).toHaveURL(new RegExp(`${path}$`));
    // A share preview shaped for the work.
    const og = await guest.request.get(`${path}/opengraph-image`);
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    const html = await (await guest.request.get(path)).text();
    expect(html).toContain('property="og:title"');
  });

  test("the Creator Page shows only what you chose; a carousel swipes natively for signed-out readers", async ({ page, creator, browser }) => {
    const tag = uid();
    const c = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `A Life in Moments ${tag}`, content: "One. Two. Three." } })).json()).artifact as { id: string };
    await seedCarousel(creator.id, c.id, ["First light", "Second wind", "Third act"]);
    expect((await page.request.post(`/api/v1/artifacts/${c.id}/publication`, { data: { visibility: "public", featured: true } })).ok()).toBe(true);
    const hidden = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "essay", title: `Only with the link ${tag}`, content: "Unlisted words." } })).json()).artifact as { id: string };
    expect((await page.request.post(`/api/v1/artifacts/${hidden.id}/publication`, { data: { visibility: "unlisted" } })).ok()).toBe(true);

    const guest = await (await browser.newContext()).newPage();
    // Not public until the creator says so.
    expect((await guest.request.get(`/p/${creator.handle}`)).status()).toBe(404);
    await page.goto("/creator-page");
    await page.getByRole("switch", { name: "Page is public" }).click();
    await page.getByLabel("Headline").fill("Writer · Photographer");
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await guest.goto(`/p/${creator.handle}`);
    await expect(guest.getByText("Writer · Photographer")).toBeVisible();
    const featured = guest.getByRole("region", { name: "Featured" });
    await expect(featured).toContainText(`A Life in Moments ${tag}`);
    await expect(featured).toContainText("Visual story · 3 slides");
    await expect(guest.getByText(`Only with the link ${tag}`)).toHaveCount(0);
    await expect(guest.getByText(/followers|likes/i)).toHaveCount(0);

    await featured.getByRole("link", { name: new RegExp(`A Life in Moments ${tag}`) }).click();
    const story = guest.getByRole("region", { name: `A Life in Moments ${tag}` });
    await expect(story.getByRole("group", { name: "1 of 3" })).toBeVisible();
    await story.getByLabel(/^Slide 1 of 3/).focus();
    await guest.keyboard.press("ArrowRight");
    await expect(guest.getByText("Slide 2 of 3", { exact: true })).toBeAttached();
    // The words are real text, not only pixels.
    await expect(story).toContainText("Second wind");
  });
});
