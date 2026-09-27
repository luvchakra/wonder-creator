import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Collaboration messaging", () => {
  test("crew chat about a task with a CreatorBrain draft, Huddle handoff, direct messages and notifications", async ({ page: a, creator: _owner, openContext }) => {
    test.setTimeout(180_000);
    const { page: b } = await openContext("B");
    const jo = await newCreator(b, { name: `Jo ${uid()}` });
    const joId = ((await (await a.request.get(`/api/v1/search?type=creators&q=${jo.handle}`)).json()) as { creators: Array<{ id: string }> }).creators[0].id;
    const title = `Pier Film ${uid()}`;
    const { project } = (await (await a.request.post("/api/v1/projects", { data: { title } })).json()) as { project: { id: string } };
    const { crew } = (await (await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    await a.request.post(`/api/v1/crews/${crew.id}/members`, { data: { creatorId: joId } });
    await b.request.post(`/api/v1/crews/${crew.id}/respond`, { data: { accept: true } });
    await a.request.post(`/api/v1/projects/${project.id}/tasks`, { data: { title: "Scout the pier" } });

    // A CreatorBrain draft is clearly not sent until the creator sends it.
    await a.goto(`/projects/${project.id}?tab=chat`);
    await a.getByRole("button", { name: "Draft with CreatorBrain" }).click();
    await a.getByLabel("What should the message say?").fill("ask Jo to scout the pier this week");
    await a.getByRole("button", { name: "Write draft" }).click();
    await expect(a.getByText("Draft — not sent")).toBeVisible();
    await expect(a.getByLabel("Message the crew")).not.toHaveValue("");
    await a.getByLabel("Message the crew").fill("Jo, could you scout the pier this week?");
    await a.getByLabel("Point to", { exact: true }).selectOption({ label: "Task: Scout the pier" });
    await a.getByRole("button", { name: "Send", exact: true }).click();
    const messages = a.getByRole("list", { name: "Messages" });
    await expect(messages).toContainText("Jo, could you scout the pier this week?");
    await expect(messages.getByRole("link", { name: "Task: Scout the pier" })).toBeVisible();
    await expect(messages).toContainText("Drafted with CreatorBrain");
    await expect(a.getByText("Draft — not sent")).toHaveCount(0);

    // Jo is told about the unread message; reading clears it.
    const notes = JSON.stringify(await (await b.request.get("/api/v1/notifications")).json());
    expect(notes).toContain("1 new message in");
    await b.goto(`/projects/${project.id}?tab=chat`);
    await expect(b.getByRole("list", { name: "Messages" })).toContainText("scout the pier");
    await expect.poll(async () => JSON.stringify(await (await b.request.get("/api/v1/messages/unread")).json())).not.toContain(crew.id);

    // Huddle handoff from the chat.
    await b.getByRole("button", { name: "Start a Huddle" }).click();
    await b.waitForURL(/\/huddles\//);
    await a.reload();
    await expect(messages.getByRole("link", { name: "Open the Huddle" })).toBeVisible();

    // Direct message from Jo's profile, about the project.
    await a.goto(`/creators/${jo.handle}`);
    await a.getByRole("button", { name: "Message" }).click();
    await a.waitForURL(/\/messages\//);
    await a.getByLabel(`Message ${jo.name}`).fill("Thanks for joining!");
    await a.getByLabel("About", { exact: true }).selectOption({ label: `Project: ${title}` });
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await expect(a.getByRole("list", { name: "Messages" })).toContainText("Thanks for joining!");
    const dm = JSON.stringify(await (await b.request.get("/api/v1/notifications")).json());
    expect(dm).toContain("sent you a message");
    await b.goto("/messages");
    await b.getByRole("link", { name: /Thanks for joining/ }).click();
    await expect(b.getByRole("list", { name: "Messages" }).getByRole("link", { name: `Project: ${title}` })).toBeVisible();
  });
});
