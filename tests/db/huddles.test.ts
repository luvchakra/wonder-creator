import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  cleanupTestCreators,
  createMaterial,
  createTestCreator,
  expectDenied,
  expectNoRowsAffected,
  expectOk,
  type Db,
  type TestCreator,
} from "./helpers";

const admin = adminClient();

afterAll(cleanupTestCreators);

async function cards(client: Db) {
  return expectOk(await client.rpc("live_huddle_cards", { p_limit: 100 }));
}

async function card(client: Db, huddleId: string) {
  return (await cards(client)).find((c) => c.huddle_id === huddleId);
}

async function start(c: TestCreator, topic = "Jam session", discoverability: "public" | "invite_only" = "public") {
  return expectOk(await c.client.rpc("huddle_start", { p_topic: topic, p_discoverability: discoverability }));
}

/** host starts, guest requests, host approves, guest enters. */
async function admit(host: TestCreator, guest: TestCreator, huddleId: string) {
  const requestId = expectOk(await guest.client.rpc("huddle_request_join", { p_huddle: huddleId }));
  expectOk(await host.client.rpc("huddle_resolve_request", { p_request: requestId, p_approve: true }));
  expectOk(await guest.client.rpc("huddle_enter", { p_huddle: huddleId }));
}

async function huddleStatus(huddleId: string) {
  return expectOk(await admin.from("huddles").select("status, topic, dissolved_at, media_room_id").eq("id", huddleId).single());
}

