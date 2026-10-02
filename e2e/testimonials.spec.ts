import { expect, newCreator, test, uid, type Page } from "./fixtures";

/** The creator id behind a session (the fixture's `creator.id` is the auth user). */
const creatorIdOf = async (p: Page) => ((await (await p.request.get("/api/v1/creators/me")).json()) as { identity: { creator: { id: string } } }).identity.creator.id;

// Testimonials (docs/testimonials.md): written by someone else, approved by you, shown in date order. No counts.

test.describe("Testimonials", () => {
  test("write one for a creator; they show it, keep it private, choose it for their Creator Page; the writer withdraws", async ({ page, creator, openContext }) => {
    const tag = uid();
    const { page: b } = await openContext("B");
    const maya = await newCreator(b, { name: "Maya Torres" });
    // Priya (A) is public so Maya can see her profile.
    await page.request.patch("/api/v1/creators/me", { data: { displayName: creator.name, handle: creator.handle, bio: "", location: "", showLocation: false, visibility: "public", collaborationAvailability: "open" } });

    // Maya writes from Priya's profile. Nothing shows until Priya decides.
    await b.goto(`/creators/${creator.handle}`);
    await b.getByRole("button", { name: "Write a testimonial" }).first().click();
    const sheet = b.getByRole("dialog", { name: /Write a testimonial for/ });
    await sheet.getByLabel("Your words").fill(`Priya hears the line before it is written ${tag}. Working beside her sharpens everyone.`);
    await sheet.getByRole("button", { name: "Send it to them" }).click();
    await expect(b.getByText(/Waiting for .* to show it/)).toBeVisible();
    await expect(b.getByRole("region", { name: "Testimonials" })).toContainText("Yours");

    // Priya finds it waiting (notification and profile), reads it, shows it.
    await page.goto("/me");
    const waiting = page.getByRole("list", { name: "Waiting for you" });
    await expect(waiting).toContainText("Maya Torres wrote you a testimonial");
    await expect(waiting).toContainText(tag);
    await waiting.getByRole("button", { name: "Show on my profile" }).click();
    await expect(page.getByRole("list", { name: "Waiting for you" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Testimonials" })).toContainText(tag);

    // Anyone who can see the profile now reads it, with no counts anywhere.
    const { page: c } = await openContext("C");
    await newCreator(c);
    await c.goto(`/creators/${creator.handle}`);
    const section = c.getByRole("region", { name: "Testimonials" });
    await expect(section).toContainText(tag);
    await expect(section).toContainText("Maya Torres");
    await expect(c.getByText(/\d+ testimonials?/)).toHaveCount(0);

    // Shown on the profile, but not chosen for the public Creator Page.
    const mine = (await (await page.request.get(`/api/v1/testimonials?creator=${await creatorIdOf(page)}`)).json()) as { testimonials: Array<{ id: string; status: string; onCreatorPage: boolean }> };
    expect(mine.testimonials[0]).toMatchObject({ status: "shown", onCreatorPage: false });

    // Keep it private: gone for others, kept for Priya under "kept private".
    await page.goto("/me");
    await page.getByRole("region", { name: "Testimonials" }).getByRole("button", { name: "Keep private" }).click();
    await expect(page.getByText("1 kept private")).toBeVisible();
    await c.reload();
    await expect(c.getByRole("region", { name: "Testimonials" })).not.toContainText(tag);
    await expect(c.getByText(/Be the first to write/)).toBeVisible();

    // Maya withdraws hers; Priya no longer has it at all.
    await b.goto(`/creators/${creator.handle}`);
    await b.getByRole("button", { name: "Withdraw" }).click();
    await b.getByRole("dialog", { name: "Withdraw your testimonial?" }).getByRole("button", { name: "Withdraw" }).click();
    await expect(b.getByText("You withdrew it")).toBeVisible();
    await page.goto("/me");
    await expect(page.getByText("1 kept private")).toHaveCount(0);
    void maya;
  });

  test("the setting decides who may write; a blocked creator never can", async ({ page, creator, openContext }) => {
    await page.request.patch("/api/v1/creators/me", { data: { displayName: creator.name, handle: creator.handle, bio: "", location: "", showLocation: false, visibility: "public", collaborationAvailability: "open" } });
    const { page: b } = await openContext("B");
    const bee = await newCreator(b);
    const me = await creatorIdOf(page);

    // Only people I've worked with: a stranger is refused, in the UI and at the API.
    await page.goto("/settings?section=privacy");
    await page.getByRole("radio", { name: "Only people I've worked with" }).check();
    await expect(page.getByText("Saved.")).toBeVisible();
    await b.goto(`/creators/${creator.handle}`);
    await expect(b.getByRole("button", { name: "Write a testimonial" })).toHaveCount(0);
    expect((await b.request.post("/api/v1/testimonials", { data: { to: me, body: "Trying to write without having worked together." } })).status()).toBe(403);

    // Back to anyone, then a block keeps B out for good.
    await page.getByRole("radio", { name: "Anyone who can see my profile" }).check();
    await page.request.post(`/api/v1/creators/${await creatorIdOf(b)}/block`, { data: { on: true } });
    void bee;
    expect((await b.request.post("/api/v1/testimonials", { data: { to: me, body: "A blocked creator can't leave a note either." } })).status()).toBe(403);
  });
});
