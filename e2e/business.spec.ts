import { expect, test } from "./fixtures";

test.describe("CreatorBusiness", () => {
  test("records income and costs per currency; the creator settles and removes their own entries", async ({ page, creator }) => {
    void creator;
    await page.goto("/");
    await page.getByRole("button", { name: "Your account" }).click();
    await page.getByRole("menuitem", { name: "Business" }).click();
    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByText("No records yet")).toBeVisible();

    await page.getByRole("button", { name: "Add record" }).first().click();
    const add = page.getByRole("dialog", { name: "Add a record" });
    await add.getByLabel("Amount").fill("5000");
    await add.getByLabel("Currency").fill("INR");
    await add.getByLabel("From (optional)").fill("Chai Co");
    await add.getByRole("button", { name: "Add record" }).click();
    const records = page.getByRole("list", { name: "Records" });
    await expect(records.getByRole("listitem").first()).toContainText("Brand income · Chai Co");
    await expect(records.getByRole("listitem").first()).toContainText("Expected");

    await page.getByRole("button", { name: "Add record" }).first().click();
    await add.getByLabel("What is it?").selectOption("provider_cost");
    await add.getByLabel("Amount").fill("20");
    await add.getByLabel("Currency").fill("USD");
    await add.getByRole("switch", { name: "Already paid" }).click();
    await add.getByRole("button", { name: "Add record" }).click();

    // Totals per currency, never combined.
    const totals = page.getByRole("region", { name: "Totals" });
    await expect(totals).toContainText("INR");
    await expect(totals).toContainText("USD");
    await expect(totals).toContainText("Paid out $20.00");

    await records.getByRole("button", { name: /More for Brand income/ }).click();
    await page.getByRole("menuitem", { name: "Mark received" }).click();
    await expect(records.getByRole("listitem").filter({ hasText: "Chai Co" })).toContainText("Received");
    await page.reload();
    await expect(page.getByRole("region", { name: "Totals" })).toContainText("Received ₹5,000.00");

    await page.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "Costs & payouts" }).click();
    await expect(records.getByRole("listitem")).toHaveCount(1);
    await records.getByRole("button", { name: /More for Tools & providers/ }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Nothing here for this filter.")).toBeVisible();
  });
});
