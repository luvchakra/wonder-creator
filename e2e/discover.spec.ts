import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Find collaborators", () => {
  test("search by discipline with explained results, shortlist privately, invite to the crew, and ask CreativeMind", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    // A letters-only discipline unique to this run.
    const word = `lumen${uid().replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]!)}`;
    const discipline = `Lightcraft ${word}`;
    const { page: b } = await openContext("B");
    const kit = await newCreator(b, { name: `Kit ${uid()}`, onboarding: { disciplines: [discipline] } });
    const { project } = (await (await a.request.post("/api/v1/projects", { data: { title: `Night Market ${uid()}` } })).json()) as { project: { id: string } };
    await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} });

    await a.goto(`/projects/${project.id}`);
    await a.getByRole("button", { name: "More Creative Room actions" }).click();
    await a.getByRole("menuitem", { name: "Find collaborators" }).click();
    await expect(a.getByRole("heading", { name: "Find collaborators", level: 1 })).toBeVisible();

    await a.getByLabel("Disciplines or skills").fill(word);
    await a.getByRole("button", { name: "Search", exact: true }).click();
    const people = a.getByRole("region", { name: "People" });
    const card = people.getByRole("listitem").filter({ hasText: kit.name });
    await expect(card).toContainText(`Lists ${discipline} as a discipline`);
    await expect(card).toContainText("Open to collaborate");
    await expect(card).not.toContainText(/score|followers/i);

    // Shortlist (private) and invite.
    await card.getByRole("button", { name: `Shortlist ${kit.name}` }).click();
    await expect(a.getByRole("region", { name: "Shortlist" })).toContainText(kit.name);
    await card.getByRole("button", { name: `Invite ${kit.name} to the crew` }).click();
    await expect(a.getByText(`${kit.name} was invited to the crew.`).first()).toBeVisible();
    expect(JSON.stringify(await (await b.request.get("/api/v1/notifications")).json())).toContain("invited you to join");
    expect((await (await b.request.get("/api/v1/collaborators/shortlist")).json()).entries).toEqual([]);

    // CreatorBrain reads the request (with simple rules when AI isn't connected) and explains each person.
    await a.getByLabel("Who are you looking for?").fill(`Find two ${word} people`);
    await a.getByRole("button", { name: "Suggest people" }).click();
    await expect(people).toContainText("CreativeMind looked for");
    // Already invited to this project's crew, so not suggested again.
    await expect(people).not.toContainText(kit.name);
    const direct = await (await a.request.post("/api/v1/collaborators/suggest", { data: { ask: `Find two ${word} people` } })).json();
    expect(direct.people.map((p: { name: string }) => p.name)).toContain(kit.name);
    expect(direct.people[0].reasons).toContain(`Lists ${discipline} as a discipline`);
  });
});
