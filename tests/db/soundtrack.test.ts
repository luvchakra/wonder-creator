import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TRACKS, type Track } from "@wonder/creator-soundtrack";
import { mirrorSoundtrack, setFavorite, soundtrackLibrary, SOUNDTRACK_BUCKET, trackAudioPath } from "@wonder/creator-soundtrack/server";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let maya: TestCreator;
let other: TestCreator;
const db = (x: TestCreator) => x.client as unknown as AppDb;
// A minimal MP3 (ID3 header + one silent frame) standing in for a licensed file.
const mp3 = new Uint8Array([...Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00", "binary"), 0xff, 0xfb, 0x90, 0x64, ...new Array(413).fill(0)]);
const sha = createHash("sha256").update(mp3).digest("hex");
const fake = (id: string, over: Partial<Track> = {}): Track => ({ ...TRACKS[0]!, id, sha256: sha, bytes: mp3.byteLength, sourceUrl: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${id}.mp3`, ...over });
const serve = (bytes: Uint8Array, finalHost?: string) =>
  (async (url: string | URL) => {
    const u = new URL(String(url));
    if (finalHost && u.hostname !== finalHost) return new Response(null, { status: 302, headers: { location: `https://${finalHost}${u.pathname}` } });
    return new Response(bytes as unknown as BodyInit, { status: 200, headers: { "content-type": "audio/mpeg" } });
  }) as unknown as typeof fetch;
const resolve = async () => ["93.184.216.34"];

beforeAll(async () => {
  [maya, other] = await Promise.all(["sndMaya", "sndOther"].map((l) => createTestCreator(l)));
});
afterAll(async () => {
  await admin.from("soundtrack_files").delete().like("track_id", "test-%");
  await admin.storage.from(SOUNDTRACK_BUCKET).remove(["test-ok.mp3", "test-evil.mp3", "test-wronghost.mp3", "test-lazy.mp3"]);
  await cleanupTestCreators();
});

describe("soundtrack", () => {
  it("mirrors only files that match the catalogued hash, from the licensed hosts", async () => {
    const out = await mirrorSoundtrack(admin, {
      tracks: [fake("test-ok"), fake("test-evil", { sha256: "0".repeat(64) })],
      limit: 5,
      fetchImpl: serve(mp3),
      resolve,
    });
    expect(out).toEqual({ mirrored: ["test-ok"], failed: ["test-evil"] });
    const wrongHost = await mirrorSoundtrack(admin, { tracks: [fake("test-wronghost")], fetchImpl: serve(mp3, "evil.example.com"), resolve });
    expect(wrongHost.failed).toEqual(["test-wronghost"]);
    expect(expectOk(await admin.from("soundtrack_files").select("track_id").like("track_id", "test-%")).map((r) => r.track_id)).toEqual(["test-ok"]);
    // Already mirrored files aren't fetched again.
    expect((await mirrorSoundtrack(admin, { tracks: [fake("test-ok")], fetchImpl: serve(new Uint8Array()), resolve })).mirrored).toEqual([]);
    // First play mirrors a song on demand (same checks); a bad file never plays.
    expect(await trackAudioPath(admin, "test-lazy", { tracks: [fake("test-lazy")], fetchImpl: serve(mp3), resolve })).toBe("test-lazy.mp3");
    expect(await trackAudioPath(admin, "test-lazy", { tracks: [fake("test-lazy")], fetchImpl: serve(new Uint8Array()), resolve })).toBe("test-lazy.mp3");
    await expect(trackAudioPath(admin, "test-bad", { tracks: [fake("test-bad", { sha256: "0".repeat(64) })], fetchImpl: serve(mp3), resolve })).rejects.toThrow(/can't play right now/);
    await expect(trackAudioPath(admin, "nope", { tracks: [] })).rejects.toThrow(/isn't in the library/);
    // Clients can't write the mirror table.
    expect((await db(maya).from("soundtrack_files").insert({ track_id: "test-forged", storage_path: "x.mp3", sha256: sha, size_bytes: 1 })).error).not.toBeNull();
  });

  it("streams only from our own storage or our own audio route; favourites are private", async () => {
    const lib = await soundtrackLibrary(db(maya), maya.creatorId, (p) => `https://cdn.test/${p}`);
    expect(lib.tracks).toHaveLength(TRACKS.length);
    expect(lib.tracks.every((t) => t.audioUrl === `/api/v1/soundtrack/${t.id}/audio` || t.audioUrl.startsWith("https://cdn.test/"))).toBe(true);
    await setFavorite(db(maya), maya.creatorId, TRACKS[1]!.id, true);
    expect((await soundtrackLibrary(db(maya), maya.creatorId, (p) => p)).favorites).toEqual([TRACKS[1]!.id]);
    expect((await soundtrackLibrary(db(other), other.creatorId, (p) => p)).favorites).toEqual([]);
    expect(expectOk(await db(other).from("soundtrack_favourites").select("*").eq("creator_id", maya.creatorId))).toEqual([]);
    expect((await db(other).from("soundtrack_favourites").insert({ creator_id: maya.creatorId, track_id: TRACKS[0]!.id })).error).not.toBeNull();
    await expect(setFavorite(db(maya), maya.creatorId, "not-a-track", true)).rejects.toThrow(/isn't in the library/);
    await setFavorite(db(maya), maya.creatorId, TRACKS[1]!.id, false);
    expect((await soundtrackLibrary(db(maya), maya.creatorId, (p) => p)).favorites).toEqual([]);
  });
});
