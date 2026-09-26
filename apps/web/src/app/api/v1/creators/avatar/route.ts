import { randomUUID } from "node:crypto";
import { DomainError, fromDbError, must } from "@wonder/core";
import { inspectUpload } from "@wonder/core/server";
import { setAvatar } from "@wonder/creator-identity";
import { MATERIAL_BUCKET } from "@wonder/creator-library";
import { withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

export const POST = withApi(async ({ db, creatorId, req }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new DomainError("validation", "Choose an image.");
  if (file.size > 5 * 1024 * 1024) throw new DomainError("payload_too_large", "Profile photos can be up to 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await inspectUpload(bytes, file.name);
  if (info.kind !== "image") throw new DomainError("unsupported_media", "Profile photos must be images.");
  const service = serviceClient();
  const path = `${creatorId}/avatar-${randomUUID()}`;
  const up = await service.storage.from(MATERIAL_BUCKET).upload(path, bytes, { contentType: info.mime });
  if (up.error) throw new DomainError("provider_failed", "We couldn't save that photo. Please try again.");
  const obj = must(
    await service
      .from("storage_objects")
      .insert({ creator_id: creatorId, bucket: MATERIAL_BUCKET, path, mime_type: info.mime, size_bytes: info.size, sha256: info.sha256, original_filename: "avatar", security_status: "clean", privacy: "public" })
      .select("id")
      .single(),
  );
  await setAvatar(db, creatorId, obj.id);
  return { ok: true };
});

export const DELETE = withApi(async ({ db, creatorId }) => {
  const res = await db.from("creators").update({ avatar_object_id: null }).eq("id", creatorId);
  if (res.error) throw fromDbError(res.error);
  return { ok: true };
});
