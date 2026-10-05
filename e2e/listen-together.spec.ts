import { readFile } from "node:fs/promises";
import { expect, fakeMicrophone, test, uid } from "./fixtures";

// Parts, step 4 (docs/creative-room-parts.md): Listen together — the Room's kept takes played as one, each at its
// start and level, the words beneath, and a download made on the device.
test.describe("Creative Room parts: listen together", () => {
  test("the takes play as one; starts and levels save; the mix downloads as a WAV", async ({ page, creator }) => {
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
    // Nothing to hear yet: no way in.
    await expect(work.getByRole("link", { name: "Listen together" })).toHaveCount(0);

    // A kept take on Tune.
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

    // Words on Lyrics.
    await page.goto(`/rooms/${projectId}`);
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Join this part" }).click();
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Start the Creation" }).click();
    await expect(page).toHaveURL(/\/write$/);
    const lyricsId = page.url().match(/creations\/([0-9a-f-]{36})/)![1];
    const art = (await (await page.request.get(`/api/v1/artifacts/${lyricsId}`)).json()).artifact as { current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${lyricsId}/versions`, { data: { content: "Every Sunday my father waited\nat Platform 3, coat folded.", baseVersionId: art.current_version_id, label: "First words" } });

    // The Room's hero opens Listen together.
    await page.goto(`/rooms/${projectId}`);
    await work.getByRole("link", { name: "Listen together" }).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${projectId}/song$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("list", { name: "Where it stands" })).toContainText(/Tune v\d+/);
    await expect(page.getByRole("region", { name: /^Lyrics · v\d+$/ })).toContainText("Every Sunday my father waited");
    const takes = page.getByRole("region", { name: "The takes" });
    await expect(takes).toContainText("Voice — no take kept yet");

    // It plays (and pauses).
    await page.getByRole("button", { name: `Play ${title}` }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: `Play ${title}` })).toBeVisible();

    // Level and start save as they change, and come back.
    await takes.getByLabel("Tune level").fill("80");
    await takes.getByRole("button", { name: "Start Tune later" }).click();
    await takes.getByRole("button", { name: "Start Tune later" }).click();
    await expect(takes.getByText("+0.2s")).toBeVisible();
    await expect(takes.getByText("Saved")).toBeVisible();
    await page.reload();
    await expect(takes.getByText("+0.2s")).toBeVisible();
    await expect(takes.getByLabel("Tune level")).toHaveValue("80");
    await takes.getByRole("button", { name: "Mute Tune" }).click();
    await expect(takes.getByRole("button", { name: "Unmute Tune" })).toHaveAttribute("aria-pressed", "true");
    await takes.getByRole("button", { name: "Unmute Tune" }).click();
    await expect(takes.getByText("Saved")).toBeVisible();

    // The download is the mix as heard: a WAV made here.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download the mix" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`${title}.wav`);
    const bytes = await readFile((await file.path())!);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(bytes.length).toBeGreaterThan(44 + 44_100 * 2 * 2); // at least a second of stereo sound

    // Back goes to the Room.
    await page.getByRole("link", { name: `Back to ${title}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${projectId}$`));
  });
});
