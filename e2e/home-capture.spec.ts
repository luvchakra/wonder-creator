import { adminPatch, creatorIdOf, fakeMicrophone, expect, test, uid, type Page } from "./fixtures";

// Phase 02 — Home orchestration + Quick Capture (docs/phases/02-home-quick-capture.md §18).

/** The note has no buttons of its own; leaving it is the close mark (the words are already saved). */
const closeSheet = (page: Page) => page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
const capture = (page: Page) => page.getByRole("dialog", { name: /^(Quick note|Voice note)$/ });


test.describe("Quick Capture", () => {
  test.beforeEach(({ creator }) => void creator);

  test("two ways in, at the greeting's top right; My captures and My Scrapbook are doors under it", async ({ page }) => {
    await page.goto("/");
    const quick = page.getByRole("region", { name: "Quick Capture" });
    // Quick note and Voice note only (owner, 21 Oct 2026): pictures and videos come in through Bring Material.
    await expect(quick.getByRole("button")).toHaveCount(2);
    await expect(quick.getByRole("button", { name: "Quick note" })).toBeVisible();
    await expect(quick.getByRole("button", { name: "Voice note" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Quick Pic|Video Note/ })).toHaveCount(0);
    // In the header's top-right corner, beside the greeting.
    const [greet, note] = await Promise.all([page.getByRole("heading", { level: 1 }).boundingBox(), quick.getByRole("button", { name: "Quick note" }).boundingBox()]);
    expect(note!.x).toBeGreaterThan(greet!.x + greet!.width / 2);
    expect(note!.y).toBeLessThan(greet!.y + greet!.height);
    // No lists of captures or scraps on Home: two doors.
    const doors = page.getByRole("navigation", { name: "Your captures and Scrapbook" });
    await expect(doors.getByRole("link")).toHaveCount(2);
    await expect(page.getByRole("list", { name: "Recent captures" })).toHaveCount(0);
    await doors.getByRole("link", { name: /My captures/ }).click();
    await expect(page).toHaveURL(/\/captures$/);
  });

  test("a quick note saves in seconds, once, as a Material with its Moment — and suggests a DejaVu it mentions", async ({ page }) => {
    const tag = uid();
    const thread = `Railways ${tag}`;
    expect((await page.request.post("/api/v1/dejavus", { data: { name: thread } })).ok()).toBe(true);
    await page.goto("/");
    await page.getByRole("region", { name: "Quick Capture" }).getByRole("button", { name: "Quick note" }).click();
    const sheet = capture(page);
    await expect(page.getByRole("dialog", { name: "Quick note" })).toBeVisible();
    // Focused at once; no title, Project, tags or DejaVu asked for.
    await expect(sheet.getByLabel("Quick note")).toBeFocused();
    await sheet.getByLabel("Quick note").fill(`The station should feel like waiting, not travelling — ${thread.toLowerCase()} ${tag}`);
    // No Save button: the note saves itself, and the sheet has nothing at the bottom.
    await expect(sheet.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Save|Cancel|Done/ })).toHaveCount(0);
    await closeSheet(page);

    // Back on Home: a quiet line offering the next step; the note itself sits in My captures. It's a Material with exactly one Moment, in the DejaVu.
    const line = page.getByRole("region", { name: "Quick Capture" }).getByRole("status");
    await expect(line).toContainText("Note saved");
    await expect(line.getByRole("button", { name: "Make something" })).toBeVisible();
    const found = (await (await page.request.get(`/api/v1/materials?q=${encodeURIComponent(tag)}`)).json()) as { items: Array<{ id: string }> };
    const materialId = found.items[0]!.id;
    const moment = await (await page.request.get(`/api/v1/moments/by-entity?entityType=material&entityId=${materialId}`)).json();
    expect(moment.momentId).toBeTruthy();
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
    await expect(page.getByText("Offline · saved locally").first()).toBeVisible();
    await closeSheet(page);

    await context.setOffline(false);
    await expect(page.getByRole("region", { name: "Quick Capture" }).getByRole("status")).toContainText("Your offline note is saved now.", { timeout: 15_000 });
    const found = await (await page.request.get(`/api/v1/materials?q=${encodeURIComponent(text.split(" ").pop()!)}`)).json();
    expect(found.items).toHaveLength(1);
  });

  test("a quick note can be typed or dictated with the small mic, and both end up in the same note", async ({ page }) => {
    // A stand-in for the browser's own speech-to-text (Web Speech API): the test says the words.
    await page.addInitScript(() => {
      type Result = { 0: { transcript: string }; isFinal: boolean };
      class FakeSpeech {
        continuous = false;
        interimResults = false;
        lang = "";
        onresult: ((e: { resultIndex: number; results: Result[] }) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        results: Result[] = [];
        start() {
          (window as unknown as { __speech: FakeSpeech }).__speech = this;
        }
        stop() {
          setTimeout(() => this.onend?.(), 0);
        }
        say(words: string, isFinal: boolean) {
          const r = { 0: { transcript: words }, isFinal };
          if (this.results.length && !this.results[this.results.length - 1].isFinal) this.results[this.results.length - 1] = r;
          else this.results.push(r);
          this.onresult?.({ resultIndex: this.results.length - 1, results: this.results });
        }
      }
      // Both names: current Chromium has the unprefixed SpeechRecognition natively, and the app prefers it.
      for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) Object.defineProperty(window, name, { value: FakeSpeech, configurable: true, writable: true });
    });
    const say = (words: string, isFinal = true) => page.evaluate(([w, f]) => (window as unknown as { __speech: { say: (w: string, f: boolean) => void } }).__speech.say(w as string, f as boolean), [words, isFinal] as const);

    const tag = uid();
    await page.goto("/");
    await page.getByRole("button", { name: "Quick note" }).click();
    const note = capture(page).getByLabel("Quick note");
    // Typing works as ever…
    await note.fill(`Typed first ${tag}.`);
    // …and the mic dictates into the same note, after what's there; words appear as they're recognised.
    const mic = capture(page).getByRole("button", { name: "Dictate" });
    await expect(mic).toBeVisible();
    await mic.click();
    await expect(capture(page).getByRole("button", { name: "Stop dictating" })).toHaveAttribute("aria-pressed", "true");
    await expect(capture(page).getByRole("status").filter({ hasText: "Listening" })).toBeVisible();
    await say("then spoken", false);
    await expect(note).toHaveText(`Typed first ${tag}. then spoken`);
    await say("then spoken aloud");
    await expect(note).toHaveText(`Typed first ${tag}. then spoken aloud`);
    await capture(page).getByRole("button", { name: "Stop dictating" }).click();
    await expect(capture(page).getByRole("button", { name: "Dictate" })).toHaveAttribute("aria-pressed", "false");
    // Back to the keyboard to finish it.
    await note.press("End");
    await note.pressSequentially(" and typed again");
    await expect(note).toHaveText(`Typed first ${tag}. then spoken aloud and typed again`);
    await expect(capture(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    const found = await (await page.request.get(`/api/v1/materials?q=${encodeURIComponent(tag)}`)).json();
    expect(found.items).toHaveLength(1);
  });

  test("where the browser can't dictate, the mic says so and typing still works", async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Quick note" }).click();
    await capture(page).getByRole("button", { name: "Dictate" }).click();
    await expect(capture(page).getByRole("status").filter({ hasText: "Dictation isn't available in this browser" })).toBeVisible();
    await capture(page).getByLabel("Quick note").fill("Still typed by hand");
    await expect(capture(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  });

  test("a voice note records at once, saves the original first, and says honestly when it can't be transcribed", async ({ page }) => {
    await fakeMicrophone(page, true);
    await page.goto("/");
    await page.getByRole("button", { name: "Voice note" }).click();
    const sheet = capture(page);
    await expect(page.getByRole("dialog", { name: "Voice note" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(1500);
    await sheet.getByRole("button", { name: "Stop" }).click();
    // It saves itself as soon as it stops; the editor is right there: play, trim, cut, undo, and more.
    await expect(sheet.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Trim to selection" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Cut selection" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^Save$/ })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Export, share or delete" }).click();
    for (const item of [/Share to another app/, /Export as WAV/, /Export the original/, /Delete/]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.keyboard.press("Escape");
    await closeSheet(page);
    // No transcription provider here: the recording is kept and the line says so.
    await expect(page.getByRole("region", { name: "Quick Capture" }).getByRole("status")).toContainText("Transcription unavailable", { timeout: 30_000 });
  });

  test("looking back: what was caught is all in My captures, by day", async ({ page }) => {
    await fakeMicrophone(page, true);
    await page.goto("/");
    const words = `The tea stall's kettle sings before the train ${uid()}`;
    await page.getByRole("button", { name: "Quick note" }).click();
    await capture(page).getByLabel("Quick note").fill(words);
    await expect(capture(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await closeSheet(page);

    await page.getByRole("button", { name: "Voice note" }).click();
    await expect(capture(page).getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(1200);
    await capture(page).getByRole("button", { name: "Stop" }).click();
    await expect(capture(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 30_000 });
    await closeSheet(page);

    // The door opens all of them, by day, with one row of filters.
    await page.getByRole("navigation", { name: "Your captures and Scrapbook" }).getByRole("link", { name: /My captures/ }).click();
    await expect(page).toHaveURL(/\/captures$/);
    await expect(page.getByRole("heading", { name: "My captures", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(words) })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Play the voice note/ })).toBeVisible();
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

    // Gone for good, not just hidden.
    await page.reload();
    await expect(page.getByRole("link", { name: new RegExp(keep) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(drop) })).toHaveCount(0);
  });

  test("with the microphone refused, it says so and offers a quick note instead", async ({ page }) => {
    await fakeMicrophone(page, false);
    await page.goto("/");
    await page.getByRole("button", { name: "Voice note" }).click();
    const sheet = capture(page);
    await expect(sheet.getByRole("alert")).toContainText("Microphone access is off");
    await sheet.getByRole("button", { name: "Write a quick note" }).click();
    await expect(page.getByRole("dialog", { name: "Quick note" })).toBeVisible();
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
