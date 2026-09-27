import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Campaigns", () => {
  test("brief → invite → accept → propose → agree → submit → approve", async ({ page, creator, openContext }) => {
    void creator;
    // Maya is open to brand work.
    const { page: maya } = await openContext("maya");
    const m = await newCreator(maya);
    expect((await maya.request.put("/api/v1/creators/brand", { data: { openToBrands: true, niches: ["Slow travel"], deliverables: ["Short film"] } })).ok()).toBe(true);

    // The brand side writes a brief.
    const title = `Autumn on the coast ${uid()}`;
    await page.goto("/campaigns");
    await page.getByRole("button", { name: "New campaign" }).first().click();
    const dialog = page.getByRole("dialog", { name: "New campaign" });
    await dialog.getByLabel("Brand").fill("Harbour Hotels");
    await dialog.getByLabel("Campaign title").fill(title);
    await dialog.getByLabel("Brief").fill("Three short pieces about slow travel on the coast.");
    await dialog.getByLabel("Usage rights needed").fill("Organic social, 12 months, India.");
    await dialog.getByRole("button", { name: "Create campaign" }).click();
    await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
    const url = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Organic social, 12 months, India.")).toBeVisible();

    await page.getByLabel("Invite by @handle").fill(`@${m.handle}`);
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByRole("region", { name: "Creators" }).or(page.locator("section", { has: page.getByRole("heading", { name: "Creators" }) }))).toContainText("Invited");

    // Maya accepts and proposes.
    await maya.goto("/campaigns");
    await maya.getByRole("link", { name: new RegExp(title) }).click();
    await maya.getByRole("button", { name: "Accept" }).click();
    await maya.getByLabel("Propose a deliverable").fill("60-second film");
    await maya.getByRole("button", { name: "Propose" }).click();
    await expect(maya.getByText("60-second film")).toBeVisible();
    await expect(maya.getByRole("button", { name: "Agree" })).toHaveCount(0); // her own proposal

    // The brand agrees.
    await page.reload();
    await page.getByRole("button", { name: "Agree" }).click();
    await expect(page.getByText("Agreed")).toBeVisible();

    // Maya submits one of her Creations.
    const film = `Coast ${uid()}`;
    const art = (await (await maya.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: film } })).json()).artifact as { id: string; current_version_id: string };
    await maya.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "The harbour keeps its lights.", baseVersionId: art.current_version_id, label: "Written" } });
    await maya.reload();
    await maya.getByLabel("Creation for 60-second film").selectOption({ label: film });
    await maya.getByRole("button", { name: "Submit" }).click();
    await expect(maya.getByText("Submitted")).toBeVisible();

    // The brand reads just that submission and approves.
    await page.goto(url);
    await page.getByRole("button", { name: "Read the submission" }).click();
    await expect(page.getByText("The harbour keeps its lights.")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved")).toBeVisible();
  });
});
