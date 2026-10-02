import "server-only";
import { randomUUID } from "node:crypto";
import { DomainError, fromDbError } from "@wonder/core";
import { inspectUpload, mediaLink } from "@wonder/core/server";
import type { Db } from "@wonder/db";
import { MATERIAL_BUCKET } from "@wonder/creator-library";
import sharp from "sharp";
import { z } from "zod";
import { serviceClient, serviceConfigured } from "./supabase/service";

/**
 * Photo album (docs/photo-album.md): pictures a creator chose to show on their Profile. The browser never stores
 * anything directly: the server checks the file, makes a resized master and a thumbnail (rotated upright, metadata —
 * including location — stripped), stores both as the creator's own objects, and adds the row through the creator's
 * RLS-scoped client. Links are minted only for objects of rows the viewer could read.
 */

export const ALBUM_MAX_BYTES = 20 * 1024 * 1024;

export interface AlbumPhoto {
  id: string;
  caption: string | null;
  width: number;
  height: number;
  position: number;
  createdAt: string;
  src: string | null;
  thumb: string | null;
}

async function linksFor(objectIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(objectIds)];
  if (!ids.length) return {};
  const out: Record<string, string> = {};
  const unsigned: string[] = [];
  for (const id of ids) {
    const l = mediaLink(id);
    if (l) out[id] = l;
    else unsigned.push(id);
  }
  if (unsigned.length && serviceConfigured()) {
    const service = serviceClient();
    const { data: objs } = await service.from("storage_objects").select("id, bucket, path").in("id", unsigned);
    for (const o of objs ?? []) {
      const { data } = await service.storage.from(o.bucket).createSignedUrl(o.path, 3600);
      if (data?.signedUrl) out[o.id] = data.signedUrl;
    }
  }
  return out;
}

/** A creator's album as the viewer may see it (RLS decides), in the creator's order, newest first within it. */
export async function albumOf(db: Db, creatorId: string, limit = 60): Promise<AlbumPhoto[]> {
  const { data, error } = await db
    .from("creator_album_photos")
    .select("id, object_id, thumb_object_id, width, height, caption, position, created_at")
    .eq("creator_id", creatorId)
    .order("position")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  const links = await linksFor(rows.flatMap((r) => [r.object_id, r.thumb_object_id]));
  return rows.map((r) => ({ id: r.id, caption: r.caption, width: r.width, height: r.height, position: r.position, createdAt: r.created_at, src: links[r.object_id] ?? null, thumb: links[r.thumb_object_id] ?? links[r.object_id] ?? null }));
}

async function derive(bytes: Uint8Array) {
  const base = sharp(bytes, { failOn: "error" }).rotate();
  const master = await base.clone().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return { master: new Uint8Array(master.data), thumb: new Uint8Array(thumb), width: master.info.width, height: master.info.height };
}

/** Add one picture to the creator's album. */
export async function addAlbumPhoto(db: Db, creatorId: string, file: File, caption: string | null): Promise<string> {
  if (file.size > ALBUM_MAX_BYTES) throw new DomainError("payload_too_large", "Photos can be up to 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await inspectUpload(bytes, file.name);
  if (info.kind !== "image") throw new DomainError("unsupported_media", "The album takes photos and pictures only.");
  let d: Awaited<ReturnType<typeof derive>>;
  try {
    d = await derive(bytes);
  } catch {
    throw new DomainError("unsupported_media", "We couldn't read that picture. Try a JPEG, PNG, WebP or HEIC photo.");
  }
  const service = serviceClient();
  const key = randomUUID();
  const files = [
    { path: `${creatorId}/album-${key}.webp`, bytes: d.master },
    { path: `${creatorId}/album-${key}-thumb.webp`, bytes: d.thumb },
  ];
  const stored: string[] = [];
  const objectIds: string[] = [];
  try {
    for (const f of files) {
      const up = await service.storage.from(MATERIAL_BUCKET).upload(f.path, f.bytes, { contentType: "image/webp" });
      if (up.error) throw new DomainError("provider_failed", "We couldn't save that photo. Please try again.");
      stored.push(f.path);
      const sha = Buffer.from(await crypto.subtle.digest("SHA-256", f.bytes)).toString("hex");
      const { data, error } = await service
        .from("storage_objects")
        .insert({ creator_id: creatorId, bucket: MATERIAL_BUCKET, path: f.path, mime_type: "image/webp", size_bytes: f.bytes.byteLength, sha256: sha, original_filename: "album", security_status: "clean", privacy: "public" })
        .select("id")
        .single();
      if (error || !data) throw new DomainError("provider_failed", "We couldn't save that photo. Please try again.");
      objectIds.push(data.id);
    }
    // Newest photos go first: one before the current first.
    const { data: first } = await db.from("creator_album_photos").select("position").eq("creator_id", creatorId).order("position").limit(1).maybeSingle();
    const { data, error } = await db
      .from("creator_album_photos")
      .insert({ creator_id: creatorId, object_id: objectIds[0]!, thumb_object_id: objectIds[1]!, width: d.width, height: d.height, caption: caption?.trim() || null, position: (first?.position ?? 1) - 1 })
      .select("id")
      .single();
    if (error) throw error.code === "54000" ? new DomainError("validation", "Your album holds up to 60 photos. Remove one to add another.") : fromDbError(error);
    return data.id;
  } catch (e) {
    // Leave nothing behind when the photo didn't make it in.
    if (objectIds.length) await service.from("storage_objects").delete().in("id", objectIds);
    if (stored.length) await service.storage.from(MATERIAL_BUCKET).remove(stored);
    throw e;
  }
}

export const albumUpdateSchema = z.object({ caption: z.string().trim().max(200, "Keep the caption under 200 characters.").nullable().optional() });
export const albumOrderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(60) });

export async function updateAlbumPhoto(db: Db, id: string, raw: unknown): Promise<void> {
  const input = albumUpdateSchema.parse(raw);
  const { data, error } = await db.from("creator_album_photos").update({ caption: input.caption ? input.caption : null }).eq("id", id).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new DomainError("not_found", "We couldn't find that photo.");
}

/** Set the album's order (the ids in the order to show them). Only the creator's own rows change. */
export async function orderAlbum(db: Db, creatorId: string, raw: unknown): Promise<void> {
  const { ids } = albumOrderSchema.parse(raw);
  for (const [i, id] of ids.entries()) {
    const { error } = await db.from("creator_album_photos").update({ position: i }).eq("id", id).eq("creator_id", creatorId);
    if (error) throw fromDbError(error);
  }
}

/** Remove a photo from the album and delete its files. */
export async function removeAlbumPhoto(db: Db, creatorId: string, id: string): Promise<void> {
  const { data, error } = await db.from("creator_album_photos").delete().eq("id", id).eq("creator_id", creatorId).select("object_id, thumb_object_id");
  if (error) throw fromDbError(error);
  const row = data?.[0];
  if (!row) throw new DomainError("not_found", "We couldn't find that photo.");
  const service = serviceClient();
  const { data: objs } = await service.from("storage_objects").select("id, path").in("id", [row.object_id, row.thumb_object_id]).eq("creator_id", creatorId);
  if (objs?.length) {
    await service.storage.from(MATERIAL_BUCKET).remove(objs.map((o) => o.path));
    await service.from("storage_objects").delete().in("id", objs.map((o) => o.id));
  }
}
