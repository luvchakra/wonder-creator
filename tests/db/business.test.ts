import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  actOnLicenseRequest,
  addBusinessEntry,
  addLicense,
  createArtifact,
  deleteBusinessEntry,
  licenseTermsSchema,
  listBusinessRecords,
  listLicenseRequests,
  requestLicense,
  respondToLicenseRequest,
  setBusinessStatus,
  setLicenseStatus,
} from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let brand: TestCreator;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, brand] = await Promise.all([createTestCreator("bizOwner"), createTestCreator("bizBrand")]);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Monsoon", content: "Rain.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  expectOk(await owner.client.from("artifacts").update({ status: "final", privacy: "public" }).eq("id", piece).select("id"));
});
afterAll(cleanupTestCreators);

describe("CreatorBusiness foundation", () => {
  it("a paid license becoming active is recorded once, for the owner, as expected income", async () => {
    const lic = await addLicense(db(owner), owner.creatorId, piece, { licenseType: "commercial", mode: "paid_nonexclusive", feeAmount: 5000, feeCurrency: "INR", licenseeName: "Chai Co", status: "draft" });
    expect(await listBusinessRecords(db(owner))).toEqual([]); // a draft isn't income
    await setLicenseStatus(db(owner), lic.id, "active");
    const [r] = await listBusinessRecords(db(owner));
    expect(r).toMatchObject({ kind: "license_income", direction: "in", amount: 5000, currency: "INR", status: "expected", counterparty: "Chai Co", source_type: "license", source_id: lic.id, artifact_id: piece });
    // Consumed exactly once, and the consumer is recorded.
    expect(expectOk(await admin.from("event_consumptions").select("event_id").eq("consumer", "creator_business").eq("event_id", r!.source_event_id!))).toHaveLength(1);
    await setLicenseStatus(db(owner), lic.id, "revoked");
    await setLicenseStatus(db(owner), lic.id, "active").catch(() => undefined);
    expect((await listBusinessRecords(db(owner))).filter((x) => x.source_id === lic.id)).toHaveLength(1);
    // Free licenses aren't economic events.
    await addLicense(db(owner), owner.creatorId, piece, { licenseType: "editorial", mode: "free_license", status: "active" });
    expect(await listBusinessRecords(db(owner))).toHaveLength(1);
  });

  it("follows a counter-offer the requester accepts — the income is still the owner's", async () => {
    await requestLicense(db(brand), brand.creatorId, piece, { proposedUse: "Campaign", terms: licenseTermsSchema.parse({ licenseType: "promotional" }) });
    const [req] = (await listLicenseRequests(db(owner), piece)).filter((x) => x.status === "pending");
    await respondToLicenseRequest(db(owner), req!.id, { decision: "counter", counter: licenseTermsSchema.parse({ licenseType: "promotional", mode: "paid_nonexclusive", feeAmount: 1200, feeCurrency: "USD" }) });
    await actOnLicenseRequest(db(brand), req!.id, "accept_counter");
    const usd = (await listBusinessRecords(db(owner))).find((x) => x.currency === "USD");
    expect(usd).toMatchObject({ amount: 1200, kind: "license_income", status: "expected" });
    expect(await listBusinessRecords(db(brand))).toEqual([]); // the licensee sees none of the owner's records
  });

  it("the creator settles, notes and adds their own entries; amounts from events stay the source's", async () => {
    const inr = (await listBusinessRecords(db(owner))).find((x) => x.currency === "INR")!;
    const received = await setBusinessStatus(db(owner), inr.id, "received");
    expect(received.status).toBe("received");
    expect(received.settled_at).not.toBeNull();
    await expect(setBusinessStatus(db(owner), inr.id, "paid")).rejects.toThrow(/income is received/);
    expect((await loose(owner.client).from("business_records").update({ amount: 1 }).eq("id", inr.id).select("id")).error).not.toBeNull();
    await expect(deleteBusinessEntry(db(owner), inr.id)).rejects.toThrow(/cancel them instead/);
    // Nobody else can touch it.
    expect((await loose(brand.client).from("business_records").update({ status: "cancelled" }).eq("id", inr.id).select("id")).data ?? []).toEqual([]);

    const cost = await addBusinessEntry(db(owner), owner.creatorId, { kind: "provider_cost", amount: 20, currency: "usd", counterparty: "Image service", settled: true });
    expect(cost).toMatchObject({ direction: "out", status: "paid", source_type: "manual", currency: "USD" });
    // Entries can't pose as coming from events, nor point at someone else's Creation.
    expect((await loose(owner.client).from("business_records").insert({ creator_id: owner.creatorId, kind: "license_income", direction: "in", amount: 9, currency: "INR", source_type: "license" })).error).not.toBeNull();
    const other = (await createArtifact(db(brand), brand.creatorId, { artifactType: "poem", title: "Theirs", content: "x", authorKind: "creator", provenance: { origin: "typed" } })).id;
    await expect(addBusinessEntry(db(owner), owner.creatorId, { kind: "brand_income", amount: 5, currency: "INR", artifactId: other })).rejects.toThrow(/isn't available/);
    await deleteBusinessEntry(db(owner), cost.id);
  });
});
