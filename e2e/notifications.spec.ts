import { expect, newCreator, test, uid, type Page } from "./fixtures";

function bell(page: Page) {
  return page.getByRole("banner").getByRole("button", { name: /^Notifications/ });
}

test.describe("Notifications", () => {
  test("shows a calm empty state, then a join request that links to the Huddle", async ({ page: a, creator, openContext }) => {
    void creator;
    test.setTimeout(180_000);
    await a.goto("/");
    await expect(bell(a)).toHaveAccessibleName("Notifications");
    await bell(a).click();
    const panel = a.getByRole("dialog", { name: "Notifications" });
    await expect(panel.getByText("Nothing is waiting for you right now.")).toBeVisible();
    await a.keyboard.press("Escape");

    // A goes live; B asks to join.
    const topic = `night markets ${uid()}`;
    await a.goto("/huddles");
    await a.getByRole("button", { name: "Start a Huddle" }).click();
    const start = a.getByRole("dialog", { name: "Start a Huddle" });
    await start.getByLabel("What are you talking about? (optional)").fill(topic);
    await start.getByRole("button", { name: /^Go live as / }).click();
    await a.waitForURL(/\/huddles\/[0-9a-f-]{36}$/);
    const huddleId = a.url().split("/").pop()!;

    const { page: b } = await openContext("B");
    const creatorB = await newCreator(b, { name: `Noor ${uid()}` });
    await b.goto(`/huddles/${huddleId}`);
    await b.getByRole("button", { name: "Request to Join" }).click();
    await expect(b.getByRole("status").filter({ hasText: "Request sent" })).toBeVisible();

    // Away from the room, A's bell counts the request and links back to it.
    await a.goto("/space");
    await expect(bell(a)).toHaveAccessibleName("Notifications, 1 waiting", { timeout: 20_000 });
    await bell(a).click();
    const item = a.getByRole("dialog", { name: "Notifications" }).getByRole("link", { name: new RegExp(`${creatorB.name} asked to join your Huddle`) });
    await expect(item).toBeVisible();
    await item.click();
    await expect(a).toHaveURL(new RegExp(`/huddles/${huddleId}$`));
    await expect(a.getByRole("region", { name: "Join requests" })).toContainText(creatorB.name);
  });
});
