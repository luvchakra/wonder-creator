import sharp from "sharp";
import { expect, newCreator, test, type Page } from "./fixtures";

// Photo album (docs/photo-album.md) and Messages in the top bar (owner, 2 Oct 2026).

/** A real JPEG with EXIF location, so the test can prove the stored copy drops it. */
async function photo(w: number, h: number, hue: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,78%)"/><stop offset="1" stop-color="hsl(${hue + 40},55%,45%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.12}" fill="hsl(${hue + 10},90%,92%)"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "15/1 29/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "73/1 49/1 0/1" } }).toBuffer();
}

const upload = async (p: Page, files: Array<{ name: string; buffer: Buffer }>) =>
  p.locator("#album-add").setInputFiles(files.map((f) => ({ name: f.name, mimeType: "image/jpeg", buffer: f.buffer })));

test.describe("Photo album", () => {
  test("add photos, caption and reorder them; others see the album; the stored copy has no location", async ({ page, creator, openContext }) => {
    await page.request.patch("/api/v1/creators/me", { data: { displayName: creator.name, handle: creator.handle, bio: "", location: "", showLocation: false, visibility: "public", collaborationAvailability: "open" } });

    // An empty album invites the owner from the Profile.
    await page.goto("/me");
    await page.getByRole("link", { name: /Start your album/ }).click();
    await expect(page).toHaveURL(new RegExp(`/creators/${creator.handle}/album$`));
    await expect(page.getByText("Your album is waiting")).toBeVisible();

    await upload(page, [
      { name: "harbour.jpg", buffer: await photo(1600, 1067, 20) },
      { name: "nets.jpg", buffer: await photo(1000, 1400, 200) },
      { name: "dusk.jpg", buffer: await photo(1400, 1400, 280) },
    ]);
    const album = page.getByRole("list", { name: /album/ });
    await expect(album.getByRole("listitem")).toHaveCount(3);

    // Caption one in the viewer, then move it earlier.
    await album.getByRole("button", { name: "View photo 2" }).click();
    const viewer = page.getByRole("dialog");
    await expect(viewer.getByText("2 / 3")).toBeVisible();
    await viewer.getByRole("button", { name: "Add a caption" }).click();
    await viewer.getByLabel("Caption").fill("Nets drying on the seawall");
    await viewer.getByRole("button", { name: "Save" }).click();
    await expect(viewer.getByText("Nets drying on the seawall")).toBeVisible();
    await viewer.getByRole("button", { name: "Earlier" }).click();
    await expect(viewer.getByText("1 / 3")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("list", { name: /album/ }).getByRole("listitem").first()).toContainText("Nets drying on the seawall");

    // The stored picture is resized WebP without location data.
    const src = await page.getByRole("list", { name: /album/ }).locator("img").first().getAttribute("src");
    const stored = await page.request.get(src!);
    expect(stored.ok()).toBe(true);
    const meta = await sharp(Buffer.from(await stored.body())).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();

    // Someone else sees it on the Profile and in the album, without owner controls.
    const { page: b } = await openContext("B");
    await newCreator(b);
    await b.goto(`/creators/${creator.handle}`);
    const preview = b.getByRole("region", { name: "Album" });
    await expect(preview.locator("img")).toHaveCount(3);
    await preview.getByRole("link", { name: "See all" }).click();
    await expect(b.getByRole("button", { name: "Add photos" })).toHaveCount(0);
    await b.getByRole("button", { name: /View “Nets drying on the seawall”/ }).click();
    await expect(b.getByRole("dialog").getByRole("button", { name: "Remove" })).toHaveCount(0);
    await b.keyboard.press("ArrowRight");
    await expect(b.getByRole("dialog").getByText("2 / 3")).toBeVisible();

    // The owner removes one; it's gone for everyone.
    await page.getByRole("list", { name: /album/ }).getByRole("button").first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog", { name: "Remove this photo from your album?" }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("list", { name: /album/ }).getByRole("listitem")).toHaveCount(2);
    await b.goto(`/creators/${creator.handle}/album`);
    await expect(b.getByText("Nets drying on the seawall")).toHaveCount(0);
  });

  test("a full-size phone photo goes in: it's made small enough to send before it leaves the phone", async ({ page, creator }) => {
    void creator;
    // A phone-sized photo (4000 × 3000, fine detail, ~7 MB): over what the host accepts in one request (~4.5 MB).
    const raw = Buffer.alloc(4000 * 3000 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
    const big = await sharp(raw, { raw: { width: 4000, height: 3000, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
    expect(big.length).toBeGreaterThan(5 * 1024 * 1024);
    const sent: number[] = [];
    page.on("request", (r) => r.url().endsWith("/api/v1/album") && r.method() === "POST" && sent.push(r.postDataBuffer()?.length ?? 0));
    await page.goto(`/creators/${creator.handle}/album`);
    await upload(page, [{ name: "1000164057.jpg", buffer: big }]);
    await expect(page.getByRole("list", { name: /album/ }).getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!).toBeLessThan(4 * 1024 * 1024);
  });

  test("files that aren't pictures are refused", async ({ page, creator }) => {
    void creator;
    const res = await page.request.post("/api/v1/album", { multipart: { file: { name: "notes.txt", mimeType: "image/jpeg", buffer: Buffer.from("not really a picture") } } });
    expect(res.status()).toBe(415);
  });

  test("Messages sits in the top bar and opens your conversations", async ({ page, creator }) => {
    void creator;
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: /^Messages/ }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(page.getByRole("banner").getByRole("link", { name: /^Messages/ })).toHaveAttribute("aria-current", "page");
    // A pressed top-bar icon shows it (owner, 3 Oct 2026): the accent disc while its page or panel is open.
    await expect(page.getByRole("banner").getByRole("link", { name: /^Messages/ })).toHaveClass(/bg-accent-soft/);
    // While the menu is open, Radix hides the rest of the page from assistive tech, so find the trigger by its label.
    const account = page.locator('button[aria-label="Your account"]');
    await expect(account).toHaveAttribute("data-state", "closed");
    await account.click();
    await expect(account).toHaveAttribute("data-state", "open");
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Messages reads like a conversation list: the list, a search field, and one way to start a new one.
    await expect(page.getByPlaceholder("Search conversations").or(page.getByText("No conversations yet"))).toBeVisible();
    await expect(page.getByRole("link", { name: "New message" })).toHaveAttribute("href", "/people");
  });
});
