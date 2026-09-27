import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

/**
 * Collaboration messaging (P1-11): direct conversations between two creators (optionally about a project or a
 * piece), read markers and unread counts, and context for crew chat. Messages are never sent on anyone's behalf:
 * CreatorBrain can draft, the creator sends.
 */

export const CONTEXT_KINDS = ["artifact", "task", "proposal", "claim"] as const;
export type ContextKind = (typeof CONTEXT_KINDS)[number];

function messagingError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("cannot message")) return new DomainError("forbidden", "You can't message this creator.");
  if (msg.includes("context not in project")) return new DomainError("validation", "That isn't part of this project.");
  if (msg.includes("not in huddle")) return new DomainError("forbidden", "You're not in that Huddle.");
  return fromDbError(e);
}

/** Resolve crew-chat contexts to titles and links (only what the viewer can read resolves). */
export async function resolveContexts(db: Db, refs: Array<{ kind: ContextKind; id: string }>): Promise<Record<string, { label: string; href: string | null }>> {
  const by = (k: ContextKind) => [...new Set(refs.filter((r) => r.kind === k).map((r) => r.id))];
  const [artifacts, tasks, proposals, claims] = await Promise.all([
    by("artifact").length ? db.from("artifacts").select("id, title").in("id", by("artifact")) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    by("task").length ? db.from("project_tasks").select("id, title, project_id").in("id", by("task")) : Promise.resolve({ data: [] as Array<{ id: string; title: string; project_id: string }> }),
    by("proposal").length ? db.from("artifact_change_proposals").select("id, summary, artifact_id, status").in("id", by("proposal")) : Promise.resolve({ data: [] as Array<{ id: string; summary: string; artifact_id: string; status: string }> }),
    by("claim").length
      ? db.from("ownership_assertions").select("id, claim, status, project_id, artifacts(title)").in("id", by("claim"))
      : Promise.resolve({ data: [] as Array<{ id: string; claim: string; status: string; project_id: string; artifacts: unknown }> }),
  ]);
  const out: Record<string, { label: string; href: string | null }> = {};
  for (const a of artifacts.data ?? []) out[`artifact:${a.id}`] = { label: `Piece: ${a.title}`, href: `/artifacts/${a.id}` };
  for (const t of tasks.data ?? []) out[`task:${t.id}`] = { label: `Task: ${t.title}`, href: `/projects/${t.project_id}?tab=tasks` };
  for (const p of proposals.data ?? []) out[`proposal:${p.id}`] = { label: `Proposed change: ${p.summary}${p.status === "open" ? "" : ` (${p.status})`}`, href: `/artifacts/${p.artifact_id}/collaborate` };
  for (const c of claims.data ?? []) out[`claim:${c.id}`] = { label: `Ownership claim on ${(c.artifacts as { title: string } | null)?.title ?? "a piece"} (${c.status})`, href: `/projects/${c.project_id}?tab=rights` };
  return out;
}

export async function markCrewRead(db: Db, creatorId: string, crewId: string) {
  const { error } = await db.from("crew_message_reads").upsert({ crew_id: crewId, creator_id: creatorId, last_read_at: new Date().toISOString() }, { onConflict: "crew_id,creator_id" });
  if (error && error.code !== "42501") throw fromDbError(error);
}

export interface UnreadItem {
  kind: "crew" | "direct";
  id: string;
  /** For crew chat: the project whose Chat tab it's on. */
  projectId: string | null;
  title: string;
  unread: number;
  latestAt: string;
  latestAuthor: string | null;
}

export async function unreadMessages(db: Db): Promise<UnreadItem[]> {
  const { data, error } = await db.rpc("unread_messages");
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({ kind: r.kind as "crew" | "direct", id: r.id, projectId: r.project_id, title: r.title, unread: r.unread, latestAt: r.latest_at, latestAuthor: r.latest_author }));
}

// Direct conversations -----------------------------------------------------------------------------------------------

export const directMessageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(4000),
  projectId: z.string().uuid().nullish(),
  artifactId: z.string().uuid().nullish(),
  draftedByAi: z.boolean().default(false),
});

export async function openDirectThread(db: Db, otherId: string): Promise<string> {
  const { data, error } = await db.rpc("open_direct_thread", { p_other: otherId });
  if (error) throw messagingError(error);
  return data as string;
}

export async function canMessage(db: Db, otherId: string): Promise<boolean> {
  const { data } = await db.rpc("can_message_creator", { p_other: otherId });
  return data === true;
}

