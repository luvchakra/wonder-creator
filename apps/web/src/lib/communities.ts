import "server-only";
import { signedUrlsFor } from "@wonder/creator-library";
import { serviceClient, serviceConfigured } from "./supabase/service";

/**
 * Communities in the app (docs/communities.md). A community's cover and members' avatars are shown to anyone who can
 * find it, so they're signed on the server for exactly those ids (the owner chose to make the room discoverable).
 */

/** Cover pictures by material id → signed URL. Only call with cover ids taken from community_list / community_card. */
export async function communityCovers(materialIds: Array<string | null | undefined>): Promise<Record<string, string>> {
  const ids = [...new Set(materialIds.filter((x): x is string => !!x))];
  if (!ids.length || !serviceConfigured()) return {};
  const service = serviceClient();
  const { data } = await service.from("creative_materials").select("id, storage_object_id").in("id", ids);
  const byObject = new Map((data ?? []).filter((m) => m.storage_object_id).map((m) => [m.storage_object_id!, m.id]));
  const urls = await signedUrlsFor(service, [...byObject.keys()]).catch(() => ({}) as Record<string, string>);
  const out: Record<string, string> = {};
  for (const [obj, url] of Object.entries(urls)) out[byObject.get(obj)!] = url;
  return out;
}
