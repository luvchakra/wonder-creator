import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { test as base, expect, type Browser, type BrowserContext, type ConsoleMessage, type Page } from "@playwright/test";

export { expect };
export type { Page };

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(): Record<string, string> {
  const file = path.join(ROOT, "apps/web/.env.local");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile();
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SECRET = process.env.E2E_SUPABASE_SECRET_KEY ?? fileEnv.SUPABASE_SECRET_KEY ?? "";

export const PASSWORD = "e2e-password-0123456789";

/** A short unique suffix usable in handles ([a-z0-9_], ≤ 30 chars overall). */
export function uid(): string {
  return `${Date.now().toString(36).slice(-5)}${randomBytes(3).toString("hex")}`;
}

export function uniqueHandle(prefix = "e2e"): string {
  return `${prefix}_${uid()}`.slice(0, 30);
}

// ---------------------------------------------------------------------------
// Console / page error guard
// ---------------------------------------------------------------------------

export interface ConsoleGuard {
  /** Start collecting console errors and uncaught page errors for every page of this context. */
  watch(context: BrowserContext, label?: string): void;
  /** Ignore console errors matching this pattern for the rest of the test (use sparingly, with a reason). */
  allow(pattern: RegExp): void;
  readonly errors: string[];
  /** Errors not matched by an `allow` pattern. */
  readonly unexpected: string[];
}

function createConsoleGuard(): ConsoleGuard {
  const errors: string[] = [];
  const allowed: RegExp[] = [];
  const watched = new WeakSet<BrowserContext>();
  const attach = (page: Page, label: string) => {
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      const loc = msg.location();
      errors.push(`[${label}] console.error: ${text}${loc.url ? ` (${loc.url}:${loc.lineNumber})` : ""} @ ${page.url()}`);
    });
    page.on("pageerror", (err) => {
      errors.push(`[${label}] pageerror: ${err.message} @ ${page.url()}`);
    });
  };
  return {
    errors,
    allow(pattern) {
      allowed.push(pattern);
    },
    watch(context, label = "page") {
      if (watched.has(context)) return;
      watched.add(context);
      for (const p of context.pages()) attach(p, label);
      context.on("page", (p) => attach(p, label));
    },
    get unexpected() {
      return errors.filter((e) => !allowed.some((r) => r.test(e)));
    },
  };
}

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

export interface Creator {
  id: string;
  email: string;
  password: string;
  name: string;
  firstName: string;
  handle: string;
}

export interface OnboardingOptions {
  disciplines?: string[];
  tones?: string[];
  writingStyle?: string | null;
  visualStyles?: string[];
  preserve?: string[];
  avoid?: string[];
  languages?: string[];
  bio?: string;
}

/** Create a confirmed auth user through the Supabase admin API (no UI). */
export async function createAuthUser(name: string): Promise<Omit<Creator, "handle">> {
  if (!SUPABASE_SECRET) throw new Error("No Supabase secret key: set E2E_SUPABASE_SECRET_KEY or apps/web/.env.local SUPABASE_SECRET_KEY");
  const email = `e2e-${uid()}@example.com`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SUPABASE_SECRET, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } }),
  });
  if (!res.ok) throw new Error(`admin createUser failed: ${res.status} ${await res.text()}`);
  const user = (await res.json()) as { id: string };
  return { id: user.id, email, password: PASSWORD, name, firstName: name.split(" ")[0] };
}

/** Sign in through the real sign-in form and wait until the app is loaded. */
export async function signInViaUi(page: Page, c: { email: string; password: string }, expectPath: RegExp = /\/(onboarding)?$/) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(c.email);
  await page.getByLabel("Password").fill(c.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => expectPath.test(u.pathname));
}

