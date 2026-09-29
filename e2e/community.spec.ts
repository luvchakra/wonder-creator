import { expect, newCreator, test, uid } from "./fixtures";

// Phase 03 — Community + Open Conversations (docs/phases/03-community-open-conversations.md §21).

test.describe("Community", () => {
  test("a critique request: asked in the open, found under Help, answered, caught up on from Home — and nothing popular about it", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const title = `Does slide 3 feel too literal ${tag}?`;

    // Community lives inside Explore; a conversation starts from a sheet, intent first.
    await page.goto("/search");
    await page.getByRole("navigation", { name: "Explore" }).getByRole("link", { name: "Community" }).click();
    await expect(page).toHaveURL(/\/community$/);
    await expect(page.getByRole("navigation", { name: "Community" }).getByRole("link")).toHaveText(["For you", "Conversations", "Help", "People"]);
    await page.getByRole("button", { name: "Start a conversation" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Start a conversation" });
    await sheet.getByRole("radio", { name: "Critique" }).click();
    await expect(sheet.getByText("People will know you asked for constructive feedback.")).toBeVisible();
    await sheet.getByLabel("Title").fill(title);
    await sheet.getByRole("button", { name: "Start the conversation" }).click();
    await expect(page).toHaveURL(/\/community\/conversations\/[0-9a-f-]{36}$/);
    const url = page.url();
    await expect(page.getByText("Critique requested.")).toBeVisible();

    // Someone else finds it under Help, with one clear action, and answers.
    const { page: other } = await openContext("B");
    await newCreator(other);
    await other.goto("/community?filter=help");
    const card = other.getByRole("list", { name: "Help" }).getByRole("listitem").filter({ hasText: title });
    await expect(card).toContainText("would like feedback");
    await card.getByRole("link", { name: "Give feedback" }).click();
    await other.getByLabel("Your reply").fill("It reads as a caption — let the image do the work.");
    await other.getByRole("button", { name: "Reply" }).click();
    await expect(other.getByRole("region", { name: "Replies" })).toContainText("let the image do the work");
    // No likes, follower counts or trending anywhere on it.
    await expect(other.getByText(/likes?|followers|trending|karma/i)).toHaveCount(0);

    // Back home, the asker sees "Your question" and catches up in one tap.
    await page.goto("/");
    const question = page.getByRole("region", { name: "Your question" });
    await expect(question).toContainText("1 new reply");
    await question.getByRole("link").click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("status").filter({ hasText: "Since you last read this" })).toContainText("1 new reply");

    // The owner closes it: still readable, no new replies.
    await page.getByRole("button", { name: "More for this conversation" }).click();
    await page.getByRole("menuitem", { name: "Close to new replies" }).click();
    await expect(page.getByText("Closed to new replies.")).toBeVisible();
    await other.reload();
    await expect(other.getByLabel("Your reply")).toHaveCount(0);
  });

  test("Limited conversations stay with the people added; muting hides someone from your Community", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const { page: b } = await openContext("B");
    const bee = await newCreator(b);
    const { page: c } = await openContext("C");
    await newCreator(c);

    const limited = (await (await page.request.post("/api/v1/open-conversations", { data: { intent: "discuss", title: `Private idea ${tag}`, visibility: "limited", inviteHandles: [bee.handle] } })).json()).conversation.id as string;
    await b.goto(`/community/conversations/${limited}`);
    await expect(b.getByRole("heading", { level: 1 })).toContainText(`Private idea ${tag}`);
    expect((await c.request.get(`/api/v1/open-conversations/${limited}`)).status()).toBe(404);

    // C sees A's open conversation, mutes A, and A is gone from C's Community.
    const open = (await (await page.request.post("/api/v1/open-conversations", { data: { intent: "discuss", title: `Open idea ${tag}` } })).json()).conversation.id as string;
    await c.goto("/community?filter=conversations");
    await expect(c.getByText(`Open idea ${tag}`)).toBeVisible();
    await c.goto(`/community/conversations/${open}`);
    await c.getByRole("button", { name: "More for this conversation" }).click();
    await c.getByRole("menuitem", { name: /^Mute / }).click();
    await expect(c.getByText(/is muted/)).toBeVisible();
    await c.goto("/community?filter=conversations");
    await expect(c.getByText(`Open idea ${tag}`)).toHaveCount(0);
  });

  test("a conversation grows into a Huddle and a Creative Room, both linked back; a reader gives it their own DejaVu", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const id = (await (await page.request.post("/api/v1/open-conversations", { data: { intent: "explore_together", title: `Visual storytelling without dialogue ${tag}`, body: "Anyone want to try?" } })).json()).conversation.id as string;
    const { page: b } = await openContext("B");
    await newCreator(b);

    // Huddle: live, named after the conversation, linked back.
    await b.goto(`/community/conversations/${id}`);
    await b.getByRole("button", { name: "More for this conversation" }).click();
    await b.getByRole("menuitem", { name: "Start Huddle about this" }).click();
    await expect(b).toHaveURL(/\/huddles\/[0-9a-f-]{36}$/);
    const huddleUrl = b.url();
    await page.goto(`/community/conversations/${id}`);
    await expect(page.getByRole("region", { name: "What grew from this" })).toContainText("Live Huddle about this");

    // Creative Room through the existing Projects domain.
    await page.getByRole("button", { name: "More for this conversation" }).click();
    await page.getByRole("menuitem", { name: "Start Creative Room" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`Visual storytelling without dialogue ${tag}`);

    // B's DejaVu on A's conversation is B's alone.
    await b.goto(`/community/conversations/${id}`);
    await b.getByRole("button", { name: "Add a DejaVu" }).click();
    await b.getByLabel("Search or type a DejaVu").fill(`Silent films ${tag}`);
    await b.getByRole("button", { name: `Create “Silent films ${tag}”` }).click();
    await b.keyboard.press("Escape");
    await expect(b.getByRole("group", { name: "DejaVus" }).getByRole("link", { name: `Silent films ${tag}` })).toBeVisible();
    await page.goto(`/community/conversations/${id}`);
    await expect(page.getByRole("group", { name: "DejaVus" }).getByRole("link")).toHaveCount(0);

    // Tidy: B leaves, so the Huddle dissolves.
    await b.goto(huddleUrl);
    await b.getByRole("button", { name: "Leave" }).click();
    await b.waitForURL(/\/summary$/);
  });

  test("Home's You could help shows a request that fits what you're open to — with why", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    expect((await page.request.patch("/api/v1/profile/open-to", { data: { preferences: ["feedback"] } })).ok()).toBe(true);
    const { page: asker } = await openContext("B");
    await newCreator(asker);
    await asker.request.post("/api/v1/open-conversations", { data: { intent: "critique", title: `Two openings for my short film ${tag}` } });
    await page.goto("/");
    const help = page.getByRole("region", { name: "You could help" });
    await help.getByText("You could help").click();
    const item = help.getByRole("link", { name: new RegExp(`Two openings for my short film ${tag}`) });
    await expect(item).toContainText("would like feedback");
    await expect(item).toContainText("You're open to giving feedback");
  });

  test("Open to… is chosen in Settings and shown on the profile", async ({ page, creator }) => {
    await page.goto("/settings?section=collaboration");
    await page.getByRole("checkbox", { name: "Giving feedback" }).click();
    await expect(page.getByRole("checkbox", { name: "Giving feedback" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("checkbox", { name: "Huddles" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.goto(`/creators/${creator.handle}`);
    await expect(page.getByLabel("Open to")).toContainText("Giving feedback");
    await expect(page.getByLabel("Open to")).toContainText("Huddles");
  });
});
