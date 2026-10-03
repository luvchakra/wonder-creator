import sharp from "sharp";
import { expect, newCreator, test, uid } from "./fixtures";

// Communities (docs/communities.md): Orkut-style communities built from Creative Rooms, Open Conversations and crews.

test.describe("Communities", () => {
  test("start a community, find and join it, start a topic, post, moderate and leave", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const name = `Poetry & Spoken Word ${tag}`;

    // Explore → Community → Communities; start one from the sheet.
    await page.goto("/pulse");
    await page.getByRole("navigation", { name: "Pulse" }).getByRole("link", { name: "Communities" }).click();
    await expect(page).toHaveURL(/filter=communities/);
    await page.getByRole("button", { name: "Start a community" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Start a community" });
    // Public by default; Unlisted and Private are one tap away. Only members post.
    await expect(sheet.getByRole("radio", { name: /Public/ })).toBeChecked();
    await expect(sheet.getByRole("radio", { name: /Unlisted/ })).toBeVisible();
    await expect(sheet.getByRole("radio", { name: /Private/ })).toBeVisible();
    await expect(sheet).toContainText("Only members can start topics and post");
    await sheet.getByLabel("Name").fill(name);
    await sheet.getByLabel("What it’s about").fill("A place for people who write to be heard.");
    await sheet.getByRole("button", { name: "Start the community" }).click();
    await expect(page).toHaveURL(/\/communities\/[0-9a-f-]{36}$/);
    const communityUrl = page.url();
    const id = communityUrl.split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("Public community")).toBeVisible();
    await expect(page.getByRole("button", { name: /Who can find this community: Public/ })).toBeVisible();
    // The owner doesn't join or leave; their primary action is starting a topic.
    await expect(page.getByRole("button", { name: /Join community|Leave this community/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Community" }).getByRole("link")).toHaveText(["Forum", "Creations", "Huddles", "Members"]);

    // Someone else finds it by interest and looks before joining. Home invites them to find one.
    const { page: b } = await openContext("B");
    await newCreator(b);
    await b.goto("/");
    await expect(b.getByRole("region", { name: "My Communities" }).getByRole("link", { name: /Find people who make what you make/ })).toHaveAttribute("href", "/pulse?filter=communities");
    await b.goto(`/pulse?filter=communities&q=${encodeURIComponent(tag)}`);
    await b.getByRole("link", { name }).click();
    await expect(b).toHaveURL(communityUrl);
    await b.getByRole("navigation", { name: "Community" }).getByRole("link", { name: "Creations" }).click();
    await expect(b.getByText("Members see the Creations shared here.")).toBeVisible();
    await expect(b.getByText("Join to start topics and post.")).toBeVisible();
    await b.getByRole("button", { name: "Join community" }).click();
    await expect(b.getByRole("button", { name: "Start a topic" }).first()).toBeVisible();
    // Home now shows it among their communities.
    await b.goto("/");
    await b.getByRole("region", { name: "My Communities" }).getByRole("list", { name: "Your communities" }).getByRole("link", { name }).click();
    await expect(b).toHaveURL(communityUrl);

    // A member starts a topic; it opens with the community named above it.
    await b.goto(communityUrl);
    await b.getByRole("button", { name: "Start a topic" }).first().click();
    const topicSheet = b.getByRole("dialog", { name: "Start a topic" });
    await topicSheet.getByLabel("Topic").fill(`Reading aloud changes the line breaks ${tag}`);
    await topicSheet.getByLabel("First post").fill("When I read it out, the breaks move.");
    await topicSheet.getByRole("button", { name: "Start the topic" }).click();
    await expect(b).toHaveURL(/\/pulse\/conversations\/[0-9a-f-]{36}$/);
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

    // Only members add anything: after leaving, the topic offers Join instead of a reply box, and the API refuses.
    await b.goto(communityUrl);
    await b.getByRole("button", { name: "Leave this community" }).click();
    await b.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
    await expect(b.getByRole("button", { name: "Join community" })).toBeVisible();
    await b.goto(topicUrl);
    await expect(b.getByText(`Join ${name} to reply.`)).toBeVisible();
    await expect(b.getByLabel("Your reply")).toHaveCount(0);
    const topicId = topicUrl.split("/").pop()!;
    expect((await b.request.post(`/api/v1/open-conversations/${topicId}/replies`, { data: { body: "Still here?" } })).ok()).toBe(false);
    expect((await b.request.post(`/api/v1/communities/${id}/topics`, { data: { title: "Sneaking a topic in" } })).ok()).toBe(false);
    await b.getByRole("button", { name: "Join community" }).click();
    await expect(b.getByLabel("Your reply")).toBeVisible();

    // The owner takes the topic out of the forum; it stays with its author.
    await page.goto(communityUrl);
    await page.getByRole("button", { name: new RegExp(`More for “Reading aloud changes the line breaks ${tag}”`) }).click();
    await page.getByRole("menuitem", { name: "Remove from the community" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No topics yet")).toBeVisible();
    await b.goto(topicUrl);
    await expect(b.getByRole("heading", { level: 1 })).toContainText("Reading aloud");

    // Unlisted: no longer listed or searchable, but its link still works.
    await page.goto(communityUrl);
    await page.getByRole("button", { name: /Who can find this community/ }).click();
    const privacy = page.getByRole("dialog", { name: "Who can find this community" });
    await privacy.getByRole("radio", { name: /Unlisted/ }).check();
    await privacy.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Unlisted community")).toBeVisible();
    const { page: c } = await openContext("C");
    await newCreator(c);
    expect(((await (await c.request.get(`/api/v1/communities?q=${tag}`)).json()) as { communities: unknown[] }).communities).toHaveLength(0);
    await c.goto(communityUrl);
    await expect(c.getByRole("heading", { level: 1 })).toHaveText(name);
    // A community stays one; "discoverable" is no longer a setting.
    expect((await page.request.patch(`/api/v1/communities/${id}`, { data: { discoverable: false } })).status()).toBe(422);
    await page.goto(`/rooms/${id}`);
    await expect(page.getByRole("link", { name: /This room is a community/ })).toBeVisible();
  });

  test("Creative Rooms stay private until their owner opens one; a Private community takes only the people it invites", async ({ page, creator, openContext }) => {
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

    // The owner opens it as a Private community.
    await page.goto(`/rooms/${project.id}`);
    await page.getByRole("button", { name: "More Creative Room actions" }).click();
    await page.getByRole("menuitem", { name: "Open as a community…" }).click();
    const open = page.getByRole("dialog", { name: "Open this room as a community" });
    await open.getByRole("radio", { name: /Private/ }).check();
    await open.getByRole("button", { name: "Open as a community" }).click();
    await expect(page.getByRole("link", { name: /This room is a community/ })).toBeVisible();
    await page.getByRole("button", { name: "More Creative Room actions" }).click();
    await expect(page.getByRole("menuitem", { name: /community|private/i })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Still invisible to others, and closed to joining.
    expect((await b.request.get(`/api/v1/communities/${project.id}`)).status()).toBe(404);
    expect((await b.request.post(`/api/v1/communities/${project.id}/join`)).status()).toBe(404);

    // Invited, they see it and accept by joining.
    const { crew } = (await (await page.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    const bId = ((await (await b.request.get("/api/v1/creators/me")).json()) as { identity: { creator: { id: string } } }).identity.creator.id;
    expect((await page.request.post(`/api/v1/crews/${crew.id}/members`, { data: { creatorId: bId } })).ok()).toBeTruthy();
    await b.goto(`/communities/${project.id}`);
    await expect(b.getByRole("heading", { level: 1 })).toHaveText(`Coastal Voices ${tag}`);
    await expect(b.getByText("Private community")).toBeVisible();
    await expect(b.getByText("You're invited. Join to read along and post.")).toBeVisible();
    await b.getByRole("button", { name: "Accept and join" }).click();
    await expect(b.getByRole("button", { name: "Start a topic" }).first()).toBeVisible();
  });

  test("every community has a profile picture: chosen when starting it, changed by its hosts, a monogram otherwise", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const name = `Night Trains ${tag}`;
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 120, g: 90, b: 200 } } }).png().toBuffer();

    await page.goto("/pulse?filter=communities");
    await page.getByRole("button", { name: "Start a community" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Start a community" });
    await sheet.getByLabel("Name").fill(name);
    await sheet.locator("#community-picture").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
    await sheet.getByRole("button", { name: "Start the community" }).click();
    await expect(page).toHaveURL(/\/communities\/[0-9a-f-]{36}$/);
    const header = page.getByRole("banner").or(page.locator("header").filter({ hasText: name }));
    const pic = page.locator("header").filter({ hasText: name }).locator("img.rounded-full");
    await expect(pic).toHaveCount(1);
    const first = await pic.getAttribute("src");
    void header;

    // The host changes it from the camera on the picture.
    await page.locator("#community-avatar-file").setInputFiles({ name: "new.png", mimeType: "image/png", buffer: await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 240, g: 170, b: 140 } } }).png().toBuffer() });
    await expect.poll(async () => page.locator("header").filter({ hasText: name }).locator("img.rounded-full").getAttribute("src")).not.toBe(first);

    // Others see it in the list and on the page, without the camera.
    const { page: b } = await openContext("B");
    await newCreator(b);
    await b.goto(`/pulse?filter=communities&q=${encodeURIComponent(tag)}`);
    await expect(b.getByRole("link", { name }).locator("img.rounded-full")).toHaveCount(1);
    await b.getByRole("link", { name }).click();
    await expect(b.getByRole("button", { name: "Change the community's picture" })).toHaveCount(0);

    // A community started without one still has a face: the painted monogram.
    const plain = `Quiet Hours ${tag}`;
    const { id } = (await (await page.request.post("/api/v1/communities", { data: { title: plain } })).json()) as { id: string };
    await page.goto(`/communities/${id}`);
    await expect(page.locator("header").filter({ hasText: plain }).getByText("Q", { exact: true })).toBeVisible();
  });
});