export interface ThreadSummary {
  id: string;
  other: { id: string; name: string; handle: string | null };
  lastMessage: { body: string; mine: boolean; at: string } | null;
  unread: number;
}

export async function listThreads(db: Db, viewerId: string): Promise<ThreadSummary[]> {
  const [threads, unread] = await Promise.all([
    db
      .from("direct_threads")
      .select("id, creator_a, creator_b, last_message_at, a:creators!direct_threads_creator_a_fkey(display_name, handle), b:creators!direct_threads_creator_b_fkey(display_name, handle), direct_messages(body, creator_id, created_at)")
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "direct_messages", ascending: false })
      .limit(1, { referencedTable: "direct_messages" })
      .limit(100),
    unreadMessages(db),
  ]);
  if (threads.error) throw fromDbError(threads.error);
  const counts = new Map(unread.filter((u) => u.kind === "direct").map((u) => [u.id, u.unread]));
  return (threads.data ?? []).map((t) => {
    const otherIsA = t.creator_b === viewerId;
    const o = (otherIsA ? t.a : t.b) as { display_name: string; handle: string | null } | null;
    const last = ((t.direct_messages ?? []) as Array<{ body: string; creator_id: string | null; created_at: string }>)[0];
    return {
      id: t.id,
      other: { id: otherIsA ? t.creator_a : t.creator_b, name: o?.display_name || "Creator", handle: o?.handle ?? null },
      lastMessage: last ? { body: last.body.slice(0, 140), mine: last.creator_id === viewerId, at: last.created_at } : null,
      unread: counts.get(t.id) ?? 0,
    };
  });
}

export interface DirectMessage {
  id: string;
  body: string;
  at: string;
  mine: boolean;
  author: string;
  draftedByAi: boolean;
  project: { id: string; title: string } | null;
  artifact: { id: string; title: string } | null;
}

export async function getThread(db: Db, viewerId: string, threadId: string, opts: { before?: string } = {}) {
  const t = must(
    await db.from("direct_threads").select("id, creator_a, creator_b, a:creators!direct_threads_creator_a_fkey(display_name, handle), b:creators!direct_threads_creator_b_fkey(display_name, handle)").eq("id", threadId).maybeSingle(),
    "We couldn't find that conversation.",
  );
  const otherIsA = t.creator_b === viewerId;
  const o = (otherIsA ? t.a : t.b) as { display_name: string; handle: string | null } | null;
  const limit = 50;
  let q = db
    .from("direct_messages")
    .select("id, body, created_at, creator_id, drafted_by_ai, projects(id, title), artifacts(id, title)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  return {
    id: t.id,
    other: { id: otherIsA ? t.creator_a : t.creator_b, name: o?.display_name || "Creator", handle: o?.handle ?? null },
    messages: rows
      .map(
        (m): DirectMessage => ({
          id: m.id,
          body: m.body,
          at: m.created_at,
          mine: m.creator_id === viewerId,
          author: m.creator_id === viewerId ? "You" : o?.display_name || "Creator",
          draftedByAi: m.drafted_by_ai,
          project: (m.projects as { id: string; title: string } | null) ?? null,
          artifact: (m.artifacts as { id: string; title: string } | null) ?? null,
        }),
      )
      .reverse(),
    olderBefore: rows.length === limit ? rows[rows.length - 1].created_at : null,
  };
}

export async function sendDirectMessage(db: Db, creatorId: string, threadId: string, raw: unknown): Promise<string> {
  const m = directMessageSchema.parse(raw);
  const { data, error } = await db
    .from("direct_messages")
    .insert({ thread_id: threadId, creator_id: creatorId, body: m.body, project_id: m.projectId ?? null, artifact_id: m.artifactId ?? null, drafted_by_ai: m.draftedByAi })
    .select("id")
    .single();
  if (error?.code === "42501") throw new DomainError("forbidden", "You can't send this here — the conversation or what it's about isn't open to both of you.");
  if (error) throw fromDbError(error);
  return data.id;
}

export async function deleteDirectMessage(db: Db, messageId: string) {
  const { data, error } = await db.from("direct_messages").delete().eq("id", messageId).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new DomainError("not_found", "That message is gone (or isn't yours to remove).");
}

export async function markThreadRead(db: Db, creatorId: string, threadId: string) {
  const { error } = await db.from("direct_thread_reads").upsert({ thread_id: threadId, creator_id: creatorId, last_read_at: new Date().toISOString() }, { onConflict: "thread_id,creator_id" });
  if (error && error.code !== "42501") throw fromDbError(error);
}
