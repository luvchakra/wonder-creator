import { DomainError, fromDbError, must } from "@wonder/core";
import { liveCards } from "@wonder/creator-huddle";
import { createMaterial } from "@wonder/creator-library";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";
import { CONVERSATION_INTENTS, CONVERSATION_VISIBILITIES, type ConversationIntent, type ConversationVisibility, type Person } from "./shared";

type Row = Tables<"open_conversations">;
type ReplyRow = Tables<"open_conversation_replies">;

export interface OpenConversation {
  id: string;
  creatorId: string;
  title: string;
  body: string | null;
  intent: ConversationIntent;
  visibility: ConversationVisibility;
  sourceEntityType: "material" | "creation" | null;
  sourceEntityId: string | null;
  /** Ask Community (Phase 04 §13): the only part of a private Creation that is shared — a slide's words, a passage. */
  sourceFragment: SourceFragment | null;
  replyCount: number;
  participantCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  removedAt: string | null;
}

export interface SourceFragment {
  /** "Slide 3", "Opening", "A passage". */
  label: string;
  /** The excerpt itself (the owner's own words). */
  text: string;
  /** The slide it came from, for the owner's way back (never shown to others). */
  slideId?: string | null;
}

export interface OpenConversationReply {
  id: string;
  conversationId: string;
  creatorId: string;
  body: string;
  attachmentType: "material" | "creation" | null;
  attachmentEntityId: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  removed: boolean;
}

export const toConversation = (r: Row): OpenConversation => ({
  id: r.id,
  creatorId: r.creator_id,
  title: r.title,
  body: r.body,
  intent: r.intent as ConversationIntent,
  visibility: r.visibility as ConversationVisibility,
  sourceEntityType: r.source_entity_type as OpenConversation["sourceEntityType"],
  sourceEntityId: r.source_entity_id,
  sourceFragment: (r.source_fragment as SourceFragment | null) ?? null,
  replyCount: r.reply_count,
  participantCount: r.participant_count,
  lastReplyAt: r.last_reply_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  closedAt: r.closed_at,
  removedAt: r.removed_at,
});
const toReply = (r: ReplyRow): OpenConversationReply => ({
  id: r.id,
  conversationId: r.conversation_id,
  creatorId: r.creator_id,
  body: r.deleted_at || r.removed_at ? "" : r.body,
  attachmentType: r.attachment_type as OpenConversationReply["attachmentType"],
  attachmentEntityId: r.attachment_entity_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deleted: !!r.deleted_at,
  removed: !!r.removed_at,
});

/** Names for a set of creators, through the viewer's own access (someone they can't see stays "A creator"). */
export async function peopleById(db: Db, ids: string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, Person>();
  if (!unique.length) return out;
  const { data } = await db.from("creators").select("id, display_name, handle").in("id", unique);
  for (const c of data ?? []) out.set(c.id, { id: c.id, name: c.display_name || "Creator", handle: c.handle });
  for (const id of unique) if (!out.has(id)) out.set(id, { id, name: "A creator", handle: null });
  return out;
}

export const conversationSchema = z.object({
  title: z.string().trim().min(3, "Give it a short title.").max(140, "Keep the title under 140 characters."),
  body: z.string().trim().max(5000).optional(),
  intent: z.enum(CONVERSATION_INTENTS),
  visibility: z.enum(CONVERSATION_VISIBILITIES).default("community"),
  source: z.object({ type: z.enum(["material", "creation"]), id: z.string().uuid() }).optional(),
  /** Only with `source`: the excerpt of it being asked about (Ask Community). */
  fragment: z
    .object({ label: z.string().trim().min(1).max(60), text: z.string().trim().min(1, "Choose something to ask about.").max(1200), slideId: z.string().uuid().nullish() })
    .optional(),
  /** Limited: who else may see it (creator ids). */
  invite: z.array(z.string().uuid()).max(20).optional(),
});
export const updateConversationSchema = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  body: z.string().trim().max(5000).nullable().optional(),
  intent: z.enum(CONVERSATION_INTENTS).optional(),
  visibility: z.enum(CONVERSATION_VISIBILITIES).optional(),
});
export const replySchema = z.object({
  body: z.string().trim().min(1, "Write a reply first.").max(4000),
  attachment: z.object({ type: z.enum(["material", "creation"]), id: z.string().uuid() }).optional(),
});

