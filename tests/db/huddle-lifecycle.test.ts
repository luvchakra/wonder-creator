import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureHuddle, declineInvite, huddleSummary, preserve, relatedItem, roomState, saveMoment, sendMessage, startHuddle } from "@wonder/creator-huddle";
import { createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

let a: TestCreator; // host
let b: TestCreator; // invited, joins
let c: TestCreator; // invited, declines
let d: TestCreator; // outsider
let huddle: string;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

async function admit(guest: TestCreator) {
  const requestId = expectOk(await guest.client.rpc("huddle_request_join", { p_huddle: huddle }));
  expectOk(await a.client.rpc("huddle_resolve_request", { p_request: requestId, p_approve: true }));
  expectOk(await guest.client.rpc("huddle_enter", { p_huddle: huddle }));
}

beforeAll(async () => {
  [a, b, c, d] = await Promise.all([createTestCreator("hlHost"), createTestCreator("hlGuest"), createTestCreator("hlDecliner"), createTestCreator("hlOutsider")]);
  piece = (await createArtifact(db(a), a.creatorId, { artifactType: "screenplay", title: "Lighthouse draft", content: "INT. LIGHTHOUSE - NIGHT", authorKind: "creator", provenance: { origin: "typed" } })).id;
  huddle = await startHuddle(db(a), { topic: "Lighthouse script", description: "Table read, act one.", relatedArtifactId: piece, invite: [b.creatorId, c.creatorId] });
});
afterAll(async () => {
  await a.client.rpc("huddle_end", { p_huddle: huddle });
  await cleanupTestCreators();
});

describe("creating and inviting", () => {
  it("records settings, and only the host can change them", async () => {
    const state = await roomState(db(a), huddle, a.creatorId);
    expect(state.huddle).toMatchObject({ description: "Table read, act one.", chat_saving_since: null, related_artifact_id: piece });
    expect(state.invitations.map((i) => [i.creatorId, i.status])).toEqual(expect.arrayContaining([[b.creatorId, "pending"], [c.creatorId, "pending"]]));
    await expect(configureHuddle(db(d), huddle, { allowSavingChat: true })).rejects.toThrow(/Only the host/);
    // Linking someone else's private piece isn't possible.
    const other = (await createArtifact(db(d), d.creatorId, { artifactType: "poem", title: "Private", content: "x", authorKind: "creator", provenance: { origin: "typed" } })).id;
    await expect(configureHuddle(db(a), huddle, { relatedArtifactId: other })).rejects.toThrow(/can only link/);
  });

  it("invitations can be declined or accepted by joining", async () => {
    await declineInvite(db(c), huddle);
    await expect(declineInvite(db(c), huddle)).rejects.toThrow(/isn't open/);
    await admit(b);
    const inv = await roomState(db(a), huddle, a.creatorId);
    expect(Object.fromEntries(inv.invitations.map((i) => [i.creatorId, i.status]))).toMatchObject({ [b.creatorId]: "accepted", [c.creatorId]: "declined" });
  });

  it("participants see the related piece's title, and open it only if they already can", async () => {
    expect(await relatedItem(db(b), huddle)).toEqual({ kind: "artifact", id: null, title: "Lighthouse draft", canOpen: false });
    expect(await relatedItem(db(a), huddle)).toMatchObject({ id: piece, canOpen: true });
    expect(await relatedItem(db(d), huddle)).toBeNull();
  });
});

describe("saving moments (no consent assumed)", () => {
  it("your own messages always; others' only if sent while the host allowed saving", async () => {
    const before = await sendMessage(db(a), a.creatorId, huddle, { body: "The keeper never sleeps." });
    const mine = await sendMessage(db(b), b.creatorId, huddle, { body: "What if the lamp fails?" });
    await expect(saveMoment(db(b), b.creatorId, huddle, before.id)).rejects.toThrow(/Only your own messages/);
    expect((await saveMoment(db(b), b.creatorId, huddle, mine.id)).text_content).toBe("What if the lamp fails?");
    await configureHuddle(db(a), huddle, { allowSavingChat: true });
    const after = await sendMessage(db(a), a.creatorId, huddle, { body: "Then the ships find their own way." });
    const saved = await saveMoment(db(b), b.creatorId, huddle, after.id);
    expect(saved.text_content).toMatch(/“Then the ships find their own way\.”\n— /);
    // Allowing later never opens up what was said before.
    await expect(saveMoment(db(b), b.creatorId, huddle, before.id)).rejects.toThrow(/Only your own messages/);
    await expect(saveMoment(db(d), d.creatorId, huddle, after.id)).rejects.toThrow();
  });
});

describe("after the Huddle", () => {
  it("each participant keeps a private summary: topic, who they met, what they saved; the chat is gone", async () => {
    expectOk(await b.client.rpc("huddle_leave", { p_huddle: huddle }));
    expectOk(await a.client.rpc("huddle_leave", { p_huddle: huddle }));
    const sb = (await huddleSummary(db(b), huddle))!;
    expect(sb).toMatchObject({ topic: "Lighthouse script", role: "member" });
    expect(sb.endedAt).toBeTruthy();
    expect(sb.met.map((m) => m.id)).toEqual([a.creatorId]);
    expect(sb.saved).toHaveLength(2);
    expect((await huddleSummary(db(a), huddle))!.met.map((m) => m.id)).toEqual([b.creatorId]);
    expect(await huddleSummary(db(c), huddle)).toBeNull();
    expect(await huddleSummary(db(d), huddle)).toBeNull();
    expect(expectOk(await a.client.from("huddle_history").select("creator_id").eq("huddle_id", huddle)).map((r) => r.creator_id)).toEqual([a.creatorId]);
    const { count } = await b.client.from("huddle_messages").select("id", { count: "exact", head: true }).eq("huddle_id", huddle);
    expect(count).toBe(0);
  });

  it("participants can still add their own notes; others can't", async () => {
    const note = await preserve(db(b), b.creatorId, huddle, { kind: "idea", text: "Open on the lamp." });
    expect(note.title).toBe("From the Huddle: Lighthouse script");
    expect((await huddleSummary(db(b), huddle))!.saved).toHaveLength(3);
    await expect(preserve(db(d), d.creatorId, huddle, { kind: "idea", text: "x" })).rejects.toThrow(/has ended/);
  });
});