async function participant(huddleId: string, creatorId: string) {
  const res = await admin
    .from("huddle_participants")
    .select("role, status")
    .eq("huddle_id", huddleId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  expect(res.error).toBeNull();
  return res.data;
}

function pair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

describe("huddle lifecycle", () => {
  let a: TestCreator; // host
  let b: TestCreator; // joins
  let c: TestCreator; // outsider, later declined
  let h: string;
  let requestB: string;
  let requestC: string;
  let bMaterial: string;
  let aMaterial: string;
  let cMaterial: string;

  beforeAll(async () => {
    [a, b, c] = await Promise.all([createTestCreator("hudA"), createTestCreator("hudB"), createTestCreator("hudC")]);
    [aMaterial, bMaterial, cMaterial] = await Promise.all([createMaterial(a), createMaterial(b), createMaterial(c)]);
  });

  it("A starts a huddle and is its joined host", async () => {
    h = await start(a, "Late-night poetry");
    expect(expectOk(await a.client.from("huddles").select("id, status, topic").eq("id", h))).toEqual([
      { id: h, status: "live", topic: "Late-night poetry" },
    ]);
    expect(await participant(h, a.creatorId)).toEqual({ role: "host", status: "joined" });
  });

  it("A cannot start a second huddle while in a live one", async () => {
    expectDenied(await a.client.rpc("huddle_start", { p_topic: "Second" }), "23505");
  });

  it("rejects an invalid discoverability value", async () => {
    expectDenied(await c.client.rpc("huddle_start", { p_topic: "x", p_discoverability: "secret" }), "22023");
  });

  it("anon cannot list live huddles", async () => {
    expectDenied(await anonClient().rpc("live_huddle_cards", {}));
  });

  it("B sees the huddle as a live card with public metadata only", async () => {
    const found = await card(b.client, h);
    expect(found).toBeDefined();
    expect(Object.keys(found!).sort()).toEqual(
      ["huddle_id", "participant_count", "participant_ids", "participant_names", "started_at", "topic", "viewer_state"].sort(),
    );
    expect(found).toMatchObject({
      topic: "Late-night poetry",
      participant_count: 1,
      participant_ids: [a.creatorId],
      viewer_state: "none",
    });
  });

  it("B cannot read the huddle, its participants or messages directly", async () => {
    expect(expectOk(await b.client.from("huddles").select("id").eq("id", h))).toHaveLength(0);
    expect(expectOk(await b.client.from("huddle_participants").select("creator_id").eq("huddle_id", h))).toHaveLength(0);
    expect(expectOk(await b.client.from("huddle_messages").select("id").eq("huddle_id", h))).toHaveLength(0);
    expect(expectOk(await b.client.from("huddle_events").select("id").eq("huddle_id", h))).toHaveLength(0);
  });

  it("B cannot insert itself as a participant or mutate the huddle directly", async () => {
    expectDenied(
      await b.client.from("huddle_participants").insert({ huddle_id: h, creator_id: b.creatorId, role: "host", status: "joined" }),
      "42501",
    );
    expectNoRowsAffected(await b.client.from("huddles").update({ topic: "hijacked" }).eq("id", h).select());
    expect((await huddleStatus(h)).topic).toBe("Late-night poetry");
  });

  it("B requests to join and sees only its own request", async () => {
    requestB = expectOk(await b.client.rpc("huddle_request_join", { p_huddle: h, p_message: "Can I join?" }));
    const own = expectOk(await b.client.from("huddle_join_requests").select("id, status, requester_creator_id").eq("huddle_id", h));
    expect(own).toEqual([{ id: requestB, status: "pending", requester_creator_id: b.creatorId }]);
    expect((await card(b.client, h))?.viewer_state).toBe("requested");
    expect(expectOk(await b.client.from("huddles").select("id").eq("id", h))).toHaveLength(0);
  });

  it("B cannot file a duplicate pending request", async () => {
    expectDenied(await b.client.rpc("huddle_request_join", { p_huddle: h }), "23505");
  });

  it("A (participant) sees the pending request", async () => {
    const rows = expectOk(await a.client.from("huddle_join_requests").select("id").eq("huddle_id", h));
    expect(rows.map((r) => r.id)).toContain(requestB);
  });

  it("B cannot resolve its own request", async () => {
    expectDenied(await b.client.rpc("huddle_resolve_request", { p_request: requestB, p_approve: true }));
    expectNoRowsAffected(
      await b.client.from("huddle_join_requests").update({ status: "approved" }).eq("id", requestB).select(),
    );
    expect(await participant(h, b.creatorId)).toBeNull();
  });

  it("C (non-participant) cannot resolve B's request", async () => {
    expectDenied(await c.client.rpc("huddle_resolve_request", { p_request: requestB, p_approve: true }), "P0002");
    expect(await participant(h, b.creatorId)).toBeNull();
  });

  it("B cannot enter before approval", async () => {
    expectDenied(await b.client.rpc("huddle_enter", { p_huddle: h }), "42501");
  });

  it("A approves; B becomes a joining participant", async () => {
    expectOk(await a.client.rpc("huddle_resolve_request", { p_request: requestB, p_approve: true }));
    expect(await participant(h, b.creatorId)).toEqual({ role: "member", status: "joining" });
    expect((await card(b.client, h))?.viewer_state).toBe("approved");
    // Joining creators may see the huddle row and their own participant row, but not chat.
    expect(expectOk(await b.client.from("huddles").select("id").eq("id", h))).toHaveLength(1);
    const visible = expectOk(await b.client.from("huddle_participants").select("creator_id").eq("huddle_id", h));
    expect(visible.map((p) => p.creator_id)).toEqual([b.creatorId]);
    expect(expectOk(await b.client.from("huddle_messages").select("id").eq("huddle_id", h))).toHaveLength(0);
  });

  it("an already-resolved request cannot be resolved again", async () => {
    expectDenied(await a.client.rpc("huddle_resolve_request", { p_request: requestB, p_approve: false }), "22023");
  });

  it("B cannot chat before entering", async () => {
    expectDenied(await b.client.from("huddle_messages").insert({ huddle_id: h, creator_id: b.creatorId, body: "early" }), "42501");
  });

  it("B enters and can see all participants", async () => {
    expectOk(await b.client.rpc("huddle_enter", { p_huddle: h }));
    expect(await participant(h, b.creatorId)).toEqual({ role: "member", status: "joined" });
    const visible = expectOk(await b.client.from("huddle_participants").select("creator_id").eq("huddle_id", h));
    expect(visible.map((p) => p.creator_id).sort()).toEqual([a.creatorId, b.creatorId].sort());
    expect((await card(c.client, h))?.participant_count).toBe(2);
  });

  it("participants can send and read messages", async () => {
    expectOk(await a.client.from("huddle_messages").insert({ huddle_id: h, creator_id: a.creatorId, body: "welcome" }));
    expectOk(await b.client.from("huddle_messages").insert({ huddle_id: h, creator_id: b.creatorId, body: "thanks" }));
    for (const client of [a.client, b.client]) {
      const msgs = expectOk(await client.from("huddle_messages").select("body").eq("huddle_id", h).order("created_at"));
      expect(msgs.map((m) => m.body)).toEqual(["welcome", "thanks"]);
    }
  });

  it("a participant cannot send a message as someone else", async () => {
    expectDenied(await b.client.from("huddle_messages").insert({ huddle_id: h, creator_id: a.creatorId, body: "spoof" }), "42501");
  });

  it("C (non-participant) cannot read or send messages", async () => {
    expect(expectOk(await c.client.from("huddle_messages").select("id").eq("huddle_id", h))).toHaveLength(0);
    expectDenied(await c.client.from("huddle_messages").insert({ huddle_id: h, creator_id: c.creatorId, body: "hi" }), "42501");
    expectDenied(await c.client.from("huddle_messages").insert({ huddle_id: h, creator_id: b.creatorId, body: "hi" }), "42501");
  });

  it("participants cannot edit or delete chat history", async () => {
    expectNoRowsAffected(await a.client.from("huddle_messages").update({ body: "edited" }).eq("huddle_id", h).select());
    expectNoRowsAffected(await b.client.from("huddle_messages").delete().eq("huddle_id", h).select());
    expect(expectOk(await admin.from("huddle_messages").select("id").eq("huddle_id", h))).toHaveLength(2);
  });

  it("heartbeat reports live for participants and not_joined for outsiders", async () => {
    expect(expectOk(await b.client.rpc("huddle_heartbeat", { p_huddle: h, p_audio: true }))).toBe("live");
    expect(expectOk(await c.client.rpc("huddle_heartbeat", { p_huddle: h }))).toBe("not_joined");
  });

  it("a non-participant cannot invite others", async () => {
    expectDenied(await c.client.rpc("huddle_invite", { p_huddle: h, p_invitee: b.creatorId }), "42501");
  });

  it("C requests, A declines; C cannot enter", async () => {
    requestC = expectOk(await c.client.rpc("huddle_request_join", { p_huddle: h }));
    expectOk(await a.client.rpc("huddle_resolve_request", { p_request: requestC, p_approve: false }));
    const row = expectOk(await c.client.from("huddle_join_requests").select("status, resolved_by_creator_id").eq("id", requestC).single());
    expect(row).toEqual({ status: "declined", resolved_by_creator_id: a.creatorId });
    expectDenied(await c.client.rpc("huddle_enter", { p_huddle: h }), "42501");
    expect(await participant(h, c.creatorId)).toBeNull();
    expect((await card(c.client, h))?.viewer_state).toBe("none");
  });

  it("a requester can cancel their own pending request only", async () => {
    const again = expectOk(await c.client.rpc("huddle_request_join", { p_huddle: h }));
    expectDenied(await b.client.rpc("huddle_cancel_request", { p_request: again }), "P0002");
    expectOk(await c.client.rpc("huddle_cancel_request", { p_request: again }));
    const row = expectOk(await c.client.from("huddle_join_requests").select("status").eq("id", again).single());
    expect(row.status).toBe("cancelled");
  });

  it("preserved items: participant with own material only", async () => {
    expectOk(
      await b.client.from("huddle_preserved_items").insert({ huddle_id: h, creator_id: b.creatorId, kind: "material", material_id: bMaterial }),
    );
    expectDenied(
      await b.client.from("huddle_preserved_items").insert({ huddle_id: h, creator_id: b.creatorId, kind: "material", material_id: aMaterial }),
      "42501",
    );
    expectDenied(
      await c.client.from("huddle_preserved_items").insert({ huddle_id: h, creator_id: c.creatorId, kind: "material", material_id: cMaterial }),
      "42501",
    );
    expectDenied(
      await b.client.from("huddle_preserved_items").insert({ huddle_id: h, creator_id: a.creatorId, kind: "idea" }),
      "42501",
    );
    expect(expectOk(await a.client.from("huddle_preserved_items").select("id").eq("huddle_id", h))).toHaveLength(0);
    expect(expectOk(await b.client.from("huddle_preserved_items").select("material_id").eq("huddle_id", h))).toEqual([
      { material_id: bMaterial },
    ]);
  });

  it("member B cannot remove participants or end the huddle", async () => {
    expectDenied(await b.client.rpc("huddle_remove_participant", { p_huddle: h, p_creator: a.creatorId }), "42501");
    expectDenied(await b.client.rpc("huddle_end", { p_huddle: h }), "42501");
    expect((await huddleStatus(h)).status).toBe("live");
  });

  it("when the host leaves, host passes to the remaining member", async () => {
    expect(expectOk(await a.client.rpc("huddle_leave", { p_huddle: h }))).toBe(false);
    expect(await participant(h, a.creatorId)).toEqual({ role: "member", status: "left" });
    expect(await participant(h, b.creatorId)).toEqual({ role: "host", status: "joined" });
    expect((await huddleStatus(h)).status).toBe("live");
    // A has left: no more chat access.
    expect(expectOk(await a.client.from("huddle_messages").select("id").eq("huddle_id", h))).toHaveLength(0);
  });

  it("a non-participant cannot leave", async () => {
    expectDenied(await c.client.rpc("huddle_leave", { p_huddle: h }), "42501");
  });

  it("when the last participant leaves, the huddle dissolves and ephemeral state is deleted", async () => {
    expect(expectOk(await b.client.rpc("huddle_leave", { p_huddle: h }))).toBe(true);
    const status = await huddleStatus(h);
    expect(status.status).toBe("dissolved");
    expect(status.topic).toBeNull();
    expect(status.media_room_id).toBeNull();
    expect(status.dissolved_at).not.toBeNull();
    for (const table of ["huddle_messages", "huddle_participants", "huddle_join_requests", "huddle_invitations"] as const) {
      const rows = expectOk(await admin.from(table).select("huddle_id").eq("huddle_id", h));
      expect(rows, table).toHaveLength(0);
    }
  });

  it("explicitly preserved items survive dissolution", async () => {
    expect(expectOk(await b.client.from("huddle_preserved_items").select("material_id").eq("huddle_id", h))).toEqual([
      { material_id: bMaterial },
    ]);
  });

  it("a relationship signal exists for A and B, visible to both but not to C", async () => {
    const [ca, cb] = pair(a.creatorId, b.creatorId);
    for (const client of [a.client, b.client]) {
      const rows = expectOk(
        await client.from("creator_relationships").select("met_in_huddle_count").eq("creator_a", ca).eq("creator_b", cb),
      );
      expect(rows).toEqual([{ met_in_huddle_count: 1 }]);
    }
    expect(expectOk(await c.client.from("creator_relationships").select("creator_a"))).toHaveLength(0);
    // C was never joined, so has no relationship rows at all.
    const cRows = expectOk(
      await admin.from("creator_relationships").select("creator_a").or(`creator_a.eq.${c.creatorId},creator_b.eq.${c.creatorId}`),
    );
    expect(cRows).toHaveLength(0);
  });

  it("a dissolved huddle cannot be entered, joined, or kept alive", async () => {
    expectDenied(await a.client.rpc("huddle_enter", { p_huddle: h }), "P0002");
    expectDenied(await c.client.rpc("huddle_request_join", { p_huddle: h }), "P0002");
    expect(expectOk(await a.client.rpc("huddle_heartbeat", { p_huddle: h }))).toBe("dissolved");
    expect(await card(c.client, h)).toBeUndefined();
    expect(expectOk(await a.client.from("huddles").select("id").eq("id", h))).toHaveLength(0);
  });

  it("A can start a new huddle once the previous one dissolved", async () => {
    const next = await start(a, "Round two");
    expectOk(await a.client.rpc("huddle_end", { p_huddle: next }));
    expect((await huddleStatus(next)).status).toBe("dissolved");
  });
});

describe("invite-only huddles", () => {
  let host: TestCreator;
  let invitee: TestCreator;
  let outsider: TestCreator;
  let h: string;

  beforeAll(async () => {
    [host, invitee, outsider] = await Promise.all([
      createTestCreator("invHost"),
      createTestCreator("invGuest"),
      createTestCreator("invOutsider"),
    ]);
    h = await start(host, "Private session", "invite_only");
  });

  afterAll(async () => {
    await host.client.rpc("huddle_end", { p_huddle: h });
  });

  it("is not listed for non-invitees", async () => {
    expect(await card(outsider.client, h)).toBeUndefined();
    expect(await card(invitee.client, h)).toBeUndefined();
  });

  it("non-invitees cannot request to join", async () => {
    expectDenied(await outsider.client.rpc("huddle_request_join", { p_huddle: h }), "P0002");
  });

  it("only participants can invite, and not themselves", async () => {
    expectDenied(await outsider.client.rpc("huddle_invite", { p_huddle: h, p_invitee: outsider.creatorId }), "42501");
    expectDenied(await host.client.rpc("huddle_invite", { p_huddle: h, p_invitee: host.creatorId }), "22023");
  });

  it("an invited creator sees the card and can request to join", async () => {
    expectOk(await host.client.rpc("huddle_invite", { p_huddle: h, p_invitee: invitee.creatorId }));
    expect(await card(invitee.client, h)).toBeDefined();
    const inv = expectOk(await invitee.client.from("huddle_invitations").select("invitee_creator_id").eq("huddle_id", h));
    expect(inv).toEqual([{ invitee_creator_id: invitee.creatorId }]);
    expectOk(await invitee.client.rpc("huddle_request_join", { p_huddle: h }));
    // Still invisible to the outsider.
    expect(await card(outsider.client, h)).toBeUndefined();
    expect(expectOk(await outsider.client.from("huddle_invitations").select("huddle_id").eq("huddle_id", h))).toHaveLength(0);
  });
});

describe("blocked creators", () => {
  let host: TestCreator;
  let blocked: TestCreator;
  let h: string;

  beforeAll(async () => {
    [host, blocked] = await Promise.all([createTestCreator("blkHost"), createTestCreator("blkGuest")]);
    expectOk(await host.client.from("creator_blocks").insert({ blocker_creator_id: host.creatorId, blocked_creator_id: blocked.creatorId }));
    h = await start(host, "No trolls");
  });

  afterAll(async () => {
    await host.client.rpc("huddle_end", { p_huddle: h });
  });

  it("a blocked creator does not see the blocker's huddle", async () => {
    expect(await card(blocked.client, h)).toBeUndefined();
    expect(expectOk(await blocked.client.rpc("live_huddle_cards", { p_creator: host.creatorId }))).toHaveLength(0);
  });

  it("a blocked creator cannot request to join", async () => {
    expectDenied(await blocked.client.rpc("huddle_request_join", { p_huddle: h }), "P0002");
    expect(expectOk(await admin.from("huddle_join_requests").select("id").eq("huddle_id", h))).toHaveLength(0);
  });

  it("a blocked creator cannot see the blocker's profile", async () => {
    const rows = expectOk(await blocked.client.from("creators").select("id").eq("id", host.creatorId));
    expect(rows).toHaveLength(0);
  });
});

describe("host-only controls", () => {
  let host: TestCreator;
  let member: TestCreator;
  let outsider: TestCreator;

  beforeAll(async () => {
    [host, member, outsider] = await Promise.all([
      createTestCreator("ctlHost"),
      createTestCreator("ctlMember"),
      createTestCreator("ctlOutsider"),
    ]);
  });

  it("the host can remove a participant, who cannot re-enter without a new request", async () => {
    const h = await start(host, "Moderated");
    await admit(host, member, h);
    expectDenied(await host.client.rpc("huddle_remove_participant", { p_huddle: h, p_creator: host.creatorId }), "22023");
    expectOk(await host.client.rpc("huddle_remove_participant", { p_huddle: h, p_creator: member.creatorId }));
    expect(await participant(h, member.creatorId)).toEqual({ role: "member", status: "left" });
    expectDenied(await member.client.rpc("huddle_enter", { p_huddle: h }), "42501");
    expect(expectOk(await member.client.from("huddle_messages").select("id").eq("huddle_id", h))).toHaveLength(0);
    expectOk(await host.client.rpc("huddle_end", { p_huddle: h }));
  });

  it("the host can end the huddle; members met are recorded", async () => {
    const h = await start(host, "To be ended");
    await admit(host, member, h);
    expectDenied(await member.client.rpc("huddle_end", { p_huddle: h }), "42501");
    expectOk(await host.client.rpc("huddle_end", { p_huddle: h }));
    expect((await huddleStatus(h)).status).toBe("dissolved");
    const [ca, cb] = pair(host.creatorId, member.creatorId);
    const rel = expectOk(
      await member.client.from("creator_relationships").select("met_in_huddle_count").eq("creator_a", ca).eq("creator_b", cb).single(),
    );
    // Previous test (removed member) + this one.
    expect(rel.met_in_huddle_count).toBe(2);
  });

  it("a non-participant cannot end someone else's huddle", async () => {
    const h = await start(host, "Protected from outsiders");
    const res = await outsider.client.rpc("huddle_end", { p_huddle: h });
    const status = (await huddleStatus(h)).status;
    await host.client.rpc("huddle_end", { p_huddle: h });
    expect(status).toBe("live");
    expect(res.error).not.toBeNull();
  });

  it("a non-participant cannot remove participants from someone else's huddle", async () => {
    const h = await start(host, "Protected roster");
    await admit(host, member, h);
    const res = await outsider.client.rpc("huddle_remove_participant", { p_huddle: h, p_creator: member.creatorId });
    const memberRow = await participant(h, member.creatorId);
    await host.client.rpc("huddle_end", { p_huddle: h });
    expect(memberRow).toEqual({ role: "member", status: "joined" });
    expect(res.error).not.toBeNull();
  });
});

describe("stale presence cleanup", () => {
  let host: TestCreator;
  let member: TestCreator;
  let h: string;

  beforeAll(async () => {
    [host, member] = await Promise.all([createTestCreator("staleHost"), createTestCreator("staleMember")]);
    h = await start(host, "Going stale");
    await admit(host, member, h);
  });

  it("is not callable by authenticated creators", async () => {
    expectDenied(await host.client.rpc("huddle_cleanup_stale", { p_timeout_seconds: 0 }), "42501");
    expect((await huddleStatus(h)).status).toBe("live");
  });

  it("is not callable by anon", async () => {
    expectDenied(await anonClient().rpc("huddle_cleanup_stale", { p_timeout_seconds: 0 }));
  });

  it("dissolves huddles whose participants all went stale (secret key)", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expectOk(await admin.from("huddle_participants").update({ last_seen_at: old }).eq("huddle_id", h));
    // A generous timeout keeps other, fresh huddles untouched.
    const count = expectOk(await admin.rpc("huddle_cleanup_stale", { p_timeout_seconds: 3600 }));
    expect(count).toBeGreaterThanOrEqual(2);
    const status = await huddleStatus(h);
    expect(status.status).toBe("dissolved");
    expect(status.topic).toBeNull();
    expect(expectOk(await admin.from("huddle_participants").select("creator_id").eq("huddle_id", h))).toHaveLength(0);
    const [ca, cb] = pair(host.creatorId, member.creatorId);
    const rel = expectOk(
      await host.client.from("creator_relationships").select("met_in_huddle_count").eq("creator_a", ca).eq("creator_b", cb).single(),
    );
    expect(rel.met_in_huddle_count).toBe(1);
    expect(expectOk(await member.client.rpc("huddle_heartbeat", { p_huddle: h }))).toBe("dissolved");
  });
});

