import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { DomainError } from "@wonder/core";
import { inspectUpload, mediaLink } from "@wonder/core/server";
import { MATERIAL_BUCKET, signedUrlsFor } from "@wonder/creator-library";
import sharp from "sharp";
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

/**
 * Community profile pictures by object id → link. Only call with ids taken from community_list / community_card /
 * topicCommunities, which already decided the viewer may see the community.
 */
export async function communityAvatars(objectIds: Array<string | null | undefined>): Promise<Record<string, string>> {
  const ids = [...new Set(objectIds.filter((x): x is string => !!x))];
  const out: Record<string, string> = {};
  const unsigned: string[] = [];
  for (const id of ids) {
    const l = mediaLink(id);
    if (l) out[id] = l;
    else unsigned.push(id);
  }
  if (unsigned.length && serviceConfigured()) {
    const service = serviceClient();
    const { data } = await service.from("storage_objects").select("id, path").in("id", unsigned);
    const byPath = new Map((data ?? []).map((o) => [o.path, o.id]));
    const urls = await signedUrlsFor(service, [...byPath.keys()]).catch(() => ({}) as Record<string, string>);
    for (const [path, url] of Object.entries(urls)) out[byPath.get(path)!] = url;
  }
  return out;
}

/** Store an uploaded picture as the uploader's own square WebP (512px, metadata stripped); returns the object id. */
export async function storeCommunityAvatar(creatorId: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new DomainError("payload_too_large", "Pictures can be up to 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await inspectUpload(bytes, file.name);
  if (info.kind !== "image") throw new DomainError("unsupported_media", "A community picture must be an image.");
  let out: Uint8Array;
  try {
    out = new Uint8Array(await sharp(bytes, { failOn: "error" }).rotate().resize(512, 512, { fit: "cover", position: "attention" }).webp({ quality: 86 }).toBuffer());
  } catch {
    throw new DomainError("unsupported_media", "We couldn't read that picture. Try a JPEG, PNG or WebP image.");
  }
  const service = serviceClient();
  const path = `${creatorId}/community-${randomUUID()}.webp`;
  const up = await service.storage.from(MATERIAL_BUCKET).upload(path, out, { contentType: "image/webp" });
  if (up.error) throw new DomainError("provider_failed", "We couldn't save that picture. Please try again.");
  const sha = createHash("sha256").update(out).digest("hex");
  const { data, error } = await service
    .from("storage_objects")
    .insert({ creator_id: creatorId, bucket: MATERIAL_BUCKET, path, mime_type: "image/webp", size_bytes: out.byteLength, sha256: sha, original_filename: "community", security_status: "clean", privacy: "public" })
    .select("id")
    .single();
  if (error || !data) {
    await service.storage.from(MATERIAL_BUCKET).remove([path]);
    throw new DomainError("provider_failed", "We couldn't save that picture. Please try again.");
  }
  return data.id;
}
