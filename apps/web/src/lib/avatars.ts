import "server-only";
import { mediaLink } from "@wonder/core/server";
import type { Db } from "@wonder/db";
import { serviceClient, serviceConfigured } from "./supabase/service";

/**
 * Signed avatar URLs for creators the viewer is allowed to see. Visibility is decided by the
 * viewer's RLS-scoped read of `creators`; only objects that ARE a visible creator's avatar are signed.
 */
export async function avatarUrls(db: Db, creatorIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(creatorIds.filter(Boolean))];
  if (!ids.length || !serviceConfigured()) return {};
  const { data } = await db.from("creators").select("id, avatar_object_id").in("id", ids).not("avatar_object_id", "is", null);
  const rows = (data ?? []).filter((r) => r.avatar_object_id);
  if (!rows.length) return {};
  const service = serviceClient();
  const objs = await service
    .from("storage_objects")
    .select("id, path, creator_id")
    .in(
      "id",
      rows.map((r) => r.avatar_object_id!),
    );
  const valid = (objs.data ?? []).filter((o) => rows.some((r) => r.avatar_object_id === o.id && r.id === o.creator_id));
  if (!valid.length) return {};
  // Stable links so avatars aren't downloaded again on every page.
  const stable = valid.map((o) => [o.creator_id, mediaLink(o.id)] as const);
  if (stable.every(([, l]) => l)) return Object.fromEntries(stable) as Record<string, string>;
  const signed = await service.storage.from("creator-media").createSignedUrls(
    valid.map((o) => o.path),
    3600,
  );
  const out: Record<string, string> = {};
  for (const o of valid) {
    const url = signed.data?.find((s) => s.path === o.path)?.signedUrl;
    if (url) out[o.creator_id] = url;
  }
  return out;
}
