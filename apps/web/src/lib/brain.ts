import "server-only";
import { log } from "@wonder/core";
import { providerWithKey, selectProvider, type BrainDeps, type CreativeModelProvider } from "@wonder/creator-brain";
import type { Db } from "@wonder/db";
import { serviceClient, serviceConfigured } from "./supabase/service";

const VISION_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * The model provider for this creator: their own key when they've connected one and chose to use it for
 * CreatorBrain (BYOK), otherwise the platform's. The secret is read server-side from Vault for this request
 * only; it's never logged, cached or sent to the browser.
 */
export async function providerFor(creatorId: string): Promise<{ provider: CreativeModelProvider; source: "own_key" | "platform"; keyProvider: string | null }> {
  if (serviceConfigured()) {
    try {
      const service = serviceClient();
      const { data: key } = await service.from("creator_ai_keys").select("provider, default_model, status").eq("creator_id", creatorId).eq("use_for_brain", true).neq("status", "invalid").maybeSingle();
      if (key) {
        const { data: secret } = await service.rpc("byok_secret", { p_creator: creatorId, p_provider: key.provider });
        if (secret) return { provider: providerWithKey(key.provider as "gemini" | "anthropic", secret, key.default_model), source: "own_key", keyProvider: key.provider };
      }
    } catch {
      log("warn", "byok.resolve_failed", { creatorId });
    }
  }
  return { provider: selectProvider(), source: "platform", keyProvider: null };
}

/** CreatorBrain dependencies for one request, bound to the caller's RLS-scoped client. */
export async function brainDeps(db: Db, creatorId: string, extra: Partial<BrainDeps> = {}): Promise<BrainDeps> {
  return {
    db,
    creatorId,
    provider: (await providerFor(creatorId)).provider,
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
