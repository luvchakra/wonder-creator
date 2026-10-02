import { fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";

/**
 * Followers and following on the in-app Profile (owner decision, 2 Oct 2026 — docs/decisions.md §12). Counts are
 * plain aggregates shown on the Profile only: never on the public Creator Page and never used to rank anything.
 * Lists show only creators the viewer may see; follow rows themselves stay private to their two creators.
 */
export interface FollowCounts {
  followers: number;
  following: number;
  /** This creator follows the viewer. */
  followsMe: boolean;
}

export async function followCounts(db: Db, creatorId: string): Promise<FollowCounts | null> {
  const { data, error } = await db.rpc("follow_counts", { p_creator: creatorId });
  if (error) throw fromDbError(error);
  return (data as FollowCounts | null) ?? null;
}

export interface FollowPerson {
  id: string;
  handle: string | null;
  name: string;
  avatarObjectId: string | null;
  followedAt: string;
  iFollow: boolean;
}

export async function followList(db: Db, creatorId: string, kind: "followers" | "following", opts: { before?: string | null; limit?: number } = {}): Promise<{ people: FollowPerson[]; nextBefore: string | null }> {
  const limit = Math.min(opts.limit ?? 40, 100);
  const { data, error } = await db.rpc("follow_list", { p_creator: creatorId, p_kind: kind, p_before: opts.before ?? undefined, p_limit: limit });
  if (error) throw fromDbError(error);
  const people = (data ?? []).map((r) => ({ id: r.creator_id, handle: r.handle, name: r.display_name, avatarObjectId: r.avatar_object_id, followedAt: r.followed_at, iFollow: r.i_follow }));
  return { people, nextBefore: people.length === limit ? people.at(-1)!.followedAt : null };
}
