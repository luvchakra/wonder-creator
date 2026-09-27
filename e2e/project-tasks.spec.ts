import type { Page } from "@playwright/test";
import { expect, newCreator, test, uid } from "./fixtures";

async function taskId(page: Page, title: string): Promise<string> {
  const projectId = new URL(page.url()).pathname.split("/")[2];
  const r = (await (await page.request.get(`/api/v1/projects/${projectId}/tasks`)).json()) as { tasks: Array<{ id: string; title: string }> };
  return r.tasks.find((t) => t.title === title)!.id;
}

test.describe("Crew tasks & milestones", () => {
  test("plan with a milestone, assign, move through statuses by menu, approval gates done, comment, and add CreatorBrain suggestions", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    const { page: b } = await openContext("B");
    const sol = await newCreator(b, { name: `Sol ${uid()}` });
    const solId = ((await (await a.request.get(`/api/v1/search?type=creators&q=${sol.handle}`)).json()) as { creators: Array<{ id: string }> }).creators[0].id;
    const { project } = (await (await a.request.post("/api/v1/projects", { data: { title: `Songs for Tomorrow ${uid()}`, brief: "Six hopeful songs.", status: "active" } })).json()) as { project: { id: string } };
    const { crew } = (await (await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    await a.request.post(`/api/v1/crews/${crew.id}/members`, { data: { creatorId: solId, roleTitle: "Sound" } });
    await b.request.post(`/api/v1/crews/${crew.id}/respond`, { data: { accept: true } });

    // Project > Tasks: a milestone, then a task assigned to Sol that needs approval.
    await a.goto(`/projects/${project.id}`);
    await a.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Tasks" }).click();
    await expect(a.getByText("No tasks yet.")).toBeVisible();
    await a.getByRole("region", { name: "Milestones" }).getByRole("button", { name: "Add" }).click();
    const ms = a.getByRole("dialog", { name: "New milestone" });
    await ms.getByLabel("Milestone").fill("Demo recorded");
    await ms.getByLabel("Date").fill("2030-03-01");
    await ms.getByRole("button", { name: "Save" }).click();
    await expect(a.getByRole("region", { name: "Milestones" })).toContainText("Demo recorded");

    await a.getByRole("button", { name: "New task" }).click();
    const create = a.getByRole("dialog", { name: "New task" });
    await create.getByLabel("Task").fill("Record guide vocals");
    await create.getByLabel("Milestone").selectOption({ label: "Demo recorded" });
    await create.getByLabel(sol.name).check();
    await create.getByRole("switch", { name: "Needs approval before it's done" }).click();
    await create.getByRole("button", { name: "Add task" }).click();
    const todo = a.getByRole("region", { name: "To do" });
    await expect(todo).toContainText("Record guide vocals");
    await expect(todo).toContainText(sol.name);
    await expect(todo).toContainText("Needs approval");

    // Sol moves it along with the accessible menu; done needs approval.
    await b.goto(`/projects/${project.id}?tab=tasks`);
    await b.getByRole("button", { name: "Options for Record guide vocals" }).click();
    await b.getByRole("menuitem", { name: "Move to In progress" }).click();
    await expect(b.getByRole("region", { name: "In progress" })).toContainText("Record guide vocals");
    // Done isn't offered to Sol (and the database refuses it too).
    await b.getByRole("button", { name: "Options for Record guide vocals" }).click();
    await expect(b.getByRole("menuitem", { name: "Move to Done" })).toHaveCount(0);
    await b.getByRole("menuitem", { name: "Move to Review" }).click();
    expect((await b.request.patch(`/api/v1/tasks/${await taskId(b, "Record guide vocals")}`, { data: { status: "done" } })).status()).toBe(403);
    await expect(b.getByRole("region", { name: "Review" })).toContainText("Record guide vocals");

    // Sol comments; the owner approves by marking it done.
    await b.getByRole("button", { name: "Record guide vocals", exact: true }).click();
    const detail = b.getByRole("dialog", { name: "Record guide vocals" });
    await detail.getByLabel("Add a comment").fill("Take 3 is the one.");
    await detail.getByRole("button", { name: "Comment" }).click();
    await expect(detail.getByRole("region", { name: "Comments" })).toContainText("Take 3 is the one.");
    await detail.getByRole("button", { name: "Close" }).click();

    await a.reload();
    await a.getByRole("button", { name: "Options for Record guide vocals" }).click();
    await a.getByRole("menuitem", { name: "Move to Done" }).click();
    await expect(a.getByRole("region", { name: "Done" })).toContainText("Record guide vocals");
    await expect(a.getByRole("region", { name: "Milestones" })).toContainText("1 of 1 tasks done");

    // CreatorBrain suggests; nothing is added until chosen, and nobody is assigned.
    await a.getByRole("button", { name: "Suggest tasks" }).click();
    const suggest = a.getByRole("dialog", { name: "Suggested tasks" });
    await expect(suggest.getByRole("checkbox").first()).toBeVisible();
    const count = await suggest.getByRole("checkbox").count();
    await suggest.getByRole("checkbox").first().uncheck();
    await suggest.getByRole("button", { name: `Add ${count - 1}` }).click();
    await expect(a.getByText(`Added ${count - 1} tasks.`).first()).toBeVisible();
    await expect(a.getByRole("region", { name: "To do" }).getByText("Nobody yet").first()).toBeVisible();
  });
});
