import { expect, newCreator, test, uid, type Page } from "./fixtures";

async function publicPiece(page: Page, title: string): Promise<string> {
  const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } });
  const id = (await res.json()).artifact.id as string;
  expect((await page.request.patch(`/api/v1/artifacts/${id}`, { data: { status: "final", privacy: "public" } })).ok()).toBe(true);
  return id;
}

test.describe("licensing", () => {
  test("the creator records a license in four short steps", async ({ page, creator }) => {
    void creator;
    const id = await publicPiece(page, `Lanterns ${uid()}`);
    await page.goto(`/artifacts/${id}?tab=rights`);
    await page.getByRole("button", { name: "Add license" }).click();
    const d = page.getByRole("dialog", { name: "Create a license" });
    await d.getByLabel("Licensee (optional)").fill("Harbour Times");
    await d.getByRole("button", { name: /Editorial use/ }).click();
    await d.getByRole("button", { name: /Free, with a license/ }).click();
    await d.getByRole("button", { name: "Continue" }).click();
    await d.getByRole("switch", { name: "Derivative works allowed" }).click();
    await d.getByRole("button", { name: "Continue" }).click();
    await d.getByLabel("Territory").fill("India");
    await d.getByRole("button", { name: "Continue" }).click();
    await expect(d.getByText("Editorial use · Free, with a license")).toBeVisible();
    await expect(d.getByText("Allows derivative works")).toBeVisible();
    // Back keeps what was entered.
    await d.getByRole("button", { name: "Back" }).click();
    await expect(d.getByLabel("Territory")).toHaveValue("India");
    await d.getByRole("button", { name: "Continue" }).click();
    await d.getByRole("button", { name: "Activate" }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole("list", { name: "Rights events, newest first" })).toContainText("Editorial Use for Harbour Times recorded (active)");
  });

  test("another creator requests a license; the owner counters; the requester accepts", async ({ page: owner, creator, openContext, consoleGuard }) => {
    void creator;
    // Offering paid terms asks for the password: the first attempt answers 403 by design.
    consoleGuard.allow(/status of 403 \(Forbidden\) \(http:\/\/[^)]*\/api\/v1\/license-requests\//);
    const title = `Salt road ${uid()}`;
    const id = await publicPiece(owner, title);

    const { page: other } = await openContext("B");
    await newCreator(other);
    await other.goto(`/artifacts/${id}?tab=rights`);
    await other.getByRole("button", { name: "Request a license" }).click();
    const req = other.getByRole("dialog", { name: "Request a license" });
    await req.getByLabel("How would you like to use it?").fill("On the cover of our spring zine, credited.");
    await req.getByRole("button", { name: /Promotional use/ }).click();
    await req.getByRole("button", { name: "Continue" }).click();
    await req.getByRole("button", { name: "Continue" }).click();
    await req.getByRole("button", { name: "Continue" }).click();
    await expect(req.getByText("On the cover of our spring zine, credited.")).toBeVisible();
    await req.getByRole("button", { name: "Send request" }).click();
    await expect(other.getByText("Waiting for a reply")).toBeVisible();

    // The owner is notified and suggests paid terms (needs their password).
    await owner.goto(`/artifacts/${id}?tab=rights`);
    const requests = owner.getByRole("region", { name: "License requests" });
    await expect(requests).toContainText("On the cover of our spring zine, credited.");
    await requests.getByRole("button", { name: "Suggest other terms" }).click();
    const counter = owner.getByRole("dialog", { name: "Suggest other terms" });
    await counter.getByRole("button", { name: /Paid, non-exclusive/ }).click();
    await counter.getByRole("button", { name: "Continue" }).click();
    await counter.getByRole("button", { name: "Continue" }).click();
    await counter.getByLabel(/^Fee/).fill("2500");
    await counter.getByLabel("Currency").fill("INR");
    await counter.getByRole("button", { name: "Continue" }).click();
    await counter.getByRole("button", { name: "Send counter-offer" }).click();
    const stepUp = owner.getByRole("dialog", { name: "Confirm it's you" });
    await stepUp.getByLabel("Password").fill("e2e-password-0123456789");
    await stepUp.getByRole("button", { name: "Confirm" }).click();
    await expect(requests).toContainText("Waiting for");

    await other.reload();
    await expect(other.getByText("Promotional use · Paid, non-exclusive · INR 2,500")).toBeVisible();
    await other.getByRole("button", { name: "Accept these terms" }).click();
    await expect(other.getByText("Approved", { exact: true })).toBeVisible();

    await owner.reload();
    await expect(owner.getByRole("list", { name: "Rights events, newest first" })).toContainText("License request from");
  });
});
