import { describe, expect, it } from "vitest";
import { licenseSchema, rightsSchema, validateOwnership } from "./rights";

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
