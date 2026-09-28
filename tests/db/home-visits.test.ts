import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createTestCreator, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("visitA"), createTestCreator("visitB")]);
});
afterAll(cleanupTestCreators);

describe("Home visits", () => {
  it("returns the end of the previous visit, only after a 30-minute gap", async () => {
    // First visit: nothing before it.
    expect((await a.client.rpc("mark_home_visit")).data).toBeNull();
    // Still the same visit: nothing changes.
    expect((await a.client.rpc("mark_home_visit")).data).toBeNull();

    // A visit that ended yesterday becomes "last here".
    const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString();
    await admin.from("creator_visits").update({ last_seen_at: yesterday }).eq("creator_id", a.creatorId);
    const prev = (await a.client.rpc("mark_home_visit")).data as string | null;
    expect(prev && Date.parse(prev)).toBe(Date.parse(yesterday));
    // And stays so for the rest of this visit.
    expect(Date.parse((await a.client.rpc("mark_home_visit")).data as string)).toBe(Date.parse(yesterday));
  });

  it("is private to the creator and written only through the function", async () => {
    await b.client.rpc("mark_home_visit");
    expect((await b.client.from("creator_visits").select("creator_id")).data?.map((r) => r.creator_id)).toEqual([b.creatorId]);
    expect((await b.client.from("creator_visits").select("creator_id").eq("creator_id", a.creatorId)).data).toEqual([]);
    const write = await b.client.from("creator_visits").update({ previous_seen_at: null }).eq("creator_id", b.creatorId).select("creator_id");
    expect(write.data ?? []).toEqual([]);
    const insert = await b.client.from("creator_visits").insert({ creator_id: a.creatorId });
    expect(insert.error).not.toBeNull();
  });
});
