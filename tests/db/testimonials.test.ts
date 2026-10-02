import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createArtifact, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, type TestCreator } from "./helpers";

/**
 * Testimonials (docs/testimonials.md): written by someone else, approved by you, shown in date order. The receiver
 * decides what shows and where; the writer can withdraw; blocks and profile visibility are respected; "worked
 * together" is derived, never claimed; no counts anywhere.
 */
const admin = adminClient();
let priya: TestCreator; // receives testimonials
let maya: TestCreator; // worked with Priya (shared crew)
let kunal: TestCreator; // stranger who can see Priya's profile
let blocked: TestCreator; // blocked by Priya
let hidden: TestCreator; // private profile

beforeAll(async () => {
  [priya, maya, kunal, blocked, hidden] = await Promise.all(["tPriya", "tMaya", "tKunal", "tBlocked", "tHidden"].map((l) => createTestCreator(l)));
  await Promise.all([priya, maya, kunal, blocked].map((c) => admin.from("creators").update({ visibility: "public" }).eq("id", c.creatorId)));
  await admin.from("creators").update({ handle: `tpriya${Date.now().toString(36)}` }).eq("id", priya.creatorId);
  expectOk(await hidden.client.from("creators").update({ visibility: "private" }).eq("id", hidden.creatorId).select("id"));
  expectOk(await priya.client.from("creator_blocks").insert({ blocker_creator_id: priya.creatorId, blocked_creator_id: blocked.creatorId }).select("blocker_creator_id"));
  // Priya and Maya share a crew (a community they both belong to).
  const room = expectOk(await priya.client.from("projects").insert({ creator_id: priya.creatorId, title: "Harbour Voices", visibility: "discoverable" }).select("id").single()).id;
  expectOk(await maya.client.rpc("community_join", { p_project: room }));
});
afterAll(cleanupTestCreators);

const mine = async (c: TestCreator, to: TestCreator) => expectOk(await c.client.rpc("testimonials_of", { p_creator: to.creatorId })).find((t) => t.from_id === c.creatorId);

describe("Testimonials — writing", () => {
  it("anyone who can see the profile may write one; it waits as pending, seen only by the two of them", async () => {
    const id = expectOk(await kunal.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Priya hears the line before it is written. Working beside her sharpens everyone." }));
    expect((await mine(kunal, priya))?.status).toBe("pending");
    expect(expectOk(await priya.client.rpc("testimonials_of", { p_creator: priya.creatorId })).map((t) => t.id)).toContain(id);
    // Not public yet: a third person sees nothing.
    expect(expectOk(await maya.client.rpc("testimonials_of", { p_creator: priya.creatorId })).map((t) => t.id)).not.toContain(id);
    expect(expectOk(await maya.client.from("creator_testimonials").select("id").eq("id", id))).toEqual([]);
    // Too short, and writing about yourself, are refused.
    expectDenied(await kunal.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Nice." }));
    expectDenied(await priya.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "I am wonderful, truly, in every way." }), "42501");
    // Direct writes are closed: only the functions change testimonials.
    expectDenied(await loose(kunal.client).from("creator_testimonials").insert({ from_creator_id: kunal.creatorId, to_creator_id: maya.creatorId, body: "Straight into the table, no approval." }));
    expectNoRowsAffected(await loose(kunal.client).from("creator_testimonials").update({ status: "shown" }).eq("id", id).select("id"));
    expect((await mine(kunal, priya))?.status).toBe("pending");
  });

  it("someone blocked, or someone who can't see the profile, can't write; a private profile takes none", async () => {
    expectDenied(await blocked.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "You will never read this, and that is fair enough." }), "42501");
    expectDenied(await kunal.client.rpc("testimonial_write", { p_to: hidden.creatorId, p_body: "A private person deserves their privacy, always." }), "42501");
  });

  it("worked together is derived: the setting 'people I worked with' lets Maya write and keeps Kunal out", async () => {
    expectOk(await priya.client.rpc("testimonials_setting", { p_from: "worked_with" }));
    expectDenied(await kunal.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Rewriting while the door is closed to strangers." }), "42501");
    expectOk(await maya.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "We cut the harbour film together; Priya finds the quiet shot every time." }));
    expect((await mine(maya, priya))?.worked_together).toBe(true);
    expect((await mine(kunal, priya))?.worked_together).toBe(false);
    // Off: nobody new may write; existing ones stay.
    expectOk(await priya.client.rpc("testimonials_setting", { p_from: "off" }));
    expectDenied(await maya.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Even a collaborator waits when the door is shut." }), "42501");
    expectDenied(await priya.client.rpc("testimonials_setting", { p_from: "everyone" }));
    expectOk(await priya.client.rpc("testimonials_setting", { p_from: "anyone" }));
    // A member can't change someone else's setting.
    expectNoRowsAffected(await loose(kunal.client).from("creators").update({ testimonials_from: "off" }).eq("id", priya.creatorId).select("id"));
  });

  it("a shared context must really be shared; a Creation one contributed to counts as working together", async () => {
    const piece = await createArtifact(priya, { title: "Harbour, early" });
    expectDenied(await kunal.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Claiming a Creation I never touched should fail.", p_context_type: "artifact", p_context_id: piece }), "22023");
    expectOk(await priya.client.from("artifact_contributors").insert({ artifact_id: piece, contributor_creator_id: kunal.creatorId, role: "Editor", added_by_creator_id: priya.creatorId }));
    expectOk(await kunal.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Editing Harbour, early with Priya: every note landed somewhere useful.", p_context_type: "artifact", p_context_id: piece }));
    const t = await mine(kunal, priya);
    expect(t).toMatchObject({ status: "pending", context_label: "Harbour, early", worked_together: true });
  });
});

