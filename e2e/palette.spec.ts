import { expect, test, uid } from "./fixtures";

test.describe("Creative Palette", () => {
  test("follows the Creation's lifecycle, keeps 3–4 primary actions, and offers More… and Go to…", async ({ page, creator }) => {
    void creator;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Harbour ${uid()}` } })).json()).artifact as { id: string; current_version_id: string };
    const trigger = page.getByRole("button", { name: "Open Creative Palette" });
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    const creation = palette.getByRole("navigation", { name: "This Creation" });

    // An empty Creation is still an idea: gather material first.
    await page.goto(`/artifacts/${art.id}`);
    await trigger.click();
    await expect(creation.getByRole("button", { name: "Bring Material" })).toBeFocused();
    await expect(creation.getByRole("button")).toHaveCount(4);
    await page.keyboard.press("Escape");

    // With words on the page it's in progress: continue, bring, refine, people — the rest under More….
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "The harbour keeps its lights.", baseVersionId: art.current_version_id, label: "Written" } });
    await page.goto(`/artifacts/${art.id}`);
    await trigger.click();
    await expect(creation.getByRole("button")).toHaveText([/Continue Creating/, /Bring Material/, /Refine/, /People/]);
    await palette.getByRole("button", { name: "More…" }).click();
    await expect(palette.getByRole("button", { name: "Publish" })).toBeVisible();
    await palette.getByRole("button", { name: "Back" }).click();
    await palette.getByRole("button", { name: /Go to…/ }).click();
    const destinations = palette.getByRole("navigation", { name: "Destinations" });
    await expect(destinations.getByRole("button")).toHaveText(["Home", "Create", "Materials", "Huddles", "Explore", "Me"]);
    await palette.getByRole("button", { name: "Back" }).click();
    await palette.getByRole("button", { name: "More…" }).click();
    await palette.getByRole("button", { name: "Transform" }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${art.id}/transform$`));

    // Leaving the Creation clears its actions.
    await page.goto("/huddles");
    await trigger.click();
    await expect(creation).toHaveCount(0);
    await expect(palette.getByRole("navigation", { name: "Huddles" })).toBeVisible();
  });

  test("Home shows the global destinations and Create opens the quick-create set", async ({ page, creator }) => {
    void creator;
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    await expect(palette.getByRole("navigation", { name: "Destinations" }).getByRole("button")).toHaveText(["Create", "Materials", "Huddles", "Explore", "Me"]);
    await palette.getByRole("button", { name: "Create" }).click();
    await expect(palette.getByRole("button", { name: "New Creation" })).toBeFocused();
    await expect(palette.getByRole("button", { name: /meTalk/ })).toBeVisible();
    // The X closes it, and it stays closed.
    await page.getByRole("button", { name: "Close Creative Palette" }).click();
    await expect(palette).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(palette).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open Creative Palette" })).toBeVisible();
  });
});
