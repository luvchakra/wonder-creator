import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, fakeSha, loose, type TestCreator } from "./helpers";

/**
 * Communities (docs/communities.md): a Creative Room opened as a community — Public, Unlisted or Private. Public ones
 * anyone signed in may find and join; the room's private details stay private; only members add anything; hosts
 * moderate; ordinary rooms are unchanged.
 */
const admin = adminClient();
let owner: TestCreator; // Priya, the community's owner
let maya: TestCreator; // joins, becomes a moderator
let kunal: TestCreator; // joins
let stranger: TestCreator; // never joins
let blocked: TestCreator; // blocked by the owner
let community: string;
let privateRoom: string;

const room = async (c: TestCreator, title: string, visibility?: "private" | "discoverable") =>
  expectOk(
    await c.client
      .from("projects")
      .insert({ creator_id: c.creatorId, title, brief: `${title} brief`, budget_enabled: true, budget_amount: 5000, budget_currency: "INR", rights_note: "secret rights note", ...(visibility ? { visibility } : {}) })
      .select("id")
      .single(),
  ).id as string;
const topic = async (c: TestCreator, title: string, visibility: "community" | "limited" = "community") =>
  expectOk(await c.client.from("open_conversations").insert({ creator_id: c.creatorId, title, intent: "discuss", visibility }).select("id").single()).id as string;

beforeAll(async () => {
  [owner, maya, kunal, stranger, blocked] = await Promise.all(["cOwner", "cMaya", "cKunal", "cStranger", "cBlocked"].map((l) => createTestCreator(l)));
  community = await room(owner, "Poetry & Spoken Word", "discoverable");
  privateRoom = await room(owner, "Coastal Voices");
  expectOk(await owner.client.from("creator_blocks").insert({ blocker_creator_id: owner.creatorId, blocked_creator_id: blocked.creatorId }).select("blocker_creator_id"));
});
afterAll(cleanupTestCreators);

describe("Communities — finding one", () => {
  it("lists discoverable rooms to anyone signed in, with safe fields only; private rooms never", async () => {
    const list = expectOk(await stranger.client.rpc("community_list", { p_limit: 30 }));
    const ids = list.map((r) => r.id);
    expect(ids).toContain(community);
    expect(ids).not.toContain(privateRoom);
    const row = list.find((r) => r.id === community)!;
    expect(row).toMatchObject({ title: "Poetry & Spoken Word", owner_id: owner.creatorId, is_member: false });
    expect(JSON.stringify(row)).not.toMatch(/secret rights|5000|INR/);
    // The rooms table itself stays closed to non-members.
    expect(expectOk(await stranger.client.from("projects").select("id").eq("id", community))).toEqual([]);
    // Search by words in the title or brief.
    expect(expectOk(await stranger.client.rpc("community_list", { p_query: "spoken", p_limit: 30 })).map((r) => r.id)).toContain(community);
    expect(expectOk(await stranger.client.rpc("community_list", { p_query: "nothing like this", p_limit: 30 })).map((r) => r.id)).not.toContain(community);
  });

  it("someone the owner blocked can't see or join the community", async () => {
    expect(expectOk(await blocked.client.rpc("community_list", { p_limit: 60 })).map((r) => r.id)).not.toContain(community);
    expect(expectOk(await blocked.client.rpc("community_card", { p_project: community }))).toEqual([]);
    expectDenied(await blocked.client.rpc("community_join", { p_project: community }), "P0002");
  });

  it("a private room can't be joined or read through the community functions", async () => {
    expectDenied(await stranger.client.rpc("community_join", { p_project: privateRoom }), "P0002");
    expect(expectOk(await stranger.client.rpc("community_card", { p_project: privateRoom }))).toEqual([]);
    expect(expectOk(await stranger.client.rpc("community_members", { p_project: privateRoom }))).toEqual([]);
  });
});

