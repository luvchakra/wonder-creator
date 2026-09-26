import { describe, expect, it } from "vitest";
import { describeRightsEvent, licenseSchema, rightsSchema, validateOwnership } from "./rights";

const base = { copyrightHolder: "Maya Sen", attributionRequired: true, derivativesAllowed: false };

describe("rights validation", () => {
  it("requires shares to total 100%", () => {
    const r = rightsSchema.parse({ ...base, ownershipKind: "joint", owners: [{ name: "Maya", sharePercent: 60 }, { name: "Arjun", sharePercent: 30 }] });
    expect(validateOwnership(r)).toMatch(/90%/);
  });
  it("accepts valid joint ownership", () => {
    const r = rightsSchema.parse({ ...base, ownershipKind: "joint", owners: [{ name: "Maya", sharePercent: 50 }, { name: "Arjun", sharePercent: 50 }] });
    expect(validateOwnership(r)).toBeNull();
  });
  it("sole ownership has one owner", () => {
    const r = rightsSchema.parse({ ...base, ownershipKind: "sole", owners: [{ name: "Maya", sharePercent: 50 }, { name: "Arjun", sharePercent: 50 }] });
    expect(validateOwnership(r)).toMatch(/exactly one/);
  });
  it("license end date must follow start date", () => {
    expect(() => licenseSchema.parse({ licenseType: "editorial", startsOn: "2026-10-01", endsOn: "2026-09-01" })).toThrow(/after the start/);
  });
});

describe("describeRightsEvent", () => {
  it("turns rights events into plain sentences", () => {
    expect(describeRightsEvent("rights.created", { copyright_holder: "Asha", ownership_kind: "sole" }).title).toBe("Rights record created — Asha, sole ownership");
    expect(describeRightsEvent("ownership.updated", { from: "sole", to: "joint" }).title).toBe("Ownership changed from sole ownership to joint ownership");
    expect(describeRightsEvent("owner.added", { name: "Co-writer", share_percent: 40 }).title).toBe("Owner added: Co-writer (40%)");
    expect(describeRightsEvent("license.activated", { license_type: "commercial", licensee: "Harbour Press" })).toEqual({ title: "Commercial License for Harbour Press activated", kind: "license" });
    expect(describeRightsEvent("publication.changed", { privacy_from: "creator_private", privacy_to: "public", status_from: "draft", status_to: "final" })).toEqual({ title: "Sharing changed: visibility private → public, status draft → final", kind: "publication" });
    expect(describeRightsEvent("derivative.created", { derivative_id: "d1", by_self: true })).toMatchObject({ kind: "derivative", derivativeId: "d1" });
    expect(describeRightsEvent("derivative.created", { derivative_id: "d2", by_self: false }).derivativeId).toBeUndefined();
  });

  it("keeps older generic events readable", () => {
    expect(describeRightsEvent("rights_records.update", {}).title).toBe("Rights record changed (rights records · update)");
    expect(describeRightsEvent("licenses.insert", {}).kind).toBe("license");
  });
});
