import { DomainError } from "@wonder/core";
import { getConversation, huddleContext } from "@wonder/creator-community";
import { startHuddle } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/**
 * POST — "Start Huddle about this" (§14): a live Huddle with the conversation's title and a short context drawn only
 * from what the starter can read. Limited conversations stay invite-only (their people are invited); the Huddle is
 * linked back so the conversation shows it.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const cid = requireUuid(id, "conversation");
    const { replyIds } = z.object({ replyIds: z.array(z.string().uuid()).max(10).optional() }).parse(await readJson(req));
    const d = await getConversation(db, creatorId, cid);
    if (d.conversation.removedAt) throw new DomainError("not_found", "We couldn't find that conversation.");
    const chosen = replyIds?.length ? d.replies.filter((r) => replyIds.includes(r.id)).map((r) => r.body) : undefined;
    const ctx = huddleContext(d.conversation, d.replies, chosen);
    const limited = d.conversation.visibility === "limited";
    const invite = limited ? [...new Set([d.conversation.creatorId, ...d.invited.map((p) => p.id)])].filter((x) => x !== creatorId).slice(0, 20) : [];
    const huddleId = await startHuddle(db, { topic: ctx.topic, description: ctx.description || undefined, discoverability: limited ? "invite_only" : "public", invite });
    const { error } = await db.rpc("open_conversation_link", { p_conversation: cid, p_kind: "huddle", p_target: huddleId });
    if (error) throw new DomainError("internal", "The Huddle started, but we couldn't link it to the conversation.", { cause: error });
    return { huddleId };
  },
  { rateLimit: 6 },
);
