import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addLicense, createArtifact, createListing, getListing, listListings, saveRights, setListingState, updateListing } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let buyer: TestCreator;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const offer = (extra: Record<string, unknown> = {}) => ({ title: "Monsoon — print license", licenseType: "commercial", usageChannels: ["print"], priceAmount: 5000, currency: "inr", ...extra });

beforeAll(async () => {
  [owner, buyer] = await Promise.all([createTestCreator("mktOwner"), createTestCreator("mktBuyer")]);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Monsoon", content: "Rain.", authorKind: "creator", provenance: { origin: "typed" } })).id;
});
afterAll(cleanupTestCreators);

describe("CreatorMarket foundation", () => {
  it("drafts are the owner's own; nobody else sees or makes them", async () => {
    const l = await createListing(db(owner), owner.creatorId, piece, offer());
    expect(l).toMatchObject({ state: "draft", currency: "INR", price_amount: 5000, usage_channels: ["print"], editions_taken: 0 });
    await expect(createListing(db(buyer), buyer.creatorId, piece, offer())).rejects.toThrow(/isn't available/);
    expect(await listListings(db(buyer), { artifactId: piece })).toEqual([]);
    // A draft can't be forged as live, and state isn't client-writable.
    expect((await loose(owner.client).from("market_listings").insert({ creator_id: owner.creatorId, artifact_id: piece, title: "x", license_type: "personal", state: "listed" })).error).not.toBeNull();
    expect((await loose(owner.client).from("market_listings").update({ state: "listed" }).eq("id", l.id).select("id")).error).not.toBeNull();
    // Price needs a currency; an exclusive offer is one license.
    await expect(createListing(db(owner), owner.creatorId, piece, offer({ currency: null }))).rejects.toThrow();
    await expect(createListing(db(owner), owner.creatorId, piece, offer({ exclusive: true, editionSize: 5 }))).rejects.toThrow();
    const events = expectOk(await admin.from("domain_events").select("event_type").eq("aggregate_id", l.id));
    expect(events.map((e) => e.event_type)).toEqual(["MarketListingCreated"]);
  });

  it("goes live only when the Creation is eligible, and says why when it isn't", async () => {
    const [l] = await listListings(db(owner), { artifactId: piece });
    const { missing } = await getListing(db(owner), l!.id);
    expect(missing).toContain("Mark the Creation as completed first.");
    await expect(setListingState(db(owner), l!.id, "listed")).rejects.toThrow(/Mark the Creation as completed first/);

    expectOk(await owner.client.from("artifacts").update({ status: "final", privacy: "public" }).eq("id", piece).select("id"));
    const rights = { ownershipKind: "sole", copyrightHolder: "Owner", attributionRequired: true, derivativesAllowed: false, owners: [{ name: "Owner", sharePercent: 100 }] };
    await saveRights(db(owner), owner.creatorId, piece, { ...rights, commercialUse: "not_offered" });
    await expect(setListingState(db(owner), l!.id, "listed")).rejects.toThrow(/Not offered/);
    await saveRights(db(owner), owner.creatorId, piece, { ...rights, commercialUse: "open" });
    await expect(setListingState(db(buyer), l!.id, "listed")).rejects.toThrow(/couldn't find/);

    const live = await setListingState(db(owner), l!.id, "listed");
    expect(live.state).toBe("listed");
    expect(live.listed_at).not.toBeNull();
    // Anyone who can see the Creation sees its live offer.
    expect((await listListings(db(buyer), { artifactId: piece })).map((x) => x.id)).toEqual([l!.id]);
    const events = expectOk(await admin.from("domain_events").select("event_type, payload").eq("aggregate_id", l!.id).order("occurred_at"));
    expect(events.at(-1)).toMatchObject({ event_type: "MarketListingStateChanged", payload: { state: "listed" } });
  });

  it("terms change only while paused; withdrawn is final; exclusives respect live licenses and offers", async () => {
    const [l] = await listListings(db(owner), { artifactId: piece });
    await expect(updateListing(db(owner), l!.id, offer({ priceAmount: 9000 }))).rejects.toThrow(/Pause it first/);
    await setListingState(db(owner), l!.id, "paused");
    expect((await updateListing(db(owner), l!.id, offer({ priceAmount: 9000 }))).price_amount).toBe(9000);
    await setListingState(db(owner), l!.id, "listed");

    // An exclusive commercial offer conflicts with the live commercial offer, and with an active commercial license.
    const excl = await createListing(db(owner), owner.creatorId, piece, offer({ title: "Exclusive", exclusive: true }));
    await expect(setListingState(db(owner), excl.id, "listed")).rejects.toThrow(/Another live offer/);
    await setListingState(db(owner), l!.id, "withdrawn");
    await expect(setListingState(db(owner), l!.id, "listed")).rejects.toThrow(/withdrawn/);
    await addLicense(db(owner), owner.creatorId, piece, { licenseType: "commercial", mode: "free_license", status: "active", licenseeName: "Chai Co" });
    await expect(setListingState(db(owner), excl.id, "listed")).rejects.toThrow(/active license of the same use/);
  });
});