describe("Testimonials — the receiver decides", () => {
  it("show puts it on the profile for anyone who can see it; hide takes it back; only the receiver decides", async () => {
    const t = (await mine(kunal, priya))!;
    expectDenied(await kunal.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show" }), "P0002");
    expectDenied(await maya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show" }), "P0002");
    expectOk(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show" }));
    const seen = expectOk(await maya.client.rpc("testimonials_of", { p_creator: priya.creatorId }));
    expect(seen.map((x) => x.id)).toContain(t.id);
    const row = seen.find((x) => x.id === t.id)!;
    expect(row).toMatchObject({ from_name: "tKunal", status: "shown", on_creator_page: false });
    expect(JSON.stringify(row)).not.toMatch(/count|likes|score/);
    // The blocked person never sees Priya's testimonials; the hidden profile's viewer rules still apply.
    expect(expectOk(await blocked.client.rpc("testimonials_of", { p_creator: priya.creatorId }))).toEqual([]);
    expectOk(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "hide" }));
    expect(expectOk(await maya.client.rpc("testimonials_of", { p_creator: priya.creatorId })).map((x) => x.id)).not.toContain(t.id);
    expect((await mine(kunal, priya))?.status).toBe("hidden");
    expectDenied(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "delete" }), "22023");
  });

  it("a rewrite goes back to pending; a withdrawal leaves the profile at once and can't be shown", async () => {
    const t = (await mine(kunal, priya))!;
    expectOk(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show" }));
    expectOk(await kunal.client.rpc("testimonial_write", { p_to: priya.creatorId, p_body: "Second thoughts, kinder and more exact: Priya listens first, then cuts." }));
    expect((await mine(kunal, priya))).toMatchObject({ status: "pending", context_type: null });
    expectOk(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show" }));
    expectOk(await kunal.client.rpc("testimonial_withdraw", { p_to: priya.creatorId }));
    expect(expectOk(await maya.client.rpc("testimonials_of", { p_creator: priya.creatorId })).map((x) => x.id)).not.toContain(t.id);
    expect(expectOk(await priya.client.rpc("testimonials_of", { p_creator: priya.creatorId })).map((x) => x.id)).not.toContain(t.id);
    expectDenied(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show" }), "42501");
    expectDenied(await kunal.client.rpc("testimonial_withdraw", { p_to: priya.creatorId }), "P0002");
    // Every decision is in the audit log.
    const actions = expectOk(await admin.from("audit_logs").select("action").eq("object_id", t.id)).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["testimonial.written", "testimonial.shown", "testimonial.hidden", "testimonial.rewritten", "testimonial.withdrawn"]));
  });

  it("the public Creator Page shows only what the creator chose for it, and only while the page is published", async () => {
    const t = (await mine(maya, priya))!;
    const handle = expectOk(await admin.from("creators").select("handle").eq("id", priya.creatorId).single()).handle!;
    const anon = anonClient();
    expectOk(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show", p_on_creator_page: true }));
    expect(expectOk(await anon.rpc("public_creator_page_testimonials", { p_handle: handle }))).toEqual([]);
    expectOk(await priya.client.from("creator_pages").upsert({ creator_id: priya.creatorId, is_published: true }));
    const pub = expectOk(await anon.rpc("public_creator_page_testimonials", { p_handle: handle }));
    expect(pub.map((x) => x.id)).toEqual([t.id]);
    expect(Object.keys(pub[0]!).sort()).toEqual(["body", "created_at", "from_handle", "from_name", "id"]);
    // Shown on the profile but not chosen for the page: not public.
    expectOk(await priya.client.rpc("testimonial_decide", { p_id: t.id, p_action: "show", p_on_creator_page: false }));
    expect(expectOk(await anon.rpc("public_creator_page_testimonials", { p_handle: handle }))).toEqual([]);
  });
});
