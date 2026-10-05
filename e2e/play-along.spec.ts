import { expect, fakeMicrophone, newCreator, test, uid } from "./fixtures";

// Parts, step 3 (docs/creative-room-parts.md): play-along both ways. The lyricist hears the tune while writing; the
// singer reads the words and records over the tune. Only the people making the work get the takes.
test.describe("Creative Room parts: play-along", () => {
  test("Tune's take plays on the Lyrics page; the singer reads the lyrics and records over the tune", async ({ page, creator, openContext }) => {
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
    const projectId = page.url().split("/").pop()!;
    const work = page.getByRole("region", { name: "The work" });

    // The owner takes Tune and records a take on its Audio page.
    await work.getByRole("button", { name: "Claim a part" }).click();
    await page.getByRole("dialog", { name: "Claim a part" }).getByRole("button", { name: /Tune/ }).click();
    await work.getByRole("button", { name: "Start Tune" }).click();
    await expect(page).toHaveURL(/\/audio$/);
    await page.getByRole("button", { name: "Record", exact: true }).click();
    const rec = page.getByRole("dialog", { name: "Record" });
    await expect(rec.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(1500);
    await rec.getByRole("button", { name: "Stop" }).click();
    await rec.getByRole("button", { name: "Keep this take" }).click();
    await expect(rec).toBeHidden({ timeout: 30_000 });

    // …and Lyrics, written on its Writing page.
    await page.goto(`/rooms/${projectId}`);
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Join this part" }).click();
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Start the Creation" }).click();
    await expect(page).toHaveURL(/\/write$/);
    const lyricsId = page.url().match(/creations\/([0-9a-f-]{36})/)![1];
    const art = (await (await page.request.get(`/api/v1/artifacts/${lyricsId}`)).json()).artifact as { current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${lyricsId}/versions`, { data: { content: "Every Sunday my father waited\nat Platform 3, coat folded.", baseVersionId: art.current_version_id, label: "First words" } });

    // Writing the lyrics, the tune is one tap away.
    await page.reload();
    const playTune = page.getByRole("list", { name: "Play along" }).getByRole("button", { name: /^Play Tune v\d+$/ });
    await expect(playTune).toBeVisible();
    await playTune.click();
    await expect(page.getByRole("list", { name: "Play along" }).getByRole("button", { name: "Pause Tune" })).toHaveAttribute("aria-pressed", "true");

    // A singer, invited to Voice only.
    const { page: b } = await openContext("singer");
    await fakeMicrophone(b, true);
    const mira = await newCreator(b, { name: `Mira ${uid()}` });
    await page.goto(`/rooms/${projectId}`);
    await work.getByRole("button", { name: "Voice actions" }).click();
    await page.getByRole("menuitem", { name: "Invite to this part…" }).click();
    const invite = page.getByRole("dialog", { name: "Invite to Voice" });
    await invite.getByLabel("Find a creator").fill(`@${mira.handle}`);
    await invite.getByRole("button", { name: `Invite ${mira.name}` }).click();
    await b.goto(`/rooms/${projectId}`);
    await b.getByRole("button", { name: "Accept" }).click();
    await b.getByRole("region", { name: "The work" }).getByRole("button", { name: "Start Voice" }).click();
    await expect(b).toHaveURL(/\/audio$/);

    // She reads the lyrics, takes them as her words, and records over the tune.
    const editor = b.getByRole("region", { name: "Editor" });
    const lyrics = editor.getByRole("region", { name: /^Lyrics v\d+$/ });
    await expect(lyrics).toContainText("Every Sunday my father waited");
    await expect(editor.getByRole("list", { name: "Play along" }).getByRole("button", { name: /^Play Tune v\d+$/ })).toBeVisible();
    await lyrics.getByRole("button", { name: "Use these words" }).click();
    await expect(editor.getByRole("textbox").first()).toHaveValue(/Every Sunday my father waited/);
    await expect(editor.getByLabel(/^Play Tune while I record/)).toBeChecked();
    await b.getByRole("button", { name: "Record", exact: true }).click();
    const take = b.getByRole("dialog", { name: "Record" });
    await expect(take).toContainText(/Recording over Tune v\d+/);
    await expect(take.getByLabel("Words to sing")).toContainText("at Platform 3, coat folded.");
    await b.waitForTimeout(1500);
    await take.getByRole("button", { name: "Stop" }).click();
    await take.getByRole("button", { name: "Keep this take" }).click();
    await expect(take).toBeHidden({ timeout: 30_000 });

    // The take was made with the tune and the lyrics as they stood (step 2): the Room says so.
    await page.goto(`/rooms/${projectId}`);
    await expect(work.getByRole("list", { name: "Where it stands" }).getByRole("listitem").nth(2)).toContainText(/with Lyrics v\d+ · Tune v\d+/);
  });
});