export async function createConversation(db: Db, creatorId: string, raw: unknown): Promise<OpenConversation> {
  const input = conversationSchema.parse(raw);
  const { data, error } = await db
    .from("open_conversations")
    .insert({
      creator_id: creatorId,
      title: input.title,
      body: input.body || null,
      intent: input.intent,
      visibility: input.visibility,
      source_entity_type: input.source?.type ?? null,
      source_entity_id: input.source?.id ?? null,
      source_fragment: input.source && input.fragment ? (input.fragment as never) : null,
    })
    .select("*")
    .single();
  if (error) throw error.code === "42501" ? new DomainError("forbidden", "You can only start a conversation about your own Material or Creation.") : fromDbError(error);
  if (input.visibility === "limited" && input.invite?.length) await inviteToConversation(db, data.id, input.invite);
  return toConversation(data);
}

/** Limited conversations: add people (only people you may see, never across a block — the database checks). */
export async function inviteToConversation(db: Db, conversationId: string, creatorIds: string[]): Promise<number> {
  let added = 0;
  for (const id of [...new Set(creatorIds)].slice(0, 20)) {
    const { error } = await db.from("open_conversation_invites").insert({ conversation_id: conversationId, creator_id: id });
    if (!error) added++;
    else if (error.code !== "23505" && error.code !== "42501") throw fromDbError(error);
  }
  return added;
}

export async function updateConversation(db: Db, id: string, raw: unknown): Promise<OpenConversation> {
  const input = updateConversationSchema.parse(raw);
  const patch: Partial<Pick<Row, "title" | "body" | "intent" | "visibility">> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body || null;
  if (input.intent !== undefined) patch.intent = input.intent;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  const res = await db.from("open_conversations").update(patch).eq("id", id).select("*");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "Only the person who started a conversation can change it.");
  return toConversation(res.data[0]!);
}

/** Close (no new replies; everything stays readable) or reopen. Owner only. */
export async function setConversationClosed(db: Db, id: string, closed: boolean): Promise<OpenConversation> {
  const res = await db
    .from("open_conversations")
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "Only the person who started a conversation can close it.");
  return toConversation(res.data[0]!);
}

export async function deleteConversation(db: Db, id: string): Promise<void> {
  const res = await db.from("open_conversations").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "Only the person who started a conversation can delete it.");
}

export async function replyToConversation(db: Db, creatorId: string, conversationId: string, raw: unknown): Promise<OpenConversationReply> {
  const input = replySchema.parse(raw);
  const { data, error } = await db
    .from("open_conversation_replies")
    .insert({
      conversation_id: conversationId,
      creator_id: creatorId,
      body: input.body,
      attachment_type: input.attachment?.type ?? null,
      attachment_entity_id: input.attachment?.id ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "42501") {
      const { data: c } = await db.from("open_conversations").select("closed_at").eq("id", conversationId).maybeSingle();
      throw new DomainError("forbidden", c?.closed_at ? "This conversation is closed to new replies." : "You can't reply here.");
    }
    throw fromDbError(error);
  }
  await markRead(db, creatorId, conversationId);
  return toReply(data);
}

/** Take your own reply back (soft delete: the thread keeps its shape). */
export async function deleteOwnReply(db: Db, replyId: string): Promise<void> {
  const res = await db.from("open_conversation_replies").update({ deleted_at: new Date().toISOString() }).eq("id", replyId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "You can only delete your own reply.");
}

/** The conversation's owner, or a moderator, removes a reply (audited in the database). */
export async function removeReply(db: Db, replyId: string, reason?: string): Promise<void> {
  const { error } = await db.rpc("open_conversation_remove_reply", { p_reply: replyId, p_reason: reason ?? undefined });
  if (error) throw error.code === "42501" ? new DomainError("forbidden", "Only the conversation's owner or a moderator can remove a reply.") : fromDbError(error);
}

/** A platform moderator removes (or restores) a conversation (audited in the database). */
export async function moderateConversation(db: Db, id: string, remove: boolean, reason?: string): Promise<void> {
  const { error } = await db.rpc("open_conversation_moderate", { p_conversation: id, p_remove: remove, p_reason: reason ?? undefined });
  if (error) throw error.code === "42501" ? new DomainError("forbidden", "Only a moderator can do that.") : fromDbError(error);
}

