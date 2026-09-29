import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { OPEN_TO, type OpenTo } from "./shared";

/* --------------------------------------------------------------------------------------------------- Mutes */

/** Mute or unmute someone in your Community. Private: they aren't told, and nothing of theirs changes. */
export async function setMuted(db: Db, creatorId: string, targetId: string, muted: boolean): Promise<void> {
  if (creatorId === targetId) throw new DomainError("validation", "You can't mute yourself.");
  if (muted) {
    const { error } = await db.from("creator_mutes").insert({ muter_creator_id: creatorId, muted_creator_id: targetId });
    if (error && error.code !== "23505") throw fromDbError(error);
  } else {
    const { error } = await db.from("creator_mutes").delete().eq("muter_creator_id", creatorId).eq("muted_creator_id", targetId);
    if (error) throw fromDbError(error);
  }
}

export async function mutedIds(db: Db, creatorId: string): Promise<Set<string>> {
  const { data } = await db.from("creator_mutes").select("muted_creator_id").eq("muter_creator_id", creatorId);
  return new Set((data ?? []).map((m) => m.muted_creator_id));
}

/** Everyone the viewer shouldn't see in Community: muted by them, or blocked either way. */
export async function hiddenCreators(db: Db, creatorId: string): Promise<Set<string>> {
  const [muted, { data: blocks }] = await Promise.all([
    mutedIds(db, creatorId),
    db.from("creator_blocks").select("blocker_creator_id, blocked_creator_id").or(`blocker_creator_id.eq.${creatorId},blocked_creator_id.eq.${creatorId}`),
  ]);
  for (const b of blocks ?? []) muted.add(b.blocker_creator_id === creatorId ? b.blocked_creator_id : b.blocker_creator_id);
  return muted;
}

/* ------------------------------------------------------------------------------------------------- Open to… */

export const openToSchema = z.object({ preferences: z.array(z.enum(OPEN_TO)).max(OPEN_TO.length) });

export async function getOpenTo(db: Db, creatorId: string): Promise<OpenTo[]> {
  const { data } = await db.from("creator_open_to").select("preferences").eq("creator_id", creatorId).maybeSingle();
  return ((data?.preferences ?? []) as OpenTo[]).filter((p) => (OPEN_TO as readonly string[]).includes(p));
}

/** Explicit, never inferred (§9). */
export async function saveOpenTo(db: Db, creatorId: string, raw: unknown): Promise<OpenTo[]> {
  const { preferences } = openToSchema.parse(raw);
  const clean = OPEN_TO.filter((p) => preferences.includes(p));
  const { error } = await db.from("creator_open_to").upsert({ creator_id: creatorId, preferences: clean });
  if (error) throw fromDbError(error);
  return clean;
}

/** Several people's "Open to…", as far as the viewer may see them. */
export async function openToOf(db: Db, ids: string[]): Promise<Map<string, OpenTo[]>> {
  const out = new Map<string, OpenTo[]>();
  if (!ids.length) return out;
  const { data } = await db.from("creator_open_to").select("creator_id, preferences").in("creator_id", [...new Set(ids)]);
  for (const r of data ?? []) out.set(r.creator_id, r.preferences as OpenTo[]);
  return out;
}
