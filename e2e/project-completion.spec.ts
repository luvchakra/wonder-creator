import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Project completion", () => {
  test("guided checklist: resolve a task, acknowledge what's open, type the name, dissolve the crew — nothing is lost; then reopen", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    const { page: b } = await openContext("B");
    const ro = await newCreator(b, { name: `Ro ${uid()}` });
    const roId = ((await (await a.request.get(`/api/v1/search?type=creators&q=${ro.handle}`)).json()) as { creators: Array<{ id: string }> }).creators[0].id;
    const title = `Tide Lines ${uid()}`;
    const { project } = (await (await a.request.post("/api/v1/projects", { data: { title } })).json()) as { project: { id: string } };
    const { crew } = (await (await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    await a.request.post(`/api/v1/crews/${crew.id}/members`, {
      data: { creatorId: roId },
    });
    await b.request.post(`/api/v1/crews/${crew.id}/respond`, {
      data: { accept: true },
    });
    await a.request.post(`/api/v1/projects/${project.id}/tasks`, {
      data: { title: "Print the zine", assigneeIds: [roId] },
    });
    await a.request.post(`/api/v1/projects/${project.id}/tasks`, {
      data: { title: "Send thank-you notes" },
    });

    // With a crew, the status menu can't complete or archive; the checklist does.
    await a.goto(`/projects/${project.id}`);
    await expect(a.getByLabel("Status").locator("option", { hasText: "Completed" })).toHaveCount(0);
    await a.getByRole("button", { name: "More Creative Room actions" }).click();
    await a.getByRole("menuitem", { name: /Complete, archive or dissolve crew/ }).click();
    await expect(a.getByRole("heading", { name: "Complete this Creative Room", level: 1 })).toBeVisible();

    const tasks = a.getByRole("region", { name: "Unresolved tasks" });
    await expect(tasks).toContainText("Needs attention");
    await tasks.getByRole("listitem").filter({ hasText: "Print the zine" }).getByRole("button", { name: "Mark done" }).click();
    await expect(tasks).not.toContainText("Print the zine");
    await tasks.getByLabel("Follow-up owner for Send thank-you notes").selectOption({ label: ro.name });
    await expect(
      a
        .getByRole("status")
        .or(a.locator("p").filter({ hasText: "will follow up" }))
        .first(),
    ).toBeVisible();

    const close = a.getByRole("region", { name: "Close the Creative Room" });
    const submit = close.getByRole("button", { name: "Complete Creative Room" });
    await expect(close.getByLabel(/Dissolve/)).toBeChecked();
    await close.getByLabel(`Type “${title}” to confirm`).fill(title);
    await expect(submit).toBeDisabled(); // one task is still open
    await close.getByLabel(/still open/).check();
    await close.getByLabel("Closing note (optional)").fill("Printed 200 copies.");
    await submit.click();
    await expect(a.getByRole("heading", { name: "Creative Room closed", level: 1 })).toBeVisible();
    await expect(a.getByRole("region", { name: "Completion history" })).toContainText("crew dissolved");

    // Ro still sees the project, its tasks and the crew, now completed.
    await b.goto(`/projects/${project.id}?tab=tasks`);
    await expect(b.getByText("Send thank-you notes")).toBeVisible();
    await b.goto(`/crews/${crew.id}`);
    await expect(b.getByText("Completed").first()).toBeVisible();

    // Reopen.
    await a.getByRole("button", { name: "Reopen Creative Room" }).click();
    await a.getByRole("dialog", { name: "Reopen this Creative Room?" }).getByRole("button", { name: "Reopen" }).click();
    await expect(a.getByRole("heading", { name: "Complete this Creative Room", level: 1 })).toBeVisible();
    await expect(a.getByRole("region", { name: "Completion history" })).toContainText("Reopened by");
  });
});
