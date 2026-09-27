import { describe, expect, it } from "vitest";
import { TRACKS } from "./catalog";
import { buildQueue, formatDuration, moreLikeThis, previousAction, rankTracks, tracksForMood } from "./queue";
import { MOODS } from "./types";

describe("soundtrack catalogue", () => {
  it("covers every mood with properly licensed, verified tracks", () => {
    for (const m of MOODS) expect(tracksForMood(TRACKS, m).length, m).toBeGreaterThanOrEqual(3);
    for (const t of TRACKS) {
      expect(t.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(t.license).toMatch(/CC BY 4\.0|CC0/);
      if (t.license.startsWith("CC BY")) expect(t.attribution).toContain("Kevin MacLeod");
      expect(new URL(t.sourceUrl).hostname).toMatch(/^(incompetech\.com|archive\.org)$/);
    }
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });
});

describe("queues", () => {
  it("filters by mood, avoids recent tracks and nudges favourites", () => {
    const calm = rankTracks(TRACKS, { mood: "calm" });
    expect(calm.every((t) => t.moods.includes("calm"))).toBe(true);
    const top = calm[0]!.id;
    expect(rankTracks(TRACKS, { mood: "calm", history: [top] })[0]!.id).not.toBe(top);
    const last = calm[calm.length - 1]!.id;
    expect(rankTracks(TRACKS, { mood: "calm", favorites: [last] }).findIndex((t) => t.id === last)).toBeLessThan(calm.length - 1);
  });

  it("focus prefers calm instrumental tracks; the queue keeps energy coherent", () => {
    expect(rankTracks(TRACKS, { mood: "focus" }).slice(0, 3).every((t) => t.energy !== "high")).toBe(true);
    const q = buildQueue(TRACKS, { mood: "all", seed: 3 }).map((id) => TRACKS.find((t) => t.id === id)!);
    const lvl = { low: 0, medium: 1, high: 2 } as const;
    for (let i = 1; i < q.length; i++) expect(Math.abs(lvl[q[i]!.energy] - lvl[q[i - 1]!.energy])).toBeLessThanOrEqual(1);
  });

  it("refresh gives a different, stable mix; the current track is excluded", () => {
    const a = buildQueue(TRACKS, { mood: "all", seed: 1 });
    expect(buildQueue(TRACKS, { mood: "all", seed: 1 })).toEqual(a);
    expect(buildQueue(TRACKS, { mood: "all", seed: 2 })).not.toEqual(a);
    expect(buildQueue(TRACKS, { mood: "all", seed: 1, exclude: [a[0]!] })).not.toContain(a[0]);
  });

  it("more like this shares moods; previous restarts after 5 seconds", () => {
    const nocturne = TRACKS.find((t) => t.id.startsWith("chopin-nocturne-in-e-flat"))!;
    const like = moreLikeThis(TRACKS, nocturne).map((id) => TRACKS.find((t) => t.id === id)!);
    expect(like.length).toBeGreaterThan(2);
    expect(like.every((t) => t.moods.some((m) => nocturne.moods.includes(m)))).toBe(true);
    expect(previousAction(12, ["a"])).toEqual({ kind: "restart" });
    expect(previousAction(2, ["a"])).toEqual({ kind: "track", id: "a" });
    expect(formatDuration(198)).toBe("3:18");
  });
});
