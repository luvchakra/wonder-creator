import { expect, test } from "./fixtures";

test.describe("AI providers & BYOK", () => {
  test("shows what CreativeMind uses, explains data use, and never saves a rejected key", async ({ page, creator, consoleGuard }) => {
    void creator;
    // The rejected key answers 422 on purpose.
    consoleGuard.allow(/api\/v1\/ai\/keys.*422|422.*api\/v1\/ai\/keys/);
    await page.goto("/settings");
    await page.getByRole("link", { name: "AI Providers" }).click();
    await expect(page).toHaveURL(/\/settings\/ai$/);
    const status = page.getByRole("region", { name: "Status" });
    await expect(status).toContainText("CreativeMind uses");
    await expect(status).toContainText("Wonder Creator's provider");
    await expect(page.getByText(/never shown again after you save them/)).toBeVisible();

    const gemini = page.getByRole("region", { name: "Google Gemini" });
    await expect(gemini).toContainText("Not connected");
    await expect(gemini).toContainText("sends the material and Creations you work on");
    const field = gemini.getByLabel("Gemini API key");
    await expect(field).toHaveAttribute("type", "password");
    await field.fill("short");
    await expect(gemini.getByRole("button", { name: "Check and connect" })).toBeDisabled();

    // A key the provider rejects is never stored (when the provider can't be reached, it's saved as "not checked yet").
    await field.fill("AIzaSyInvalid-e2e-key-000000000");
    await gemini.getByRole("button", { name: "Check and connect" }).click();
    const outcome = gemini.getByRole("alert").or(gemini.getByRole("status"));
    await expect(outcome).toContainText(/didn't accept this key\. Nothing was saved\.|not checked yet/, { timeout: 20_000 });
    if (await gemini.getByRole("alert").count()) {
      await expect(gemini).toContainText("Not connected");
      await expect(field).toHaveValue("AIzaSyInvalid-e2e-key-000000000");
    } else {
      // Saved unchecked: only the hint is ever shown, and it can be removed.
      await expect(gemini).toContainText("…0000");
      await expect(gemini).not.toContainText("AIzaSyInvalid");
      await gemini.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("dialog", { name: "Remove your Google Gemini key?" }).getByRole("button", { name: "Remove key" }).click();
      await expect(gemini).toContainText("Not connected");
    }
  });
});
