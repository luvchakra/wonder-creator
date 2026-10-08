import sharp from "sharp";
import { adminPatch, creatorIdOf, fakeMicrophone, expect, test, uid, type Page } from "./fixtures";

// Phase 02 — Home orchestration + Quick Capture (docs/phases/02-home-quick-capture.md §18).

const capture = (page: Page) => page.getByRole("dialog", { name: "Quick Capture" });


test.describe("Quick Capture", () => {
  test.beforeEach(({ creator }) => void creator);

  test("sits above My Scrapbook with four ways in; Quick Pic takes or chooses pictures, each saved as a Material", async ({ page }) => {
    await page.goto("/");
    const quick = page.getByRole("region", { name: "Quick Capture" });
    await expect(quick.locator("button")).toHaveText(["Quick note", "Voice note", "Quick Pic", "Video Note"]);
    // Capture comes first, above the Scrapbook.
    const [q, s] = await Promise.all([quick.boundingBox(), page.getByRole("region", { name: "My Scrapbook" }).boundingBox()]);
    expect(q!.y).toBeLessThan(s!.y);
    // The phone's own chooser opens — camera or gallery (owner, 7 Oct 2026): nothing forces the camera's limited mode.
    const pick = page.getByLabel("Take or choose a picture");
    await expect(pick).not.toHaveAttribute("capture");
    await expect(page.getByLabel("Record or choose a video")).not.toHaveAttribute("capture");
    // Several pictures chosen from the gallery each land as a Material.
    const jpg = (r: number) => sharp({ create: { width: 800, height: 600, channels: 3, background: { r, g: 150, b: 90 } } }).jpeg().toBuffer();
    await pick.setInputFiles([
      { name: "harbour.jpg", mimeType: "image/jpeg", buffer: await jpg(230) },
      { name: "pier.jpg", mimeType: "image/jpeg", buffer: await jpg(120) },
    ]);
    await expect(quick.getByText("2 pictures saved to Materials")).toBeVisible({ timeout: 30_000 });
    // One picture (from the camera, or the gallery) lands without another step — and the next step is making something from it.
    await pick.setInputFiles({ name: "harbour.jpg", mimeType: "image/jpeg", buffer: await jpg(200) });
    await expect(quick.getByText("Picture saved")).toBeVisible({ timeout: 30_000 });
    await quick.getByRole("button", { name: "Make something" }).click();
    const make = page.getByRole("dialog", { name: "Make a new Creation" });
    await expect(make.getByRole("list", { name: "Formats" }).getByRole("button")).toHaveCount(6);
    await expect(make).toContainText("This Material comes with it as its source.");
    await page.keyboard.press("Escape");
    // The picture itself is one tap away in My captures.
    await expect(page.getByRole("list", { name: "Recent captures" }).getByRole("link", { name: /^Picture,/ }).first()).toBeVisible();
  });

  test("a quick note saves in seconds, once, as a Material with its Moment — and suggests a DejaVu it mentions", async ({ page }) => {
    const tag = uid();
    const thread = `Railways ${tag}`;
    expect((await page.request.post("/api/v1/dejavus", { data: { name: thread } })).ok()).toBe(true);
    await page.goto("/");
    await page.getByRole("region", { name: "Quick Capture" }).getByRole("button", { name: "Quick note" }).click();
    const sheet = capture(page);
    await expect(sheet.getByRole("tab", { name: "Text" })).toHaveAttribute("aria-selected", "true");
    // Focused at once; no title, Project, tags or DejaVu asked for.
    await expect(sheet.getByLabel("Quick note")).toBeFocused();
    await sheet.getByLabel("Quick note").fill(`The station should feel like waiting, not travelling — ${thread.toLowerCase()} ${tag}`);
    await sheet.getByRole("button", { name: /Save note/ }).click();
    await expect(sheet.getByRole("status").filter({ hasText: "Note saved" })).toBeVisible();
    // The next step is right there: make something from it (no "capture another" — Home's row is one tap away).
    await expect(sheet.getByRole("button", { name: "Make something" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Capture another" })).toHaveCount(0);

    // Suggestions arrive later, as suggestions; the creator says yes.
    const suggestion = sheet.getByRole("button", { name: `Add to ${thread}` });
    await expect(suggestion).toBeVisible({ timeout: 30_000 });
    await suggestion.click();
    await expect(sheet.getByText(thread)).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();

    // Back on Home: a quiet line offering the next step; the note itself sits in My captures. It's a Material with exactly one Moment, in the DejaVu.
    const line = page.getByRole("region", { name: "Quick Capture" }).getByRole("status");
    await expect(line).toContainText("Note saved");
    await expect(line.getByRole("button", { name: "Make something" })).toBeVisible();
    const tile = page.getByRole("list", { name: "Recent captures" }).getByRole("link").first();
    const materialId = (await tile.getAttribute("href"))!.split("/").pop()!;
    const moment = await (await page.request.get(`/api/v1/moments/by-entity?entityType=material&entityId=${materialId}`)).json();
    expect(moment.momentId).toBeTruthy();
    expect(moment.dejavus.map((d: { name: string }) => d.name)).toEqual([thread]);
  });

  test("a retry with the same capture id lands exactly once", async ({ page }) => {
    const clientId = crypto.randomUUID();
    const text = `Platform 3 at dusk ${uid()}`;
    const first = await (await page.request.post("/api/v1/capture", { data: { kind: "note", clientId, text } })).json();
    const again = await (await page.request.post("/api/v1/capture", { data: { kind: "note", clientId, text } })).json();
    expect(first.materialId).toBeTruthy();
    expect(again).toMatchObject({ duplicate: true, materialId: first.materialId, momentId: first.momentId });
  });

  test("offline, a note is kept on the device and synced once the connection returns", async ({ page, context, consoleGuard }) => {
    // Being offline is the point: the browser reports the requests it couldn't make (prefetches, polling).
    consoleGuard.allow(/ERR_INTERNET_DISCONNECTED/);
    const text = `Written on the train ${uid()}`;
    await page.goto("/");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Quick note" }).click();
    await capture(page).getByLabel("Quick note").fill(text);
    await capture(page).getByRole("button", { name: /Save note/ }).click();
    await expect(capture(page).getByRole("status").filter({ hasText: "saved on this device" })).toBeVisible();
    await capture(page).getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Offline · saved locally").first()).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByRole("region", { name: "Quick Capture" }).getByRole("status")).toContainText("Your offline note is saved now.", { timeout: 15_000 });
    const found = await (await page.request.get(`/api/v1/materials?q=${encodeURIComponent(text.split(" ").pop()!)}`)).json();
    expect(found.items).toHaveLength(1);
  });

  test("a voice note records at once, saves the original first, and says honestly when it can't be transcribed", async ({ page }) => {
    await fakeMicrophone(page, true);
    await page.goto("/");
    await page.getByRole("button", { name: "Voice note" }).click();
    const sheet = capture(page);
    await expect(sheet.getByRole("tab", { name: "Voice" })).toHaveAttribute("aria-selected", "true");
    await expect(sheet.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(1500);
    await sheet.getByRole("button", { name: "Stop" }).click();
    await expect(sheet.getByText(/^Voice note · 0:0\d$/)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Play" })).toBeVisible();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet.getByRole("status").filter({ hasText: "Voice note saved" })).toBeVisible({ timeout: 30_000 });
    // No transcription provider here: the recording is kept and the line says so.
    await expect(sheet.getByRole("status").filter({ hasText: "Transcription unavailable" })).toBeVisible({ timeout: 30_000 });
  });

  test("looking back: what was caught shows under Quick Capture at once, and all of it by day in My captures", async ({ page }) => {
    await fakeMicrophone(page, true);
    await page.goto("/");
    const mine = page.getByRole("region", { name: "My captures" });
    // Nothing caught yet: nothing to look back on, so nothing shows.
    await expect(page.getByRole("region", { name: "Quick Capture" })).toBeVisible();
    await expect(mine).toHaveCount(0);

    const words = `The tea stall's kettle sings before the train ${uid()}`;
    await page.getByRole("button", { name: "Quick note" }).click();
    await capture(page).getByLabel("Quick note").fill(words);
    await capture(page).getByRole("button", { name: /Save note/ }).click();
    await expect(capture(page).getByRole("status").filter({ hasText: "Note saved" })).toBeVisible();
    await capture(page).getByRole("button", { name: "Done" }).click();
    // The note is there at once, without reloading Home.
    await expect(mine.getByRole("link", { name: new RegExp(words) })).toBeVisible();

    await page.getByRole("button", { name: "Voice note" }).click();
    await expect(capture(page).getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(1200);
    await capture(page).getByRole("button", { name: "Stop" }).click();
    await capture(page).getByRole("button", { name: "Save" }).click();
    await expect(capture(page).getByRole("status").filter({ hasText: "Voice note saved" })).toBeVisible({ timeout: 30_000 });
    await capture(page).getByRole("button", { name: "Done" }).click();
    const jpg = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 210, g: 160, b: 120 } } }).jpeg().toBuffer();
    await page.getByLabel("Take or choose a picture").setInputFiles({ name: "kettle.jpg", mimeType: "image/jpeg", buffer: jpg });
    await expect(page.getByRole("region", { name: "Quick Capture" }).getByText("Picture saved")).toBeVisible({ timeout: 30_000 });

    // Newest first: the picture, the voice note (playable right here), the note.
    const strip = mine.getByRole("list", { name: "Recent captures" });
    await expect(strip.getByRole("listitem")).toHaveCount(3);
    await expect(strip.getByRole("listitem").first().getByRole("link", { name: /^Picture,/ })).toBeVisible();
    await expect(strip.getByRole("button", { name: /^Play the voice note/ })).toBeEnabled();

    // The title opens all of them, by day, with one row of filters.
    await mine.getByRole("link", { name: "My captures" }).click();
    await expect(page).toHaveURL(/\/captures$/);
    await expect(page.getByRole("heading", { name: "My captures", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(words) })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Picture,/ })).toBeVisible();
    const kinds = page.getByRole("navigation", { name: "Kind of capture" });
    await expect(kinds.getByRole("link")).toHaveText(["All", "Notes", "Voice", "Pictures", "Videos"]);
    await kinds.getByRole("link", { name: "Voice" }).click();
    await expect(page).toHaveURL(/kind=voice/);
    await expect(page.getByRole("button", { name: /^Play the voice note/ })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(words) })).toHaveCount(0);
    await kinds.getByRole("link", { name: "Videos" }).click();
    await expect(page.getByText("No videos yet.")).toBeVisible();
    // Back goes to Home, where it came from.
    await page.getByRole("link", { name: "Back to Home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a capture can be deleted from My captures — asked first, then gone everywhere", async ({ page }) => {
    const keep = `Keep: the porter's whistle ${uid()}`;
    const drop = `Drop: a half-thought about tickets ${uid()}`;
    for (const text of [keep, drop]) expect((await page.request.post("/api/v1/capture", { data: { kind: "note", clientId: crypto.randomUUID(), text } })).ok()).toBe(true);
    await page.goto("/captures");
    await expect(page.getByRole("link", { name: new RegExp(drop) })).toBeVisible();

    // Asked first; Cancel keeps it.
    const bin = page.getByRole("button", { name: /^Delete note: Drop: a half-thought/ });
    await bin.click();
    const ask = page.getByRole("dialog");
    await expect(ask.getByRole("heading", { name: "Delete this note?" })).toBeVisible();
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("link", { name: new RegExp(drop) })).toBeVisible();

    await bin.click();
    await ask.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: new RegExp(drop) })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Note deleted." })).toBeAttached();
    await expect(page.getByRole("link", { name: new RegExp(keep) })).toBeVisible();

    // Gone for good: not on reload, not on Home.
    await page.reload();
    await expect(page.getByRole("link", { name: new RegExp(keep) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(drop) })).toHaveCount(0);
    await page.goto("/");
    const mine = page.getByRole("region", { name: "My captures" });
    await expect(mine.getByRole("link", { name: new RegExp(keep) })).toBeVisible();
    await expect(mine.getByRole("link", { name: new RegExp(drop) })).toHaveCount(0);
  });

  test("with the microphone refused, it says so and offers a quick note instead", async ({ page }) => {
    await fakeMicrophone(page, false);
    await page.goto("/");
    await page.getByRole("button", { name: "Voice note" }).click();
    const sheet = capture(page);
    await expect(sheet.getByRole("alert")).toContainText("Microphone access is off");
    await sheet.getByRole("button", { name: "Write a quick note" }).click();
    await expect(sheet.getByRole("tab", { name: "Text" })).toHaveAttribute("aria-selected", "true");
    await expect(sheet.getByLabel("Quick note")).toBeVisible();
  });
});

