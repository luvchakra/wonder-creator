import { DomainError } from "@wonder/core";
import { createConversation } from "@wonder/creator-community";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

const schema = z.object({
  question: z.string().trim().min(3, "Ask a short question.").max(1000),
  intent: z.enum(["critique", "ask"]).default("critique"),
  visibility: z.enum(["community", "limited"]).default("community"),
  inviteHandles: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  fragment: z.object({ label: z.string().trim().min(1).max(60), text: z.string().trim().min(1, "Choose something to ask about.").max(1200), slideId: z.string().uuid().nullish() }),
});

/**
 * POST /api/v1/artifacts/:id/ask-community — "Ask Community" from a selected part of a Creation (Phase 04 §13). Only the
 * selected excerpt and the question are shared: the Open Conversation carries the excerpt and a pointer back to the
 * Creation, which stays private (readers can't open it). Only the Creation's owner can ask (the database checks).
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    await checkBudget(`community:start:${creatorId}`, 20);
    const b = schema.parse(await readJson(req, 20_000));
    const { data: a } = await db.from("artifacts").select("id, creator_id").eq("id", id).maybeSingle();
    if (!a || a.creator_id !== creatorId) throw new DomainError("not_found", "You can ask about your own Creations.");
    let invite: string[] = [];
    if (b.visibility === "limited" && b.inviteHandles?.length) {
      const { data } = await db.from("creators").select("id").in("handle", b.inviteHandles.map((h) => h.toLowerCase()));
      invite = (data ?? []).map((c) => c.id).filter((x) => x !== creatorId);
    }
    const q = b.question;
    const title = q.length <= 140 ? q : `${q.slice(0, 137).trimEnd()}…`;
    const conversation = await createConversation(db, creatorId, {
      title,
      body: q.length > 140 ? q : undefined,
      intent: b.intent,
      visibility: b.visibility,
      source: { type: "creation", id },
      fragment: b.fragment,
      invite,
    });
    return { conversation };
  },
  { rateLimit: 6 },
);
