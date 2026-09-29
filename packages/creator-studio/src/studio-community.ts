import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { addSources } from "./working-set";
import type { SourceType } from "./working-set-options";

/**
 * Phase 04 — the Studio's doors to DejaVu and Community (docs/studio-integration.md). Everything arrives on the Working
 * Table as a reference, Available, through the creator's own access; nothing is imported as active and nothing is
 * copied. The owning domains (Moments, DejaVu, Open Conversations) keep their truth.
 */

/** Which Working Table source a Moment points at. Moments of other kinds can't be brought in (yet) and are skipped. */
const MOMENT_SOURCE: Record<string, SourceType> = { material: "material", creation: "creation", conversation: "conversation", scrapbook_entry: "scrapbook_entry" };

export const fromDejaVuSchema = z.object({ dejavuId: z.string().uuid(), momentIds: z.array(z.string().uuid()).min(1).max(30) });

/**
 * `Bring in → DejaVu` (§4): the chosen Moments of one DejaVu become Available sources — never the whole DejaVu, never
 * on the Canvas. Moments are read through the creator's own access and must belong to that DejaVu.
 */
export async function addFromDejaVu(db: Db, creatorId: string, sessionId: string, raw: unknown): Promise<{ added: number; skipped: number }> {
  const v = fromDejaVuSchema.parse(raw);
  const { data: links, error } = await db.from("dejavu_moments").select("moment_id, moment_references(id, entity_type, entity_id, deleted_at)").eq("dejavu_id", v.dejavuId).in("moment_id", v.momentIds);
  if (error) throw fromDbError(error);
  type M = { id: string; entity_type: string; entity_id: string; deleted_at: string | null };
  const moments = (links ?? []).map((l) => l.moment_references as unknown as M | null).filter((m): m is M => !!m && !m.deleted_at);
  const items = moments.filter((m) => MOMENT_SOURCE[m.entity_type]).map((m) => ({ type: MOMENT_SOURCE[m.entity_type]!, id: m.entity_id }));
  if (!items.length) throw new DomainError("validation", "None of those Moments can be brought in.");
  const added = await addSources(db, creatorId, sessionId, items, "available");
  return { added, skipped: v.momentIds.length - items.length };
}

/**
 * "Explore in Studio" from a DejaVu page (§5): the DejaVu's context becomes available in a Studio — its Moments are one
 * tap away on the Working Table — but none are imported and the Canvas stays as it was.
 */
export async function exploreDejaVuIn(db: Db, sessionId: string, dejavuId: string): Promise<void> {
  const res = await db.from("studio_sessions").update({ dejavu_id: dejavuId, status: "active" }).eq("id", sessionId).select("id");
  if (res.error) throw res.error.code === "42501" ? new DomainError("not_found", "We couldn't find that DejaVu.") : fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That Studio session isn't available.");
}

export interface CommunityResponse {
  id: string;
  conversationId: string;
  conversationTitle: string;
  /** What was asked about ("Slide 3"), when the conversation came from Ask Community. */
  about: string | null;
  body: string;
  author: { id: string; name: string; handle: string | null };
  createdAt: string;
  /** Posted since the creator last read the conversation. */
  isNew: boolean;
  /** Already on the Working Table. */
  inSet: boolean;
}

/**
 * Replies to the conversations the creator started about this Creation (§14) — "7 community responses · 2 new". Only
 * what the creator can read (their own conversations; replies hidden across a block stay hidden); dismissed ones are
 * left out; their own replies aren't responses.
 */
export async function communityResponses(db: Db, sessionId: string): Promise<{ total: number; fresh: number; conversations: number; responses: CommunityResponse[] }> {
  const s = must(await db.from("studio_sessions").select("id, creator_id, artifact_id, dismissed_replies").eq("id", sessionId).maybeSingle(), "That Studio session isn't available.");
  const { data: convs, error } = await db
    .from("open_conversations")
    .select("id, title, source_fragment")
    .eq("creator_id", s.creator_id)
    .eq("source_entity_type", "creation")
    .eq("source_entity_id", s.artifact_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw fromDbError(error);
  if (!convs?.length) return { total: 0, fresh: 0, conversations: 0, responses: [] };
  const ids = convs.map((c) => c.id);
  const [{ data: replies }, { data: reads }, { data: inSet }] = await Promise.all([
    db
      .from("open_conversation_replies")
      .select("id, conversation_id, creator_id, body, created_at")
      .in("conversation_id", ids)
      .neq("creator_id", s.creator_id)
      .is("deleted_at", null)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("open_conversation_reads").select("conversation_id, last_read_at").eq("creator_id", s.creator_id).in("conversation_id", ids),
    db.from("studio_sources").select("source_id").eq("session_id", sessionId).eq("source_type", "conversation_reply"),
  ]);
  const dismissed = new Set(s.dismissed_replies ?? []);
  const live = (replies ?? []).filter((r) => !dismissed.has(r.id));
  const people = live.length ? ((await db.from("creators").select("id, display_name, handle").in("id", [...new Set(live.map((r) => r.creator_id))])).data ?? []) : [];
  const readAt = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));
  const present = new Set((inSet ?? []).map((r) => r.source_id));
  const responses = live.map((r) => {
    const c = convs.find((x) => x.id === r.conversation_id)!;
    const p = people.find((x) => x.id === r.creator_id);
    const since = readAt.get(r.conversation_id);
    return {
      id: r.id,
      conversationId: r.conversation_id,
      conversationTitle: c.title,
      about: (c.source_fragment as { label?: string } | null)?.label ?? null,
      body: r.body,
      author: { id: r.creator_id, name: p?.display_name || "A creator", handle: p?.handle ?? null },
      createdAt: r.created_at,
      isNew: !since || r.created_at > since,
      inSet: present.has(r.id),
    };
  });
  return { total: responses.length, fresh: responses.filter((r) => r.isNew).length, conversations: new Set(responses.map((r) => r.conversationId)).size, responses };
}

/** "Use in Studio" on a response (§14): the reply joins the Working Table, Available, as feedback (the creator can change the role). */
export async function useCommunityResponse(db: Db, creatorId: string, sessionId: string, replyId: string): Promise<void> {
  await addSources(db, creatorId, sessionId, [{ type: "conversation_reply", id: replyId, roles: ["feedback"] }], "available");
}

/** "Dismiss": this Studio stops showing it. The reply itself is untouched. */
export async function dismissCommunityResponse(db: Db, sessionId: string, replyId: string): Promise<void> {
  const s = must(await db.from("studio_sessions").select("dismissed_replies").eq("id", sessionId).maybeSingle(), "That Studio session isn't available.");
  const next = [...new Set([...(s.dismissed_replies ?? []), replyId])].slice(-500);
  const res = await db.from("studio_sessions").update({ dismissed_replies: next }).eq("id", sessionId).select("id");
  if (res.error) throw fromDbError(res.error);
}
