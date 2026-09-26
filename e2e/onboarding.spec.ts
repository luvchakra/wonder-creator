import { expect, newCreator, signUpViaUi, test, uniqueHandle } from "./fixtures";

test.describe("onboarding", () => {
  test("a new creator walks every step, including skip and handle availability", async ({ page, openContext }) => {
    // Someone else already owns a handle.
    const other = await openContext("other");
    const taken = await newCreator(other.page, { handlePrefix: "taken" });

    await signUpViaUi(page, "Maya Onboard");

    // Welcome
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Welcome to\s*Wonder Creator/);
    await page.getByRole("button", { name: /Let's begin/ }).click();

    // About you
    await expect(page.getByRole("heading", { name: "Tell us about you" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Onboarding progress" }).locator('[aria-current="step"]')).toContainText("About you");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maya Onboard");
    // The first step can't be skipped.
    await expect(page.getByRole("button", { name: "Skip for now" })).toHaveCount(0);
    const next = page.getByRole("button", { name: "Next", exact: true });
    const handle = page.getByLabel("Handle");

    await handle.fill(taken.handle);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That handle is taken.");
    await expect(handle).toHaveAttribute("aria-invalid", "true");
    await expect(next).toBeDisabled();

    await handle.fill("ab");
    await expect(next).toBeDisabled();

    // Input is normalised to lowercase letters, numbers and underscores.
    const mine = uniqueHandle("maya");
    await handle.fill(`${mine.toUpperCase()}!!`);
    await expect(handle).toHaveValue(mine);
    await expect(page.getByText("Available ✓")).toBeVisible();
    await expect(next).toBeEnabled();

    await page.getByLabel("Short description").fill("Poet and filmmaker writing about the sea.");
    await expect(page.getByText("41/300")).toBeVisible();
    await page.getByLabel("Location (optional)").fill("Goa, India");
    await page.getByRole("checkbox", { name: "Show my location on my profile" }).check();
    await page.getByRole("button", { name: "Hindi", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hindi", exact: true })).toHaveAttribute("aria-pressed", "true");
    await next.click();

    // Your creative world
    await expect(page.getByRole("heading", { name: "Your creative world" })).toBeVisible();
    await page.getByRole("button", { name: "Poetry", exact: true }).click();
    await page.getByRole("button", { name: "Filmmaking", exact: true }).click();
    await expect(page.getByRole("button", { name: "Poetry", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Skills").fill("Editing");
    await page.getByLabel("Skills").press("Enter");
    await expect(page.getByRole("button", { name: "Remove Editing" })).toBeVisible();
    // Back keeps what was entered.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Tell us about you" })).toBeVisible();
    await expect(page.getByLabel("Handle")).toHaveValue(mine);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your creative world" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Style & voice: skipped
    await expect(page.getByRole("heading", { name: "How do you like to create?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();

    // Preferences
    await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
    await page.getByRole("button", { name: "+ My voice" }).first().click();
    await expect(page.getByRole("button", { name: "Remove My voice" })).toBeVisible();
    await page.getByLabel("Things to avoid").fill("Rhyming couplets");
    await page.getByLabel("Things to avoid").press("Enter");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // All set
    await expect(page.getByRole("heading", { name: "You're all set, Maya." })).toBeVisible();
    await page.getByRole("button", { name: /Enter your studio/ }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Maya");

    // Onboarding is done: going back redirects to Home.
    await page.goto("/onboarding");
    await expect(page).toHaveURL((u) => u.pathname === "/");

    // The profile reflects the answers.
    await page.goto("/profile");
    await expect(page).toHaveURL(new RegExp(`/creators/${mine}$`));
    await expect(page.getByRole("heading", { name: "Maya Onboard" })).toBeVisible();
    await expect(page.getByText(`@${mine}`)).toBeVisible();
    await expect(page.getByText("Poet and filmmaker writing about the sea.")).toBeVisible();
    await expect(page.getByText("Goa, India")).toBeVisible();
    await expect(page.getByText(/Poetry · Filmmaking|Filmmaking · Poetry/)).toBeVisible();
    await expect(page.getByText("Editing", { exact: true })).toBeVisible();

    // Creative Memory is seeded from the answers — and the skipped step added nothing.
    await page.goto("/memory");
    await expect(page.getByText("You work across poetry and filmmaking.")).toBeVisible();
    await expect(page.getByText("You create in English and Hindi.")).toBeVisible();
    await expect(page.getByText("Always preserve: My voice.")).toBeVisible();
    await expect(page.getByText("Avoid: Rhyming couplets.")).toBeVisible();
    await expect(page.getByText(/^You prefer/)).toHaveCount(0);
  });
});
