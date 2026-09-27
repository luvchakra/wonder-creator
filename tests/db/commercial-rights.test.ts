import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createArtifact, getRights, licenseTermsSchema, listLicenseRequests, requestLicense, respondToLicenseRequest, saveRights } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

let owner: TestCreator;
let brand: TestCreator;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const rights = (extra: Record<string, unknown> = {}) => ({ ownershipKind: "sole", copyrightHolder: "Owner", attributionRequired: true, derivativesAllowed: false, owners: [{ name: "Owner", sharePercent: 100 }], ...extra });

beforeAll(async () => {
  [owner, brand] = await Promise.all([createTestCreator("comOwner"), createTestCreator("comBrand")]);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Monsoon", content: "Rain.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  expectOk(await owner.client.from("artifacts").update({ status: "final", privacy: "public" }).eq("id", piece).select("id"));
});
afterAll(cleanupTestCreators);

describe("commercial rights preparation", () => {
  it("records the creator's stance and channels; others see only the stance", async () => {
    expect((await getRights(db(owner), piece))!.commercial_use).toBe("on_request");
    await saveRights(db(owner), owner.creatorId, piece, rights({ commercialUse: "open", commercialChannels: ["social", "print", "social"] }));
    const r = (await getRights(db(owner), piece))!;
    expect([r.commercial_use, r.commercial_channels]).toEqual(["open", ["social", "print"]]);
    // The stance is readable by whoever can see the Creation.
    expect(expectOk(await brand.client.rpc("commercial_stance", { p_artifact: piece }))).toEqual([{ commercial_use: "open", commercial_channels: ["social", "print"] }]);
    await expect(saveRights(db(owner), owner.creatorId, piece, rights({ commercialChannels: ["billboards"] }))).rejects.toThrow();
    // Only known channels, even written directly.
    expect((await loose(owner.client).from("rights_records").update({ commercial_channels: ["billboards"] }).eq("artifact_id", piece).select("id")).error).not.toBeNull();
  });

  it("carries usage channels from a request into the license it becomes", async () => {
    await requestLicense(db(brand), brand.creatorId, piece, { proposedUse: "Instagram campaign", terms: licenseTermsSchema.parse({ licenseType: "commercial", usageChannels: ["social", "advertising"] }) });
    const [req] = await listLicenseRequests(db(owner), piece);
    expect(req!.summary).toContain("Channels: Social, Advertising");
    const res = await respondToLicenseRequest(db(owner), req!.id, { decision: "approve" });
    const lic = expectOk(await owner.client.from("licenses").select("usage_channels, license_type").eq("id", res.license_id!).single());
    expect(lic).toEqual({ usage_channels: ["advertising", "social"], license_type: "commercial" });
  });

  it("turns commercial requests away when the creator doesn't offer commercial use", async () => {
    await saveRights(db(owner), owner.creatorId, piece, rights({ commercialUse: "not_offered" }));
    await expect(requestLicense(db(brand), brand.creatorId, piece, { proposedUse: "Ad", terms: licenseTermsSchema.parse({ licenseType: "commercial" }) })).rejects.toThrow();
    // Other uses can still be asked for.
    await requestLicense(db(brand), brand.creatorId, piece, { proposedUse: "A review", terms: licenseTermsSchema.parse({ licenseType: "editorial" }) });
  });
});
