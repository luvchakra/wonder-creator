import { expect, newCreator, saveNote, test, uid } from "./fixtures";

test.describe("Projects", () => {
  test.beforeEach(({ creator }) => void creator);

  test("create a project, give it a brief, add work, create inside it, and delete it without touching the work", async ({ page }) => {
    test.setTimeout(180_000);
    const title = `A Life in Moments ${uid()}`;
    const note = `Monsoon on the balcony ${uid()}`;
    const noteId = await saveNote(page, note);

    // From Home to an empty project list, then a new project.
    await page.goto("/");
    await page.getByRole("link", { name: "Start a project" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    await page.getByRole("button", { name: "New project" }).first().click();
    const create = page.getByRole("dialog", { name: "New project" });
    await create.getByLabel("Name").fill(title);
    await create.getByLabel("Brief").fill("A short film about memory and the passing of time.");
    await create.getByLabel("Already underway").check();
    await create.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    const projectId = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByLabel("Status")).toHaveValue("active");

    // Goals and a budget, which only shows once it's switched on.
    await expect(page.getByRole("region", { name: "Budget" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const edit = page.getByRole("dialog", { name: "Edit project" });
    await edit.getByLabel("Goals").fill("Finish the script\nShoot in Goa");
    await edit.getByRole("switch", { name: "Track a budget for this project" }).click();
    await edit.getByLabel("Amount").fill("125000");
    await edit.getByLabel("Currency").fill("INR");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Shoot in Goa")).toBeVisible();
    await expect(page.getByRole("region", { name: "Budget" })).toContainText("125,000");

    // Add the note from the material picker (nothing is copied).
    const materialSection = page.getByRole("region", { name: "Material & references" });
    await materialSection.getByRole("button", { name: "Add" }).click();
    const add = page.getByRole("dialog", { name: "Add to project" });
    await expect(add.getByRole("radio", { name: "Material" })).toHaveAttribute("aria-checked", "true");
    await add.getByLabel(note).check();
    await add.getByRole("button", { name: "Add 1" }).click();
    await expect(page.getByText("Added 1 material to the project.").first()).toBeVisible();
    await expect(materialSection.getByRole("link", { name: new RegExp(note) })).toBeVisible();

    // Creating in the project: the conversation, and the piece made there, join it.
    await page.getByRole("link", { name: "Create in this project" }).click();
    await expect(page.getByText(`In project: ${title}`)).toBeVisible();
    const turn = await page.request.post("/api/v1/conversations/turn", { data: { message: "Write a poem about the monsoon on the balcony.", projectId } });
    expect(turn.ok()).toBeTruthy();
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("region", { name: "Conversations" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Pieces" }).getByRole("listitem")).toHaveCount(1);

    // Removing from the project keeps the work.
    await materialSection.getByRole("button", { name: `Options for ${note}` }).click();
    await page.getByRole("menuitem", { name: "Remove from project" }).click();
    await expect(page.getByText(`Removed “${note}” from the project. It's still in your space.`).first()).toBeVisible();

    // Deleting the project keeps the work too.
    await page.getByRole("button", { name: "More project actions" }).click();
    await page.getByRole("menuitem", { name: "Delete project" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this project?" });
    await expect(confirm).toContainText("are not deleted");
    await confirm.getByRole("button", { name: "Delete project" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto(`/space/materials/${noteId}`);
    await expect(page.getByText(note).first()).toBeVisible();
  });

  test("another creator can't open your project", async ({ page, openContext }) => {
    const res = await page.request.post("/api/v1/projects", { data: { title: `Private plan ${uid()}` } });
    const { project } = (await res.json()) as { project: { id: string } };
    const { page: other } = await openContext("Other");
    await newCreator(other, { name: `Other ${uid()}` });
    await other.goto(`/projects/${project.id}`);
    await expect(other.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
    const api = await other.request.get(`/api/v1/projects/${project.id}`);
    expect(api.status()).toBe(404);
  });
});
