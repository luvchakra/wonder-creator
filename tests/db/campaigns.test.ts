import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveBrandProfile } from "@wonder/creator-identity";
import { agreeDeliverable, campaignSubmission, createCampaign, getCampaign, inviteToCampaign, listCampaigns, proposeDeliverable, respondToCampaign, reviewDeliverable, submitDeliverable, updateCampaign, withdrawInvite } from "@wonder/creator-projects";
import { createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let brand: TestCreator;
let maya: TestCreator;
let closed: TestCreator;
let out: TestCreator;
let campaignId: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [brand, maya, closed, out] = await Promise.all(["cmpBrand", "cmpMaya", "cmpClosed", "cmpOut"].map((l) => createTestCreator(l)));
  await saveBrandProfile(db(maya), maya.creatorId, { openToBrands: true, niches: ["Slow travel"], deliverables: ["Short film"] });
  campaignId = (await createCampaign(db(brand), brand.creatorId, { brandName: "Harbour Hotels", title: "Autumn on the coast", brief: "Three short pieces about slow travel on the coast.", usageRights: "Organic social, 12 months, India." })).id;
});
afterAll(cleanupTestCreators);

describe("campaigns (P1-16)", () => {
  it("runs brief → invite → accept → propose → agree → submit → review, each step by the right person", async () => {
    // Only creators open to brand work can be invited; outsiders can't see the campaign.
    await expect(inviteToCampaign(db(brand), campaignId, { creatorId: closed.creatorId })).rejects.toThrow(/open to brand work/i);
    expect(expectOk(await db(maya).from("campaigns").select("id").eq("id", campaignId))).toEqual([]);
    await inviteToCampaign(db(brand), campaignId, { creatorId: maya.creatorId, note: "We love your coastal films." });
    await expect(inviteToCampaign(db(maya), campaignId, { creatorId: out.creatorId })).rejects.toThrow(/owner can invite/i);

    // Invited: Maya sees it and responds; the campaign opens.
    expect((await listCampaigns(db(maya), maya.creatorId)).joined.map((c) => c.id)).toEqual([campaignId]);
    expect((await getCampaign(db(maya), maya.creatorId, campaignId))!.role).toBe("invited");
    await respondToCampaign(db(maya), campaignId, true);
    expect(expectOk(await admin.from("campaigns").select("status").eq("id", campaignId).single()).status).toBe("in_progress");

    // Maya proposes; she can't agree to her own proposal; the brand agrees.
    const d = await proposeDeliverable(db(maya), campaignId, { creatorId: maya.creatorId, title: "60-second film", format: "Short film" });
    await expect(agreeDeliverable(db(maya), d)).rejects.toThrow(/other side agrees/i);
    await expect(proposeDeliverable(db(maya), campaignId, { creatorId: brand.creatorId, title: "x" })).rejects.toThrow(/your own deliverables/i);
    await agreeDeliverable(db(brand), d);

    // She submits her own Creation; someone else's is refused; the brand reads just that submission.
    const film = (await createArtifact(db(maya), maya.creatorId, { artifactType: "short_film", title: "Coast", content: "EXT. HARBOUR - DAWN", authorKind: "creator", provenance: { origin: "typed" } })).id;
    const notHers = (await createArtifact(db(out), out.creatorId, { artifactType: "poem", title: "Not hers", content: "x", authorKind: "creator", provenance: { origin: "typed" } })).id;
    await expect(submitDeliverable(db(maya), d, notHers)).rejects.toThrow(/isn't yours/i);
    await expect(reviewDeliverable(db(brand), d, true)).rejects.toThrow(/nothing submitted/i);
    await submitDeliverable(db(maya), d, film);
    expect(await campaignSubmission(db(brand), d)).toMatchObject({ title: "Coast", content: "EXT. HARBOUR - DAWN" });
    expect(await campaignSubmission(db(out), d)).toBeNull();
    expect(expectOk(await db(brand).from("artifacts").select("id").eq("id", film))).toEqual([]); // no broader access

    // Only the owner reviews; changes need a reason; approval is a person's decision.
    await expect(reviewDeliverable(db(maya), d, true)).rejects.toThrow(/owner reviews/i);
    await expect(reviewDeliverable(db(brand), d, false)).rejects.toThrow(/what should change/i);
    await reviewDeliverable(db(brand), d, false, "Open on the lighthouse.");
    await submitDeliverable(db(maya), d, film);
    await reviewDeliverable(db(brand), d, true);
    const view = (await getCampaign(db(brand), brand.creatorId, campaignId))!;
    expect(view.deliverables.map((x) => x.status)).toEqual(["approved"]);
  });

  it("keeps state server-side: nobody writes invitations or deliverables directly; only the owner edits the brief", async () => {
    expect((await db(maya).from("campaign_deliverables").update({ status: "approved" }).eq("campaign_id", campaignId).select()).data ?? []).toEqual([]);
    expect((await db(out).from("campaign_invitations").insert({ campaign_id: campaignId, creator_id: out.creatorId, status: "accepted" })).error).not.toBeNull();
    await expect(updateCampaign(db(maya), campaignId, { title: "Mine now" })).rejects.toThrow(/owner/i);
    expect((await updateCampaign(db(brand), campaignId, { usageRights: "Organic social and web, 12 months." })).usage_rights).toMatch(/web/);
    // Withdraw only applies to open invitations.
    await expect(withdrawInvite(db(brand), campaignId, maya.creatorId)).rejects.toThrow(/not found/i);
  });
});
