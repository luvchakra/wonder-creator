import { adminInsert, adminPatch, creatorIdOf, expect, newCreator, saveNote, test, uid } from "./fixtures";

// Phase 05 — CreativeMind orchestration (docs/creativemind-orchestration.md).
test.describe("CreativeMind orchestration", () => {
  test("Your world is connecting: a found connection says why it's here, and a dismissal is final", async ({ page, creator }) => {
    const tag = `waiting${uid().slice(0, 6)}`.toLowerCase();
    const me = await creatorIdOf(creator.id);
    const old = await saveNote(page, `An old note about the bench ${uid()}`);
    const fresh = await saveNote(page, `A new note about the same bench ${uid()}`);
    await adminPatch("moment_references", `entity_id=eq.${old}`, { occurred_at: new Date(Date.now() - 200 * 86_400_000).toISOString() });
    await adminInsert("creative_material_tags", [
      { material_id: old, creator_id: me, tag },
      { material_id: fresh, creator_id: me, tag },
    ]);

    // Home answers first; CreativeMind looks afterwards, so the connection shows on the next visit.
    await page.goto("/");
    await expect
      .poll(
        async () => {
          await page.goto("/");
          return page.getByRole("region", { name: "Your world is connecting" }).count();
        },
        { timeout: 45_000, intervals: [2_000, 4_000] },
      )
      .toBe(1);
    const card = page.getByRole("region", { name: "Your world is connecting" });
    await expect(card).toContainText(`are both about “${tag}”`);
    await expect(card).not.toContainText("%");
    await card.getByRole("button", { name: "Why am I seeing this?" }).click();
    await expect(card.getByRole("list", { name: "Why this connection" })).toContainText(`Both are tagged “${tag}”`);
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Okay — it won't come back.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Your world is connecting" }).filter({ hasText: tag })).toHaveCount(0);
  });

  test("Conversation so far: points link to the replies they come from; a summary that fell behind says so", async ({ page, creator, openContext }) => {
    void creator;
    const tag = uid();
    const id = (await (await page.request.post("/api/v1/open-conversations", { data: { intent: "discuss", title: `How much text on a slide ${tag}?` } })).json()).conversation.id as string;
    const { page: b } = await openContext("B");
    await newCreator(b);
    const r1 = (await (await b.request.post(`/api/v1/open-conversations/${id}/replies`, { data: { body: "One line at most." } })).json()).reply.id as string;
    const r2 = (await (await b.request.post(`/api/v1/open-conversations/${id}/replies`, { data: { body: "Two lines if the image is quiet." } })).json()).reply.id as string;
    await adminInsert("open_conversation_summaries", {
      conversation_id: id,
      points: [
        { text: "Most prefer a single line per slide.", replyIds: [r1] },
        { text: "A few allow two when the image is quiet.", replyIds: [r2] },
      ],
      reply_count_at: 2,
    });
    await page.goto(`/community/conversations/${id}`);
    const so = page.getByRole("region", { name: "Conversation so far" });
    await expect(so).toContainText("Most prefer a single line per slide.");
    await expect(so).not.toContainText("Summary from earlier");
    await so.getByRole("link", { name: "See the reply" }).first().click();
    await expect(page).toHaveURL(new RegExp(`#reply-${r1}$`));

    // Four more replies later, the summary is marked as from earlier.
    for (let i = 0; i < 4; i++) await b.request.post(`/api/v1/open-conversations/${id}/replies`, { data: { body: `Another view ${i}` } });
    await page.reload();
    await expect(so).toContainText("Summary from earlier · 4 newer replies below");
  });
});
