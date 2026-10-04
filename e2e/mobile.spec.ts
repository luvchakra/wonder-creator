import { expect, saveNote, test, uid, type Page } from "./fixtures";

async function expectNoHorizontalOverflow(page: Page) {
  const m = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(m.scrollWidth, `page is ${m.scrollWidth}px wide in a ${m.innerWidth}px viewport`).toBeLessThanOrEqual(m.innerWidth);
}

/** No bottom navigation: the corner Creative Palette is in thumb reach (UI redesign §6–7). */
async function expectPalette(page: Page) {
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Open Creative Palette" });
  await expect(trigger).toBeVisible();
  const box = (await trigger.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(vp.width - (box.x + box.width)).toBeLessThanOrEqual(24);
  expect(vp.height - (box.y + box.height)).toBeLessThanOrEqual(24);
}

test.describe("mobile layout @mobile", () => {
  test.beforeEach(({ creator }) => void creator);

  test("core screens fit a 360px viewport and keep the Creative Palette in reach", async ({ page }) => {
    // Something to open in the Studio.
    await page.goto("/materials");
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Start a new Creation" });
    await dialog.getByLabel("Title").fill("Pocket poem");
    await dialog.getByRole("button", { name: "Open Creative Studio" }).click();
    await page.waitForURL(/\/creations\/[0-9a-f-]{36}\/(?:studio|write)$/);
    const studio = new URL(page.url()).pathname;
    const material = `/materials/${await saveNote(page, `Pocket note ${uid()}`)}`;

    const screens: Array<[string, (p: Page) => Promise<void>]> = [
      ["/", (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible()],
      ["/create", (p) => expect(p.getByRole("region", { name: "meTalk" })).toBeVisible()],
      ["/materials", (p) => expect(p.getByRole("heading", { name: "My Creative Space" })).toBeVisible()],
      ["/explore?q=pocket", (p) => expect(p.getByRole("navigation", { name: "Search in" })).toBeVisible()],
      ["/materials?tab=collections", (p) => expect(p.getByRole("button", { name: "New collection" })).toBeVisible()],
      [material, (p) => expect(p.getByRole("tab", { name: "Links" })).toBeVisible()],
      [studio, (p) => expect(p.getByRole("region", { name: "Editor" })).toBeVisible()],
      ["/huddles", (p) => expect(p.getByRole("heading", { name: "Live Huddles" })).toBeVisible()],
      ["/approvals", (p) => expect(p.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible()],
      ["/shared", (p) => expect(p.getByRole("heading", { name: "Shared with you", level: 1 })).toBeVisible()],
      ["/settings/audit", (p) => expect(p.getByRole("list", { name: "Summary" })).toBeVisible()],
      ["/scrapbook", (p) => expect(p.getByRole("form", { name: "Share to your Scrapbook" })).toBeVisible()],
      ["/settings/ai", (p) => expect(p.getByRole("region", { name: "Status" })).toBeVisible()],
      [`${studio.replace(/\/(?:studio|write)$/, "")}/share`, (p) => expect(p.getByRole("heading", { name: "Private link" })).toBeVisible()],
      [`${studio.replace(/\/(?:studio|write)$/, "")}/publish`, (p) => expect(p.getByRole("heading", { name: "Publish", level: 1 })).toBeVisible()],
      ["/settings", (p) => expect(p.getByRole("heading", { name: "Account & Profile" })).toBeVisible()],
    ];
    for (const [path, ready] of screens) {
      await test.step(path, async () => {
        await page.goto(path);
        await ready(page);
        await expectNoHorizontalOverflow(page);
        await expectPalette(page);
      });
    }

    // The Palette navigates: it opens over the Canvas, focuses its first leaf, and closes on Escape or selection.
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole("button", { name: "Home", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await palette.getByRole("button", { name: /Go to…/ }).click();
    await palette.getByRole("button", { name: "Materials" }).click();
    await expect(page).toHaveURL(/\/materials\?tab=ideas$/);
    // Inside Materials the Palette is contextual; the destinations are one step away under Go to….
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await palette.getByRole("button", { name: /Go to…/ }).click();
    await expect(palette.getByRole("button", { name: "Materials" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
  });

  test("critical P0.1 flows fit 320–480 px and landscape, with sheets in reach", async ({ page }) => {
    test.setTimeout(300_000);
    // Data for every flow: a piece with content, a note, a proposal waiting for approval, a live Huddle.
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Pocket tide ${uid()}` } });
    const art = (await res.json()).artifact as { id: string; current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "The tide keeps its own counsel.", baseVersionId: art.current_version_id, label: "Written" } });
    const material = `/materials/${await saveNote(page, `Pocket note ${uid()}`)}`;
    await page.request.patch("/api/v1/creators/autonomy", { data: { domain: "creative_generation", level: "execute_with_approval" } });
    const turn = await (await page.request.post("/api/v1/conversations/turn", { data: { message: "Write a poem about the pier at night." } })).text();
    const conversation = /"conversationId":"([0-9a-f-]{36})"/.exec(turn)?.[1];
    await page.goto("/approvals");
    await page.getByRole("link", { name: /Create a new Creation/ }).first().click();
    await page.waitForURL(/\/approvals\/[0-9a-f-]{36}$/);
    const approval = new URL(page.url()).pathname;
    await page.request.patch("/api/v1/creators/autonomy", { data: { reset: true } });
    const project = `/rooms/${((await (await page.request.post("/api/v1/projects", { data: { title: `Pocket project ${uid()}`, brief: "A small film." } })).json()) as { project: { id: string } }).project.id}`;

    const crew = `/crews/${((await (await page.request.post(`/api/v1/projects/${project.split("/").pop()}/crew`, { data: {} })).json()) as { crew: { id: string } }).crew.id}`;
    const routes: Array<[string, (p: Page) => Promise<unknown>]> = [
      ["/", (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible()],
      [`/create?c=${conversation}`, (p) => expect(p.getByRole("region", { name: "meTalk" })).toBeVisible()],
      [material, (p) => expect(p.getByRole("tab", { name: "Links" })).toBeVisible()],
      ["/materials?tab=collections", (p) => expect(p.getByRole("button", { name: "New collection" })).toBeVisible()],
      [`/creations/${art.id}`, (p) => expect(p.getByRole("button", { name: "Download" })).toBeVisible()],
      [`/creations/${art.id}/context?tab=people`, (p) => expect(p.getByRole("region", { name: "People" })).toBeVisible()],
      [`/creations/${art.id}/transform`, (p) => expect(p.getByRole("heading", { name: "Transform", level: 1 })).toBeVisible()],
      [`/creations/${art.id}/studio`, (p) => expect(p.getByRole("region", { name: "Editor" })).toBeVisible()],
      [`/creations/${art.id}/share`, (p) => expect(p.getByRole("heading", { name: "Private link" })).toBeVisible()],
      [`/creations/${art.id}/publish`, (p) => expect(p.getByRole("button", { name: "Next" })).toBeVisible()],
      [`/creations/${art.id}/collaborate`, (p) => expect(p.getByRole("button", { name: "Add a collaborator" })).toBeVisible()],
      ["/approvals", (p) => expect(p.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible()],
      [approval, (p) => expect(p.getByRole("button", { name: "Approve once" })).toBeInViewport()],
      ["/huddles", (p) => expect(p.getByRole("button", { name: "Start a Huddle" })).toBeVisible()],
      ["/scrapbook", (p) => expect(p.getByRole("form", { name: "Share to your Scrapbook" })).toBeVisible()],
      ["/rooms", (p) => expect(p.getByRole("button", { name: "New Creative Room" }).first()).toBeVisible()],
      [project, (p) => expect(p.getByRole("link", { name: "Create in this Creative Room" })).toBeVisible()],
      [crew, (p) => expect(p.getByRole("region", { name: "People" })).toBeVisible()],
      [`${project}?tab=work`, (p) => expect(p.getByRole("region", { name: "Shared by the crew" })).toBeVisible()],
      [`${project}?tab=chat`, (p) => expect(p.getByLabel("Message the crew")).toBeVisible()],
      [`${project}?tab=tasks`, (p) => expect(p.getByRole("button", { name: "New task" })).toBeVisible()],
      [`${project}?tab=contributions`, (p) => expect(p.getByRole("region", { name: "Summary" })).toBeVisible()],
      [`${project}?tab=rights`, (p) => expect(p.getByRole("region", { name: "Creative Room policy" })).toBeVisible()],
      [`${project}/complete`, (p) => expect(p.getByRole("region", { name: "Unresolved tasks" })).toBeVisible()],
      ["/people?terms=writing", (p) => expect(p.getByRole("region", { name: "People" })).toBeVisible()],
      ["/publishing", (p) => expect(p.getByRole("region", { name: "Queue" })).toBeVisible()],
      ["/settings/ai", (p) => expect(p.getByRole("region", { name: "Status" })).toBeVisible()],
      ["/settings/audit", (p) => expect(p.getByRole("list", { name: "Summary" })).toBeVisible()],
      ["/explore?q=pocket", (p) => expect(p.getByRole("navigation", { name: "Search in" })).toBeVisible()],
    ];
    for (const width of [320, 375, 390, 430, 480]) {
      await page.setViewportSize({ width, height: 800 });
      for (const [path, ready] of routes) {
        await test.step(`${width}px ${path}`, async () => {
          await page.goto(path);
          await ready(page);
          await expectNoHorizontalOverflow(page);
          await expectPalette(page);
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
    await expect(page.getByRole("region", { name: "meTalk" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
