import { accountMenu, expect, test, uid, type Page } from "./fixtures";

// The profile answers fixtures.onboardViaApi fills in under Settings produce these memories.
const PROFILE_MEMORIES = [
  "You work across writing and poetry.",
  "You prefer warm tone and narrative writing.",
  "Your visual style leans cinematic.",
  "Always preserve: My voice.",
  "Avoid: Clichés.",
];

function memoryCard(page: Page, text: string) {
  return page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: text });
}

test.describe("Creative Memory", () => {
  test.beforeEach(({ creator }) => void creator);

  test("profile memories are visible; add, edit and remove a memory", async ({ page }) => {
    await accountMenu(page, "Creative Memory");
    await expect(page).toHaveURL(/\/memory$/);
    await expect(page.getByRole("heading", { name: "Creative Memory" })).toBeVisible();
    for (const m of PROFILE_MEMORIES) {
      await expect(memoryCard(page, m)).toBeVisible();
      await expect(memoryCard(page, m)).toContainText("Your profile answers");
    }
    await expect(page.getByRole("tab", { name: `All (${PROFILE_MEMORIES.length})` })).toHaveAttribute("aria-selected", "true");

    // Add
    const statement = `I always start from a single sound ${uid()}.`;
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const add = page.getByRole("dialog", { name: "Add a memory" });
    await add.getByLabel("Memory").fill(statement);
    await add.getByLabel("Kind").selectOption({ label: "About me" });
    await add.getByRole("button", { name: "Save" }).click();
    await expect(add).toBeHidden();
    await expect(memoryCard(page, statement)).toContainText("Added by you");
    await expect(page.getByRole("tab", { name: `All (${PROFILE_MEMORIES.length + 1})` })).toBeVisible();
    // It is filed under About Me.
    await page.getByRole("tab", { name: "About Me" }).click();
    await expect(memoryCard(page, statement)).toBeVisible();
    await page.getByRole("tab", { name: /^All/ }).click();

    // Edit
    const edited = statement.replace("a single sound", "one remembered sound");
    await memoryCard(page, statement).getByRole("button", { name: "Edit memory" }).click();
    const edit = page.getByRole("dialog", { name: "Edit memory" });
    await expect(edit.getByLabel("Memory")).toHaveValue(statement);
    await edit.getByLabel("Memory").fill(edited);
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();
    await expect(memoryCard(page, edited)).toBeVisible();
    await expect(memoryCard(page, statement)).toHaveCount(0);

    // Remove (with confirmation)
    await memoryCard(page, "Avoid: Clichés.").getByRole("button", { name: "Remove memory" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove this memory?" });
    await expect(confirm).toContainText("CreativeMind will stop using: “Avoid: Clichés.”");
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(memoryCard(page, "Avoid: Clichés.")).toHaveCount(0);

    await page.reload();
    await expect(memoryCard(page, edited)).toBeVisible();
    await expect(memoryCard(page, "Avoid: Clichés.")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: `All (${PROFILE_MEMORIES.length})` })).toBeVisible();
  });

  test("“That's not how I write.” in meTalk corrects Creative Memory", async ({ page }) => {
    await page.goto("/create");
    const talk = page.getByRole("region", { name: "meTalk" });
    await talk.getByLabel("What are you thinking about?").fill("That's not how I write.");
    await talk.getByRole("button", { name: "Send", exact: true }).click();
    await expect(talk.getByText(/Thank you — I've let go of (that note|those notes) about your style and kept your words instead\./)).toBeVisible({ timeout: 30_000 });
    await talk.getByRole("link", { name: "Review Creative Memory" }).click();

    await expect(page).toHaveURL(/\/memory$/);
    const correction = memoryCard(page, "In your words: “That's not how I write.”");
    await expect(correction).toBeVisible();
    await expect(correction).toContainText("Your correction in meTalk");
    // Style/voice memories CreatorBrain inferred were let go (two of them at most); facts stay.
    const styleMemories = PROFILE_MEMORIES.slice(1);
    let remaining = 0;
    for (const m of styleMemories) remaining += await memoryCard(page, m).count();
    expect(remaining).toBe(styleMemories.length - 2);
    await expect(memoryCard(page, "You work across writing and poetry.")).toBeVisible();
  });
});
