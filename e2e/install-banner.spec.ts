import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { devices, type Browser, type BrowserContextOptions } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

// Install banner (docs/install-banner.md): phones and tablets only, only when the browser can install the app and it
// isn't installed. Chromium's `beforeinstallprompt` is synthetic here (a stubbed prompt that records the call), fired
// as the document finishes parsing — before the app has hydrated — the way Chrome can fire it on a fast page.

type Choice = "accepted" | "dismissed";

const { defaultBrowserType: _p, ...PIXEL } = devices["Pixel 7"];
const { defaultBrowserType: _i, ...IPHONE } = devices["iPhone 15"];

/**
 * Runs in the page before its own scripts: fires a synthetic beforeinstallprompt as the document finishes parsing
 * (before hydration) or at load. Its prompt() counts calls on `window.__prompted` and answers `choice`.
 */
function fireInstallPrompt({ choice, when }: { choice: Choice; when: "interactive" | "load" }) {
  const fire = () => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: Choice }> };
    const w = window as unknown as { __prompted?: number };
    e.prompt = async () => {
      w.__prompted = (w.__prompted ?? 0) + 1;
    };
    e.userChoice = Promise.resolve({ outcome: choice });
    window.dispatchEvent(e);
  };
  if (when === "load") window.addEventListener("load", fire);
  else document.addEventListener("readystatechange", () => document.readyState === "interactive" && fire());
}

async function visitor(browser: Browser, device: BrowserContextOptions, label: string, watch: (ctx: Awaited<ReturnType<Browser["newContext"]>>, label: string) => void) {
  const context = await browser.newContext({ ...device, baseURL: test.info().project.use.baseURL });
  watch(context, label);
  return { context, page: await context.newPage() };
}

const banner = (page: Page) => page.getByRole("region", { name: "Install Wonder Creator" });
const stored = (page: Page) => page.evaluate(() => localStorage.getItem("wc.install-banner"));

async function seriousViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: axeSource });
  const violations = (await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: Array<{ target: string[] }> }> }> } }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations;
  })) as Array<{ id: string; impact: string | null; nodes: Array<{ target: string[] }> }>;
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

const shots = process.env.INSTALL_SHOTS;

test.describe("Install banner", () => {
  test("a Chromium phone gets one-tap install above the top bar; Install opens the browser's prompt and the banner goes for good", async ({ browser, consoleGuard }) => {
    const { context, page } = await visitor(browser, PIXEL, "phone", (c, l) => consoleGuard.watch(c, l));
    await context.addInitScript(fireInstallPrompt, { choice: "accepted" as Choice, when: "interactive" as const });
    await page.goto("/");
    const region = banner(page);
    await expect(region).toBeVisible();
    await expect(region.getByText("Wonder Creator", { exact: true })).toBeVisible();
    await expect(region.getByRole("button", { name: "Install" })).toBeVisible();
    // At the very top, in the flow: the page's own header starts below it.
    const box = (await region.boundingBox())!;
    expect(box.y).toBe(0);
    const header = (await page.locator("header").first().boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    // A 44px close target, and nothing took focus.
    const close = region.getByRole("button", { name: "Not now" });
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    expect(closeBox.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement === null)).toBe(true);
    // No sideways scroll on a phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PIXEL.viewport!.width);
    if (shots) {
      await page.screenshot({ path: `${shots}/install-banner-android.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${shots}/install-banner-android-390.png` });
    }

    // Accessible with the banner showing.
    expect(await seriousViolations(page)).toEqual([]);

    await region.getByRole("button", { name: "Install" }).click();
    await expect(region).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __prompted?: number }).__prompted)).toBe(1);
    expect(JSON.parse((await stored(page))!)).toEqual({ installed: true });

    // Installed: never again on this browser, even when the browser offers again.
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(500);
    await expect(banner(page)).toHaveCount(0);
    await context.close();
  });

  test("declining the browser's dialog or choosing Not now snoozes it for 14 days", async ({ browser, consoleGuard }) => {
    for (const how of ["declined", "not now"] as const) {
      const { context, page } = await visitor(browser, PIXEL, `phone-${how}`, (c, l) => consoleGuard.watch(c, l));
      await context.addInitScript(fireInstallPrompt, { choice: "dismissed" as Choice, when: "load" as const });
      await page.goto("/help");
      await expect(banner(page)).toBeVisible();
      const before = Date.now();
      await banner(page).getByRole("button", { name: how === "declined" ? "Install" : "Not now" }).click();
      await expect(banner(page)).toHaveCount(0);
      const memory = JSON.parse((await stored(page))!) as { snoozedUntil: number };
      const days = (memory.snoozedUntil - before) / 86_400_000;
      expect(days).toBeGreaterThan(13.9);
      expect(days).toBeLessThan(14.1);
      await page.reload();
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
      await expect(banner(page)).toHaveCount(0);
      await context.close();
    }
  });

  test("stays away when the browser says the app is already installed on this device", async ({ browser, consoleGuard }) => {
    const { context, page } = await visitor(browser, PIXEL, "phone-installed", (c, l) => consoleGuard.watch(c, l));
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "getInstalledRelatedApps", { configurable: true, value: async () => [{ platform: "webapp", url: `${location.origin}/manifest.webmanifest` }] });
    });
    await context.addInitScript(fireInstallPrompt, { choice: "accepted" as Choice, when: "load" as const });
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(banner(page)).toHaveCount(0);
    await context.close();
  });

  test("iPhone Safari gets the two-tap Add to Home Screen steps, and 'I've added it' is remembered", async ({ browser, consoleGuard }) => {
    const { context, page } = await visitor(browser, IPHONE, "iphone", (c, l) => consoleGuard.watch(c, l));
    await page.goto("/help");
    const region = banner(page);
    await expect(region).toBeVisible();
    const howTo = region.getByRole("button", { name: "How to" });
    await expect(howTo).toHaveAttribute("aria-expanded", "false");
    await expect(region.getByText("Add to Home Screen")).toBeHidden();
    await howTo.click();
    await expect(howTo).toHaveAttribute("aria-expanded", "true");
    await expect(region.getByRole("listitem")).toHaveCount(2);
    await expect(region.getByText("Add to Home Screen")).toBeVisible();
    await expect(region.getByRole("img", { name: /square with an arrow/ })).toBeVisible();
    if (shots) {
      await page.screenshot({ path: `${shots}/install-banner-ios.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${shots}/install-banner-ios-390.png` });
    }
    expect(await seriousViolations(page)).toEqual([]);

    await region.getByRole("button", { name: "I’ve added it" }).click();
    await expect(region).toHaveCount(0);
    expect(JSON.parse((await stored(page))!)).toEqual({ installed: true });
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(500);
    await expect(banner(page)).toHaveCount(0);
    await context.close();
  });

  test("desktop never shows it, even when the browser offers to install", async ({ browser, consoleGuard }) => {
    const { context, page } = await visitor(browser, { viewport: { width: 1280, height: 900 } }, "desktop", (c, l) => consoleGuard.watch(c, l));
    await context.addInitScript(fireInstallPrompt, { choice: "accepted" as Choice, when: "load" as const });
    for (const path of ["/", "/help"]) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(800);
      await expect(banner(page)).toHaveCount(0);
    }
    await context.close();
  });
});
