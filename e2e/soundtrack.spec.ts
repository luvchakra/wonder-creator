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

    const mini = page.getByRole("region", { name: "CreativeRadio" });
    await expect(mini).toContainText(title);
    await expect(mini.getByRole("button", { name: `Pause ${title}` })).toBeVisible();

    // Navigation doesn't stop it; the Palette now says what's playing.
    await page.goto("/space?tab=ideas");
    await expect(mini).toContainText(title);
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await expect(page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: new RegExp(`Focus · ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toBeVisible();
    await page.keyboard.press("Escape");

    // Favourites persist on the server.
    await mini.getByRole("button", { name: "Up next" }).click();
    await expect(panel.getByRole("tab", { name: /Up next/ })).toHaveAttribute("aria-selected", "true");
    await panel.getByRole("tab", { name: /Songs for/ }).click();
    await panel.getByRole("button", { name: `Favourite ${title}` }).first().click();
    await expect.poll(async () => ((await (await page.request.get("/api/v1/soundtrack")).json()) as { favorites: string[] }).favorites.length).toBe(1);
  });
});
