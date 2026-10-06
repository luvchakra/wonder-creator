import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createArtifact, createTestCreator, createVersion, expectDenied, expectOk, type TestCreator } from "./helpers";

/**
 * The bell in one round trip (`notifications_feed`, docs/performance.md phase 3). It runs as the caller: everything it
 * returns is what that creator could already read, one question at a time — nothing more, and only their own waiting
 * items.
 */
const admin = adminClient();
let ana: TestCreator; // receives a testimonial; owns a Creation others ask about
let ben: TestCreator; // writes it
let cal: TestCreator; // a stranger to both

type Feed = Record<string, Array<Record<string, unknown>>>;
const feedOf = async (c: TestCreator) => expectOk(await c.client.rpc("notifications_feed")) as unknown as Feed;

beforeAll(async () => {
  [ana, ben, cal] = await Promise.all(["nfAna", "nfBen", "nfCal"].map((l) => createTestCreator(l)));
  await Promise.all([ana, ben, cal].map((c) => admin.from("creators").update({ visibility: "public" }).eq("id", c.creatorId)));
});
afterAll(cleanupTestCreators);

describe("notifications_feed", () => {
  it("is for signed-in creators only", async () => {
    expectDenied(await anonClient().rpc("notifications_feed"));
  });

  it("answers every section, empty when nothing waits", async () => {
    const f = await feedOf(cal);
    for (const k of ["proposals", "requests", "invites", "live", "failed", "runs", "license_asks", "license_answers", "shared", "crew_invites", "crew_threads", "to_review", "decided", "added_as", "claims", "unread", "testimonials", "songs"]) {
      expect(Array.isArray(f[k]), k).toBe(true);
    }
    expect(f.testimonials).toEqual([]);
  });

  it("a testimonial waiting for Ana shows in her feed, with its writer's name — and in no one else's", async () => {
    const id = expectOk(await ben.client.rpc("testimonial_write", { p_to: ana.creatorId, p_body: "Ana hears the line before it is written. Working beside her sharpens everyone." }));
    const mine = (await feedOf(ana)).testimonials.find((t) => t.id === id);
    expect(mine?.status).toBe("pending");
    expect((mine?.creators as { display_name: string } | null)?.display_name).toBeTruthy();
    // The writer's own pending note isn't waiting on them; a stranger sees nothing of it.
    expect((await feedOf(ben)).testimonials.map((t) => t.id)).not.toContain(id);
    expect((await feedOf(cal)).testimonials.map((t) => t.id)).not.toContain(id);
  });

  it("a proposed change waits on the Creation's owner only", async () => {
    const artifactId = await createArtifact(ana, { title: "A shared draft" });
    const v1 = await createVersion(ana, artifactId, "First words");
    // Ben may propose once he can collaborate; the owner adds him.
    expectOk(await admin.from("artifact_contributors").insert({ artifact_id: artifactId, contributor_creator_id: ben.creatorId, role: "editor", added_by_creator_id: ana.creatorId }).select("artifact_id"));
    const proposal = await admin
      .from("artifact_change_proposals")
      .insert({ artifact_id: artifactId, creator_id: ben.creatorId, base_version_id: v1.id, content: "New words", summary: "A tighter opening" })
      .select("id")
      .single();
    const pid = expectOk(proposal).id;
    expect((await feedOf(ana)).to_review.map((p) => p.id)).toContain(pid);
    expect((await feedOf(ben)).to_review.map((p) => p.id)).not.toContain(pid);
    expect((await feedOf(cal)).to_review.map((p) => p.id)).not.toContain(pid);
    // Ben was added this week: that shows for him, not for Ana.
    expect((await feedOf(ben)).added_as.map((a) => a.artifact_id)).toContain(artifactId);
    expect((await feedOf(ana)).added_as.map((a) => a.artifact_id)).not.toContain(artifactId);
  });
});
