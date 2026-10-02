import { accountMenu, expect, test } from "./fixtures";

test.describe("Security & activity", () => {
  test("summary, plain-language history with detail, filters and CSV export", async ({ page, creator }) => {
    void creator;
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: "Harbour notes" } });
    const id = (await res.json()).artifact.id as string;
    expect((await page.request.post(`/api/v1/artifacts/${id}/shares`, { data: { kind: "link" } })).ok()).toBe(true);

    await accountMenu(page, "Settings");
    await page.getByRole("button", { name: "Privacy & Security" }).click();
    await page.getByRole("link", { name: /Security & activity/ }).click();
    await expect(page).toHaveURL(/\/settings\/audit$/);

    // Summary cards, then the chronological list.
    const summary = page.getByRole("list", { name: "Summary" });
    await expect(summary).toContainText("Last sign-in");
    await expect(summary).toContainText("Live shares1");
    const activity = page.getByRole("list", { name: "Activity" });
    await expect(activity).toContainText("Signed in");
    const link = activity.getByRole("listitem").filter({ hasText: "Made a private link" });
    await expect(link).toContainText("Creation: Harbour notes");
    await link.getByText("Made a private link").click();
    await expect(link.getByText("Downloads allowed")).toBeVisible();
    await expect(link.getByRole("link", { name: "Open Creation" })).toHaveAttribute("href", `/creations/${id}`);

    // Filters live in a sheet.
    await page.getByRole("button", { name: /^Filter/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filter activity" });
    await sheet.getByText("Sign-in & security", { exact: true }).click();
    await sheet.getByRole("button", { name: "Show results" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Showing Sign-in & security" })).toBeVisible();
    await expect(activity).not.toContainText("Made a private link");
    await expect(activity).toContainText("Signed in");

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toBe("wonder-creator-activity.csv");
  });
});
