import "server-only";
import { selectProvider, type BrainDeps } from "@wonder/creator-brain";
import type { Db } from "@wonder/db";

const VISION_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** CreatorBrain dependencies for one request, bound to the caller's RLS-scoped client. */
export function brainDeps(db: Db, creatorId: string, extra: Partial<BrainDeps> = {}): BrainDeps {
  return {
    db,
    creatorId,
    provider: selectProvider(),
    loadImage: async (storageObjectId) => {
      // RLS: the creator can only read their own objects.
      const obj = await db.from("storage_objects").select("bucket, path, mime_type, size_bytes, security_status").eq("id", storageObjectId).maybeSingle();
      if (!obj.data || obj.data.security_status !== "clean" || !VISION_TYPES.has(obj.data.mime_type) || obj.data.size_bytes > 5 * 1024 * 1024) return null;
      const dl = await db.storage.from(obj.data.bucket).download(obj.data.path);
      if (dl.error || !dl.data) return null;
      return { mediaType: obj.data.mime_type as "image/png", dataBase64: Buffer.from(await dl.data.arrayBuffer()).toString("base64") };
    },
    ...extra,
  };
}
