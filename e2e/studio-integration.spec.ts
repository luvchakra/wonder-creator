import type { Page } from "@playwright/test";
import { expect, newCreator, saveNote, test, uid } from "./fixtures";

// Phase 04 — CreativeStudio integration: Working Table + Community + DejaVu (docs/studio-integration.md).
const openTable = async (page: Page) => {
  await page.getByRole("button", { name: /^Working Table:/ }).click();
  return page.getByRole("dialog", { name: "Working Table" });
};
async function poem(page: Page, title: string, content = "") {
  const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title, content } })).json()).artifact as { id: string };
  const s = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()).workingSet as { sessionId: string };
  return { id: art.id, sessionId: s.sessionId };
}

test.describe("Studio integration", () => {
  test("Bring in → DejaVu: filter, pick some Moments, they wait on the table as Available; Explore in Studio keeps the rest one tap away", async ({ page, creator }) => {
    void creator;
    const tag = uid();
    const n1 = await saveNote(page, `Chai at Platform 3 ${tag}`);
    const n2 = await saveNote(page, `The night train's lights ${tag}`);
    const dv = (await (await page.request.post("/api/v1/dejavus", { data: { name: `Railways ${tag}`, attach: { entityType: "material", entityId: n1 } } })).json()).dejavu as { id: string };
    await page.request.post(`/api/v1/dejavus/${dv.id}/moments`, { data: { entityType: "material", entityId: n2 } });
    const art = await poem(page, `Platform ${tag}`);

    await page.goto(`/creations/${art.id}/studio`);
    const table = await openTable(page);
    await table.getByRole("button", { name: "Bring in" }).click();
    const bring = page.getByRole("dialog", { name: "Bring in" });
    await bring.getByRole("button", { name: /^DejaVu/ }).click();
    await bring.getByRole("list", { name: "DejaVus" }).getByRole("button", { name: new RegExp(`Railways ${tag}.*2 Moments`) }).click();
    await expect(bring.getByRole("radiogroup", { name: "Kind of Moment" }).getByRole("radio", { name: /Notes/ })).toBeVisible();
    await bring.getByRole("checkbox", { name: new RegExp(`Chai at Platform 3 ${tag}`) }).click();
    await bring.getByRole("button", { name: "Add to Studio" }).click();
    await expect(table.getByRole("tab", { name: /Available/ })).toHaveAttribute("aria-selected", "true");
    await expect(table.getByRole("list", { name: "Materials" })).toContainText(`Chai at Platform 3 ${tag}`);
    await expect(table.getByRole("list", { name: "Materials" })).not.toContainText(`The night train's lights ${tag}`);

    // From the DejaVu page: Explore in Studio — the DejaVu is available, nothing more is imported.
    await page.goto(`/dejavu/${dv.id}`);
    await page.getByRole("button", { name: "Explore in Studio" }).click();
    await page.getByRole("dialog", { name: "Explore in Studio" }).getByRole("button", { name: /In the Studio you were last in/ }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/(?:studio|write)`));
    const again = await openTable(page);
    await expect(again.getByRole("button", { name: new RegExp(`Railways ${tag} · 2 Moments available`) })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Working Table: 1 source/ })).toBeVisible();
  });

  test("someone's reply comes to the Studio as reference: it can steer, never be pasted in — and the server holds that line", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const art = await poem(page, `Silence ${tag}`, "Every Sunday my father waited.");
    await page.goto(`/creations/${art.id}/studio`); // the Studio A was last in
    const { page: b } = await openContext("B");
    await newCreator(b);
    const conv = (await (await b.request.post("/api/v1/open-conversations", { data: { intent: "discuss", title: `Pauses between images ${tag}` } })).json()).conversation.id as string;
    await b.request.post(`/api/v1/open-conversations/${conv}/replies`, { data: { body: `Treat each image like a pause ${tag}` } });

    await page.goto(`/pulse/conversations/${conv}`);
    await page.getByRole("button", { name: /More for .*'s reply/ }).click();
    await page.getByRole("menuitem", { name: "Use in Studio" }).click();
    await expect(page.getByRole("status").filter({ hasText: "On your Working Table." })).toBeVisible();
    await page.getByRole("link", { name: "Open Studio" }).click();
    const table = await openTable(page);
    await table.getByRole("tab", { name: /Available/ }).click();
    const card = table.getByRole("listitem").filter({ hasText: `Treat each image like a pause ${tag}` });
    await expect(card).toContainText("Reference only");
    await expect(card).toContainText("Thought from Pulse");
    const uses = card.getByRole("group");
    await expect(uses.getByRole("button", { name: "Use as creative direction" })).toBeVisible();
    await expect(uses.getByRole("button", { name: "Add to draft" })).toHaveCount(0);

    // The apply endpoint refuses to paste it even when asked directly.
    const ws = (await (await page.request.get(`/api/v1/studio-sessions/${art.sessionId}`)).json()).workingSet as { sources: Array<{ id: string; sourceType: string }> };
    const row = ws.sources.find((s) => s.sourceType === "conversation_reply")!;
    const refused = await page.request.post(`/api/v1/studio-sessions/${art.sessionId}/sources/${row.id}/apply`, { data: { action: "draft_words" } });
    expect(refused.status()).toBe(403);

    await uses.getByRole("button", { name: "Use as creative direction" }).click();
    await expect(page.getByText("It's steering the piece now.")).toBeVisible();
  });

  test("Ask Community about one part: only the excerpt is shared; the reply comes back to the Studio as feedback", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const art = await poem(page, `Private poem ${tag}`, `The train was always late ${tag}.\n\nThe second stanza stays private ${tag}.`);
    await page.goto(`/creations/${art.id}/studio`);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: /^Ask Pulse/ }).click();
    const ask = page.getByRole("dialog", { name: "Ask Pulse" });
    await expect(ask).toContainText("Selected: The opening");
    await expect(ask).toContainText(`The train was always late ${tag}.`);
    await expect(ask).not.toContainText("second stanza");
    await ask.getByLabel("Question").fill(`Does this line feel too literal ${tag}?`);
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(ask.getByText("Asked. Replies come back to your Working Table.")).toBeVisible();
    const convUrl = await ask.getByRole("link", { name: "See the conversation" }).getAttribute("href");

    const { page: b } = await openContext("B");
    await newCreator(b);
    await b.goto(convUrl!);
    await expect(b.getByRole("figure", { name: "What this is about" })).toContainText(`The train was always late ${tag}.`);
    await expect(b.getByText(`The second stanza stays private ${tag}`)).toHaveCount(0);
    await expect(b.getByText(/only this part is shared/)).toBeVisible();
    expect((await b.request.get(`/api/v1/artifacts/${art.id}`)).status()).toBe(404);
    await b.getByLabel("Your reply").fill(`Let the image do the work ${tag}`);
    await b.getByRole("button", { name: "Reply" }).click();
    await expect(b.getByRole("region", { name: "Replies" })).toContainText(`Let the image do the work ${tag}`);

    await page.goto(`/creations/${art.id}/studio`);
    await expect(page.getByRole("button", { name: /^Working Table:/ })).toContainText("1 new reply");
    const table = await openTable(page);
    await table.getByRole("button", { name: "1 response from Pulse · 1 new" }).click();
    const responses = page.getByRole("dialog", { name: "Responses from Pulse" });
    await expect(responses).toContainText("About The opening");
    await responses.getByRole("button", { name: "Use in Studio" }).click();
    await expect(responses.getByText(/on the Working Table as feedback/)).toBeVisible();
    await expect(responses.getByRole("button", { name: "On the table" })).toBeVisible();
  });

  test("the last opened source comes back on another device (the session remembers, not just this browser)", async ({ page, creator }) => {
    void creator;
    const tag = uid();
    const a = await saveNote(page, `Rain on the platform roof ${tag}`);
    const b = await saveNote(page, `The chai seller's radio ${tag}`);
    const art = await poem(page, `Platform ${tag}`);
    await page.request.post(`/api/v1/studio-sessions/${art.sessionId}/sources`, {
      data: {
        items: [
          { type: "material", id: a },
          { type: "material", id: b },
        ],
      },
    });
    await page.goto(`/creations/${art.id}/studio`);
    let panel = await openTable(page);
    const radio = panel.locator("li > button[aria-expanded]").filter({ hasText: "The chai seller's radio" });
    await radio.click();
    await expect(radio).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => ((await (await page.request.get(`/api/v1/studio-sessions/${art.sessionId}`)).json()).workingSet as { lastOpenedSourceId: string | null }).lastOpenedSourceId).not.toBeNull();
    // A fresh browser: no local memory at all.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    panel = await openTable(page);
    await expect(panel.locator("li > button[aria-expanded]").filter({ hasText: "The chai seller's radio" })).toHaveAttribute("aria-expanded", "true");
  });
});
