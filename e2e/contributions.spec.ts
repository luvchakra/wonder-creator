import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Contribution ledger", () => {
  test("automatic and recorded contributions, agreed shares only when defined, refine and retract with history, export credits", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    const { page: b } = await openContext("B");
    const lu = await newCreator(b, { name: `Lu ${uid()}` });
    const luId = ((await (await a.request.get(`/api/v1/search?type=creators&q=${lu.handle}`)).json()) as { creators: Array<{ id: string }> }).creators[0].id;
    const title = `Monsoon Reflections ${uid()}`;
    const { project } = (await (await a.request.post("/api/v1/projects", { data: { title } })).json()) as { project: { id: string } };
    const { crew } = (await (await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    await a.request.post(`/api/v1/crews/${crew.id}/members`, { data: { creatorId: luId } });
    await b.request.post(`/api/v1/crews/${crew.id}/respond`, { data: { accept: true } });
    // Lu completes an assigned task: recorded automatically.
    const { id: taskId } = (await (await a.request.post(`/api/v1/projects/${project.id}/tasks`, { data: { title: "Record the rain", assigneeIds: [luId] } })).json()) as { id: string };
    expect((await b.request.patch(`/api/v1/tasks/${taskId}`, { data: { status: "done" } })).ok()).toBeTruthy();

    await a.goto(`/projects/${project.id}`);
    await a.getByRole("navigation", { name: "Creative Room sections" }).getByRole("link", { name: "Contributions" }).click();
    const list = a.getByRole("region", { name: "Contributions" });
    await expect(list).toContainText("Completed: Record the rain");
    await expect(list).toContainText("Completed a task");
    await expect(a.getByRole("region", { name: "Summary" })).not.toContainText("%");

    // The owner records a contribution with a credit line and an agreed share.
    await a.getByRole("button", { name: "Record a contribution" }).click();
    const rec = a.getByRole("dialog", { name: "Record a contribution" });
    await rec.getByLabel("Who").selectOption({ label: lu.name });
    await rec.getByLabel("Kind of contribution").selectOption("sound");
    await rec.getByLabel("What they contributed").fill("Recorded the monsoon ambience");
    await rec.getByLabel("Credit line").fill("Sound recordist");
    await rec.getByLabel("Agreed share (%)").fill("40");
    await rec.getByRole("button", { name: "Record" }).click();
    await expect(a.getByRole("region", { name: "Summary" })).toContainText("40% (agreed)");
    await expect(list).toContainText("Recorded by");

    // Shares can't exceed 100%.
    const over = await a.request.post(`/api/v1/projects/${project.id}/contributions`, { data: { contributorId: luId, kind: "idea", description: "Too much", sharePercent: 70 } });
    expect(over.status()).toBe(422);

    // Lu refines their own description; the edit is in the history.
    await b.goto(`/projects/${project.id}?tab=contributions`);
    await b.getByRole("button", { name: `Options for ${lu.name}'s contribution` }).first().click();
    await b.getByRole("menuitem", { name: "Edit description" }).click();
    const edit = b.getByRole("dialog", { name: "Contribution" });
    await expect(edit.getByLabel("Agreed share (%)")).toHaveCount(0);
    await edit.getByLabel("What they contributed").fill("Recorded the monsoon ambience on the terrace");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(b.getByRole("region", { name: "Contributions" })).toContainText("on the terrace");

    // The owner retracts the task entry: it stays, marked retracted.
    await a.reload();
    const taskEntry = a.getByRole("region", { name: "Contributions" }).getByRole("listitem").filter({ hasText: "Completed: Record the rain" });
    await taskEntry.getByRole("button", { name: /Options for/ }).click();
    await a.getByRole("menuitem", { name: "Retract" }).click();
    const retract = a.getByRole("dialog", { name: "Retract this contribution?" });
    await retract.getByLabel("Reason").fill("Duplicate of the sound credit");
    await retract.getByRole("button", { name: "Retract" }).click();
    await expect(taskEntry).toContainText("Retracted: Duplicate of the sound credit");

    // Credits export names the credited person and line.
    const credits = await (await a.request.get(`/api/v1/projects/${project.id}/credits`)).text();
    expect(credits).toContain(title);
    expect(credits).toContain(`${lu.name} — Sound recordist`);
    const csv = await (await a.request.get(`/api/v1/projects/${project.id}/credits?format=csv`)).text();
    expect(csv.split("\n")[0]).toContain("Share (%)");
  });
});
