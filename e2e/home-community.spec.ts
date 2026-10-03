import { adminPatch, creatorIdOf, expect, newCreator, saveNote, test, uid } from "./fixtures";

// Home → From Pulse (was “From the community”) (owner, 1 Oct 2026): a calm glance at what's alive around the creator — never a feed.
test.describe("Home: from Pulse", () => {
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
      const glance = page.getByRole("region", { name: "From Pulse" });
      // Maya's live Huddle shows once on Home: "the Communities row already carries it (she's followed), so the glance doesn't repeat it.
      await expect(page.getByText(`Light and shadow ${tag}`)).toHaveCount(1);
      const work = glance.getByRole("list", { name: "New work from Pulse" });
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
    await page.getByRole("region", { name: "From Pulse" }).getByRole("link", { name: new RegExp(`Platform 3 at dawn ${tag}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${poem.id}$`));
    expect(creator.handle).toBeTruthy();
  });

  test("this week in words, a conversation you joined moving on, and new work from your Creative Rooms", async ({ page, creator: _me, openContext }) => {
    test.setTimeout(120_000);
    const tag = uid();
    const { page: jo } = await openContext("jo");
    const j = await newCreator(jo, { name: `Jo ${tag}` });
    const joId = await creatorIdOf(j.id);

    // This week: Jo shares a public, finished short film and asks for feedback.
    const film = (await (await jo.request.post("/api/v1/artifacts", { data: { artifactType: "short_film", title: `Harbour lights ${tag}`, content: "INT. FERRY — NIGHT" } })).json()).artifact as { id: string };
    await adminPatch("artifacts", `id=eq.${film.id}`, { privacy: "public", status: "final" });
    const conv = (await (await jo.request.post("/api/v1/open-conversations", { data: { intent: "discuss", title: `On slowness ${tag}` } })).json()).conversation.id as string;
    const conv2 = (await (await jo.request.post("/api/v1/open-conversations", { data: { intent: "discuss", title: `On waiting ${tag}` } })).json()).conversation.id as string;
    // I join both conversations; Jo answers afterwards.
    for (const c of [conv, conv2]) {
      expect((await page.request.post(`/api/v1/open-conversations/${c}/replies`, { data: { body: "I walk to notice." } })).ok()).toBe(true);
      expect((await jo.request.post(`/api/v1/open-conversations/${c}/replies`, { data: { body: "The long way home." } })).ok()).toBe(true);
    }

    // My Creative Room, with Jo in its crew sharing a note.
    const { project } = (await (await page.request.post("/api/v1/projects", { data: { title: `Coastline film ${tag}`, status: "active" } })).json()) as { project: { id: string } };
    const { crew } = (await (await page.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    expect((await page.request.post(`/api/v1/crews/${crew.id}/members`, { data: { creatorId: joId, roleTitle: "Editor" } })).ok()).toBeTruthy();
    expect((await jo.request.post(`/api/v1/crews/${crew.id}/respond`, { data: { accept: true } })).ok()).toBeTruthy();
    const noteId = await saveNote(jo, `Cut list for the harbour scene ${tag}`);
    expect((await jo.request.post(`/api/v1/projects/${project.id}/items`, { data: { kind: "material", ids: [noteId], shared: true } })).ok()).toBeTruthy();

    await page.goto("/");
    const glance = page.getByRole("region", { name: "From Pulse" });
    await expect(glance).toContainText("short films");
    await expect(glance.getByText(/This week in Pulse/)).toBeAttached();
    // One joined conversation is the Communities row; the other is the catch-up line — each shown once.
    const moved = glance.getByRole("link", { name: /A conversation you joined has moved on/ });
    await expect(moved).toContainText("1 new reply");
    await expect(page.getByText(`On slowness ${tag}`)).toHaveCount(1);
    await expect(page.getByText(`On waiting ${tag}`)).toHaveCount(1);
    const rooms = page.getByRole("region", { name: "New in your Creative Rooms" });
    await expect(rooms).toContainText(`Cut list for the harbour scene ${tag}`);
    await expect(rooms).toContainText(`Coastline film ${tag}`);
    await rooms.getByRole("link", { name: new RegExp(`Cut list for the harbour scene ${tag}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${project.id}/shared/`));
  });

  test("followers and following on the Profile, with lists that open from the counts", async ({ page, creator, openContext }) => {
    const tag = uid();
    const { page: kim } = await openContext("kim");
    const k = await newCreator(kim, { name: `Kim ${tag}` });
    const kimId = await creatorIdOf(k.id);
    expect((await kim.request.post(`/api/v1/creators/${await creatorIdOf(creator.id)}/follow`, { data: { on: true } })).ok()).toBe(true);

    await page.goto(`/creators/${creator.handle}`);
    const counts = page.getByLabel("Followers and following");
    await expect(counts).toContainText("1 follower");
    await expect(counts).toContainText("0 following");
    await counts.getByRole("link", { name: /follower/ }).click();
    await expect(page).toHaveURL(new RegExp(`/creators/${creator.handle}/followers$`));
    const list = page.getByRole("list", { name: "Followers" });
    await expect(list).toContainText(`Kim ${tag}`);
    // Follow back from the list; my Following count follows.
    await list.getByRole("button", { name: `Follow Kim ${tag}` }).click();
    await expect(list.getByRole("button", { name: `Unfollow Kim ${tag}` })).toHaveAttribute("aria-pressed", "true");
    await page.goto(`/creators/${creator.handle}`);
    await expect(page.getByLabel("Followers and following")).toContainText("1 following");

    // On Kim's profile I see that Kim follows me.
    await page.goto(`/creators/${k.handle}`);
    await expect(page.getByLabel("Followers and following")).toContainText("Follows you");
    expect(kimId).toBeTruthy();
  });
});

