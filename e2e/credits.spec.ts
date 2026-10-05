import { expect, newCreator, test, uid } from "./fixtures";
import type { Page } from "@playwright/test";

// Parts, step 5a (docs/creative-room-parts.md): once every part is final, the Room's owner proposes who's credited for
// what with equal shares; everyone named signs off — or says what they'd change — and then it's agreed.
test.describe("Creative Room parts: credits & shares", () => {
  test("the owner proposes; the singer objects, then signs off; it's agreed", async ({ page, creator, openContext }) => {
    void creator;
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

    // The owner makes Lyrics and Tune; each is started and called final.
    for (const part of ["Lyrics", "Tune"]) {
      await work.getByRole("button", { name: `${part} actions` }).click();
      await page.getByRole("menuitem", { name: "Join this part" }).click();
      await work.getByRole("button", { name: `${part} actions` }).click();
      await page.getByRole("menuitem", { name: "Start the Creation" }).click();
      await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/(write|audio)$/);
      await page.goto(room);
      await markFinal(page, part);
    }
    // Nothing to propose while a part isn't final.
    await expect(page.getByRole("region", { name: "Credits & shares" })).toHaveCount(0);

    // A singer, on Voice only.
    const { page: b } = await openContext("singer");
    const mira = await newCreator(b, { name: `Mira ${uid()}` });
    await work.getByRole("button", { name: "Voice actions" }).click();
    await page.getByRole("menuitem", { name: "Invite to this part…" }).click();
    const invite = page.getByRole("dialog", { name: "Invite to Voice" });
    await invite.getByLabel("Find a creator").fill(`@${mira.handle}`);
    await invite.getByRole("button", { name: `Invite ${mira.name}` }).click();
    await b.goto(room);
    await b.getByRole("button", { name: "Accept" }).click();
    await b.getByRole("region", { name: "The work" }).getByRole("button", { name: "Start Voice" }).click();
    await expect(b).toHaveURL(/\/audio$/);
    await b.goto(room);
    await markFinal(b, "Voice");

    // The owner proposes: equal shares, Voice credited as performance.
    await page.reload();
    const credits = page.getByRole("region", { name: "Credits & shares" });
    await credits.getByRole("button", { name: "Propose credits" }).click();
    const propose = page.getByRole("dialog", { name: "Propose credits" });
    await expect(propose.getByLabel("Voice is credited as")).toHaveValue("performance");
    await expect(propose).toContainText("Equal for everyone on the work.");
    await propose.getByRole("button", { name: "Send for sign-off" }).click();
    await expect(propose).toBeHidden();
    await expect(credits).toContainText("Lyrics, writing · Tune, sound");
    await expect(credits).toContainText("Voice, performance");
    await expect(credits.getByRole("status")).toHaveText(`Waiting on ${mira.name}`);
    await expect(credits).toContainText("50%");

    // The singer hears about it, says what she'd change, then signs off.
    await b.goto("/");
    await b.getByRole("button", { name: /notifications/i }).click();
    await b.getByRole("link", { name: new RegExp(`Sign off on the credits for “${title}”`) }).click();
    await expect(b).toHaveURL(/#credits$/);
    const hers = b.getByRole("region", { name: "Credits & shares" });
    await hers.getByRole("button", { name: "I’d change something…" }).click();
    const why = b.getByRole("dialog", { name: "What would you change?" });
    await why.getByRole("textbox").fill("Could Voice be co-credited for the melody?");
    await why.getByRole("button", { name: "Send" }).click();
    await expect(hers.getByRole("status")).toHaveText("You would change something");
    await page.reload();
    await expect(credits).toContainText("“Could Voice be co-credited for the melody?”");
    await hers.getByRole("button", { name: "Sign off" }).click();
    await expect(hers.getByRole("status")).toHaveText("Agreed by everyone");
    await page.reload();
    await expect(credits.getByRole("status")).toHaveText("Agreed by everyone");
  });
});

async function markFinal(page: Page, part: string) {
  const work = page.getByRole("region", { name: "The work" });
  await work.getByRole("button", { name: `${part} actions` }).click();
  await page.getByRole("menuitem", { name: "Mark final" }).click();
  await expect(work.getByRole("button", { name: `${part} actions` })).toBeVisible();
  await work.getByRole("button", { name: `${part} actions` }).click();
  await expect(page.getByRole("menuitem", { name: "Back into rounds" })).toBeVisible();
  await page.keyboard.press("Escape");
}
