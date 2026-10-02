import { accountMenu, expect, newCreator, test, uniqueHandle } from "./fixtures";

test.describe("creator identity & profile", () => {
  test("edit profile in Settings and see it on the profile page", async ({ page, creator }) => {
    await accountMenu(page, "Settings");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Account & Profile" })).toBeVisible();
    await expect(page.getByText(`Signed in as ${creator.email}`)).toBeVisible();

    const newHandle = uniqueHandle("renamed");
    await page.getByLabel("Name", { exact: true }).fill("Ada Lighthouse");
    await page.getByRole("textbox", { name: "Handle" }).fill(newHandle);
    await page.getByLabel("Short description").fill("Documentary filmmaker drawn to coastlines.");
    await page.getByRole("textbox", { name: "Location" }).fill("Kochi, India");
    await page.getByRole("switch", { name: "Show location on profile" }).click();
    await expect(page.getByRole("switch", { name: "Show location on profile" })).toHaveAttribute("aria-checked", "true");
    await page.getByLabel("Collaboration").selectOption({ label: "Selectively collaborating" });
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    // Creative identity: disciplines and a new skill.
    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Creative Identity" }).click();
    await expect(page.getByRole("heading", { name: "Creative Identity" })).toBeVisible();
    await page.getByRole("button", { name: "Documentary", exact: true }).click();
    await page.getByLabel("Skills").fill("Colour grading");
    await page.getByLabel("Skills").press("Enter");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    // The account menu reflects the new name and handle.
    await page.getByRole("button", { name: "Your account" }).click();
    await expect(page.getByRole("menu")).toContainText("Ada Lighthouse");
    await expect(page.getByRole("menu")).toContainText(`@${newHandle}`);
    await page.keyboard.press("Escape");

    // Profile page.
    await page.goto("/me");
    await expect(page).toHaveURL(new RegExp(`/creators/${newHandle}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Ada Lighthouse" })).toBeVisible();
    await expect(page.getByText(`@${newHandle}`)).toBeVisible();
    await expect(page.getByText("Documentary filmmaker drawn to coastlines.")).toBeVisible();
    await expect(page.getByText("Kochi, India")).toBeVisible();
    await expect(page.getByText("Selectively collaborating")).toBeVisible();
    await expect(page.getByText(/Documentary/).first()).toBeVisible();
    await expect(page.getByText("Colour grading", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/settings");

    // The old handle no longer resolves.
    await page.goto(`/creators/${creator.handle}`);
    await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
  });

  test("another creator sees the public profile without edit controls", async ({ page, creator, openContext }) => {
    const { page: other } = await openContext("B");
    await newCreator(other);
    await other.goto(`/creators/${creator.handle}`);
    await expect(other.getByRole("heading", { level: 1, name: creator.name })).toBeVisible();
    await expect(other.getByRole("link", { name: "Edit profile" })).toHaveCount(0);
    await expect(other.getByRole("button", { name: "Follow" })).toBeVisible();
    await other.getByRole("button", { name: "Follow" }).click();
    await expect(other.getByRole("button", { name: "Following" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  });
});
