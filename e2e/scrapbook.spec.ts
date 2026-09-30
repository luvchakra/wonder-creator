import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Scrapbook", () => {
  test("post, see it chronologically, reply, change who can reply, report, delete; private stays private", async ({ page: a, creator: creatorA, openContext }) => {
    test.setTimeout(120_000);
    const thought = `What do tides remember? ${uid()}`;
    const secret = `Not ready to share ${uid()}`;

    await a.goto("/");
    await a.getByRole("button", { name: "Your account" }).click();
    await a.getByRole("menuitem", { name: "Scrapbook" }).click();
    await expect(a).toHaveURL(/\/scrapbook$/);
    await expect(a.getByText("Newest first. Nothing here is ranked or counted.")).toBeVisible();
    const composer = a.getByRole("form", { name: "Share to your Scrapbook" });
    await composer.getByRole("button", { name: "Reflection" }).click();
    await composer.getByLabel("What's on your mind?").fill(thought);
    await composer.getByRole("button", { name: "Share" }).click();
    const posts = a.getByRole("list", { name: "Posts" });
    await expect(posts.getByRole("article").first()).toContainText(thought);
    await composer.getByLabel("What's on your mind?").fill(secret);
    await composer.getByLabel("Who can see it").selectOption("private");
    await expect(composer.getByLabel("Who can reply")).toBeDisabled();
    await composer.getByRole("button", { name: "Share" }).click();
    await expect(posts.getByRole("article").first()).toContainText(secret);
    await expect(posts.getByRole("article").first()).toContainText("Only you");

    // B sees the public post (not the private one), with no counts, and replies.
    const { page: b } = await openContext("B");
    const creatorB = await newCreator(b, { name: `Ravi ${uid()}` });
    await b.goto("/scrapbook");
    const card = b.getByRole("article").filter({ hasText: thought });
    await expect(card).toContainText("Reflection");
    await expect(b.getByText(secret)).toHaveCount(0);
    await card.getByRole("link", { name: "Open and reply" }).click();
    await b.getByLabel("Your reply").fill("Every shoreline it touched.");
    await b.getByRole("button", { name: "Reply", exact: true }).click();
    await expect(b.getByRole("region", { name: "Replies" }).getByText("Every shoreline it touched.")).toBeVisible();

    // A turns replies off; B can no longer reply.
    await a.goto(`${b.url().replace(/^https?:\/\/[^/]+/, "")}`);
    await expect(a.getByText("Every shoreline it touched.")).toBeVisible();
    await expect(a.getByText(creatorB.name)).toBeVisible();
    await a.getByLabel("Who can reply").selectOption("none");
    await expect(a.getByLabel("Who can reply")).toHaveValue("none");
    await b.reload();
    await expect(b.getByText("Replies are off for this post.")).toBeVisible();
    await expect(b.getByLabel("Your reply")).toHaveCount(0);

    // B reports the post.
    await b.getByRole("button", { name: "More actions for this post" }).click();
    await b.getByRole("menuitem", { name: "Report this post" }).click();
    const report = b.getByRole("dialog", { name: "Report this post" });
    await report.getByRole("button", { name: "Send report" }).click();
    await expect(report.getByText("Thank you. We'll review it.")).toBeVisible();
    await b.keyboard.press("Escape");

    // The post shows on A's profile; A deletes it.
    await a.goto(`/creators/${creatorA.handle}?tab=moments`);
    await expect(a.getByRole("list", { name: "Moments" }).getByText(thought)).toBeVisible();
    await a.goBack();
    await a.getByRole("button", { name: "Delete post" }).click();
    await a.getByRole("dialog", { name: "Delete this post?" }).getByRole("button", { name: "Delete" }).click();
    await expect(a).toHaveURL(/\/scrapbook$/);
    await b.goto("/scrapbook");
    await expect(b.getByText(thought)).toHaveCount(0);
  });
});