/** Complete every onboarding step through the onboarding API (uses the page's session cookies). */
export async function onboardViaApi(page: Page, c: { name: string; handle: string }, o: OnboardingOptions = {}) {
  const steps: Array<[string, Record<string, unknown>]> = [
    ["about", { displayName: c.name, handle: c.handle, bio: o.bio ?? "", location: "", showLocation: false, languages: o.languages ?? ["English"] }],
    ["identity", { disciplines: o.disciplines ?? ["Writing", "Poetry"], skills: [], interests: [] }],
    ["style", { tones: o.tones ?? ["Warm"], writingStyle: o.writingStyle === undefined ? "narrative" : o.writingStyle, formality: null, visualStyles: o.visualStyles ?? ["Cinematic"], experimentation: "balanced" }],
    ["boundaries", { preserve: o.preserve ?? ["My voice"], avoid: o.avoid ?? ["Clichés"], sensitive: [] }],
    ["ready", {}],
  ];
  for (const [step, body] of steps) {
    const r = await page.request.post(`/api/v1/creators/onboarding/${step}`, { data: body });
    if (!r.ok()) throw new Error(`onboarding ${step} failed: ${r.status()} ${await r.text()}`);
  }
}

/**
 * A fresh, fully onboarded creator signed in on `page`.
 * Account via the admin API, sign-in via the UI, onboarding via the API.
 */
export async function newCreator(page: Page, opts: { name?: string; handlePrefix?: string; onboarding?: OnboardingOptions } = {}): Promise<Creator> {
  const name = opts.name ?? `Test ${uid()}`;
  const user = await createAuthUser(name);
  const handle = uniqueHandle(opts.handlePrefix);
  await signInViaUi(page, user, /^\/onboarding$/);
  await onboardViaApi(page, { name, handle }, opts.onboarding);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.firstName);
  return { ...user, handle };
}

/** Sign up through the real sign-up form (email confirmation is disabled locally). Lands on /onboarding. */
export async function signUpViaUi(page: Page, name: string): Promise<{ email: string; password: string; name: string }> {
  const email = `e2e-${uid()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /Let's begin/ }).click();
  await page.waitForURL("**/onboarding");
  return { email, password: PASSWORD, name };
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** A valid 16x16 RGB PNG (a simple gradient) generated in memory. */
export function pngBytes(size = 16): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    for (let x = 0; x < size; x++) {
      raw[row + 1 + x * 3] = (x * 255) / size;
      raw[row + 2 + x * 3] = (y * 255) / size;
      raw[row + 3 + x * 3] = 180;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

/** A tiny valid PCM WAV (0.25 s of a 440 Hz tone, 8 kHz mono 16-bit). */
export function wavBytes(): Buffer {
  const rate = 8000;
  const samples = rate / 4;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Upload files through the CreatorSend inbox "Upload files" button (real file chooser). */
export async function uploadViaInbox(page: Page, files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  if (!page.url().endsWith("/send")) await page.goto("/send");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files" }).click();
  await (await chooser).setFiles(files);
}

/** The "Recent sends" list item whose material link has this title. */
export function sendItem(page: Page, title: string) {
  return page.getByRole("region", { name: "Recent sends" }).getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

/** Save a text note through CreatorSend and wait until it's processed; returns the material id. */
export async function saveNote(page: Page, text: string): Promise<string> {
  await page.goto("/send");
  await page.getByLabel("Write or paste text").fill(text);
  await page.getByRole("button", { name: "Save note" }).click();
  const title = text.split("\n")[0].slice(0, 80);
  const item = sendItem(page, title);
  await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });
  const href = await item.getByRole("link", { name: title, exact: true }).getAttribute("href");
  const id = href?.split("/").pop();
  if (!id) throw new Error("note has no material link");
  return id;
}

/** The CreatorBrain artifact card in CreatorTalk (the one with "Open in Studio"). */
export function artifactCard(page: Page) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Open in Creative Studio" }) });
}

/**
 * Save a note, then ask CreatorTalk "Turn these notes into a poem." with it attached.
 * Returns the note (material) id/title and the created artifact id.
 */
export async function poemFromNote(page: Page, noteText = `The tide keeps our old names ${uid()}\nGrandmother's lantern on the jetty.`) {
  const materialId = await saveNote(page, noteText);
  const noteTitle = noteText.split("\n")[0];
  await page.goto(`/space/materials/${materialId}`);
  await page.getByRole("link", { name: "Use in creation" }).click();
  await expect(page).toHaveURL(new RegExp(`/create\\?material=${materialId}`));
  const talk = page.getByRole("region", { name: "meTalk" });
  await expect(talk.getByText(noteTitle)).toBeVisible(); // attached chip
  await talk.getByLabel("What are you thinking about?").fill("Turn these notes into a poem.");
  await talk.getByRole("button", { name: "Send", exact: true }).click();
  const card = artifactCard(page);
  await expect(card).toBeVisible({ timeout: 45_000 });
  const href = await card.getByRole("link", { name: "Open in Creative Studio" }).getAttribute("href");
  const artifactId = /\/artifacts\/([0-9a-f-]{36})\/studio/.exec(href ?? "")?.[1];
  if (!artifactId) throw new Error(`no artifact link in meTalk (${href})`);
  return { materialId, noteTitle, artifactId };
}