describe("Communities — joining and leaving", () => {
  it("anyone may join with one call; the crew appears with the owner as owner; joining twice is harmless", async () => {
    const crew = expectOk(await maya.client.rpc("community_join", { p_project: community }));
    expectOk(await maya.client.rpc("community_join", { p_project: community }));
    expectOk(await kunal.client.rpc("community_join", { p_project: community }));
    const members = expectOk(await stranger.client.rpc("community_members", { p_project: community }));
    expect(members.map((m) => [m.creator_id, m.access])).toEqual([
      [owner.creatorId, "owner"],
      [maya.creatorId, "member"],
      [kunal.creatorId, "member"],
    ]);
    // Members are crew members: they can now read the room like any crew.
    expect(expectOk(await maya.client.from("projects").select("id").eq("id", community))).toHaveLength(1);
    expect(expectOk(await maya.client.rpc("community_card", { p_project: community }))[0]).toMatchObject({ is_member: true, is_host: false, crew_id: crew, member_count: 3 });
    // A member can't make themselves a moderator.
    expectDenied(await loose(maya.client).from("crew_members").update({ access: "admin" }).eq("crew_id", crew).eq("creator_id", maya.creatorId));
  });

  it("members can leave and come back; someone removed by the hosts stays out", async () => {
    const crew = expectOk(await kunal.client.rpc("community_card", { p_project: community }))[0]!.crew_id!;
    expectOk(await kunal.client.rpc("crew_leave", { p_crew: crew }));
    expect(expectOk(await kunal.client.from("projects").select("id").eq("id", community))).toEqual([]);
    expectOk(await kunal.client.rpc("community_join", { p_project: community }));
    expectOk(await owner.client.rpc("crew_remove", { p_crew: crew, p_creator: kunal.creatorId }));
    expectDenied(await kunal.client.rpc("community_join", { p_project: community }), "42501");
    expect(expectOk(await kunal.client.from("projects").select("id").eq("id", community))).toEqual([]);
  });

  it("blocked pairs never see each other in the member list", async () => {
    expectOk(await maya.client.from("creator_blocks").insert({ blocker_creator_id: maya.creatorId, blocked_creator_id: stranger.creatorId }).select("blocker_creator_id"));
    expect(expectOk(await stranger.client.rpc("community_members", { p_project: community })).map((m) => m.creator_id)).not.toContain(maya.creatorId);
    await admin.from("creator_blocks").delete().eq("blocker_creator_id", maya.creatorId).eq("blocked_creator_id", stranger.creatorId);
  });
});