describe("one live huddle at a time", () => {
  let x: TestCreator;
  let y: TestCreator;

  beforeAll(async () => {
    [x, y] = await Promise.all([createTestCreator("oneX"), createTestCreator("oneY")]);
  });

  it("a creator joined in a live huddle cannot enter another one", async () => {
    const hx = await start(x, "X's room");
    const hy = await start(y, "Y's room");
    const req = expectOk(await x.client.rpc("huddle_request_join", { p_huddle: hy }));
    expectOk(await y.client.rpc("huddle_resolve_request", { p_request: req, p_approve: true }));
    const res = await x.client.rpc("huddle_enter", { p_huddle: hy });
    const row = await participant(hy, x.creatorId);
    await x.client.rpc("huddle_end", { p_huddle: hx });
    expectDenied(res, "23505");
    expect(row).toEqual({ role: "member", status: "joining" });
    // Once X's own huddle is gone, X may enter.
    expectOk(await x.client.rpc("huddle_enter", { p_huddle: hy }));
    expect(await participant(hy, x.creatorId)).toEqual({ role: "member", status: "joined" });
    expectOk(await y.client.rpc("huddle_end", { p_huddle: hy }));
  });

  it("re-entering the same huddle is not blocked by the check", async () => {
    const hy = await start(y, "Rejoin");
    await admit(y, x, hy);
    expect(expectOk(await x.client.rpc("huddle_leave", { p_huddle: hy }))).toBe(false);
    expectOk(await x.client.rpc("huddle_enter", { p_huddle: hy }));
    expect(await participant(hy, x.creatorId)).toEqual({ role: "member", status: "joined" });
    expectOk(await y.client.rpc("huddle_end", { p_huddle: hy }));
  });
});

