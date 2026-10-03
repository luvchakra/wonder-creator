import { creatorIdOf, expect, newCreator, test, uid, type Page } from "./fixtures";

/** The live card on /huddles or Home for a given topic. */
function liveCard(page: Page, topic: string) {
  return page.getByRole("article").filter({ hasText: `Talking about ${topic}` });
}

async function startHuddle(page: Page, topic: string, discoverable = true): Promise<string> {
  await page.goto("/huddles");
  await page.getByRole("button", { name: "Start a Huddle" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a Huddle" });
  await dialog.getByLabel("What are you talking about? (optional)").fill(topic);
  const sw = dialog.getByRole("switch", { name: "Discoverable" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  if (!discoverable) {
    await sw.click();
    await expect(dialog.getByText("Only creators you invite can see it.")).toBeVisible();
  }
  await dialog.getByRole("button", { name: /^Go live as / }).click();
  await page.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: `Talking about ${topic}` })).toBeVisible();
  return page.url().split("/").pop()!;
}

function chat(page: Page) {
  return page.getByRole("region", { name: "Chat" });
}

async function say(page: Page, text: string) {
  await chat(page).getByRole("textbox", { name: "Message" }).fill(text);
  await chat(page).getByRole("button", { name: "Send message" }).click();
  await expect(chat(page).getByRole("listitem").filter({ hasText: text })).toContainText("You");
}

test.describe("Huddles", () => {
  test("a media token is only issued to joined participants", async ({ page, creator }) => {
    void creator;
    const res = await page.request.post(`/api/v1/huddles/${"00000000-0000-4000-8000-000000000000"}/media-token`);
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  test("public Huddle: request → accept → chat → preserve → leave → dissolve", async ({ page: a, creator: creatorA, openContext }) => {
    test.setTimeout(240_000);
    const { page: b } = await openContext("B");
    const creatorB = await newCreator(b, { name: `Bea ${uid()}` });
    const topic = `independent film ${uid()}`;

    // A goes live.
    const huddleId = await startHuddle(a, topic);
    await expect(a.getByRole("region", { name: "Participants" })).toContainText(`${creatorA.name} (you)`);
    await expect(a.getByText("Voice and video aren't connected in this environment yet. Text chat is live.")).toBeVisible();

    // B discovers it on /huddles and on Home.
    await b.goto("/huddles");
    const card = liveCard(b, topic);
    await expect(card).toBeVisible();
    await expect(card).toContainText(creatorA.firstName);
    await expect(card).toContainText("1 creator");
    // Home shows a live Huddle that's relevant to you — here, one with someone B follows.
    expect((await b.request.post(`/api/v1/creators/${await creatorIdOf(creatorA.id)}/follow`, { data: { on: true } })).ok()).toBe(true);
    await b.goto("/");
    const worth = b.getByRole("region", { name: "My Communities" });
    await expect(worth).toContainText("Live Huddle");
    await expect(worth.getByRole("link", { name: new RegExp(topic) })).toHaveAttribute("href", `/huddles/${huddleId}`);
    await b.goto("/huddles");
    await liveCard(b, topic).getByRole("link", { name: "Request to Join" }).click();
    await expect(b).toHaveURL(new RegExp(`/huddles/${huddleId}$`));

    // B asks to join with a message.
    await expect(b.getByRole("heading", { level: 1 })).toContainText(creatorA.firstName);
    await expect(b.getByText(`Talking about ${topic}`)).toBeVisible();
    await b.getByLabel("Say hello (optional)").fill("Working on a harbour documentary — may I listen in?");
    await b.getByRole("button", { name: "Request to Join" }).click();
    await expect(b.getByRole("status").filter({ hasText: "Request sent — waiting for someone inside to accept." })).toBeVisible();

    // A sees the request and accepts.
    const requests = a.getByRole("region", { name: "Join requests" });
    await expect(requests).toContainText(creatorB.name, { timeout: 20_000 });
    await expect(requests).toContainText("Working on a harbour documentary — may I listen in?");
    await requests.getByRole("button", { name: "Accept" }).click();
    await expect(requests).toBeHidden();

    // B is let in and enters.
    await expect(b.getByText("You've been let in.")).toBeVisible({ timeout: 20_000 });
    await b.getByRole("button", { name: "Enter Huddle" }).click();
    await expect(b.getByRole("heading", { level: 1, name: `Talking about ${topic}` })).toBeVisible();
    await expect(b.getByRole("region", { name: "Participants" })).toContainText(`${creatorB.name} (you)`);
    await expect(b.getByRole("region", { name: "Participants" })).toContainText(creatorA.name);
    await expect(a.getByRole("region", { name: "Participants" })).toContainText(creatorB.name, { timeout: 20_000 });

    // Text chat both ways.
    const fromA = `What if the lighthouse is the narrator? ${uid()}`;
    const fromB = `Yes — and the tide is its memory. ${uid()}`;
    await say(a, fromA);
    await expect(chat(b).getByRole("listitem").filter({ hasText: fromA })).toContainText(creatorA.name, { timeout: 20_000 });
    await say(b, fromB);
    await expect(chat(a).getByRole("listitem").filter({ hasText: fromB })).toContainText(creatorB.name, { timeout: 20_000 });

    // Nothing is assumed: B can save their own line, but not A's (saving chat is off).
    await expect(b.getByText("Nothing is recorded or transcribed. You can save only your own messages.")).toBeVisible();
    await expect(chat(b).getByRole("listitem").filter({ hasText: fromA }).getByRole("button", { name: /^Save/ })).toHaveCount(0);
    await chat(b).getByRole("listitem").filter({ hasText: fromB }).getByRole("button", { name: /^Save/ }).click();
    await expect(b.getByRole("status").filter({ hasText: "Saved to your Creative Space." })).toBeVisible();

    // The host allows saving from now on; A's next line can be saved by B, credited to A.
    await a.getByRole("button", { name: "More" }).click();
    await a.getByRole("menuitem", { name: "Let people save chat from now on" }).click();
    await expect(a.getByText(/Anyone can save chat messages sent since/)).toBeVisible();
    const later = `The keeper keeps a logbook. ${uid()}`;
    await say(a, later);
    const laterItem = chat(b).getByRole("listitem").filter({ hasText: later });
    await expect(laterItem).toBeVisible({ timeout: 20_000 });
    await expect(chat(b).getByRole("listitem").filter({ hasText: fromA }).getByRole("button", { name: /^Save/ })).toHaveCount(0);
    const saving = b.waitForResponse((r) => r.url().endsWith(`/api/v1/huddles/${huddleId}/moments`) && r.request().method() === "POST");
    await laterItem.getByRole("button", { name: /^Save/ }).click();
    const savedId = ((await (await saving).json()) as { material: { id: string } }).material.id;
    const savedHref = `/materials/${savedId}`;
    await expect(b.getByRole("status").filter({ hasText: "Saved to your Creative Space." }).getByRole("link", { name: "View it" })).toHaveAttribute("href", savedHref);

    // B leaves → B's summary; A is alone, the Huddle is still live.
    await b.getByRole("button", { name: "Leave" }).click();
    await b.waitForURL(new RegExp(`/huddles/${huddleId}/summary$`));
    await expect(b.getByRole("heading", { level: 1, name: `Talking about ${topic}` })).toBeVisible();
    await expect(b.getByText("You left this Huddle.")).toBeVisible();
    await expect(b.getByRole("region", { name: "What you saved" }).getByRole("listitem")).toHaveCount(2);
    await b.goto("/huddles");
    await expect(liveCard(b, topic)).toContainText("1 creator");
    await expect(a.getByRole("region", { name: "Participants" })).not.toContainText(creatorB.name, { timeout: 20_000 });

    // A leaves → the Huddle dissolves; A's summary shows who they met.
    await a.getByRole("button", { name: "Leave" }).click();
    await a.waitForURL(new RegExp(`/huddles/${huddleId}/summary$`));
    await expect(a.getByText("This Huddle has ended.")).toBeVisible();
    await expect(a.getByRole("region", { name: "People you met" })).toContainText(creatorB.name);
    await a.getByLabel("Add a note from this Huddle").fill("Try the lighthouse as narrator.");
    await a.getByRole("button", { name: "Save note" }).click();
    await expect(a.getByRole("region", { name: "What you saved" }).getByRole("listitem")).toHaveCount(1);
    await a.goto("/huddles");
    await expect(liveCard(a, topic)).toHaveCount(0);
    await a.getByRole("navigation", { name: "Huddle views" }).getByRole("link", { name: "My Huddles" }).click();
    await expect(a.getByRole("region", { name: "Your recent Huddles" })).toContainText(`Talking about ${topic}`);
    await a.goto("/huddles");
    await b.reload();
    await expect(liveCard(b, topic)).toHaveCount(0);

    for (const p of [a, b]) {
      await p.goto(`/huddles/${huddleId}`);
      await expect(p.getByRole("heading", { name: "This Huddle has ended" })).toBeVisible();
      await expect(p.getByRole("button", { name: "Request to Join" })).toHaveCount(0);
      await expect(p.getByRole("link", { name: "Your Huddle summary" })).toHaveAttribute("href", `/huddles/${huddleId}/summary`);
    }

    // What B saved outlives the Huddle, credited to A.
    await b.goto(savedHref!);
    await expect(b.getByText("Preserved from a Huddle")).toBeVisible();
    await expect(b.getByText(`— ${creatorA.name}`)).toBeVisible();
  });

  test("an invite-only Huddle is not discoverable by other creators", async ({ page: a, creator: _creatorA, openContext }) => {
    const { page: c } = await openContext("C");
    await newCreator(c);
    const topic = `private sketch ${uid()}`;
    const huddleId = await startHuddle(a, topic, false);

    // Not listed for C…
    await c.goto("/huddles");
    await expect(c.getByRole("heading", { name: "Live Huddles" })).toBeVisible();
    await expect(liveCard(c, topic)).toHaveCount(0);
    await c.goto("/");
    await expect(c.getByText(`Talking about ${topic}`)).toHaveCount(0);
    // …and opening its URL reveals nothing and offers no way in.
    await c.goto(`/huddles/${huddleId}`);
    await expect(c.getByText(topic)).toHaveCount(0);
    await expect(c.getByRole("button", { name: "Request to Join" })).toHaveCount(0);
    await expect(c.getByRole("heading", { level: 1 })).toBeVisible();

    // Search doesn't reveal it either.
    await c.getByRole("button", { name: "Search your creativity" }).click();
    await c.getByRole("search", { name: "Search" }).getByRole("textbox", { name: "Search" }).fill(topic.split(" ")[0]);
    await expect(c.getByRole("search", { name: "Search" }).getByText(topic)).toHaveCount(0);
    await c.keyboard.press("Escape");

    // The host still sees it as theirs.
    await a.goto("/huddles");
    await expect(a.getByRole("link", { name: "Return to your live Huddle" })).toHaveAttribute("href", `/huddles/${huddleId}`);
    await a.goto(`/huddles/${huddleId}`);
    await a.getByRole("button", { name: "Leave" }).click();
    await a.waitForURL(new RegExp(`/huddles/${huddleId}/summary$`));
  });

  test("start about a piece, with a description and an invite; the invitee can decline", async ({ page: a, creator: _creatorA, openContext }) => {
    test.setTimeout(120_000);
    const { page: b } = await openContext("B");
    const creatorB = await newCreator(b, { name: `Mira ${uid()}` });
    const res = await a.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Tide poem ${uid()}` } });
    const art = (await res.json()).artifact as { id: string; title: string };

    await a.goto(`/creations/${art.id}`);
    await a.getByRole("button", { name: "More actions" }).click();
    await a.getByRole("menuitem", { name: "Start a Huddle about this" }).click();
    const dialog = a.getByRole("dialog", { name: "Start a Huddle" });
    await expect(dialog.getByLabel("What are you talking about? (optional)")).toHaveValue(art.title);
    await expect(dialog.getByRole("switch", { name: `Talk about ${art.title}` })).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByRole("switch", { name: "Let people save chat moments" })).toHaveAttribute("aria-checked", "false");
    await dialog.getByLabel("Anything else? (optional)").fill("A first read-through.");
    await dialog.getByLabel("Invite creators (optional)").fill(creatorB.handle);
    await dialog.getByRole("button", { name: `Add ${creatorB.name}` }).click();
    await expect(dialog.getByRole("list", { name: "Inviting" })).toContainText(creatorB.name);
    await dialog.getByRole("button", { name: /^Go live as / }).click();
    await a.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);
    const huddleId = a.url().split("/").pop()!;
    await expect(a.getByText("A first read-through.")).toBeVisible();
    await expect(a.getByRole("link", { name: art.title })).toHaveAttribute("href", `/creations/${art.id}`);
    await expect(a.getByRole("region", { name: "Invitations" })).toContainText(`${creatorB.name} · invited`);

    // B is invited, and declines.
    await b.goto(`/huddles/${huddleId}`);
    await expect(b.getByText("You're invited.")).toBeVisible();
    await b.getByRole("button", { name: "Decline" }).click();
    await expect(b.getByText("You're invited.")).toHaveCount(0);
    await expect(a.getByRole("region", { name: "Invitations" })).toContainText(`${creatorB.name} · declined`, { timeout: 20_000 });

    await a.getByRole("button", { name: "Leave" }).click();
    await a.waitForURL(new RegExp(`/huddles/${huddleId}/summary$`));
    await expect(a.getByText("Nobody else joined this time.")).toBeVisible();
  });
});
