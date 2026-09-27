import { expect, saveNote, test, uid, type Page } from "./fixtures";

async function expectNoHorizontalOverflow(page: Page) {
  const m = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(m.scrollWidth, `page is ${m.scrollWidth}px wide in a ${m.innerWidth}px viewport`).toBeLessThanOrEqual(m.innerWidth);
}

async function expectBottomNav(page: Page) {
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toHaveCount(1); // the desktop top nav is hidden at this width
  await expect(nav).toBeVisible();
  for (const label of ["Home", "Create", "Huddles", "Library", "Profile"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
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
      ["/settings/ai", (p) => expect(p.getByRole("region", { name: "Status" })).toBeVisible()],
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
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/space$/);
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
  });

  test("critical P0.1 flows fit 320–480 px and landscape, with sheets in reach", async ({ page }) => {
    test.setTimeout(300_000);
    // Data for every flow: a piece with content, a note, a proposal waiting for approval, a live Huddle.
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Pocket tide ${uid()}` } });
    const art = (await res.json()).artifact as { id: string; current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "The tide keeps its own counsel.", baseVersionId: art.current_version_id, label: "Written" } });
    const material = `/space/materials/${await saveNote(page, `Pocket note ${uid()}`)}`;
    await page.request.patch("/api/v1/creators/autonomy", { data: { domain: "creative_generation", level: "execute_with_approval" } });
    const turn = await (await page.request.post("/api/v1/conversations/turn", { data: { message: "Write a poem about the pier at night." } })).text();
    const conversation = /"conversationId":"([0-9a-f-]{36})"/.exec(turn)?.[1];
    await page.goto("/approvals");
    await page.getByRole("link", { name: /Create a new piece/ }).first().click();
    await page.waitForURL(/\/approvals\/[0-9a-f-]{36}$/);
    const approval = new URL(page.url()).pathname;
    await page.request.patch("/api/v1/creators/autonomy", { data: { reset: true } });

    const routes: Array<[string, (p: Page) => Promise<unknown>]> = [
      ["/", (p) => expect(p.getByLabel("What are you thinking about?")).toBeVisible()],
      [`/create?c=${conversation}`, (p) => expect(p.getByRole("region", { name: "CreatorTalk" })).toBeVisible()],
      [material, (p) => expect(p.getByRole("tab", { name: "Links" })).toBeVisible()],
      ["/space?tab=collections", (p) => expect(p.getByRole("button", { name: "New collection" })).toBeVisible()],
      [`/artifacts/${art.id}`, (p) => expect(p.getByRole("button", { name: "Download" })).toBeVisible()],
      [`/artifacts/${art.id}/studio`, (p) => expect(p.getByRole("region", { name: "Editor" })).toBeVisible()],
      [`/artifacts/${art.id}/share`, (p) => expect(p.getByRole("heading", { name: "Private link" })).toBeVisible()],
      [`/artifacts/${art.id}/publish`, (p) => expect(p.getByRole("button", { name: "Next" })).toBeVisible()],
      ["/approvals", (p) => expect(p.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible()],
      [approval, (p) => expect(p.getByRole("button", { name: "Approve once" })).toBeInViewport()],
      ["/huddles", (p) => expect(p.getByRole("button", { name: "Start a Huddle" })).toBeVisible()],
      ["/scrapbook", (p) => expect(p.getByRole("form", { name: "Share to your Scrapbook" })).toBeVisible()],
      ["/settings/ai", (p) => expect(p.getByRole("region", { name: "Status" })).toBeVisible()],
      ["/settings/audit", (p) => expect(p.getByRole("list", { name: "Summary" })).toBeVisible()],
      ["/search?q=pocket", (p) => expect(p.getByRole("navigation", { name: "Search in" })).toBeVisible()],
    ];
    for (const width of [320, 375, 390, 430, 480]) {
      await page.setViewportSize({ width, height: 800 });
      for (const [path, ready] of routes) {
        await test.step(`${width}px ${path}`, async () => {
          await page.goto(path);
          await ready(page);
          await expectNoHorizontalOverflow(page);
          await expectBottomNav(page);
        });
      }
    }

    // Sheets stay on screen at the narrowest width: collection picker, notifications, Huddle start.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/huddles");
    await page.getByRole("button", { name: "Start a Huddle" }).click();
    const sheet = page.getByRole("dialog", { name: "Start a Huddle" });
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    await expect(sheet.getByRole("button", { name: /^Go live as / })).toBeVisible();
    await sheet.getByRole("button", { name: /^Go live as / }).scrollIntoViewIfNeeded();
    await sheet.getByRole("button", { name: /^Go live as / }).click();
    await page.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Notifications" }).click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    const pbox = (await panel.boundingBox())!;
    expect(pbox.x).toBeGreaterThanOrEqual(0);
    expect(pbox.x + pbox.width).toBeLessThanOrEqual(320);
    await page.keyboard.press("Escape");

    // Landscape phone: the live room and CreatorTalk still fit.
    await page.setViewportSize({ width: 740, height: 360 });
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Leave" }).click();
    await page.waitForURL(/\/summary$/);
    await expectNoHorizontalOverflow(page);
    await page.goto(`/create?c=${conversation}`);
    await expect(page.getByRole("region", { name: "CreatorTalk" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
