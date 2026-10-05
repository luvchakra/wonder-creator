import { expect, fakeMicrophone, test, uid } from "./fixtures";
import type { Page } from "@playwright/test";

// Parts, step 5b (docs/creative-room-parts.md): once everyone has agreed the credits, the Room's owner publishes the song
// — the mix as heard, the words and the agreed credits — on their page.
test.describe("Creative Room parts: publishing the song", () => {
  test("credits agreed, the owner publishes the mix with the words and credits", async ({ page, creator }) => {
    void creator;
    await fakeMicrophone(page, true);
    const title = `Platform 3 ${uid()}`;
    await page.goto("/rooms?new=1");
    const create = page.getByRole("dialog", { name: "New Creative Room" });
    await create.getByLabel("Name").fill(title);
    await create.getByLabel(/^Song/).check();
    await create.getByLabel("Already underway").check();
    await create.getByRole("button", { name: "Create Creative Room" }).click();
    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
    const room = page.url();
    const work = page.getByRole("region", { name: "The work" });

    // One creator makes all three parts: Tune is a recording, Lyrics are words, Voice is started.
    for (const part of ["Lyrics", "Tune", "Voice"]) {
      await work.getByRole("button", { name: `${part} actions` }).click();
      await page.getByRole("menuitem", { name: "Join this part" }).click();
      await work.getByRole("button", { name: `${part} actions` }).click();
      await page.getByRole("menuitem", { name: "Start the Creation" }).click();
      await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/(write|audio)$/);
      if (part === "Lyrics") {
        const id = page.url().match(/creations\/([0-9a-f-]{36})/)![1];
        const art = (await (await page.request.get(`/api/v1/artifacts/${id}`)).json()).artifact as { current_version_id: string };
        await page.request.post(`/api/v1/artifacts/${id}/versions`, { data: { content: "Every Sunday my father waited\nat Platform 3, coat folded.", baseVersionId: art.current_version_id, label: "First words" } });
      }
      if (part === "Tune") {
        await page.getByRole("button", { name: "Record", exact: true }).click();
        const rec = page.getByRole("dialog", { name: "Record" });
        await expect(rec.getByRole("button", { name: "Stop" })).toBeEnabled();
        await page.waitForTimeout(1500);
        await rec.getByRole("button", { name: "Stop" }).click();
        await rec.getByRole("button", { name: "Keep this take" }).click();
        await expect(rec).toBeHidden({ timeout: 30_000 });
      }
      await page.goto(room);
      await markFinal(page, part);
    }

    // Not publishable until the credits are agreed: proposing them (as the only person on the work) agrees them.
    await page.goto(`${room}/song`);
    await expect(page.getByRole("region", { name: "Ready to publish" })).toHaveCount(0);
    await page.goto(room);
    const credits = page.getByRole("region", { name: "Credits & shares" });
    await credits.getByRole("button", { name: "Propose credits" }).click();
    await page.getByRole("dialog", { name: "Propose credits" }).getByRole("button", { name: "Send for sign-off" }).click();
    await expect(credits.getByRole("status")).toHaveText("Agreed by everyone");

    // Publish from Listen together.
    await work.getByRole("link", { name: "Listen together" }).click();
    await expect(page).toHaveURL(/\/song$/);
    const ready = page.getByRole("region", { name: "Ready to publish" });
    await ready.getByRole("button", { name: "Publish the song" }).click();
    const dialog = page.getByRole("dialog", { name: "Publish the song" });
    await dialog.getByLabel("Unlisted — only people with the link").check();
    await dialog.getByRole("button", { name: "Publish" }).click();
    await expect(dialog).toBeHidden({ timeout: 60_000 });
    const published = page.getByRole("region", { name: "Published" });
    await expect(published).toContainText("for anyone with the link");
    const href = await published.getByRole("link", { name: "Open it" }).getAttribute("href");
    expect(href).toMatch(/^\/p\/[^/]+\/[^/]+$/);

    // The public page: the song, the words, and who made what.
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("audio").first()).toBeAttached();
    await page.locator("summary", { hasText: "Lyrics" }).click();
    await expect(page.getByText("Every Sunday my father waited").first()).toBeVisible();
    await expect(page.getByText(/Lyrics \(writing\), Tune \(sound\), Voice \(performance\)/)).toBeVisible();
  });
});

async function markFinal(page: Page, part: string) {
  const work = page.getByRole("region", { name: "The work" });
  await work.getByRole("button", { name: `${part} actions` }).click();
  await page.getByRole("menuitem", { name: "Mark final" }).click();
  await work.getByRole("button", { name: `${part} actions` }).click();
  await expect(page.getByRole("menuitem", { name: "Back into rounds" })).toBeVisible();
  await page.keyboard.press("Escape");
}