describe("Communities — topics and posts", () => {
  let mayaTopic: string;
  it("members attach their own topics; non-members and others' topics can't be attached", async () => {
    mayaTopic = await topic(maya, "Reading aloud changes the line breaks");
    expectOk(await maya.client.rpc("open_conversation_link", { p_conversation: mayaTopic, p_kind: "project", p_target: community }));
    // Linking again returns the same link.
    expectOk(await maya.client.rpc("open_conversation_link", { p_conversation: mayaTopic, p_kind: "project", p_target: community }));
    expect(expectOk(await stranger.client.from("open_conversation_links").select("id").eq("project_id", community))).toHaveLength(1);
    // A non-member can't attach their topic.
    const theirs = await topic(stranger, "Spam about something else");
    expectDenied(await stranger.client.rpc("open_conversation_link", { p_conversation: theirs, p_kind: "project", p_target: community }), "42501");
    // A member can't attach someone else's topic.
    expectDenied(await maya.client.rpc("open_conversation_link", { p_conversation: theirs, p_kind: "project", p_target: community }), "42501");
    // The private room still only takes its owner's links.
    expectDenied(await maya.client.rpc("open_conversation_link", { p_conversation: mayaTopic, p_kind: "project", p_target: privateRoom }), "42501");
    // Non-members read a public community's topics, but only members post (owner, 3 Oct 2026).
    expect(expectOk(await stranger.client.from("open_conversations").select("id").eq("id", mayaTopic))).toHaveLength(1);
    expectDenied(await stranger.client.from("open_conversation_replies").insert({ conversation_id: mayaTopic, creator_id: stranger.creatorId, body: "I trust the page." }));
    expect(expectOk(await stranger.client.rpc("open_conversation_can_add", { p_conversation: mayaTopic }))).toBe(false);
    expect(expectOk(await maya.client.rpc("open_conversation_can_add", { p_conversation: mayaTopic }))).toBe(true);
    expectOk(await maya.client.from("open_conversation_replies").insert({ conversation_id: mayaTopic, creator_id: maya.creatorId, body: "I trust the page." }).select("id"));
  });

  it("only members start a Huddle from a community topic", async () => {
    const ownHuddle = async (c: TestCreator) =>
      expectOk(await admin.from("huddles").insert({ started_by_creator_id: c.creatorId, topic: "Reading aloud", status: "live", discoverability: "public" }).select("id").single()).id as string;
    expectDenied(await stranger.client.rpc("open_conversation_link", { p_conversation: mayaTopic, p_kind: "huddle", p_target: await ownHuddle(stranger) }), "42501");
    expectOk(await maya.client.rpc("open_conversation_link", { p_conversation: mayaTopic, p_kind: "huddle", p_target: await ownHuddle(maya) }));
  });

  it("the owner and moderators remove posts and topics in their community; members can't", async () => {
    const crew = expectOk(await owner.client.rpc("community_card", { p_project: community }))[0]!.crew_id!;
    const kunalBack = await createTestCreator("cMember2");
    expectOk(await kunalBack.client.rpc("community_join", { p_project: community }));
    const spammer = await createTestCreator("cSpammer");
    expectOk(await spammer.client.rpc("community_join", { p_project: community }));
    const reply = expectOk(await spammer.client.from("open_conversation_replies").insert({ conversation_id: mayaTopic, creator_id: spammer.creatorId, body: "Buy followers here" }).select("id").single()).id;
    expectDenied(await kunalBack.client.rpc("open_conversation_remove_reply", { p_reply: reply }), "42501");
    expectDenied(await kunalBack.client.rpc("community_remove_topic", { p_project: community, p_conversation: mayaTopic }), "42501");
    // Maya is the topic's author, so she could already remove posts in it; promote someone else to moderator to test hosts.
    expectOk(await owner.client.rpc("crew_set_role", { p_crew: crew, p_creator: kunalBack.creatorId, p_access: "admin" }));
    expectOk(await kunalBack.client.rpc("open_conversation_remove_reply", { p_reply: reply, p_reason: "spam" }));
    expect(expectOk(await admin.from("open_conversation_replies").select("removed_at").eq("id", reply).single()).removed_at).not.toBeNull();
    const audit = expectOk(await admin.from("audit_logs").select("metadata").eq("object_id", reply).eq("action", "community.reply_removed").single());
    expect((audit.metadata as { by: string }).by).toBe("community_host");
    // Taking a topic out of the community keeps the topic with its author.
    expectOk(await kunalBack.client.rpc("community_remove_topic", { p_project: community, p_conversation: mayaTopic, p_reason: "off topic" }));
    expect(expectOk(await stranger.client.from("open_conversation_links").select("id").eq("project_id", community))).toEqual([]);
    expect(expectOk(await maya.client.from("open_conversations").select("id").eq("id", mayaTopic))).toHaveLength(1);
  });

  it("a host can't moderate a topic that isn't in their community", async () => {
    const elsewhere = await topic(stranger, "Not in any community");
    const reply = expectOk(await maya.client.from("open_conversation_replies").insert({ conversation_id: elsewhere, creator_id: maya.creatorId, body: "Hi" }).select("id").single()).id;
    expectDenied(await owner.client.rpc("open_conversation_remove_reply", { p_reply: reply }), "42501");
  });
});

