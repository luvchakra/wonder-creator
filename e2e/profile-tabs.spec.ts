import { expect, newCreator, seedCarousel, test, uid } from "./fixtures";

// The Profile (profile board, 30 Sep 2026): Overview · Creations · Moments · Community.
test.describe("Profile views", () => {
  test("identity at a glance, work in many forms, everyday moments and community — each its own view", async ({ page, creator, openContext }) => {
    const tag = uid();
    const make = async (artifactType: string, title: string, content: string) => (await (await page.request.post("/api/v1/artifacts", { data: { artifactType, title, content } })).json()).artifact as { id: string };
    await make("poem", `Between Here and Home ${tag}`, "Stillness finds me\nin the spaces between\ndaylight and dreams.");
    const carousel = await make("carousel", `Small Joys ${tag}`, "One. Two. Three.");
    await seedCarousel(creator.id, carousel.id, ["Tea", "Light", "Rain"]);
    await make("short_film", `Chants of Dawn ${tag}`, "A visual poem on light and routine.");
    expect((await page.request.post("/api/v1/scrapbook", { data: { body: `“Same sky, different chapter.” ${tag}` } })).ok()).toBe(true);
    const ask = (await (await page.request.post("/api/v1/open-conversations", { data: { intent: "ask", title: `Seeking feedback on a short film ${tag}`, body: "Opening sequence and pacing." } })).json()).conversation.id as string;

    // Overview: who they are, their series and recent moments.
    await page.goto(`/creators/${creator.handle}`);
    await expect(page.getByRole("navigation", { name: "Profile views" }).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: "Profile" }).getByRole("button", { name: "Share profile" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected series" })).toContainText(`Small Joys ${tag}`);
    await expect(page.getByRole("region", { name: "Selected series" })).toContainText("3 slides");
    await expect(page.getByRole("region", { name: "Recent scrapbook moments" }).getByRole("link", { name: /Same sky/ })).toBeVisible();

    // Creations: every form, then just one kind.
    await page.getByRole("navigation", { name: "Profile views" }).getByRole("link", { name: "Creations" }).click();
    const list = page.getByRole("list", { name: "Creations" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(list).toContainText("Stillness finds me");
    await expect(list).toContainText("1 min read");
    await page.getByRole("navigation", { name: "Kinds of work" }).getByRole("link", { name: "Series" }).click();
    await expect(page).toHaveURL(/shelf=series/);
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText(`Small Joys ${tag}`);

    // Moments: words in their own form.
    await page.getByRole("navigation", { name: "Profile views" }).getByRole("link", { name: "Moments" }).click();
    await expect(page.getByRole("list", { name: "Moments" }).getByRole("article")).toContainText(["Quote"]);

    // Community: what they've asked for.
    await page.getByRole("navigation", { name: "Profile views" }).getByRole("link", { name: "Community" }).click();
    const help = page.getByRole("link", { name: `Open Seeking feedback on a short film ${tag}` });
    await expect(help).toBeVisible();
    await expect(page.getByText("Help request")).toBeVisible();
    await help.click();
    await expect(page).toHaveURL(new RegExp(`/community/conversations/${ask}$`));

    // Someone else sees only what's public: drafts stay private, the public moment and request show.
    const { page: other } = await openContext("other");
    await newCreator(other);
    await other.goto(`/creators/${creator.handle}?tab=creations`);
    await expect(other.getByText("No public work yet.")).toBeVisible();
    await expect(other.getByText(`Between Here and Home ${tag}`)).toHaveCount(0);
    await expect(other.getByRole("button", { name: "Follow" })).toBeVisible();
    await other.goto(`/creators/${creator.handle}?tab=moments`);
    await expect(other.getByRole("list", { name: "Moments" })).toContainText("Same sky");
  });
});
