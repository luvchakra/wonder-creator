import { createHash } from "node:crypto";
import { DomainError, log } from "@wonder/core";
import { inspectUpload, safeFetch } from "@wonder/core/server";
import type { Db } from "@wonder/db";
import { TRACKS } from "./catalog";
import type { Track } from "./types";

export const SOUNDTRACK_BUCKET = "soundtrack";
/** Only the licensed sources in the catalogue (archive.org redirects to its own mirrors). */
const SOURCE_HOSTS = [/^incompetech\.com$/, /^archive\.org$/, /^ia\d+\.us\.archive\.org$/, /^[a-z0-9-]+\.archive\.org$/];

/**
 * Mirror licensed tracks into Wonder Creator storage (server/cron only). Each file is fetched from its catalogued
 * source through the SSRF-guarded fetcher, must match the catalogued SHA-256 exactly, must be detected as MP3, and is
 * then stored under its track id. Anything that doesn't match is skipped and logged — never stored.
 */
type MirrorOpts = { fetchImpl?: typeof fetch; resolve?: (host: string) => Promise<string[]> };

/**
 * Mirror one licensed track into Wonder Creator storage. The file is fetched from its catalogued source through the
 * SSRF-guarded fetcher, must match the catalogued SHA-256 exactly, must be detected as MP3, and is then stored under
 * its track id. Anything that doesn't match throws — never stored.
 */
async function mirrorTrack(service: Db, t: Track, opts: MirrorOpts = {}): Promise<string> {
  const res = await safeFetch(t.sourceUrl, { maxBytes: t.bytes + 1, timeoutMs: 120_000, accept: "audio/mpeg,*/*;q=0.5", fetchImpl: opts.fetchImpl, resolve: opts.resolve, userAgent: "WonderCreatorBot/1.0 (+soundtrack mirror)" });
  if (!SOURCE_HOSTS.some((h) => h.test(new URL(res.finalUrl).hostname))) throw new DomainError("security_rejected", "Unexpected host.");
  if (res.status !== 200 || res.truncated) throw new DomainError("provider_failed", `Status ${res.status}.`);
  const sha = createHash("sha256").update(res.body).digest("hex");
  if (sha !== t.sha256) throw new DomainError("security_rejected", "Hash mismatch.");
  const inspected = await inspectUpload(res.body, `${t.id}.mp3`);
  if (inspected.mime !== "audio/mpeg") throw new DomainError("unsupported_media", "Not an MP3.");
  const path = `${t.id}.mp3`;
  const up = await service.storage.from(SOUNDTRACK_BUCKET).upload(path, res.body, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
  if (up.error) throw new DomainError("provider_failed", "Storage upload failed.", { cause: up.error });
  const row = await service.from("soundtrack_files").upsert({ track_id: t.id, storage_path: path, sha256: sha, size_bytes: res.body.byteLength });
  if (row.error) throw new DomainError("internal", "Couldn't record the file.", { cause: row.error });
  return path;
}

/** Mirror licensed tracks that aren't stored yet (server/cron only), a few at a time. Failures are logged and skipped. */
export async function mirrorSoundtrack(service: Db, opts: MirrorOpts & { limit?: number; tracks?: readonly Track[] } = {}): Promise<{ mirrored: string[]; failed: string[] }> {
  const { data: have } = await service.from("soundtrack_files").select("track_id");
  const done = new Set((have ?? []).map((r) => r.track_id));
  const todo = (opts.tracks ?? TRACKS).filter((t) => !done.has(t.id)).slice(0, opts.limit ?? 3);
  const mirrored: string[] = [];
  const failed: string[] = [];
  for (const t of todo) {
    try {
      await mirrorTrack(service, t, opts);
      mirrored.push(t.id);
    } catch (e) {
      failed.push(t.id);
      log("warn", "soundtrack.mirror_failed", { trackId: t.id, code: e instanceof DomainError ? e.code : "internal" });
    }
  }
  return { mirrored, failed };
}

/**
 * Where a track streams from, mirroring it first if this is its first play. Playback never streams from a third-party
 * host: the page only plays audio from our own storage.
 */
export async function trackAudioPath(service: Db, trackId: string, opts: MirrorOpts & { tracks?: readonly Track[] } = {}): Promise<string> {
  const t = (opts.tracks ?? TRACKS).find((x) => x.id === trackId);
  if (!t) throw new DomainError("not_found", "That song isn't in the library.");
  const { data: have } = await service.from("soundtrack_files").select("storage_path").eq("track_id", t.id).maybeSingle();
  if (have) return have.storage_path;
  try {
    return await mirrorTrack(service, t, opts);
  } catch (e) {
    log("warn", "soundtrack.mirror_failed", { trackId: t.id, code: e instanceof DomainError ? e.code : "internal" });
    throw new DomainError("provider_unavailable", "This song can't play right now.", { cause: e });
  }
}

export type LibraryTrack = Track & { audioUrl: string; mirrored: boolean };

/**
 * The library for a creator: every catalogued track with where to stream it from (our mirror once it's there; until
 * then our own audio route, which mirrors it on first play) and their favourites.
 */
export async function soundtrackLibrary(db: Db, creatorId: string, publicUrl: (path: string) => string): Promise<{ tracks: LibraryTrack[]; favorites: string[] }> {
  const [files, favs] = await Promise.all([db.from("soundtrack_files").select("track_id, storage_path"), db.from("soundtrack_favourites").select("track_id").eq("creator_id", creatorId)]);
  const mirror = new Map((files.data ?? []).map((f) => [f.track_id, f.storage_path]));
  return {
    tracks: TRACKS.map((t) => {
      const path = mirror.get(t.id);
      return { ...t, audioUrl: path ? publicUrl(path) : `/api/v1/soundtrack/${t.id}/audio`, mirrored: !!path };
    }),
    favorites: (favs.data ?? []).map((f) => f.track_id).filter((id) => TRACKS.some((t) => t.id === id)),
  };
}

export async function setFavorite(db: Db, creatorId: string, trackId: string, on: boolean): Promise<void> {
  if (!TRACKS.some((t) => t.id === trackId)) throw new DomainError("not_found", "That song isn't in the library.");
  const res = on
    ? await db.from("soundtrack_favourites").upsert({ creator_id: creatorId, track_id: trackId })
    : await db.from("soundtrack_favourites").delete().eq("creator_id", creatorId).eq("track_id", trackId);
  if (res.error) throw new DomainError("internal", "Couldn't save that.", { cause: res.error });
}
