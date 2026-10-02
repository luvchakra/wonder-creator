import { DomainError, fromDbError, log } from "@wonder/core";
import { inspectUpload } from "@wonder/core/server";
import type { Db, JsonValue } from "@wonder/db";
import { syncBudgets, type SyncBudgets } from "./budgets";
import { rebuildCandidates } from "./server";

/**
 * Photos (Personal Sources spec §5 "Phone/cloud photos", phase D). In a PWA there is no background access to a camera
 * roll: the creator selects photos in the browser's own picker. Discovery then gets only what grouping needs — when
 * each was taken, its size, a fingerprint (SHA-256 of the original, computed on the device) and a tiny thumbnail —
 * never the original. The original is uploaded only for a photo the creator chooses to bring in.
 */

export const PHOTO_BATCH = 25;
export const THUMB_MAX_BYTES = 12_000;

export interface PhotoInput {
  sha256: string;
  takenAt: string | null;
  width?: number | null;
  height?: number | null;
  /** data:image/jpeg|webp;base64,… — a thumbnail of at most THUMB_MAX_BYTES. */
  thumb: string;
}

/** Index one batch of selected photos for a creator's Photos connection, then regroup. */
export async function indexPhotos(service: Db, creatorId: string, connectionId: string, photos: PhotoInput[], opts: { now?: Date; budgets?: SyncBudgets } = {}): Promise<{ indexed: number; skipped: number; candidates: number }> {
  const budgets = opts.budgets ?? syncBudgets();
  const now = opts.now ?? new Date();
  if (photos.length > PHOTO_BATCH) throw new DomainError("validation", `Send at most ${PHOTO_BATCH} photos at a time.`);
  const { data: conn } = await service.from("source_connections").select("id, provider").eq("id", connectionId).eq("creator_id", creatorId).maybeSingle();
  if (!conn || conn.provider !== "phone_photos") throw new DomainError("not_found", "Connect Photos first.");

  const expires = new Date(now.getTime() + budgets.recordDays * 86_400_000).toISOString();
  const rows = [];
  let skipped = 0;
  for (const p of photos) {
    const thumb = await checkedThumb(p.thumb);
    const taken = p.takenAt && !Number.isNaN(Date.parse(p.takenAt)) ? new Date(p.takenAt) : null;
    const plausible = taken && taken.getTime() > Date.UTC(1990, 0, 1) && taken.getTime() < now.getTime() + 86_400_000;
    if (!/^[0-9a-f]{64}$/.test(p.sha256) || !thumb) {
      skipped++;
      continue;
    }
    rows.push({
      creator_id: creatorId,
      connection_id: connectionId,
      provider_item_id: p.sha256,
      source_type: "photo",
      occurred_at: plausible ? taken!.toISOString() : null,
      preview_ref: thumb,
      hydration_level: 2,
      fingerprint: p.sha256.slice(0, 64),
      signals: { width: dim(p.width), height: dim(p.height) } as JsonValue,
      expires_at: expires,
    });
  }
  if (rows.length) {
    const { error } = await service.from("source_context_records").upsert(rows, { onConflict: "connection_id,provider_item_id" });
    if (error) throw fromDbError(error);
  }
  await service.from("source_connections").update({ last_successful_sync_at: now.toISOString(), status: "connected" }).eq("id", connectionId);
  const candidates = await rebuildCandidates(service, creatorId, { now, budgets });
  log("info", "sources.photos_indexed", { creatorId, indexed: rows.length, skipped });
  return { indexed: rows.length, skipped, candidates };
}

const dim = (n: number | null | undefined) => (typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100_000 ? n : null);

/** The thumbnail must really be a small JPEG or WebP (content-detected), or it isn't kept. */
async function checkedThumb(uri: string): Promise<string | null> {
  const m = /^data:image\/(jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(uri ?? "");
  if (!m || m[2]!.length > 16_000 - 30) return null;
  const bytes = Buffer.from(m[2]!, "base64");
  if (!bytes.length || bytes.length > THUMB_MAX_BYTES) return null;
  try {
    const inspected = await inspectUpload(new Uint8Array(bytes), `thumb.${m[1] === "jpeg" ? "jpg" : "webp"}`);
    return inspected.mime === "image/jpeg" || inspected.mime === "image/webp" ? `data:${inspected.mime};base64,${bytes.toString("base64")}` : null;
  } catch {
    return null;
  }
}