test.describe("Home orchestration", () => {
  test("quiet when nothing needs attention: one calm line, Continue as the one action, no empty modules", async ({ page, creator }) => {
    void creator;
    const title = `A Life in Moments ${uid()}`;
    await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title } });
    await page.goto("/");
    await expect(page.locator("[data-home-mode]")).toHaveAttribute("data-home-mode", "quiet");
    await expect(page.getByText("Nothing needs your attention.")).toBeVisible();
    const cont = page.getByRole("list", { name: "Creations in progress" });
    await expect(cont.getByRole("link", { name: new RegExp(title) })).toHaveAttribute("data-primary-action", "true");
    for (const name of ["While you were away", "Your world is connecting", "A DejaVu surfaced", "A little spark", "You could help"]) await expect(page.getByRole("region", { name })).toHaveCount(0);
    // One large action only.
    await expect(page.locator("[data-primary-action]")).toHaveCount(1);
  });

  test("returning after days away: the world connecting across time, and a DejaVu surfacing — never changed on its own", async ({ page, creator }) => {
    const tag = uid();
    const old = (await (await page.request.post("/api/v1/capture", { data: { kind: "note", clientId: crypto.randomUUID(), text: `Empty platform ${tag}` } })).json()).materialId as string;
    const fresh = (await (await page.request.post("/api/v1/capture", { data: { kind: "note", clientId: crypto.randomUUID(), text: `Dad's railway story ${tag}\n${"He waited at Platform 3 every Sunday, watching the trains go by. ".repeat(6)}` } })).json())
      .materialId as string;
    const threads: string[] = [];
    for (const name of [`Railways ${tag}`, `Dad ${tag}`]) {
      const id = (await (await page.request.post("/api/v1/dejavus", { data: { name } })).json()).dejavu.id as string;
      threads.push(id);
      for (const m of [old, fresh]) await page.request.post(`/api/v1/dejavus/${id}/moments`, { data: { entityType: "material", entityId: m } });
    }
    // The older note is from months ago, and its links from before the last visit; the last visit was days ago.
    await adminPatch("moment_references", `entity_type=eq.material&entity_id=eq.${old}`, { occurred_at: new Date(Date.now() - 200 * 86_400_000).toISOString() });
    const oldMoment = (await (await page.request.get(`/api/v1/moments/by-entity?entityType=material&entityId=${old}`)).json()).momentId as string;
    await adminPatch("dejavu_moments", `moment_id=eq.${oldMoment}`, { created_at: new Date(Date.now() - 10 * 86_400_000).toISOString() });
    await page.goto("/");
    await adminPatch("creator_visits", `creator_id=eq.${await creatorIdOf(creator.id)}`, { last_seen_at: new Date(Date.now() - 3 * 86_400_000).toISOString() });

    await page.goto("/");
    await expect(page.locator("[data-home-mode]")).toHaveAttribute("data-home-mode", "return");
    const connecting = page.getByRole("region", { name: "Your world is connecting" });
    await expect(connecting).toContainText(/from \w+ and a new note share “(Railways|Dad) /);
    const surfaced = page.getByRole("region", { name: "A DejaVu surfaced" });
    await expect(surfaced).toContainText("1 new, 2 Moments");
    // The navbar's one line follows the same priority; nothing was attached or changed by Home.
    await expect(page.getByText("A new connection was found").first()).toBeVisible();
    for (const id of threads) expect((await (await page.request.get(`/api/v1/dejavus/${id}`)).json()).dejavu.total).toBe(2);
    await connecting.getByRole("link").click();
    await expect(page).toHaveURL(/\/dejavu\/[0-9a-f-]{36}$/);
  });

  test("Home is one structured payload, not a feed", async ({ page, creator }) => {
    void creator;
    const home = await (await page.request.get("/api/v1/home")).json();
    expect(home).toMatchObject({ mode: expect.stringMatching(/^(active|return|quiet)$/), quickCapture: { textEnabled: true, voiceEnabled: true } });
    expect(typeof home.contextLine).toBe("string");
    expect(home.contextLine.split(" ").length).toBeLessThanOrEqual(7);
  });
});
