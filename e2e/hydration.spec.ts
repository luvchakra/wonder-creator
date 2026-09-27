import { expect, poemFromNote, test, type Page } from "./fixtures";

/**
 * Server-rendered client components must hydrate cleanly even when the device clock is a few
 * minutes off the server's (very common on phones and laptops). Time-relative text such as
 * "just now" / "5 min ago" or a live Huddle timer must not be rendered differently on the
 * server and on the client. The console guard fails the test on any hydration error.
 */
const SKEW_MS = 7 * 60_000;

async function skewClock(page: Page) {
  await page.clock.install({ time: new Date(Date.now() + SKEW_MS) });
}

test.describe("hydration with a skewed device clock", () => {
  test.beforeEach(({ creator }) => void creator);

  test("inbox, material, meTalk, artifact and memory pages hydrate without mismatches", async ({ page }) => {
    const { materialId, artifactId } = await poemFromNote(page);
    await expect(page).toHaveURL(/\/create\?c=/);
    const conversation = new URL(page.url()).pathname + new URL(page.url()).search;
    expect(conversation).toMatch(/^\/create\?c=/);
    await skewClock(page);
    for (const path of ["/send", `/space/materials/${materialId}`, conversation, `/artifacts/${artifactId}`, "/memory"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      // Give React time to hydrate and report.
      await page.clock.runFor(2_000);
      await page.waitForLoadState("networkidle");
    }
    const skewed = await page.evaluate(() => Date.now());
    expect(skewed - Date.now()).toBeGreaterThan(SKEW_MS - 60_000);
  });

  test("a live Huddle room hydrates without mismatches", async ({ page }) => {
    await page.goto("/huddles");
    await page.getByRole("button", { name: "Start a Huddle" }).click();
    await page.getByRole("dialog", { name: "Start a Huddle" }).getByRole("button", { name: /^Go live as / }).click();
    await page.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);
    const url = page.url();
    await skewClock(page);
    await page.goto(url);
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
    await page.clock.runFor(2_000);
    await page.getByRole("button", { name: "Leave" }).click();
    await page.waitForURL(/\/huddles\/[0-9a-f-]{36}\/summary$/);
  });
});
