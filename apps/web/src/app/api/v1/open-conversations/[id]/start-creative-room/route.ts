import { DomainError } from "@wonder/core";
import { getConversation } from "@wonder/creator-community";
import { createProject } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/**
 * POST — "Start Creative Room" (§15) through the existing Projects domain: a Creative Room of the caller's own, briefed
 * from the conversation and linked back to it. People are invited from the Room as usual (no second collaboration model).
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId }, { id }) => {
    const cid = requireUuid(id, "conversation");
    const d = await getConversation(db, creatorId, cid);
    if (d.conversation.removedAt) throw new DomainError("not_found", "We couldn't find that conversation.");
    const brief = [`From the Open Conversation “${d.conversation.title}” started by ${d.author.name}.`, d.conversation.body?.trim()].filter(Boolean).join("\n\n").slice(0, 5000);
    const project = await createProject(db, creatorId, { title: d.conversation.title.slice(0, 120), brief });
    const { error } = await db.rpc("open_conversation_link", { p_conversation: cid, p_kind: "project", p_target: project.id });
    if (error) throw new DomainError("internal", "The Creative Room was made, but we couldn't link it to the conversation.", { cause: error });
    track("creative_room_from_conversation", creatorId);
    return { projectId: project.id };
  },
  { feature: "open_conversations_enabled", rateLimit: 6 },
);
