import { DomainError } from "@wonder/core";
import { canAddToConversation, getConversation, huddleContext, topicCommunities } from "@wonder/creator-community";
import { startHuddle } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/**
 * POST — "Start Huddle about this" (§14): a live Huddle with the conversation's title and a short context drawn only
 * from what the starter can read. Limited conversations stay invite-only (their people are invited), and so do topics
 * of an Unlisted or Private community (the topic's people are invited); only members start one from a community topic.
 * The Huddle is linked back so the conversation shows it.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const cid = requireUuid(id, "conversation");
    const { replyIds } = z.object({ replyIds: z.array(z.string().uuid()).max(10).optional() }).parse(await readJson(req));
    const d = await getConversation(db, creatorId, cid);
    if (d.conversation.removedAt) throw new DomainError("not_found", "We couldn't find that conversation.");
    if (!(await canAddToConversation(db, cid))) throw new DomainError("forbidden", "Join the community to start a Huddle about this topic.");
    const closedCommunity = (await topicCommunities(db, cid)).some((c) => c.privacy !== "public");
    const chosen = replyIds?.length ? d.replies.filter((r) => replyIds.includes(r.id)).map((r) => r.body) : undefined;
    const ctx = huddleContext(d.conversation, d.replies, chosen);
    const limited = d.conversation.visibility === "limited" || closedCommunity;
    const people = closedCommunity ? d.replies.map((r) => r.creatorId) : d.invited.map((p) => p.id);
    const invite = limited ? [...new Set([d.conversation.creatorId, ...people])].filter((x) => x !== creatorId).slice(0, 20) : [];
    const huddleId = await startHuddle(db, { topic: ctx.topic, description: ctx.description || undefined, discoverability: limited ? "invite_only" : "public", invite });
    const { error } = await db.rpc("open_conversation_link", { p_conversation: cid, p_kind: "huddle", p_target: huddleId });
    if (error) throw new DomainError("internal", "The Huddle started, but we couldn't link it to the conversation.", { cause: error });
    track(db, "huddle_from_conversation", creatorId);
    return { huddleId };
  },
  { feature: "open_conversations_enabled", rateLimit: 6 },
);