export async function markRead(db: Db, creatorId: string, conversationId: string): Promise<void> {
  await db.from("open_conversation_reads").upsert({ conversation_id: conversationId, creator_id: creatorId, last_read_at: new Date().toISOString() });
}

export interface ConversationDetail {
  conversation: OpenConversation;
  author: Person;
  replies: Array<OpenConversationReply & { author: Person }>;
  /** Since the viewer last read it (§13); null on a first read or when nothing is new. */
  catchUp: { since: string; newReplies: number; newParticipants: number; byKnown: number } | null;
  links: Array<{ kind: "huddle" | "project"; id: string; title: string | null; live: boolean; startedBy: string }>;
  /** Moments kept from Huddles that grew out of this conversation — the viewer's own preserved items. */
  preservedFromHuddles: number;
  isOwner: boolean;
  isModerator: boolean;
  invited: Person[];
}

/** One conversation as the viewer may see it. Marks nothing as read (the page does that after showing catch-up). */
export async function getConversation(db: Db, viewerId: string, id: string): Promise<ConversationDetail> {
  const c = must(await db.from("open_conversations").select("*").eq("id", id).maybeSingle(), "We couldn't find that conversation.");
  const [{ data: replies }, { data: read }, { data: links }, { data: mod }, { data: invites }] = await Promise.all([
    db.from("open_conversation_replies").select("*").eq("conversation_id", id).order("created_at").limit(500),
    db.from("open_conversation_reads").select("last_read_at").eq("conversation_id", id).eq("creator_id", viewerId).maybeSingle(),
    db.from("open_conversation_links").select("kind, huddle_id, project_id, started_by, created_at").eq("conversation_id", id).order("created_at"),
    db.from("platform_moderators").select("creator_id").eq("creator_id", viewerId).maybeSingle(),
    c.creator_id === viewerId ? db.from("open_conversation_invites").select("creator_id").eq("conversation_id", id) : Promise.resolve({ data: [] as Array<{ creator_id: string }> }),
  ]);
  const people = await peopleById(db, [c.creator_id, ...(replies ?? []).map((r) => r.creator_id), ...(invites ?? []).map((i) => i.creator_id)]);
  const live = (replies ?? []).filter((r) => !r.deleted_at && !r.removed_at);

  let catchUp: ConversationDetail["catchUp"] = null;
  if (read?.last_read_at) {
    const since = read.last_read_at;
    const fresh = live.filter((r) => r.created_at > since && r.creator_id !== viewerId);
    const before = new Set(live.filter((r) => r.created_at <= since).map((r) => r.creator_id).concat(c.creator_id));
    if (fresh.length) {
      const known = await knownCollaborators(db, viewerId, [...new Set(fresh.map((r) => r.creator_id))]);
      catchUp = {
        since,
        newReplies: fresh.length,
        newParticipants: new Set(fresh.map((r) => r.creator_id).filter((x) => !before.has(x))).size,
        byKnown: fresh.filter((r) => known.has(r.creator_id)).length,
      };
    }
  }

  const huddleIds = (links ?? []).map((l) => l.huddle_id).filter((x): x is string => !!x);
  const projectIds = (links ?? []).map((l) => l.project_id).filter((x): x is string => !!x);
  const [{ data: huddles }, { data: projects }, preserved] = await Promise.all([
    // Huddles are ephemeral and private by design: whether one is live (and its topic) comes from the live cards the
    // viewer is allowed to see; anything else reads as ended.
    huddleIds.length ? liveCards(db, { limit: 50 }).then((cards) => ({ data: cards.filter((h) => huddleIds.includes(h.huddleId)).map((h) => ({ id: h.huddleId, topic: h.topic, status: "live" })) })).catch(() => ({ data: [] as Array<{ id: string; topic: string | null; status: string }> })) : Promise.resolve({ data: [] as Array<{ id: string; topic: string | null; status: string }> }),
    projectIds.length ? db.from("projects").select("id, title").in("id", projectIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    huddleIds.length ? db.from("huddle_preserved_items").select("id", { count: "exact", head: true }).in("huddle_id", huddleIds).eq("creator_id", viewerId) : Promise.resolve({ count: 0 }),
  ]);
  return {
    conversation: toConversation(c),
    author: people.get(c.creator_id)!,
    replies: (replies ?? []).filter((r) => !(r.deleted_at || r.removed_at) || r.creator_id === viewerId).map((r) => ({ ...toReply(r), author: people.get(r.creator_id)! })),
    catchUp,
    links: (links ?? []).map((l) => {
      if (l.kind === "huddle") {
        const h = (huddles ?? []).find((x) => x.id === l.huddle_id);
        return { kind: "huddle" as const, id: l.huddle_id!, title: h?.topic ?? null, live: h?.status === "live", startedBy: l.started_by };
      }
      return { kind: "project" as const, id: l.project_id!, title: (projects ?? []).find((x) => x.id === l.project_id)?.title ?? null, live: false, startedBy: l.started_by };
    }),
    preservedFromHuddles: preserved.count ?? 0,
    isOwner: c.creator_id === viewerId,
    isModerator: !!mod,
    invited: (invites ?? []).map((i) => people.get(i.creator_id)!),
  };
}

/** People the viewer has worked with: a shared crew or a Creation they contributed to. */
export async function knownCollaborators(db: Db, viewerId: string, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const [{ data: mine }, { data: contrib }] = await Promise.all([
    db.from("crew_members").select("crew_id").eq("creator_id", viewerId).eq("status", "active"),
    db.from("artifact_contributors").select("contributor_creator_id, artifacts!inner(creator_id)").in("contributor_creator_id", ids).eq("artifacts.creator_id", viewerId),
  ]);
  for (const c of contrib ?? []) out.add(c.contributor_creator_id);
  const crews = (mine ?? []).map((m) => m.crew_id);
  if (crews.length) {
    const { data: mates } = await db.from("crew_members").select("creator_id").in("crew_id", crews).in("creator_id", ids).eq("status", "active");
    for (const m of mates ?? []) out.add(m.creator_id);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ Conversions (§14–15) */

/** What a Huddle about this conversation starts with: its title, and a short context from what the starter can read. */
export function huddleContext(c: Pick<OpenConversation, "title" | "body">, replies: Array<Pick<OpenConversationReply, "body" | "deleted" | "removed">>, selected?: string[]): { topic: string; description: string } {
  const picked = replies.filter((r) => !r.deleted && !r.removed && r.body).map((r) => r.body);
  const chosen = selected?.length ? picked.filter((b) => selected.includes(b)) : picked.slice(-2);
  const description = [c.body?.trim(), ...chosen.map((b) => `“${b.trim()}”`)].filter(Boolean).join("\n").slice(0, 500);
  return { topic: c.title.slice(0, 140), description };
}

/**
 * "Save thought" (Phase 04 §6, §14): keep someone's reply as a note in your Materials — quoted, credited, and linked back
 * to the conversation. It stays their words: the Studio treats it as reference only, never as yours to copy in.
 */
export async function saveThought(db: Db, creatorId: string, replyId: string): Promise<{ materialId: string }> {
  const r = must(
    await db.from("open_conversation_replies").select("id, conversation_id, creator_id, body, deleted_at, removed_at, open_conversations(title)").eq("id", replyId).maybeSingle(),
    "That reply isn't available.",
  );
  if (r.deleted_at || r.removed_at) throw new DomainError("not_found", "That reply isn't available.");
  const people = await peopleById(db, [r.creator_id]);
  const author = r.creator_id === creatorId ? "You" : people.get(r.creator_id)!.name;
  const about = (r.open_conversations as { title: string } | null)?.title ?? "an Open Conversation";
  const material = await createMaterial(db, creatorId, {
    type: "note",
    title: `Thought from ${author}`.slice(0, 200),
    textContent: `“${r.body}”\n\n— ${author}, in “${about}”`,
    sourceType: "community",
    metadata: { community: { kind: "conversation_reply", id: r.id, conversationId: r.conversation_id, authorId: r.creator_id, authorName: author } },
    provenance: { origin: "import", details: { community: { conversationId: r.conversation_id, replyId: r.id, authorId: r.creator_id } } },
  });
  return { materialId: material.id };
}
