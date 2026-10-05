import { expect, pngBytes, sendItem, test, uid, uploadViaInbox } from "./fixtures";

// Creation pages, step 5 (docs/ui-redesign/creation-pages.md): a Video opens on its storyboard — frames, lines, lengths;
// Write, Add shot, Play through (the animatic); Render says plainly when no video provider is connected.
test.describe("Video page", () => {
  test("a script opens as shots; write, frame, add and play them through; every change is a version", async ({ page, creator }) => {
    void creator;
    const name = `frame-${uid()}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes(64) }]);
    await expect(sendItem(page, name).getByLabel("Ready")).toBeVisible({ timeout: 30_000 });

    const script = ["INT. STATION - DAWN", "A man waits with his coat folded.", "", "EXT. PLATFORM 3 - DAY", "The train comes in.", "", "INT. CARRIAGE - DAY", "He sits by the window."].join("\n");
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "storyboard", title: `Platform 3 ${uid()}`, content: script } });
    const id = ((await res.json()) as { artifact: { id: string } }).artifact.id;

    // Older links to the Studio land on the page built for it.
    await page.goto(`/creations/${id}/studio`);
    await expect(page).toHaveURL(new RegExp(`/creations/${id}/video$`));
    const shots = page.getByRole("list", { name: "Shots" });
    await expect(shots.getByRole("button")).toHaveCount(3);
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByText("Shot 1 of 3 · 3 shots, 0:12")).toBeVisible();

    // Write (the primary action): the line, the direction, how long it holds, and a frame of the creator's own.
    await page.getByRole("button", { name: "Write" }).click();
    await editor.getByLabel("What's seen or said").fill("A man waits, his coat folded over one arm.");
    await editor.getByLabel("Camera and staging").fill("Wide, slow push in");
    await editor.getByRole("button", { name: "Longer" }).click();
    await expect(editor.getByText("Shot 1 of 3 · 3 shots, 0:13")).toBeVisible();
    await editor.getByRole("button", { name: "Choose a frame" }).click();
    await page.getByRole("dialog", { name: "Choose a frame" }).getByRole("button", { name: /^Use / }).first().click();
    await expect(editor.getByRole("button", { name: "Change the frame" })).toBeVisible();
    await expect(editor.getByText("Saved")).toBeVisible();

    // Add shot, then move it earlier.
    await shots.getByRole("button", { name: /^Shot 3,/ }).click();
    await page.getByRole("button", { name: "Add shot" }).click();
    await editor.getByLabel("What's seen or said").fill("The clock reads 6:10.");
    await editor.getByRole("button", { name: "Move earlier" }).click();
    await expect(shots.getByRole("button", { name: /^Shot 3, 4 seconds: The clock reads 6:10\./ })).toHaveAttribute("aria-current", "true");
    await expect(editor.getByText("Saved")).toBeVisible();

    // The version holds the shot list; the frame is linked to the Creation.
    const versions = (await (await page.request.get(`/api/v1/artifacts/${id}/versions`)).json()) as { versions: Array<{ content: string }> };
    expect(versions.versions[0]!.content).toContain("## Shot 1 · 5s — Wide, slow push in");
    expect(versions.versions[0]!.content).toContain("The clock reads 6:10.");

    // Play through: the animatic, from the first shot; arrows move on; Escape ends it.
    await shots.getByRole("button", { name: /^Shot 1,/ }).click();
    await page.getByRole("button", { name: "Play through" }).click();
    const play = page.getByRole("dialog", { name: "Playing through" });
    await expect(play.getByText(/^Shot 1 of 4/)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(play.getByText(/^Shot 2 of 4/)).toBeVisible();
    await expect(play.getByText("The train comes in.").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(play).toBeHidden();
    await expect(shots.getByRole("button", { name: /^Shot 2,/ })).toHaveAttribute("aria-current", "true");

    // Render: no video provider is connected, and it says so. Export is here too.
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /^Render video/ }).click();
    await expect(page.getByRole("dialog", { name: "Render video" })).toContainText("Video rendering isn't connected.");
    await page.getByRole("dialog", { name: "Render video" }).getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /^Export/ }).click();
    await expect(page.getByRole("dialog", { name: "Export" })).toBeVisible();

    // A save against an older version is refused.
    const stale = await page.request.post(`/api/v1/artifacts/${id}/storyboard`, { data: { storyboard: { kind: "storyboard", shots: [] }, baseVersionId: "00000000-0000-0000-0000-000000000000" } });
    expect(stale.status()).toBe(409);
  });

  test("Make a new Creation › Video and › Presentation open their own pages", async ({ page, creator }) => {
    void creator;
    for (const [format, path, primary] of [["Video", "video", "Add a shot"], ["Presentation", "deck", "Add a slide"]] as const) {
      await page.goto("/");
      await page.getByRole("button", { name: "Open Creative Palette" }).click();
      await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: "Create" }).click();
      await page.getByRole("dialog", { name: "Make a new Creation" }).getByRole("button", { name: new RegExp(format) }).click();
      await expect(page).toHaveURL(new RegExp(`/creations/[0-9a-f-]{36}/${path}$`));
      await expect(page.getByRole("button", { name: primary })).toBeVisible();
    }
  });
});
