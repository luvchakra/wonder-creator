import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { CONTEXT_KINDS, resolveContexts, type ContextKind } from "./messaging";

/**
 * Crew workspace (P1-04): work shared with a project's crew, and the crew's chat. Crew members read shared work
 * through security-definer functions (read-only, only while it stays shared); sharing never widens access to the
 * work anywhere else.
 */

export interface SharedItem {
  itemId: string;
  kind: "material" | "reference" | "artifact";
  title: string;
  detail: string | null;
  sharedBy: { id: string; name: string };
  sharedAt: string;
  mine: boolean;
}

export async function listSharedItems(db: Db, projectId: string): Promise<SharedItem[]> {
  const { data, error } = await db.rpc("project_shared_items", { p_project: projectId });
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    itemId: r.item_id,
    kind: r.kind as SharedItem["kind"],
    title: r.title,
    detail: r.detail,
    sharedBy: { id: r.shared_by, name: r.shared_by_name },
    sharedAt: r.shared_at,
    mine: r.mine,
  }));
}

export type SharedItemContent =
  | { kind: "material"; title: string; type: string; text: string; sourceUrl: string | null; mimeType: string | null; fileUrl: string | null }
  | { kind: "artifact"; title: string; type: string; status: string; versionNumber: number | null; content: string; updatedAt: string };

export type SharedItemView = SharedItemContent & { itemId: string; projectId: string; sharedBy: string; sharedById: string; sharedAt: string; mine: boolean };

/** One shared item, read-only. Null when the viewer can't open it (not in the crew, or no longer shared). */
export async function getSharedItem(db: Db, itemId: string, bucket: string): Promise<SharedItemView | null> {
  const { data, error } = await db.rpc("project_shared_item", { p_item: itemId });
  if (error) throw fromDbError(error);
  if (!data) return null;
  const v = data as Record<string, unknown>;
  if (v.kind === "material") {
    const path = v.filePath as string | null;
    const fileUrl = path ? ((await db.storage.from(bucket).createSignedUrl(path, 600)).data?.signedUrl ?? null) : null;
    return { ...(v as unknown as SharedItemView), fileUrl } as SharedItemView;
  }
  return v as unknown as SharedItemView;
}

/** Share (or stop sharing) your own linked work with the crew. */
export async function setItemShared(db: Db, projectId: string, itemId: string, shared: boolean) {
  const res = await db
    .from("project_items")
    .update({ shared, shared_at: shared ? new Date().toISOString() : null })
    .eq("project_id", projectId)
    .eq("id", itemId)
    .select("id");
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only the person whose work it is can share it with the crew.");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That's no longer in this project.");
}

// Crew chat -----------------------------------------------------------------------------------------------------

export const chatSchema = z
  .object({
    body: z.string().trim().min(1, "Write a message first.").max(4000),
    itemId: z.string().uuid().nullish(),
    // What the message is about: a piece, task, change proposal or ownership claim in the project.
    contextKind: z.enum(CONTEXT_KINDS).nullish(),
    contextId: z.string().uuid().nullish(),
    huddleId: z.string().uuid().nullish(),
    draftedByAi: z.boolean().default(false),
  })
  .refine((m) => !m.contextKind === !m.contextId, { message: "Say what the message is about.", path: ["contextId"] });

export interface CrewMessage {
  id: string;
  body: string;
  at: string;
  author: { id: string | null; name: string };
  itemId: string | null;
  context: { kind: ContextKind; id: string; label: string; href: string | null } | null;
  huddleId: string | null;
  draftedByAi: boolean;
  mine: boolean;
}

/** Newest last. `before` pages back through older messages. */
export async function listCrewMessages(db: Db, viewerId: string, crewId: string, opts: { before?: string; limit?: number } = {}): Promise<{ messages: CrewMessage[]; olderBefore: string | null }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  let q = db.from("crew_messages").select("id, body, created_at, creator_id, item_id, context_kind, context_id, huddle_id, drafted_by_ai, creators(display_name)").eq("crew_id", crewId).order("created_at", { ascending: false }).limit(limit);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  const contexts = await resolveContexts(
    db,
    rows.filter((m) => m.context_kind && m.context_id).map((m) => ({ kind: m.context_kind as ContextKind, id: m.context_id! })),
  );
  return {
    messages: rows
      .map((m) => {
        const key = m.context_kind && m.context_id ? `${m.context_kind}:${m.context_id}` : null;
        return {
          id: m.id,
          body: m.body,
          at: m.created_at,
          author: { id: m.creator_id, name: (m.creators as { display_name: string } | null)?.display_name ?? "Someone" },
          itemId: m.item_id,
          context: key ? { kind: m.context_kind as ContextKind, id: m.context_id!, label: contexts[key]?.label ?? "Something you can't open", href: contexts[key]?.href ?? null } : null,
          huddleId: m.huddle_id,
          draftedByAi: m.drafted_by_ai,
          mine: m.creator_id === viewerId,
        };
      })
      .reverse(),
    olderBefore: rows.length === limit ? rows[rows.length - 1].created_at : null,
  };
}

export async function postCrewMessage(db: Db, creatorId: string, crewId: string, raw: unknown) {
  const m = chatSchema.parse(raw);
  const res = await db
    .from("crew_messages")
    .insert({ crew_id: crewId, creator_id: creatorId, body: m.body, item_id: m.itemId ?? null, context_kind: m.contextKind ?? null, context_id: m.contextId ?? null, huddle_id: m.huddleId ?? null, drafted_by_ai: m.draftedByAi })
    .select("id")
    .single();
  if (res.error?.message?.includes("context not in project")) throw new DomainError("validation", "That isn't part of this project.");
  if (res.error?.message?.includes("not in huddle")) throw new DomainError("forbidden", "You're not in that Huddle.");
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only people in the crew can post here.");
  if (res.error) throw fromDbError(res.error);
  return res.data;
}

export async function deleteCrewMessage(db: Db, crewId: string, messageId: string) {
  const res = await db.from("crew_messages").delete().eq("crew_id", crewId).eq("id", messageId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That message is gone (or isn't yours to remove).");
}
