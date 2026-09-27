import { expect, newCreator, test, uid } from "./fixtures";

test.describe("CreatorCrew", () => {
  test("start a crew, invite with a flexible role, join, see the project read-only, huddle, and remove while keeping the record", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    const { page: b } = await openContext("B");
    const bea = await newCreator(b, { name: `Bea ${uid()}` });
    const title = `Songs for Tomorrow ${uid()}`;
    const res = await a.request.post("/api/v1/projects", { data: { title, brief: "An album of small, hopeful songs.", status: "active" } });
    const { project } = (await res.json()) as { project: { id: string } };

    // Project > Crew: start it, then invite Bea with a role that isn't a film role.
    await a.goto(`/projects/${project.id}`);
    await a.getByRole("region", { name: "Crew" }).getByRole("button", { name: "Start a crew" }).click();
    const start = a.getByRole("dialog", { name: "Start a crew" });
    await expect(start.getByLabel("Crew name")).toHaveValue(title);
    await start.getByLabel("Purpose").fill("Record six songs by spring.");
    await start.getByRole("button", { name: "Start crew" }).click();
    await a.waitForURL(/\/crews\/[0-9a-f-]{36}$/);
    const crewUrl = new URL(a.url()).pathname;
    await expect(a.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(a.getByText("Forming")).toBeVisible();

    await a.getByRole("button", { name: "Invite people" }).click();
    const invite = a.getByRole("dialog", { name: "Invite to the crew" });
    await invite.getByLabel("Find a creator").fill(bea.handle);
    await invite.getByRole("button", { name: `Choose ${bea.name}` }).click();
    await invite.getByLabel("Role").fill("Harmonies & field recordings");
    await invite.getByLabel("Note").fill("Your voice would make this.");
    await invite.getByRole("button", { name: "Send invitation" }).click();
    await expect(a.getByRole("region", { name: "Invited" })).toContainText(bea.name);
    await expect(a.getByRole("region", { name: "Invited" })).toContainText("Harmonies & field recordings");

    // Bea sees the invitation (notifications and Projects), with the project, role and note, and joins.
    await b.goto("/projects");
    await b.getByRole("link", { name: /invited you to join/ }).click();
    await expect(b).toHaveURL(new RegExp(`${crewUrl}$`));
    const card = b.getByRole("region", { name: "Your invitation" });
    await expect(card).toContainText("Harmonies & field recordings");
    await expect(card).toContainText("Your voice would make this.");
    await expect(card).toContainText("An album of small, hopeful songs.");
    await card.getByRole("button", { name: "Join the crew" }).click();
    await expect(b.getByRole("region", { name: "People" })).toContainText(bea.name);
    await expect(b.getByText("Active", { exact: true })).toBeVisible();

    // Bea reads the project but can't change it.
    await b.goto(`/projects/${project.id}`);
    await expect(b.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(b.getByText(/You’re in the crew/)).toBeVisible();
    await expect(b.getByRole("link", { name: "Create in this project" })).toHaveCount(0);
    await expect(b.getByRole("button", { name: "More project actions" })).toHaveCount(0);
    expect((await b.request.patch(`/api/v1/projects/${project.id}`, { data: { title: "Hijacked" } })).status()).toBe(404);

    // The owner changes Bea's role; the activity records it.
    await a.reload();
    await a.getByRole("button", { name: `Options for ${bea.name}` }).click();
    await a.getByRole("menuitem", { name: "Change role" }).click();
    const role = a.getByRole("dialog", { name: `${bea.name}'s role` });
    await role.getByRole("button", { name: "Producer" }).click();
    await role.getByRole("button", { name: "Save role" }).click();
    await expect(a.getByRole("region", { name: "People" })).toContainText("Producer");
    await expect(a.getByRole("region", { name: "Activity" })).toContainText(`changed ${bea.name}'s role to Producer`);

    // A Huddle with the crew invites Bea.
    await a.getByRole("button", { name: "Start a Huddle with the crew" }).click();
    await a.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);
    await expect(a.getByRole("region", { name: "Invitations" })).toContainText(bea.name);
    expect((await a.request.post(`/api/v1/huddles/${a.url().split("/").pop()}/end`)).ok()).toBeTruthy();

    // Removing Bea keeps the record and ends her access.
    await a.goto(crewUrl);
    await a.getByRole("button", { name: `Options for ${bea.name}` }).click();
    await a.getByRole("menuitem", { name: "Remove from crew" }).click();
    const confirm = a.getByRole("dialog", { name: `Remove ${bea.name}?` });
    await expect(confirm).toContainText("stays credited");
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(a.getByRole("region", { name: "Former members" })).toContainText(bea.name);
    await b.goto(`/projects/${project.id}`);
    await expect(b.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
  });
});
