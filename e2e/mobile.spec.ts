import { expect, saveNote, test, uid, type Page } from "./fixtures";

async function expectNoHorizontalOverflow(page: Page) {
  const m = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(m.scrollWidth, `page is ${m.scrollWidth}px wide in a ${m.innerWidth}px viewport`).toBeLessThanOrEqual(m.innerWidth);
}

async function expectBottomNav(page: Page) {
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toHaveCount(1); // the desktop top nav is hidden at this width
  await expect(nav).toBeVisible();
  for (const label of ["Home", "Create", "Space", "Huddles", "Profile"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
  const box = await nav.boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box && box.y + box.height).toBeCloseTo(vh, 0);
}

test.describe("mobile layout @mobile", () => {
  test.beforeEach(({ creator }) => void creator);

  test("core screens fit a 360px viewport and show the bottom navigation", async ({ page }) => {
    // Something to open in the Studio.
    await page.goto("/space");
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Start a new piece" });
    await dialog.getByLabel("Title").fill("Pocket poem");
    await dialog.getByRole("button", { name: "Open Studio" }).click();
    await page.waitForURL(/\/artifacts\/[0-9a-f-]{36}\/studio$/);
    const studio = new URL(page.url()).pathname;
    const material = `/space/materials/${await saveNote(page, `Pocket note ${uid()}`)}`;

    const screens: Array<[string, (p: Page) => Promise<void>]> = [
      ["/", (p) => expect(p.getByLabel("What are you thinking about?")).toBeVisible()],
      ["/create", (p) => expect(p.getByRole("region", { name: "CreatorTalk" })).toBeVisible()],
      ["/space", (p) => expect(p.getByRole("heading", { name: "My Creative Space" })).toBeVisible()],
      ["/search?q=pocket", (p) => expect(p.getByRole("navigation", { name: "Search in" })).toBeVisible()],
      ["/space?tab=collections", (p) => expect(p.getByRole("button", { name: "New collection" })).toBeVisible()],
      [material, (p) => expect(p.getByRole("tab", { name: "Links" })).toBeVisible()],
      [studio, (p) => expect(p.getByRole("region", { name: "Editor" })).toBeVisible()],
      ["/huddles", (p) => expect(p.getByRole("heading", { name: "Live Huddles" })).toBeVisible()],
      ["/approvals", (p) => expect(p.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible()],
      ["/shared", (p) => expect(p.getByRole("heading", { name: "Shared with you", level: 1 })).toBeVisible()],
      ["/settings/audit", (p) => expect(p.getByRole("list", { name: "Summary" })).toBeVisible()],
      ["/scrapbook", (p) => expect(p.getByRole("form", { name: "Share to your Scrapbook" })).toBeVisible()],
      [`${studio.replace(/\/studio$/, "")}/share`, (p) => expect(p.getByRole("heading", { name: "Private link" })).toBeVisible()],
      [`${studio.replace(/\/studio$/, "")}/publish`, (p) => expect(p.getByRole("heading", { name: "Publish", level: 1 })).toBeVisible()],
      ["/settings", (p) => expect(p.getByRole("heading", { name: "Account & Profile" })).toBeVisible()],
    ];
    for (const [path, ready] of screens) {
      await test.step(path, async () => {
        await page.goto(path);
        await ready(page);
        await expectNoHorizontalOverflow(page);
        await expectBottomNav(page);
      });
    }

    // The bottom nav navigates.
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Space" }).click();
    await expect(page).toHaveURL(/\/space$/);
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Space" })).toHaveAttribute("aria-current", "page");
  });
});
