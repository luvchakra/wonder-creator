import { artifactCard, expect, test } from "./fixtures";

test.describe("CreativeMind intent clarification", () => {
  test.beforeEach(({ creator }) => void creator);

  test("a clear request goes straight to a draft and says what it assumed", async ({ page }) => {
    await page.goto("/create");
    const talk = page.getByRole("region", { name: "meTalk" });
    await talk.getByLabel("What are you thinking about?").fill("Write a poem about rain on the harbour.");
    await talk.getByRole("button", { name: "Send", exact: true }).click();
    await expect(artifactCard(page)).toBeVisible({ timeout: 45_000 });
    await expect(talk.getByText(/^I assumed:/)).toBeVisible();
    await expect(talk.getByRole("form", { name: "What I understood" })).toHaveCount(0);
  });

  test("an open-ended request asks only what's missing; the creator's choices shape the draft", async ({ page }) => {
    await page.goto("/create");
    const talk = page.getByRole("region", { name: "meTalk" });
    await talk.getByLabel("What are you thinking about?").fill("Write a screenplay about the harbour and publish it to YouTube.");
    await talk.getByRole("button", { name: "Send", exact: true }).click();

    const card = talk.getByRole("form", { name: "What I understood" });
    await expect(card).toBeVisible({ timeout: 45_000 });
    await expect(card.getByLabel("Format")).toHaveValue("screenplay");
    await expect(card.getByRole("group", { name: "Length" })).toBeVisible();
    await expect(card.getByLabel("Who is it for?")).toHaveCount(0); // not asked for a screenplay
    // The consequential assumption must be confirmed first.
    const create = card.getByRole("button", { name: "Create with these choices" });
    await expect(create).toBeDisabled();
    await expect(card.getByRole("button", { name: "Use your judgment" })).toHaveCount(0);
    await card.getByLabel("Short").check();
    await card.getByText("I'll assume · adjust").click();
    await card.getByLabel("Experiment").check();
    await card.getByLabel(/Publishing is a separate step/).check();
    await create.click();

    await expect(talk.getByText("Let's make it: Screenplay · short · experimenting with my style")).toBeVisible({ timeout: 45_000 });
    await expect(artifactCard(page)).toBeVisible({ timeout: 45_000 });
    await expect(talk.getByText("Answered — I'm working from your choices.")).toBeVisible();

    // After a reload the question stays answered.
    await page.reload();
    await expect(talk.getByText("Answered — I'm working from your choices.")).toBeVisible();
  });
});
