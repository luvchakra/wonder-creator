import { expect, newCreator, saveNote, test, uid } from "./fixtures";

test.describe("Crew workspace", () => {
  test("share work with the crew read-only, share back, talk in the crew chat, and stop sharing", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    const { page: b } = await openContext("B");
    const ren = await newCreator(b, { name: `Ren ${uid()}` });
    const renId = ((await (await a.request.get(`/api/v1/search?type=creators&q=${ren.handle}`)).json()) as { creators: Array<{ id: string }> }).creators[0].id;
    const title = `Goa Photo Series ${uid()}`;
    const { project } = (await (await a.request.post("/api/v1/projects", { data: { title, status: "active" } })).json()) as { project: { id: string } };
    const { crew } = (await (await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    expect((await a.request.post(`/api/v1/crews/${crew.id}/members`, { data: { creatorId: renId, roleTitle: "Photographer" } })).ok()).toBeTruthy();
    expect((await b.request.post(`/api/v1/crews/${crew.id}/respond`, { data: { accept: true } })).ok()).toBeTruthy();

    // The owner adds a note to the project; it isn't shared until they say so.
    const note = `Shot list: sunrise at the fort ${uid()}`;
    const noteId = await saveNote(a, note);
    expect((await a.request.post(`/api/v1/projects/${project.id}/items`, { data: { kind: "material", ids: [noteId] } })).ok()).toBeTruthy();
    await b.goto(`/projects/${project.id}?tab=work`);
    await expect(b.getByRole("region", { name: "Shared by the crew" })).not.toContainText(note);

    await a.goto(`/projects/${project.id}?tab=work`);
    await expect(a.getByRole("navigation", { name: "Creative Room sections" }).getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
    const material = a.getByRole("region", { name: "Material & references" });
    await material.getByRole("button", { name: `Options for ${note}` }).click();
    await a.getByRole("menuitem", { name: "Share with crew" }).click();
    await expect(material.getByText("Shared with crew")).toBeVisible();

    // Ren opens it read-only.
    await b.reload();
    const shared = b.getByRole("region", { name: "Shared by the crew" });
    await shared.getByRole("link", { name: new RegExp(note) }).click();
    await expect(b.getByRole("heading", { name: note, level: 1 })).toBeVisible();
    await expect(b.getByText("Read-only")).toBeVisible();
    const viewer = b.url();

    // Ren shares their own note back.
    const renNote = `Contact sheet notes ${uid()}`;
    await saveNote(b, renNote);
    await b.goto(`/projects/${project.id}?tab=work`);
    await b.getByRole("button", { name: "Share your work" }).click();
    const share = b.getByRole("dialog", { name: "Share with the crew" });
    await share.getByRole("radio", { name: "Material" }).click();
    await share.getByLabel(renNote).check();
    await share.getByRole("button", { name: "Add 1" }).click();
    await a.reload();
    await expect(a.getByRole("region", { name: "Shared by the crew" })).toContainText(renNote);
    await expect(a.getByRole("region", { name: "Shared by the crew" })).toContainText(`Shared by ${ren.name}`);

    // Crew chat, pointing at shared work.
    await b.goto(`/projects/${project.id}?tab=chat`);
    await b.getByLabel("Message the crew").fill("Sunrise at the fort works for me.");
    await b.getByLabel("Point to", { exact: true }).selectOption({ label: `Shared: ${note}` });
    await b.getByRole("button", { name: "Send" }).click();
    const messages = b.getByRole("list", { name: "Messages" });
    await expect(messages).toContainText("Sunrise at the fort works for me.");
    await a.goto(`/projects/${project.id}?tab=chat`);
    await expect(a.getByRole("list", { name: "Messages" })).toContainText("Sunrise at the fort works for me.");
    await expect(a.getByRole("list", { name: "Messages" }).getByRole("link", { name: note })).toBeVisible();
    await a.getByRole("button", { name: "Message options" }).click();
    await a.getByRole("menuitem", { name: "Remove message" }).click();
    await expect(a.getByText("No messages yet. Say hello to the crew.")).toBeVisible();

    // The owner stops sharing: Ren can't open it any more.
    await a.goto(`/projects/${project.id}?tab=work`);
    await a.getByRole("region", { name: "Material & references" }).getByRole("button", { name: `Options for ${note}` }).click();
    await a.getByRole("menuitem", { name: "Stop sharing with crew" }).click();
    await expect(a.getByText(`“${note}” is no longer shared with the crew.`).first()).toBeVisible();
    await b.goto(viewer);
    await expect(b.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
  });
});
