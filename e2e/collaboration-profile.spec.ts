import { expect, newCreator, test } from "./fixtures";

test.describe("Collaboration profile", () => {
  test("say how you collaborate; others see it, and your rate only when you choose", async ({ page, creator, openContext }) => {
    await page.goto("/settings?section=collaboration");
    await expect(page.getByRole("heading", { name: "Collaboration", level: 2 })).toBeVisible();
    await page.getByLabel("Project types you'd like").fill("Short film");
    await page.getByLabel("Project types you'd like").press("Enter");
    await page.getByLabel("Where you work").selectOption("remote");
    await page.getByLabel("Typical turnaround (optional)").fill("About two weeks");
    await page.getByLabel("Commercial boundaries (optional)").fill("No gambling brands.");
    // No rate yet, so there's nothing to show anyone.
    await expect(page.getByLabel("Who sees your rate guidance")).toBeDisabled();
    await page.getByLabel("Rate guidance (optional)").fill("From ₹40,000 per short");
    await expect(page.getByLabel("Who sees your rate guidance")).toHaveValue("private");
    await page.getByRole("button", { name: "Save collaboration profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Collaboration profile saved." })).toBeVisible();

    // Your own profile shows it, rate included (it's yours).
    await page.goto(`/creators/${creator.handle}`);
    const mine = page.getByRole("region", { name: "How you collaborate" });
    await expect(mine).toContainText("Short film");
    await expect(mine).toContainText("From ₹40,000 per short");

    // Someone else sees the profile but not the private rate.
    const { page: other } = await openContext("other");
    await newCreator(other);
    await other.goto(`/creators/${creator.handle}`);
    const theirs = other.getByRole("region", { name: "How I collaborate" });
    await expect(theirs).toContainText("Remote");
    await expect(theirs).toContainText("About two weeks");
    await expect(theirs).toContainText("No gambling brands.");
    await expect(theirs).not.toContainText("₹40,000");

    // Shown to everyone once the creator chooses that.
    await page.goto("/settings?section=collaboration");
    await page.getByLabel("Who sees your rate guidance").selectOption("public");
    await page.getByRole("button", { name: "Save collaboration profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Collaboration profile saved." })).toBeVisible();
    await other.reload();
    await expect(other.getByRole("region", { name: "How I collaborate" })).toContainText("From ₹40,000 per short");
  });
});
