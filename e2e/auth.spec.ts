import { accountMenu, expect, signInViaUi, test } from "./fixtures";

test.describe("authentication", () => {
  test("signed-out visitors are sent to sign in", async ({ page }) => {
    await page.goto("/materials");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("wrong password shows a readable error", async ({ page, creator, consoleGuard }) => {
    // The rejected password grant is an expected 400 from Supabase Auth, logged by Chromium.
    consoleGuard.allow(/status of 400 .*\/auth\/v1\/token\?grant_type=password/);
    await accountMenu(page, "Sign out");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.getByLabel("Email").fill(creator.email);
    await page.getByLabel("Password").fill("definitely-not-it");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That email and password don't match. Try again.");
  });

  test("sign out, then sign back in", async ({ page, creator }) => {
    await accountMenu(page, "Sign out");
    await expect(page).toHaveURL(/\/sign-in$/);
    // The session is really gone: protected pages redirect.
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in/);

    await signInViaUi(page, creator, /^\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(creator.firstName);
    await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  });
});
