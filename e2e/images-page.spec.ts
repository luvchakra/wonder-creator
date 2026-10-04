import { expect, pngBytes, sendItem, test, uid, uploadViaInbox } from "./fixtures";

// Creation pages, step 2 (docs/ui-redesign/creation-pages.md): Images opens a page built for pictures.
test.describe("Images page", () => {
  test("Make a new Creation › Images: add a picture of yours, edit it (a new version each time), words on it, arrange", async ({ page, creator }) => {
    void creator;
    // A picture of the creator's own.
    const name = `harbour-${uid()}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes(64) }]);
    await expect(sendItem(page, name).getByLabel("Ready")).toBeVisible({ timeout: 30_000 });

    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: "Create" }).click();
    await page.getByRole("dialog", { name: "Make a new Creation" }).getByRole("button", { name: /Images/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/image$/);
    const id = page.url().match(/creations\/([0-9a-f-]{36})/)![1];

    // Empty: one line, three ways to begin. The page's primary action is Add a picture until there is one.
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByText("Begin with a picture")).toBeVisible();
    await expect(page.getByRole("button", { name: "Text", exact: true })).toBeDisabled();
    await editor.getByRole("button", { name: "Your pictures" }).click();
    await editor.getByRole("list", { name: "Your pictures" }).getByRole("button").first().click();
    // Adding is a version (v2): the original Material is untouched.
    await expect(page.getByRole("link", { name: "Version 2 — see versions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();

    // Edit: six tools; Keep makes v3.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Edit" });
    await expect(edit.getByRole("radiogroup", { name: "Tool" }).getByRole("radio")).toHaveText(["Crop", "Focus", "Filter", "Light", "Blur", "Frame"]);
    await edit.getByRole("radio", { name: "1:1" }).click();
    await edit.getByRole("radio", { name: "Filter" }).click();
    await edit.getByRole("radio", { name: "Mono" }).click();
    await edit.getByRole("radio", { name: "Frame" }).click();
    await edit.getByRole("radio", { name: "Paper edge" }).click();
    await edit.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByRole("link", { name: "Version 3 — see versions" })).toBeVisible();

    // Text: a box on the picture, typed in place; it autosaves as v4. The box is real text, moved and sized by hand.
    await page.getByRole("button", { name: "Text", exact: true }).click();
    const box = editor.getByRole("textbox", { name: "Text on the picture" });
    await box.fill("The lights came on one by one");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("link", { name: "Version 4 — see versions" })).toBeVisible();
    await expect(editor.getByRole("button", { name: /Text: The lights came on one by one/ })).toBeVisible();
    // Size it with the toolbar (no precision gesture needed) — another version.
    await editor.getByRole("button", { name: /Text: The lights/ }).click();
    await editor.getByRole("button", { name: "Larger text" }).click();
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("link", { name: "Version 5 — see versions" })).toBeVisible();

    // Arrange & captions from More: a caption shows under the picture.
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /Arrange & captions/ }).click();
    const arrange = page.getByRole("dialog", { name: "Arrange & captions" });
    await arrange.getByLabel("Caption for picture 1").fill("Harbour, late");
    await arrange.getByRole("button", { name: "Keep" }).click();
    await expect(editor.getByText("Harbour, late")).toBeVisible();

    // Every Keep was a version; the Studio address forwards here.
    const versions = (await (await page.request.get(`/api/v1/artifacts/${id}/versions`)).json()) as { versions: Array<{ version_number: number; label: string }> };
    expect(versions.versions.map((v) => v.label)).toEqual(expect.arrayContaining(["First picture", "Edited", "Words on the picture", "Arranged"]));
    await page.goto(`/creations/${id}/studio`);
    await expect(page).toHaveURL(new RegExp(`/creations/${id}/image$`));
  });

  test("Download offers PNG, JPEG and WebP, drawn in the browser", async ({ page, creator }) => {
    void creator;
    const name = `jetty-${uid()}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes(48) }]);
    const item = sendItem(page, name);
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });
    const materialId = (await item.getByRole("link", { name, exact: true }).getAttribute("href"))!.split("/").pop()!;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "photo_essay", title: "Jetty" } })).json()).artifact as { id: string; current_version_id: string };
    const r = await page.request.post(`/api/v1/artifacts/${art.id}/images`, {
      data: { set: { kind: "images", items: [{ materialId, caption: "", edits: { aspect: "16:9", zoom: 1, focalX: 0.5, focalY: 0.5, filter: "warm", brightness: 1, contrast: 1, blurBehind: false, frame: "none" }, words: { enabled: false, text: "", x: 0.5, y: 0.8, width: 0.84, font: "serif", size: 0.07, align: "center", color: "#ffffff", shadow: true, background: "shade" } }] }, baseVersionId: art.current_version_id },
    });
    expect(r.ok()).toBe(true);
    await page.goto(`/creations/${art.id}/image`);
    await page.getByRole("button", { name: "Download" }).click();
    const sheet = page.getByRole("dialog", { name: "Download" });
    await expect(sheet.getByRole("button")).toContainText(["PNG", "JPEG", "WebP"]);
    const dl = page.waitForEvent("download");
    await sheet.getByRole("button", { name: /JPEG/ }).click();
    expect((await dl).suggestedFilename()).toBe("jetty.jpg");
  });
});
