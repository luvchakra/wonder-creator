import { adminPatch, creatorIdOf, expect, test, uid, type Page } from "./fixtures";

// Phase 02 — Home orchestration + Quick Capture (docs/phases/02-home-quick-capture.md §18).

const capture = (page: Page) => page.getByRole("dialog", { name: "Quick Capture" });

/** A microphone that works (a quiet tone) or one the creator has refused. */
async function fakeMicrophone(page: Page, allowed: boolean) {
  await page.addInitScript((ok) => {
    const md = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true });
    md.getUserMedia = async () => {
      if (!ok) throw new DOMException("Permission denied", "NotAllowedError");
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const dest = ctx.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      return dest.stream;
    };
  }, allowed);
}

test.describe("Quick Capture", () => {
  test.beforeEach(({ creator }) => void creator);

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

    // Suggestions arrive later, as suggestions; the creator says yes.
    const suggestion = sheet.getByRole("button", { name: `Add to ${thread}` });
    await expect(suggestion).toBeVisible({ timeout: 30_000 });
    await suggestion.click();
    await expect(sheet.getByText(thread)).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();

    // Back on Home: a quiet line, with the note one tap away. It's a Material with exactly one Moment, in the DejaVu.
    const line = page.getByRole("region", { name: "Quick Capture" }).getByRole("status");
    await expect(line).toContainText("Note saved");
    const materialId = (await line.getByRole("link", { name: "Open" }).getAttribute("href"))!.split("/").pop()!;
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
