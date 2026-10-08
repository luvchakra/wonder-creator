import { expect, newCreator, signUpViaUi, test, uniqueHandle } from "./fixtures";

// One screen (owner, 8 Oct 2026: "shorten the onboarding"): a name and a handle, then the studio.
test.describe("onboarding", () => {
  test("a new creator gives a name and a handle and is in; the rest waits in Settings", async ({ page, openContext }) => {
    // Someone else already owns a handle.
    const other = await openContext("other");
    const taken = await newCreator(other.page, { handlePrefix: "taken" });

    await signUpViaUi(page, "Maya Onboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Welcome to\s*Wonder Creator/);
    // No steps, no progress, no skip: one form.
    await expect(page.getByRole("list", { name: "Onboarding progress" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Skip|Next/ })).toHaveCount(0);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maya Onboard");
    const enter = page.getByRole("button", { name: /Enter your studio/ });
    const handle = page.getByLabel("Handle");
    await expect(enter).toBeDisabled();

    await handle.fill(taken.handle);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That handle is taken.");
    await expect(handle).toHaveAttribute("aria-invalid", "true");
    await expect(enter).toBeDisabled();
    await handle.fill("ab");
    await expect(enter).toBeDisabled();
    // Input is normalised to lowercase letters, numbers and underscores.
    const mine = uniqueHandle("maya");
    await handle.fill(`${mine.toUpperCase()}!!`);
    await expect(handle).toHaveValue(mine);
    await expect(page.getByText("Available ✓")).toBeVisible();
    await enter.click();

    // Straight to Home, which asks for one small thing.
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Maya");
    await expect(page.getByText("Begin with one small thing — a line is enough.")).toBeVisible();
    // Done: coming back redirects to Home.
    await page.goto("/onboarding");
    await expect(page).toHaveURL((u) => u.pathname === "/");

    // The profile has the name and handle; what else there is to say waits in Settings and teaches Creative Memory there.
    await page.goto("/me");
    await expect(page).toHaveURL(new RegExp(`/creators/${mine}$`));
    await expect(page.getByRole("heading", { name: "Maya Onboard" })).toBeVisible();
    await expect(page.getByText(`@${mine}`)).toBeVisible();
    expect((await page.request.put("/api/v1/creators/me/identity", { data: { disciplines: ["Poetry", "Filmmaking"], skills: [], interests: [] } })).ok()).toBe(true);
    expect((await page.request.put("/api/v1/creators/me/boundaries", { data: { preserve: ["My voice"], avoid: ["Rhyming couplets"], sensitive: [] } })).ok()).toBe(true);
    await page.goto("/memory");
    await expect(page.getByText("You work across poetry and filmmaking.")).toBeVisible();
    await expect(page.getByText("Avoid: Rhyming couplets.")).toBeVisible();
    await expect(page.getByText("Your profile answers").first()).toBeVisible();
    await expect(page.getByText(/^You prefer/)).toHaveCount(0);
  });
});
