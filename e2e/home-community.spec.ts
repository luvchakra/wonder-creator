import { adminPatch, creatorIdOf, expect, newCreator, test, uid } from "./fixtures";

// Home → From the community (owner, 1 Oct 2026): a calm glance at what's alive around the creator — never a feed.
test.describe("Home: from the community", () => {
  test("new work, a thought, an ask and someone to meet — people you follow first, with why, nothing repeated", async ({ page, creator, openContext }, info) => {
    const tag = uid();
    const { page: maya } = await openContext("maya");
    const m = await newCreator(maya, { name: `Maya ${tag}` });

    // Maya's public, finished poem; a public thought; a request for feedback; and a live Huddle.
    const poem = (await (await maya.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform 3 at dawn ${tag}`, content: "The train sighs.\nI stay a little longer." } })).json()).artifact as { id: string };
    await adminPatch("artifacts", `id=eq.${poem.id}`, { privacy: "public", status: "final" });
    expect((await maya.request.post("/api/v1/scrapbook", { data: { body: `Morning light in my garden ${tag}` } })).ok()).toBe(true);
    expect((await maya.request.post("/api/v1/open-conversations", { data: { intent: "critique", title: `Feedback on my opening shot ${tag}`, body: "Three minutes about morning routines." } })).ok()).toBe(true);
    await maya.goto("/huddles");
    await maya.getByRole("button", { name: "Start a Huddle" }).click();
    const dialog = maya.getByRole("dialog", { name: "Start a Huddle" });
    await dialog.getByLabel("What are you talking about? (optional)").fill(`Light and shadow ${tag}`);
    await dialog.getByRole("button", { name: /^Go live as / }).click();
    await maya.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);

    expect((await page.request.post(`/api/v1/creators/${await creatorIdOf(m.id)}/follow`, { data: { on: true } })).ok()).toBe(true);

    for (const [vp, size] of [
      ["mobile", { width: 390, height: 844 }],
      ["desktop", { width: 1280, height: 900 }],
    ] as const) {
      await page.setViewportSize(size);
      await page.goto("/");
      const glance = page.getByRole("region", { name: "From the community" });
      // Maya's live Huddle shows once on Home: "Worth hearing" already carries it (she's followed), so the glance doesn't repeat it.
      await expect(page.getByText(`Light and shadow ${tag}`)).toHaveCount(1);
      const work = glance.getByRole("list", { name: "New work from the community" });
      await expect(work).toContainText(`Platform 3 at dawn ${tag}`);
      await expect(work).toContainText(`You follow Maya`);
      await expect(glance).toContainText(`Morning light in my garden ${tag}`);
      await expect(glance).toContainText(`Feedback on my opening shot ${tag}`);
      await expect(glance).toContainText("Maya would like feedback");
      // Never popularity.
      await expect(glance.getByText(/likes|followers|trending|popular/i)).toHaveCount(0);
      await info.attach(`home-community-${vp}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      if (process.env.HOME_SHOTS) (await import("node:fs")).writeFileSync(`${process.env.HOME_SHOTS}/home-${vp}.png`, await page.screenshot({ fullPage: true }));
    }

    // Each part goes somewhere real.
    await page.getByRole("region", { name: "From the community" }).getByRole("link", { name: new RegExp(`Platform 3 at dawn ${tag}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${poem.id}$`));
    expect(creator.handle).toBeTruthy();
  });
});
