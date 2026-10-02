import { expect, newCreator, test, uid } from "./fixtures";

// Communities (docs/communities.md): Orkut-style communities built from Creative Rooms, Open Conversations and crews.

test.describe("Communities", () => {
  test("start a community, find and join it, start a topic, post, moderate and leave", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const name = `Poetry & Spoken Word ${tag}`;

    // Explore → Community → Communities; start one from the sheet.
    await page.goto("/community");
    await page.getByRole("navigation", { name: "Pulse" }).getByRole("link", { name: "Communities" }).click();
    await expect(page).toHaveURL(/filter=communities/);
    await page.getByRole("button", { name: "Start a community" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Start a community" });
    await expect(sheet).toContainText("Communities are always public");
    await sheet.getByLabel("Name").fill(name);
    await sheet.getByLabel("What it’s about").fill("A place for people who write to be heard.");
    await sheet.getByRole("button", { name: "Start the community" }).click();
    await expect(page).toHaveURL(/\/communities\/[0-9a-f-]{36}$/);
    const communityUrl = page.url();
    const id = communityUrl.split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("Open community")).toBeVisible();
    // The owner doesn't join or leave; their primary action is starting a topic.
    await expect(page.getByRole("button", { name: /Join community|Leave this community/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Community" }).getByRole("link")).toHaveText(["Forum", "Creations", "Huddles", "Members"]);

    // Someone else finds it by interest and looks before joining.
    const { page: b } = await openContext("B");
    await newCreator(b);
    await b.goto(`/community?filter=communities&q=${encodeURIComponent(tag)}`);
    await b.getByRole("link", { name }).click();
    await expect(b).toHaveURL(communityUrl);
    await b.getByRole("navigation", { name: "Community" }).getByRole("link", { name: "Creations" }).click();
    await expect(b.getByText("Members see the Creations shared here.")).toBeVisible();
    await b.getByRole("button", { name: "Join community" }).click();
    await expect(b.getByRole("button", { name: "Start a topic" }).first()).toBeVisible();

    // A member starts a topic; it opens with the community named above it.
    await b.goto(communityUrl);
    await b.getByRole("button", { name: "Start a topic" }).first().click();
    const topicSheet = b.getByRole("dialog", { name: "Start a topic" });
    await topicSheet.getByLabel("Topic").fill(`Reading aloud changes the line breaks ${tag}`);
    await topicSheet.getByLabel("First post").fill("When I read it out, the breaks move.");
    await topicSheet.getByRole("button", { name: "Start the topic" }).click();
    await expect(b).toHaveURL(/\/community\/conversations\/[0-9a-f-]{36}$/);
    const topicUrl = b.url();
    await expect(b.getByRole("link", { name: `In ${name}` })).toBeVisible();

    // The owner sees it in the Forum and posts in it.
    await page.goto(communityUrl);
    const forum = page.getByRole("list", { name: "Topics" });
    await expect(forum).toContainText(`Reading aloud changes the line breaks ${tag}`);
    await forum.getByRole("link", { name: new RegExp(`Reading aloud changes the line breaks ${tag}`) }).click();
    await page.getByLabel("Your reply").fill("I trust the page, then the breath.");
    await page.getByRole("button", { name: "Reply" }).click();
    await expect(page.getByRole("region", { name: "Replies" })).toContainText("then the breath");
    // No likes, followers or ranking anywhere.
    await expect(page.getByText(/likes?|followers|trending|karma/i)).toHaveCount(0);

    // Members are listed with the owner first.
    await b.goto(`${communityUrl}?view=members`);
    await expect(b.getByRole("region", { name: "Owner & moderators" })).toContainText("Owner");
    await expect(b.getByRole("region", { name: /^Members/ })).toBeVisible();

    // The owner takes the topic out of the forum; it stays with its author.
    await page.goto(communityUrl);
    await page.getByRole("button", { name: new RegExp(`More for “Reading aloud changes the line breaks ${tag}”`) }).click();
    await page.getByRole("menuitem", { name: "Remove from the community" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No topics yet")).toBeVisible();
    await b.goto(topicUrl);
    await expect(b.getByRole("heading", { level: 1 })).toContainText("Reading aloud");

    // Leaving asks first; joining again is one tap.
    await b.goto(communityUrl);
    await b.getByRole("button", { name: "Leave this community" }).click();
    await b.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
    await expect(b.getByRole("button", { name: "Join community" })).toBeVisible();

    // Communities are always public: there's no way back to private.
    const back = await page.request.patch(`/api/v1/communities/${id}`, { data: { discoverable: false } });
    expect(back.status()).toBe(422);
    await page.goto(`/projects/${id}`);
    await expect(page.getByRole("link", { name: /This room is a community/ })).toBeVisible();
  });

  test("private Creative Rooms stay private until their owner opens one as a community", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const { project } = (await (await page.request.post("/api/v1/projects", { data: { title: `Coastal Voices ${tag}`, brief: "Our film.", status: "active" } })).json()) as { project: { id: string } };
    const { page: b } = await openContext("B");
    await newCreator(b);
    expect((await b.request.get(`/api/v1/communities/${project.id}`)).status()).toBe(404);
    expect((await b.request.post(`/api/v1/communities/${project.id}/join`)).status()).toBe(404);
    expect(((await (await b.request.get(`/api/v1/communities?q=${tag}`)).json()) as { communities: unknown[] }).communities).toHaveLength(0);
    await b.goto(`/communities/${project.id}`);
    await expect(b.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();

    // The owner opens it, after being told it's public for good.
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("button", { name: "More Creative Room actions" }).click();
    await page.getByRole("menuitem", { name: "Open as a community…" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText("This can't be undone");
    await confirm.getByRole("button", { name: "Open as a community" }).click();
    await expect(page.getByRole("link", { name: /This room is a community/ })).toBeVisible();
    await page.getByRole("button", { name: "More Creative Room actions" }).click();
    await expect(page.getByRole("menuitem", { name: /community|private/i })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await b.goto(`/communities/${project.id}`);
    await expect(b.getByRole("heading", { level: 1 })).toHaveText(`Coastal Voices ${tag}`);
    // The room's own details stay with its crew.
    expect((await b.request.get(`/api/v1/projects/${project.id}`)).status()).toBe(404);
  });
});