/** Open the account menu in the top bar and pick an item. */
export async function accountMenu(page: Page, item: "Profile" | "Creative Memory" | "Settings" | "Sign out") {
  await page.getByRole("button", { name: "Your account" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

interface Fixtures {
  consoleGuard: ConsoleGuard;
  /** A fresh onboarded creator, already signed in on `page`. */
  creator: Creator;
  /** Open an additional, isolated browser context (another person). Watched by the console guard, closed after the test. */
  openContext: (label: string) => Promise<{ context: BrowserContext; page: Page }>;
}

/**
 * While a page streams in (the app shell has a loading boundary), React briefly keeps the incoming content in a hidden
 * holder (`div[hidden][id^="S:"]`) after it's already on screen. Readers never see it, but Playwright's strict text
 * matching counts hidden elements, so a check right after a load could find the same words twice. After goto/reload,
 * wait (briefly) for those holders to empty before the test looks.
 */
export async function settleStreaming(page: Page) {
  await page
    .waitForFunction(() => ![...document.querySelectorAll('div[hidden][id^="S:"]')].some((d) => d.childElementCount > 0), undefined, { timeout: 5_000 })
    .catch(() => undefined);
}
function settleOnLoad(page: Page) {
  for (const method of ["goto", "reload"] as const) {
    const original = page[method].bind(page) as (...a: unknown[]) => Promise<unknown>;
    (page as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
      const res = await original(...args);
      await settleStreaming(page);
      return res;
    };
  }
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    settleOnLoad(page);
    await use(page);
  },
  consoleGuard: [
    async ({ context }, use, testInfo) => {
      const guard = createConsoleGuard();
      guard.watch(context, "A");
      await use(guard);
      const unexpected = guard.unexpected;
      if (unexpected.length) await testInfo.attach("console-errors", { body: unexpected.join("\n\n"), contentType: "text/plain" });
      expect(unexpected, "browser console errors / uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
  creator: async ({ page }, use) => {
    await use(await newCreator(page));
  },
  openContext: async ({ browser, consoleGuard }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (label: string) => {
      const context = await newWatchedContext(browser, consoleGuard, label);
      opened.push(context);
      const page = await context.newPage();
      settleOnLoad(page);
      return { context, page };
    });
    for (const c of opened) await c.close();
  },
});

async function newWatchedContext(browser: Browser, guard: ConsoleGuard, label: string): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: test.info().project.use.viewport ?? undefined });
  guard.watch(context, label);
  return context;
}

/** Test-only: move a crew invitation's expiry into the past (there's no way to wait days in a test). */
export async function expireCrewInvite(crewId: string, creatorId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/crew_members?crew_id=eq.${crewId}&creator_id=eq.${creatorId}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ expires_at: new Date(Date.now() - 60_000).toISOString() }),
  });
  if (!res.ok) throw new Error(`expireCrewInvite failed: ${res.status} ${await res.text()}`);
}

/**
 * Test-only: stored slide visuals for a Creation, as the image pipeline would leave them (e2e has no image model).
 * Returns the generation id; the images are small real PNGs in the creator's storage.
 */
