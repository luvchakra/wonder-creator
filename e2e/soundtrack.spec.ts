import { expect, test } from "./fixtures";

test.describe("CreativeRadio", () => {
  test.beforeEach(async ({ page, creator }) => {
    void creator;
    // No real audio in tests: play() resolves and nothing is fetched (the licensed files are exercised in the DB suite).
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () {
        this.dispatchEvent(new Event("pause"));
      };
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        configurable: true,
        get() {
          return (this as HTMLMediaElement).dataset.fakeSrc ?? "";
        },
        set(v: string) {
          (this as HTMLMediaElement).dataset.fakeSrc = v;
        },
      });
    });
  });

  test("set the mood from the Palette, play, and keep playing across pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: /Set the mood/ }).click();

    const panel = page.getByRole("dialog", { name: "CreativeRadio" });
    await expect(panel.getByRole("radiogroup", { name: "Mood" }).getByRole("radio", { name: /Calm/ })).toHaveAttribute("aria-checked", "true");
    const calm = panel.getByRole("list", { name: "Songs for Calm" });
    await expect(calm.getByRole("listitem").first()).toBeVisible();

    await panel.getByRole("radio", { name: /Focus/ }).click();
    const focus = panel.getByRole("list", { name: "Songs for Focus" });
    const first = focus.getByRole("button", { name: /^Play / }).first();
    const title = ((await first.getAttribute("aria-label")) ?? "").replace(/^Play /, "");
    await first.click();

    // Song details carry the license and credit.
    await focus.getByRole("button", { name: `More for ${title}` }).click();
    await page.getByRole("menuitem", { name: "Song details" }).click();
    await expect(panel.getByRole("region", { name: "Song details" })).toContainText(/CC BY 4\.0|CC0/);
    await page.keyboard.press("Escape");

    // The mini player docks right-middle as a slim tab (awareness + expand); it opens leftward from there.
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // (A full page load restores the track paused — browsers need a tap before sound — so the tab may say either.)
    const tab = page.getByRole("button", { name: new RegExp(`^Open audio player — (playing|paused): ${esc}$`) });
    const mini = page.getByRole("region", { name: "CreativeRadio" });
    await expect(page.getByRole("button", { name: `Open audio player — playing: ${title}` })).toBeVisible();
    await expect(mini).toHaveCount(0);
    const box = (await tab.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(vp.height * 0.1); // vertically centred
    expect(vp.width - (box.x + box.width)).toBeLessThanOrEqual(1); // tucked into the right edge
    await tab.click();
    await expect(mini).toContainText(title);
    await expect(mini.getByRole("button", { name: `Pause ${title}` })).toBeVisible();

    // Navigation doesn't stop it or change its state; the Palette says what's playing.
    await page.goto("/space?tab=ideas");
    await expect(mini).toContainText(title);
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await expect(page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: new RegExp(`Focus · ${esc}`) })).toBeVisible();
    await page.keyboard.press("Escape");

    // Up next lives under More; favourites persist on the server.
    await mini.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Up next" }).click();
    await expect(panel.getByRole("tab", { name: /Up next/ })).toHaveAttribute("aria-selected", "true");
    await panel.getByRole("tab", { name: /Songs for/ }).click();
    await panel.getByRole("button", { name: `Favourite ${title}` }).first().click();
    await expect.poll(async () => ((await (await page.request.get("/api/v1/soundtrack")).json()) as { favorites: string[] }).favorites.length).toBe(1);
    await page.keyboard.press("Escape");

    // Collapsing tucks it back into the tab and never stops the music; Escape collapses too; the state is remembered.
    await mini.getByRole("button", { name: "Collapse player" }).click();
    await expect(mini).toHaveCount(0);
    await expect(tab).toBeVisible();
    await tab.click();
    await mini.focus();
    await page.keyboard.press("Escape");
    await expect(tab).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /^Open audio player — paused: / })).toBeVisible();
    await expect(mini).toHaveCount(0);
  });

  test("the open player never covers the page's primary action, and keeps clear of the Palette", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: /Set the mood/ }).click();
    await page.getByRole("dialog", { name: "CreativeRadio" }).getByRole("button", { name: /^Play / }).first().click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Open audio player/ }).click();
    const mini = page.getByRole("region", { name: "CreativeRadio" });
    await expect(mini).toBeVisible();
    await page.waitForTimeout(400); // placement settles on the next frame
    const p = (await mini.boundingBox())!;
    const cta = (await page.getByRole("link", { name: "New Creation" }).boundingBox())!;
    const overlaps = p.x < cta.x + cta.width && p.x + p.width > cta.x && p.y < cta.y + cta.height && p.y + p.height > cta.y;
    expect(overlaps).toBe(false);
    const palette = (await page.getByRole("button", { name: "Open Creative Palette" }).boundingBox())!;
    expect(palette.y - (p.y + p.height)).toBeGreaterThanOrEqual(72);
  });
});
