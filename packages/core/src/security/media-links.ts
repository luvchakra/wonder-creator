import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stable media links (owner, 29 Sep 2026: "cache all images, so they don't need to download multiple times").
 *
 * A storage signed URL is different every time it's made, so the browser can never reuse a picture it already has. A
 * media link is `/api/v1/media/<storage object id>?e=<day>&s=<signature>`: the same for a whole UTC day, so the browser
 * caches it. Like a signed URL it is a capability — minted only after the viewer's access was checked, useless for any
 * other object, expiring after 2–3 days. The key is derived from the server secret and never leaves the server.
 */

const DAY_SECONDS = 86_400;

function key(): Buffer | null {
  const secret = process.env.WONDERCREATOR_MEDIA_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHmac("sha256", secret).update("wonder-media-link-v1").digest() : null;
}

const sign = (k: Buffer, objectId: string, e: number) => createHmac("sha256", k).update(`${objectId}.${e}`).digest("base64url").slice(0, 32);

/** The stable link for a storage object, or null when the server has no secret to sign with. */
export function mediaLink(objectId: string, now = Date.now()): string | null {
  const k = key();
  if (!k) return null;
  const e = Math.floor(now / 1000 / DAY_SECONDS) + 2;
  return `/api/v1/media/${objectId}?e=${e}&s=${sign(k, objectId, e)}`;
}

/** Seconds the link stays valid, or null when it's forged, for another object, or expired. */
export function verifyMediaLink(objectId: string, e: string | null, s: string | null, now = Date.now()): number | null {
  const k = key();
  const day = Number(e);
  if (!k || !s || !Number.isInteger(day)) return null;
  const want = Buffer.from(sign(k, objectId, day));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const left = (day + 1) * DAY_SECONDS - Math.floor(now / 1000);
  return left > 0 ? left : null;
}
