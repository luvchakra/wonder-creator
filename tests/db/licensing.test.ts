import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actOnLicenseRequest, addLicense, createArtifact, licenseTermsSchema, listLicenseRequests, requestLicense, respondToLicenseRequest } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

let a: TestCreator; // owner
let b: TestCreator; // requester
let c: TestCreator; // bystander
let piece: string;
let privatePiece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const terms = (extra: Record<string, unknown> = {}) => licenseTermsSchema.parse({ licenseType: "editorial", ...extra });

beforeAll(async () => {
  [a, b, c] = await Promise.all([createTestCreator("licOwner"), createTestCreator("licRequester"), createTestCreator("licOther")]);
  piece = (await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Harbour", content: "Lamps.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  privatePiece = (await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Diary", content: "Private.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  expectOk(await a.client.from("artifacts").update({ status: "final", privacy: "public" }).eq("id", piece).select("id"));
});
afterAll(cleanupTestCreators);

describe("license requests", () => {
  it("can be made only for work you can see and don't own, one open request at a time", async () => {
    await expect(requestLicense(db(b), b.creatorId, privatePiece, { proposedUse: "x", terms: terms() })).rejects.toThrow();
    await expect(requestLicense(db(a), a.creatorId, piece, { proposedUse: "x", terms: terms() })).rejects.toThrow(/your own piece/);
    await requestLicense(db(b), b.creatorId, piece, { proposedUse: "Our newsletter cover", terms: terms() });
    await expect(requestLicense(db(b), b.creatorId, piece, { proposedUse: "again", terms: terms() })).rejects.toThrow(/already have an open request/);
    // A request can't be forged as already approved.
    expectDenied(await loose(c.client).from("license_requests").insert({ artifact_id: piece, owner_creator_id: a.creatorId, requester_creator_id: c.creatorId, proposed_use: "x", terms: {}, status: "approved" }));
  });

  it("is visible to the two parties only, and only the owner can answer it", async () => {
    const [req] = await listLicenseRequests(db(a), piece);
    expect(req.requester.id).toBe(b.creatorId);
    expect(await listLicenseRequests(db(b), piece)).toHaveLength(1);
    expect(await listLicenseRequests(db(c), piece)).toHaveLength(0);
    await expect(respondToLicenseRequest(db(b), req.id, { decision: "approve" })).rejects.toThrow(/couldn't find/);
    await expect(respondToLicenseRequest(db(c), req.id, { decision: "approve" })).rejects.toThrow(/couldn't find/);
    const tamper = await loose(b.client).from("license_requests").update({ status: "approved" }).eq("id", req.id).select("id");
    expect(tamper.data ?? []).toEqual([]);
  });

  it("approving creates an active license for the requester, private to the two of them", async () => {
    const [req] = await listLicenseRequests(db(a), piece);
    const res = await respondToLicenseRequest(db(a), req.id, { decision: "approve", note: "Enjoy" });
    expect(res.status).toBe("approved");
    await expect(respondToLicenseRequest(db(a), req.id, { decision: "decline" })).rejects.toThrow(/already been answered/);
    const lic = expectOk(await b.client.from("licenses").select("status, licensee_creator_id, license_type, permitted_use").eq("id", res.license_id!).single());
    expect(lic).toMatchObject({ status: "active", licensee_creator_id: b.creatorId, license_type: "editorial", permitted_use: "Our newsletter cover" });
    expect(expectOk(await c.client.from("licenses").select("id").eq("id", res.license_id!))).toEqual([]);
  });

  it("a counter-offer becomes a license only when the requester accepts it; requests can be withdrawn", async () => {
    await requestLicense(db(b), b.creatorId, piece, { proposedUse: "A campaign", terms: terms({ licenseType: "promotional" }) });
    const open = (await listLicenseRequests(db(a), piece)).find((r) => r.status === "pending")!;
    const countered = await respondToLicenseRequest(db(a), open.id, { decision: "counter", counter: terms({ licenseType: "promotional", mode: "paid_nonexclusive", feeAmount: 5000, feeCurrency: "INR" }) });
    expect(countered.status).toBe("countered");
    await expect(actOnLicenseRequest(db(a), open.id, "accept_counter")).rejects.toThrow(/couldn't find/);
    const accepted = await actOnLicenseRequest(db(b), open.id, "accept_counter");
    const lic = expectOk(await b.client.from("licenses").select("mode, fee_amount, fee_currency, status").eq("id", accepted.license_id!).single());
    expect(lic).toMatchObject({ mode: "paid_nonexclusive", fee_amount: 5000, fee_currency: "INR", status: "active" });

    await requestLicense(db(b), b.creatorId, piece, { proposedUse: "Maybe later", terms: terms() });
    const again = (await listLicenseRequests(db(b), piece)).find((r) => r.status === "pending")!;
    expect((await actOnLicenseRequest(db(b), again.id, "withdraw")).status).toBe("withdrawn");
    await expect(respondToLicenseRequest(db(a), again.id, { decision: "approve" })).rejects.toThrow(/already been answered/);
  });

  it("every step is in the owner's rights history", async () => {
    const rights = expectOk(await a.client.from("rights_records").select("id").eq("artifact_id", piece).single());
    const events = expectOk(await a.client.from("rights_events").select("event").eq("rights_id", rights.id)).map((e) => e.event);
    expect(events).toEqual(expect.arrayContaining(["license.requested", "license.request_approved", "license.request_countered", "license.request_withdrawn", "license.created"]));
  });

  it("license terms stay consistent, and licenses aren't public", async () => {
    await expect(addLicense(db(a), a.creatorId, piece, { licenseType: "editorial", mode: "paid_nonexclusive" })).rejects.toThrow(/fee and currency/);
    const rights = expectOk(await a.client.from("rights_records").select("id").eq("artifact_id", piece).single());
    expectDenied(await a.client.from("licenses").insert({ rights_id: rights.id, creator_id: a.creatorId, license_type: "editorial", mode: "exclusive", exclusive: false }), "23514");
    // A public piece shows its rights summary, not its deals.
    expect(expectOk(await c.client.from("licenses").select("id").eq("rights_id", rights.id))).toEqual([]);
  });
});
