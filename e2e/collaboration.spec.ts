import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Collaborative editing", () => {
  test("add a collaborator, propose → review diff → accept (credited), comment, conflicts are explicit, and edit access saves directly", async ({ page: a, creator: _owner, openContext, consoleGuard }) => {
    test.setTimeout(180_000);
    // The stale save below is refused on purpose (409).
    consoleGuard.allow(/409 \(Conflict\).*\/edits/);
    const { page: b } = await openContext("B");
    const mo = await newCreator(b, { name: `Mo ${uid()}` });
    const res = await a.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Monsoon ${uid()}` } });
    const art = (await res.json()).artifact as { id: string; current_version_id: string; title: string };
    await a.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "Rain on the tin roof.", baseVersionId: art.current_version_id, label: "Written" } });

    // The owner adds Mo as a collaborator who can propose changes.
    await a.goto(`/artifacts/${art.id}`);
    await a.getByRole("button", { name: "More actions" }).click();
    await a.getByRole("menuitem", { name: "Collaborate" }).click();
    await expect(a.getByRole("heading", { name: "Collaborate", level: 1 })).toBeVisible();
    await a.getByRole("button", { name: "Add a collaborator" }).click();
    const add = a.getByRole("dialog", { name: "Add a collaborator" });
    await add.getByLabel("Find a creator").fill(mo.handle);
    await add.getByRole("button", { name: `Choose ${mo.name}` }).click();
    await add.getByLabel("Their part").fill("Co-writer");
    await add.getByLabel("What they can do").selectOption("propose");
    await add.getByRole("button", { name: "Add collaborator" }).click();
    await expect(a.getByRole("region", { name: "People" })).toContainText(mo.name);

    // Mo is notified, opens the piece, and proposes a change.
    const notes = JSON.stringify(await (await b.request.get("/api/v1/notifications")).json());
    expect(notes).toContain("You were added as Co-writer");
    await b.goto(`/artifacts/${art.id}/collaborate`);
    await b.getByRole("button", { name: "Propose a change" }).click();
    const write = b.getByRole("dialog", { name: "Propose a change" });
    await write.getByLabel("Text").fill("Rain on the tin roof,\nand the kettle answers.");
    await write.getByLabel("What you changed").fill("Added a second line");
    await write.getByRole("button", { name: "Send proposal" }).click();
    await expect(b.getByRole("region", { name: "Proposed changes" })).toContainText("Added a second line");

    // The owner reviews the diff and accepts; the new version is credited to Mo.
    await a.reload();
    await a.getByRole("region", { name: "Proposed changes" }).getByRole("button", { name: "Review" }).click();
    const review = a.getByRole("dialog", { name: "Added a second line" });
    await expect(review.getByLabel("Changes")).toContainText("and the kettle answers.");
    await review.getByRole("button", { name: "Accept as a new version" }).click();
    await expect(a.getByText(`credited to ${mo.name}`).first()).toBeVisible();
    const history = a.getByRole("region", { name: "Version history" });
    await expect(history.getByRole("listitem").first()).toContainText(mo.name);
    await expect(history.getByRole("listitem").first()).toContainText("Proposed by");

    // Mo comments on a passage.
    await b.reload();
    await b.getByLabel("Passage (optional)").fill("kettle");
    await b.getByLabel("Comment", { exact: true }).fill("Maybe a teapot?");
    await b.getByRole("button", { name: "Add comment" }).click();
    await expect(b.getByRole("region", { name: "Comments" })).toContainText("Maybe a teapot?");

    // A proposal on an older version is flagged, and accepting it needs explicit confirmation.
    await b.getByRole("button", { name: "Propose a change" }).click();
    const w2 = b.getByRole("dialog", { name: "Propose a change" });
    await w2.getByLabel("Text").fill("A completely different take.");
    await w2.getByLabel("What you changed").fill("Rewrite");
    await w2.getByRole("button", { name: "Send proposal" }).click();
    await expect(b.getByRole("region", { name: "Proposed changes" })).toContainText("Rewrite");
    const cur = ((await (await a.request.get(`/api/v1/artifacts/${art.id}`)).json()) as { artifact: { current_version_id: string } }).artifact.current_version_id;
    expect((await a.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "Owner's newer text.", baseVersionId: cur, label: "Owner" } })).ok()).toBeTruthy();
    await a.reload();
    await expect(a.getByRole("region", { name: "Proposed changes" })).toContainText("Creation changed since");
    await a.getByRole("region", { name: "Proposed changes" }).getByRole("button", { name: "Review" }).click();
    const r2 = a.getByRole("dialog", { name: "Rewrite" });
    await expect(r2.getByRole("status")).toContainText("has changed since this was proposed");
    await expect(r2.getByRole("button", { name: "Accept as a new version" })).toBeDisabled();
    await r2.getByLabel("Note if declining (optional)").fill("Keeping the rain.");
    await r2.getByRole("button", { name: "Decline" }).click();
    await expect(a.getByText("Proposal declined.").first()).toBeVisible();

    // With edit access, Mo saves directly; a stale save is refused and the text is kept.
    await a.getByLabel(`What ${mo.name} can do`).selectOption("edit");
    await expect(a.getByText(`${mo.name}: can edit.`).first()).toBeVisible();
    await b.reload();
    await b.getByRole("button", { name: "Edit the Creation" }).click();
    const edit = b.getByRole("dialog", { name: "Edit the Creation" });
    await edit.getByLabel("Text").fill("Mo's tightened version.");
    const cur2 = ((await (await a.request.get(`/api/v1/artifacts/${art.id}`)).json()) as { artifact: { current_version_id: string } }).artifact.current_version_id;
    await a.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "Owner raced ahead.", baseVersionId: cur2, label: "Owner" } });
    await edit.getByRole("button", { name: "Save new version" }).click();
    await expect(edit.getByRole("alert")).toContainText("newer version");
    await expect(edit.getByLabel("Text")).toHaveValue("Mo's tightened version.");
    await edit.getByRole("button", { name: "Cancel" }).click();
    await b.reload();
    await b.getByRole("button", { name: "Edit the Creation" }).click();
    await b.getByRole("dialog", { name: "Edit the Creation" }).getByLabel("Text").fill("Mo's tightened version.");
    await b.getByRole("dialog", { name: "Edit the Creation" }).getByRole("button", { name: "Save new version" }).click();
    await expect(b.getByText("credited to you").first()).toBeVisible();
  });
});
