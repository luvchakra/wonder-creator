import { adminPatch, expect, saveNote, test, uid } from "./fixtures";

test.describe("Home Canvas", () => {
  test("begins calmly, then centres on the Creation in progress with one clear focus", async ({ page, creator }) => {
    void creator;
    // New creator: an editorial start, no chat box, no dashboard sections.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What would you like to begin with?" })).toBeVisible();
    await expect(page.getByLabel("What are you thinking about?")).toHaveCount(0);
    // The supplied artwork: one decorative floral corner, and the watercolor motif on the Palette trigger — both hidden
    // from assistive tech (the trigger keeps its own name).
    await expect(page.locator('main img[src*="/brand/watercolor/floral-corner"]')).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: "Open Creative Palette" }).locator('img[src*="/brand/kit/palette-button-master"]')).toHaveAttribute("alt", "");
    // One primary way to begin and one secondary (interaction minimalism); the rest is in the Palette.
    const begin = page.getByRole("region", { name: "What would you like to begin with?" });
    await expect(begin.getByRole("button", { name: /New Creation/ })).toBeVisible();
    await expect(begin.getByRole("link", { name: /Bring Material/ })).toBeVisible();
    // New Creation opens the same sheet as the Palette's Create — one place to start.
    await begin.getByRole("button", { name: /New Creation/ }).click();
    await expect(page.getByRole("dialog", { name: "Make a new Creation" }).getByRole("list", { name: "Formats" }).getByRole("button")).toHaveCount(6);
    await page.keyboard.press("Escape");

    // Creations in progress show as thin Continue rows (the last three edited); the "Continue ›" title opens them all.
    const title = `Harbour lights ${uid()}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await saveNote(page, `Night ferry sounds ${uid()}`);
    await page.goto("/");
    const rows = page.getByRole("list", { name: "Creations in progress" });
    await expect(rows.getByRole("link", { name: new RegExp(title) })).toContainText(/Poem · Edited (just now|\d+ min ago)/);
    await expect(page.getByRole("heading", { name: "My Creations" }).getByRole("link")).toHaveAttribute("href", "/creations");
    // Fewer buttons (owner, 4 Oct 2026): no "All …" rows — a section's title is its link.
    await expect(page.getByRole("link", { name: /^All (scraps|my creations|testimonials)$/ })).toHaveCount(0);
    // Sections only appear with something real in them: nothing happened, no one's waiting, nothing old to rediscover.
    for (const name of ["While you were away", "A little spark", "You could help"]) await expect(page.getByRole("region", { name })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Recent Materials" })).toHaveCount(0);
    // Continue lands in the Creative Studio (the boards' default view), not on the Creation page.
    await rows.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/(?:studio|write)$`));
  });

  test("Continue shows the last three Creations in progress as thin rows; its title opens them all", async ({ page, creator }) => {
    void creator;
    const tag = uid();
    const make = async (title: string) => ((await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string }).id;
    await make(`Oldest ${tag}`);
    for (const n of ["Second", "Third"]) await make(`${n} ${tag}`);
    const done = await make(`Finished ${tag}`);
    await adminPatch("artifacts", `id=eq.${done}`, { status: "final" });
    await make(`Newest ${tag}`);
    await page.goto("/");
    const rows = page.getByRole("list", { name: "Creations in progress" });
    // Newest first; a finished Creation and the fourth-newest draft don't take a row.
    await expect(rows.getByRole("link")).toHaveText([new RegExp(`Newest ${tag}`), new RegExp(`Third ${tag}`), new RegExp(`Second ${tag}`)]);
    await expect(page.locator("[data-primary-action]")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Continue Creating" })).toHaveCount(0);
    // My Scrapbook is a door under the greeting.
    await page.getByRole("navigation", { name: "Your captures and Scrapbook" }).getByRole("link", { name: /My Scrapbook/ }).click();
    await expect(page).toHaveURL(/\/scrapbook$/);
  });

  test("Home is calm: the two doors, then the fixed sections, each once; My Testimonials is always there", async ({ page, creator }) => {
    void creator;
    await page.goto("/");
    // My Scrapbook is no longer listed on Home (owner, 21 Oct 2026): a door to it, beside My captures.
    await expect(page.getByRole("region", { name: "My Scrapbook" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Your captures and Scrapbook" }).getByRole("link", { name: /My Scrapbook/ })).toHaveAttribute("href", "/scrapbook");
    for (const name of ["My Communities", "My Testimonials"]) await expect(page.getByRole("region", { name })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "My Testimonials" })).toContainText("Nobody has written one yet");
  });

  // Start small (owner, 8 Oct 2026; docs/ui-redesign/start-small.md): the next small step, read from what the creator has
  // actually done — catch, make, connect, collaborate — one at a time, never a checklist.
  test("start small: a line to begin, then the same line turned into a Creation, then a way to make it with someone", async ({ page, creator }) => {
    void creator;
    const tag = uid();
    // 1. Nothing yet: the line under the greeting invites one small thing; the capture row is the way in.
    await page.goto("/");
    await expect(page.getByText("Begin with one small thing — a line is enough.")).toBeVisible();

    // 2. Caught a note: Home moves on by itself, no reload — "make something from it", in the note's own words.
    await page.getByRole("button", { name: "Quick note" }).click();
    const sheet = page.getByRole("dialog", { name: "Quick note" });
    await sheet.getByLabel("Quick note").fill(`Rain on the tin roof ${tag}\nThe sound arrives before the train.`);
    await expect(sheet.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    const begin = page.getByRole("region", { name: "Make something from your note" });
    await expect(begin).toContainText(`Rain on the tin roof ${tag}`);
    await expect(page.getByText("Turn something you caught into a Creation.")).toBeVisible();
    // One action, and it opens the sheet with the words — here the same words, as the first draft.
    await begin.getByRole("button", { name: "Make something" }).click();
    const make = page.getByRole("dialog", { name: "Make a new Creation" });
    await expect(make.getByText(new RegExp(`Rain on the tin roof ${tag}`))).toBeVisible();
    await make.getByRole("button", { name: /^Writing/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}/);
    const id = /\/creations\/([0-9a-f-]{36})/.exec(page.url())![1];
    const { versions } = (await (await page.request.get(`/api/v1/artifacts/${id}/versions`)).json()) as { versions: Array<{ content: string }> };
    expect(versions[0]!.content).toContain(`Rain on the tin roof ${tag}`);

    // 3. Made something, in no community yet: no new card — the Communities section is the invitation already there.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Make something with someone/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Make something from your note" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Find people who make what you make/ })).toBeVisible();

    // 4. Joined a community: one quiet way to make something with someone — and it's gone once a Room exists.
    expect((await page.request.post("/api/v1/communities", { data: { title: `Tin roof makers ${tag}` } })).ok()).toBe(true);
    await page.goto("/");
    const together = page.getByRole("link", { name: /Make something with someone/ });
    await expect(together).toHaveAttribute("href", "/rooms?new=1");
    expect((await page.request.post("/api/v1/projects", { data: { title: `Rain song ${tag}`, brief: "Together." } })).ok()).toBe(true);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Make something with someone/ })).toHaveCount(0);
  });
});