export async function seedSlideVisuals(userId: string, artifactId: string, count = 3, size = 64): Promise<string> {
  const h = { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}`, "content-type": "application/json", prefer: "return=representation" };
  const rest = async <T>(table: string, body: unknown, query = ""): Promise<T> => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { method: body === undefined ? "GET" : "POST", headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw new Error(`seedSlideVisuals ${table}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  const [creator] = await rest<Array<{ id: string }>>("creators", undefined, `?user_id=eq.${userId}&select=id`);
  const creatorId = creator!.id;
  const [gen] = await rest<Array<{ id: string }>>("image_generations", {
    creator_id: creatorId,
    artifact_id: artifactId,
    purpose: "carousel",
    aspect_ratio: "4:5",
    quality_intent: "preview",
    context_hash: createHash("sha256").update(uid()).digest("hex"),
    provider: "test",
    model: "test",
    prompt_version: "test",
    routing_version: "test",
    status: "complete",
    requested_count: count,
  });
  for (let i = 0; i < count; i++) {
    const path = `${creatorId}/generated/${gen!.id}/${i}-master.png`;
    const bytes = pngBytes(size);
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/creator-media/${path}`, { method: "POST", headers: { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}`, "content-type": "image/png" }, body: new Blob([new Uint8Array(bytes)]) });
    if (!up.ok) throw new Error(`seedSlideVisuals upload: ${up.status} ${await up.text()}`);
    const [obj] = await rest<Array<{ id: string }>>("storage_objects", { creator_id: creatorId, bucket: "creator-media", path, mime_type: "image/png", size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), original_filename: `${i}.png`, security_status: "clean" });
    await rest("image_generation_assets", { generation_id: gen!.id, creator_id: creatorId, storage_object_id: obj!.id, sequence: i, direction_label: ["Quiet", "Bold", "Warm", "Night"][i % 4], width: size, height: size });
  }
  return gen!.id;
}

/**
 * Test-only: a Carousel with slides, as the Composer leaves it after its first set is ready (e2e has no image model).
 * One seeded image per slide text, in order.
 */
export async function seedCarousel(userId: string, artifactId: string, texts: string[]): Promise<string[]> {
  const genId = await seedSlideVisuals(userId, artifactId, texts.length, 400);
  const h = { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}`, "content-type": "application/json", prefer: "return=representation" };
  const get = async <T>(q: string) => (await (await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h })).json()) as T;
  const post = async <T>(table: string, body: unknown): Promise<T> => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`seedCarousel ${table}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  const [creator] = await get<Array<{ id: string }>>(`creators?user_id=eq.${userId}&select=id`);
  const assets = await get<Array<{ id: string; sequence: number }>>(`image_generation_assets?generation_id=eq.${genId}&select=id,sequence&order=sequence`);
  await post("carousels", { artifact_id: artifactId, creator_id: creator!.id, requested_count: texts.length, aspect_ratio: "4:5", visual_style: "auto", generation_id: genId, seeded_at: new Date().toISOString() });
  const slides = await post<Array<{ id: string; order_index: number }>>(
    "carousel_slides",
    texts.map((t, i) => ({ artifact_id: artifactId, creator_id: creator!.id, order_index: i, asset_id: assets[i]!.id, source_text: t, display_text: t })),
  );
  return slides.sort((a, b) => a.order_index - b.order_index).map((s) => s.id);
}

/** Test setup only: patch rows with the service key (e.g. to make a visit or a Moment look older than it is). */
export async function adminPatch(table: string, query: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`adminPatch ${table}: ${res.status} ${await res.text()}`);
}

/** Test setup only: the creator row id for an auth user. */
export async function creatorIdOf(userId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/creators?user_id=eq.${userId}&select=id`, { headers: { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}` } });
  const [row] = (await res.json()) as Array<{ id: string }>;
  if (!row) throw new Error("creatorIdOf: no creator");
  return row.id;
}

/** Test setup only: insert rows with the service key (pipeline-written data such as tags or a stored summary). */
export async function adminInsert(table: string, rows: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_SECRET, authorization: `Bearer ${SUPABASE_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`adminInsert ${table}: ${res.status} ${await res.text()}`);
}