describe("live cards count only recently-seen participants", () => {
  it("drops a participant whose heartbeat went stale, and hides a Huddle with nobody fresh", async () => {
    const [host, guest, viewer] = await Promise.all([createTestCreator("freshHost"), createTestCreator("freshGuest"), createTestCreator("freshViewer")]);
    const huddleId = await start(host, "Night walk");
    await admit(host, guest, huddleId);
    expect((await card(viewer.client, huddleId))?.participant_count).toBe(2);

    // Guest's client crashed two minutes ago (no heartbeat since).
    expectOk(await admin.from("huddle_participants").update({ last_seen_at: new Date(Date.now() - 120_000).toISOString() }).eq("huddle_id", huddleId).eq("creator_id", guest.creatorId).select("creator_id"));
    const c = await card(viewer.client, huddleId);
    expect(c?.participant_count).toBe(1);
    expect(c?.participant_ids).toEqual([host.creatorId]);

    // Host went stale too: the Huddle no longer shows as live, before any cleanup sweep runs.
    expectOk(await admin.from("huddle_participants").update({ last_seen_at: new Date(Date.now() - 120_000).toISOString() }).eq("huddle_id", huddleId).select("creator_id"));
    expect(await card(viewer.client, huddleId)).toBeUndefined();
    expect((await huddleStatus(huddleId)).status).toBe("live");
  });
});
