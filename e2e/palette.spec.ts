import { expect, test, uid } from "./fixtures";

test.describe("Creative Palette", () => {
  test("follows the Creation's lifecycle, keeps three primary actions, and offers More… and Go to…", async ({ page, creator }) => {
    void creator;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Harbour ${uid()}` } })).json()).artifact as { id: string; current_version_id: string };
    const trigger = page.getByRole("button", { name: "Open Creative Palette" });
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    const creation = palette.getByRole("navigation", { name: "This Creation" });

    // An empty Creation is still an idea: gather material first.
    await page.goto(`/creations/${art.id}`);
    await trigger.click();
    await expect(creation.getByRole("button", { name: "Bring Material" })).toBeFocused();
    await expect(creation.getByRole("button")).toHaveCount(3);
    await page.keyboard.press("Escape");

    // With words on the page it's in progress: continue, bring, refine — the rest (People too) under More….
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "The harbour keeps its lights.", baseVersionId: art.current_version_id, label: "Written" } });
    await page.goto(`/creations/${art.id}`);
    await trigger.click();
    await expect(creation.getByRole("button")).toHaveText([/Continue Creating/, /Bring Material/, /Refine/]);
    await palette.getByRole("button", { name: "More…" }).click();
    await expect(palette.getByRole("button", { name: "Publish" })).toBeVisible();
    await palette.getByRole("button", { name: "Back" }).click();
    await palette.getByRole("button", { name: /Go to…/ }).click();
    const destinations = palette.getByRole("navigation", { name: "Destinations" });
    await expect(destinations.getByRole("button")).toHaveText(["Home", "Create", "Materials", "Explore", "Me"]);
    await palette.getByRole("button", { name: "Back" }).click();
    await palette.getByRole("button", { name: "More…" }).click();
    await palette.getByRole("button", { name: "Transform" }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/transform$`));

    // Leaving the Creation clears its actions.
    await page.goto("/huddles");
    await trigger.click();
    await expect(creation).toHaveCount(0);
    await expect(palette.getByRole("navigation", { name: "Huddles" })).toBeVisible();
  });

  test("Home shows the global destinations and Create shows every format", async ({ page, creator }) => {
    void creator;
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    await expect(palette.getByRole("navigation", { name: "Destinations" }).getByRole("button")).toHaveText(["Create", "Materials", "Explore", "Me"]);
    await palette.getByRole("button", { name: "Create" }).click();
    // Create shows every format at once (owner, 2 Oct 2026); a tap makes the Creation and opens its Studio.
    const sheet = page.getByRole("dialog", { name: "Make a new Creation" });
    // Every format, each with its own page (owner, 5 Oct 2026: Video and Presentation back); and making with others.
    await expect(sheet.getByRole("list", { name: "Formats" }).getByRole("button")).toHaveText([/Writing/, /Carousel/, /Images/, /Video/, /Audio/, /Presentation/]);
    await expect(sheet.getByRole("link", { name: /Collaborate with others/ })).toHaveAttribute("href", "/rooms?new=1");
    await expect(palette).toHaveCount(0);
    await sheet.getByRole("button", { name: /Carousel/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/(?:studio|write)$/);
    await expect(page.getByRole("link", { name: "Add words" })).toBeVisible();
    // The X closes the Palette, and it stays closed.
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("button", { name: "Close Creative Palette" }).click();
    await expect(palette).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(palette).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open Creative Palette" })).toBeVisible();
  });
  test("previews what a leaf does in one bubble, and the trigger stays in front of the page", async ({ page, creator }) => {
    void creator;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform ${uid()}` } })).json()).artifact as { id: string; current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "Every Sunday my father waited at Platform 3.", baseVersionId: art.current_version_id, label: "Written" } });
    await page.goto(`/creations/${art.id}/studio`);
    const trigger = page.getByRole("button", { name: "Open Creative Palette" });
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    const bubble = page.locator("[data-palette-preview]");

    // Nothing on the Studio canvas sits over the trigger.
    const box = (await trigger.boundingBox())!;
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest("[data-palette-trigger]"), [box.x + box.width / 2, box.y + box.height / 2])).toBe(true);

    // Leaves are labels only; what each does is its description and, when previewed, one bubble. On the Writing page
    // that kind's own tools lead (owner, 4 Oct 2026: "less about AI, more about supporting the writing type"): for a
    // poem, Lines & stanzas · Hear it read · Publish as link. Preview and Cover are on the page, so not repeated here.
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/write$`));
    await trigger.click();
    const creation = palette.getByRole("navigation", { name: "This Creation" });
    await expect(creation.getByRole("button")).toHaveText(["Lines & stanzas", "Hear it read", "Publish as link"]);
    const craft = palette.getByRole("button", { name: "Lines & stanzas", exact: true });
    await expect(craft).toHaveAccessibleDescription(/syllables, stanzas/);
    await expect(bubble).toHaveCount(0);
    await craft.hover();
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toContainText("Line by line");

    // Keyboard focus previews the focused leaf instead: still one bubble.
    await page.keyboard.press("Tab");
    await expect(palette.getByRole("button", { name: "Hear it read" })).toBeFocused();
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toContainText("rhythm");

    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
    await expect(bubble).toHaveCount(0);

    // The tool opens on the page itself — counted here, nothing sent — and opens again from the same leaf.
    for (let i = 0; i < 2; i++) {
      await trigger.click();
      await palette.getByRole("button", { name: "Lines & stanzas", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "Lines & stanzas" });
      await expect(sheet.getByRole("list", { name: "Lines" }).getByRole("listitem")).toHaveCount(1);
      await expect(sheet.getByText("Lines", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    }
  });
});