describe("Communities — Public, Unlisted and Private; ordinary rooms unchanged", () => {
  it("rooms aren't communities until the owner opens one; only the owner chooses its privacy", async () => {
    expect(expectOk(await owner.client.from("projects").select("community_privacy, visibility").eq("id", privateRoom).single())).toEqual({ community_privacy: null, visibility: "private" });
    expect(expectOk(await stranger.client.from("projects").select("id").eq("id", privateRoom))).toEqual([]);
    expectDenied(await owner.client.from("projects").update({ community_privacy: "everyone" }).eq("id", privateRoom));
    const later = await room(stranger, "Night Trains");
    expectDenied(await maya.client.rpc("community_set_privacy", { p_project: later, p_privacy: "public" }), "42501");
    expectDenied(await stranger.client.rpc("community_set_privacy", { p_project: later, p_privacy: "secret" }), "22023");
    expectOk(await stranger.client.rpc("community_set_privacy", { p_project: later, p_privacy: "public" }));
    expect(expectOk(await maya.client.rpc("community_list", { p_limit: 60 })).map((r) => r.id)).toContain(later);
    // The legacy column mirrors it, and an older client's "discoverable" opens a public one.
    expect(expectOk(await stranger.client.from("projects").select("visibility").eq("id", later).single()).visibility).toBe("discoverable");
    const legacy = await room(stranger, "Old Client Room", "discoverable");
    expect(expectOk(await stranger.client.from("projects").select("community_privacy").eq("id", legacy).single()).community_privacy).toBe("public");
    // A community stays a community.
    expectDenied(await stranger.client.from("projects").update({ community_privacy: null }).eq("id", later), "42501");
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("object_id", later).eq("action", "community.opened"));
    expect(audit).toHaveLength(1);
  });

  it("an unlisted community is never listed or searched, but anyone with the link sees and joins it", async () => {
    const hidden = await room(owner, "Unlisted Workshop");
    expectOk(await owner.client.rpc("community_set_privacy", { p_project: hidden, p_privacy: "unlisted" }));
    expect(expectOk(await stranger.client.rpc("community_list", { p_limit: 60 })).map((r) => r.id)).not.toContain(hidden);
    expect(expectOk(await stranger.client.rpc("community_list", { p_query: "Unlisted Workshop", p_limit: 60 })).map((r) => r.id)).not.toContain(hidden);
    expect(expectOk(await stranger.client.rpc("community_card", { p_project: hidden }))[0]).toMatchObject({ privacy: "unlisted", is_member: false });
    expectOk(await owner.client.rpc("community_join", { p_project: hidden }));
    const t = await topic(owner, "Workshop notes");
    expectOk(await owner.client.rpc("open_conversation_link", { p_conversation: t, p_kind: "project", p_target: hidden }));
    // Its topics open from a link but aren't listed to non-members.
    expect(expectOk(await stranger.client.from("open_conversations").select("id").eq("id", t))).toHaveLength(1);
    expect(expectOk(await stranger.client.rpc("open_conversations_unlisted_for_me", { p_ids: [t] }))).toEqual([t]);
    expectOk(await stranger.client.rpc("community_join", { p_project: hidden }));
    expect(expectOk(await stranger.client.rpc("open_conversations_unlisted_for_me", { p_ids: [t] }))).toEqual([]);
    expect(expectOk(await stranger.client.rpc("community_mine", { p_limit: 50 })).map((r) => r.id)).toContain(hidden);
  });

  it("a private community is invisible to non-members, joined only by invitation, and its topics are members-only", async () => {
    const circle = await room(owner, "Night Writers Circle");
    expectOk(await owner.client.rpc("community_set_privacy", { p_project: circle, p_privacy: "private" }));
    const crew = expectOk(await owner.client.rpc("community_join", { p_project: circle }));
    const t = await topic(owner, "Tonight's prompt");
    expectOk(await owner.client.rpc("open_conversation_link", { p_conversation: t, p_kind: "project", p_target: circle }));

    const outsider = await createTestCreator("cOutsider");
    expect(expectOk(await outsider.client.rpc("community_list", { p_query: "Night Writers", p_limit: 60 }))).toEqual([]);
    expect(expectOk(await outsider.client.rpc("community_card", { p_project: circle }))).toEqual([]);
    expect(expectOk(await outsider.client.rpc("community_members", { p_project: circle }))).toEqual([]);
    expectDenied(await outsider.client.rpc("community_join", { p_project: circle }), "P0002");
    expect(expectOk(await outsider.client.from("open_conversations").select("id").eq("id", t))).toEqual([]);
    expect(expectOk(await outsider.client.from("open_conversation_links").select("id").eq("conversation_id", t))).toEqual([]);
    expectDenied(await outsider.client.from("open_conversation_replies").insert({ conversation_id: t, creator_id: outsider.creatorId, body: "Let me in" }));

    // Invited: they see the card (invited), join to accept, then read and post.
    expectOk(await owner.client.rpc("crew_invite", { p_crew: crew, p_creator: outsider.creatorId }));
    expect(expectOk(await outsider.client.rpc("community_card", { p_project: circle }))[0]).toMatchObject({ privacy: "private", invited: true, is_member: false });
    expect(expectOk(await outsider.client.from("open_conversations").select("id").eq("id", t))).toEqual([]);
    expectOk(await outsider.client.rpc("community_join", { p_project: circle }));
    expect(expectOk(await outsider.client.from("open_conversations").select("id").eq("id", t))).toHaveLength(1);
    expectOk(await outsider.client.from("open_conversation_replies").insert({ conversation_id: t, creator_id: outsider.creatorId, body: "Here's mine." }).select("id"));

    // Making a public community private keeps members and hides it from everyone else.
    expectOk(await owner.client.rpc("community_set_privacy", { p_project: community, p_privacy: "private" }));
    expect(expectOk(await stranger.client.rpc("community_list", { p_limit: 60 })).map((r) => r.id)).not.toContain(community);
    expect(expectOk(await maya.client.rpc("community_card", { p_project: community }))[0]).toMatchObject({ privacy: "private", is_member: true });
    expectOk(await owner.client.rpc("community_set_privacy", { p_project: community, p_privacy: "public" }));
  });

  it("community topics stay open to their community: a limited topic can't join, and a joined topic can't be narrowed", async () => {
    const limited = await topic(maya, "Only for a few", "limited");
    expectDenied(await maya.client.rpc("open_conversation_link", { p_conversation: limited, p_kind: "project", p_target: community }), "22023");
    const open = await topic(maya, "Open to everyone");
    expectOk(await maya.client.rpc("open_conversation_link", { p_conversation: open, p_kind: "project", p_target: community }));
    expectDenied(await maya.client.from("open_conversations").update({ visibility: "limited" }).eq("id", open), "42501");
    expectOk(await maya.client.from("open_conversations").update({ visibility: "public" }).eq("id", open));
    // An ordinary room's owner still links limited topics as before.
    const own = await topic(owner, "Room notes", "limited");
    expectOk(await owner.client.rpc("open_conversation_link", { p_conversation: own, p_kind: "project", p_target: privateRoom }));
    expectOk(await owner.client.from("open_conversations").update({ visibility: "community" }).eq("id", own));
    expectOk(await owner.client.from("open_conversations").update({ visibility: "limited" }).eq("id", own));
  });
});

