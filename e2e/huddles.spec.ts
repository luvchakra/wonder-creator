import { expect, newCreator, test, uid, type Page } from "./fixtures";

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
    await b.goto("/");
    const homeLive = b.getByRole("region").filter({ has: b.getByRole("heading", { name: "Live now" }) });
    await expect(liveCard(b, topic).or(homeLive.getByRole("article").filter({ hasText: topic }))).toBeVisible();
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

    // B saves A's line as an idea.
    await chat(b).getByRole("listitem").filter({ hasText: fromA }).getByRole("button", { name: "Save as idea" }).click();
    const preserve = b.getByRole("dialog", { name: "Save from this Huddle" });
    await expect(preserve.getByLabel("What do you want to keep?")).toHaveValue(fromA);
    await expect(preserve.getByLabel("Save as")).toHaveValue("idea");
    await preserve.getByRole("button", { name: "Save" }).click();
    await expect(preserve.getByText("Saved to your Creative Space.")).toBeVisible();
    const savedHref = await preserve.getByRole("link", { name: "View it" }).getAttribute("href");
    expect(savedHref).toMatch(/^\/space\/materials\/[0-9a-f-]{36}$/);
    await preserve.getByRole("button", { name: "Back to Huddle" }).click();
    await expect(preserve).toBeHidden();

    // B leaves; A is alone, the Huddle is still live.
    await b.getByRole("button", { name: "Leave" }).click();
    await b.waitForURL(/\/huddles$/);
    await expect(liveCard(b, topic)).toContainText("1 creator");
    await expect(a.getByRole("region", { name: "Participants" })).not.toContainText(creatorB.name, { timeout: 20_000 });

    // A leaves → the Huddle dissolves.
    await a.getByRole("button", { name: "Leave" }).click();
    await a.waitForURL(/\/huddles$/);
    await expect(liveCard(a, topic)).toHaveCount(0);
    await b.reload();
    await expect(liveCard(b, topic)).toHaveCount(0);

    for (const p of [a, b]) {
      await p.goto(`/huddles/${huddleId}`);
      await expect(p.getByRole("heading", { name: "This Huddle has ended" })).toBeVisible();
      await expect(p.getByRole("button", { name: "Request to Join" })).toHaveCount(0);
    }

    // What B saved outlives the Huddle.
    await b.goto("/space");
    const idea = b.getByRole("link").filter({ hasText: fromA.slice(0, 30) });
    await expect(idea).toBeVisible();
    await expect(idea).toContainText("Idea");
    await b.goto(savedHref!);
    await expect(b.getByText("Preserved from a Huddle")).toBeVisible();
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
    await c.getByRole("dialog", { name: "Search" }).getByRole("textbox", { name: "Search" }).fill(topic.split(" ")[0]);
    await expect(c.getByRole("dialog", { name: "Search" }).getByText(topic)).toHaveCount(0);
    await c.keyboard.press("Escape");

    // The host still sees it as theirs.
    await a.goto("/huddles");
    await expect(a.getByRole("link", { name: "Return to your live Huddle" })).toHaveAttribute("href", `/huddles/${huddleId}`);
    await a.goto(`/huddles/${huddleId}`);
    await a.getByRole("button", { name: "Leave" }).click();
    await a.waitForURL(/\/huddles$/);
  });
});