describe("Communities — profile picture", () => {
  const image = async (c: TestCreator, mime = "image/webp", status: "clean" | "pending" = "clean") =>
    expectOk(
      await admin
        .from("storage_objects")
        .insert({ creator_id: c.creatorId, bucket: "creator-media", path: `${c.creatorId}/community-${randomUUID()}`, mime_type: mime, size_bytes: 900, sha256: fakeSha(), security_status: status })
        .select("id")
        .single(),
    ).id as string;

  it("the owner and moderators set it from their own image; everyone who can see the community sees it", async () => {
    const own = await image(owner);
    expectOk(await owner.client.rpc("community_set_avatar", { p_project: community, p_object: own }));
    expect(expectOk(await stranger.client.rpc("community_card", { p_project: community }))[0]!.avatar_object_id).toBe(own);
    expect(expectOk(await stranger.client.rpc("community_list", { p_limit: 60 })).find((r) => r.id === community)!.avatar_object_id).toBe(own);
    // A moderator may change it, with their own upload.
    const mod = await createTestCreator("cPicMod");
    expectOk(await mod.client.rpc("community_join", { p_project: community }));
    const crew = expectOk(await owner.client.rpc("community_card", { p_project: community }))[0]!.crew_id!;
    expectOk(await owner.client.rpc("crew_set_role", { p_crew: crew, p_creator: mod.creatorId, p_access: "admin" }));
    expectOk(await mod.client.rpc("community_set_avatar", { p_project: community, p_object: await image(mod) }));
  });

  it("members can't; and it must be the setter's own clean image", async () => {
    const m = await createTestCreator("cPicMember");
    expectOk(await m.client.rpc("community_join", { p_project: community }));
    expectDenied(await m.client.rpc("community_set_avatar", { p_project: community, p_object: await image(m) }), "42501");
    expectDenied(await owner.client.rpc("community_set_avatar", { p_project: community, p_object: await image(m) }), "42501");
    expectDenied(await owner.client.rpc("community_set_avatar", { p_project: community, p_object: await image(owner, "application/pdf") }), "42501");
    expectDenied(await owner.client.rpc("community_set_avatar", { p_project: community, p_object: await image(owner, "image/png", "pending") }), "42501");
    // Not even a direct owner update can point at someone else's file.
    expectDenied(await owner.client.from("projects").update({ avatar_object_id: await image(m) }).eq("id", community), "42501");
    // A private room isn't a community.
    expectDenied(await owner.client.rpc("community_set_avatar", { p_project: privateRoom, p_object: await image(owner) }), "P0002");
    // Clearing it is allowed.
    expectOk(await owner.client.rpc("community_set_avatar", { p_project: community, p_object: null as unknown as string }));
  });
});
