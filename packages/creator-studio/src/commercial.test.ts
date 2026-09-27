import { describe, expect, it } from "vitest";
import { commercialReadiness, type ReadinessInput } from "./commercial";

const base: ReadinessInput = {
  ownershipKind: "sole",
  owners: [{ name: "Asha", sharePercent: 100 }],
  copyrightHolder: "Asha",
  commercialUse: "on_request",
  commercialChannels: [],
  contributors: 0,
  outsideMaterials: 0,
  derivedFrom: null,
  licenses: [],
  today: "2026-09-27",
};

describe("commercialReadiness", () => {
  it("states recorded facts for a simple, solely owned Creation — and never calls it cleared", () => {
    const items = commercialReadiness(base);
    expect(items.map((i) => [i.key, i.state])).toEqual([
      ["ownership", "recorded"],
      ["copyright", "recorded"],
      ["stance", "recorded"],
    ]);
    expect(JSON.stringify(items)).not.toMatch(/clear|safe|legal to|approved/i);
  });

  it("flags what's worth checking: co-owners, contributors, outside material, a source Creation, active exclusives", () => {
    const items = commercialReadiness({
      ...base,
      ownershipKind: "joint",
      owners: [
        { name: "Asha", sharePercent: 60 },
        { name: "Ravi", sharePercent: 40 },
      ],
      contributors: 2,
      outsideMaterials: 1,
      derivedFrom: "Monsoon notes",
      commercialChannels: ["social", "print"],
      licenses: [
        { license_type: "commercial", exclusive: true, status: "active", territory: "India", ends_on: "2027-01-01", licensee_name: "Chai Co", usage_channels: ["advertising"] },
        { license_type: "commercial", exclusive: true, status: "active", territory: "EU", ends_on: "2026-01-01", licensee_name: "Old", usage_channels: [] },
        { license_type: "editorial", exclusive: true, status: "revoked", territory: "US", ends_on: null, licensee_name: null },
      ],
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key.replace(/-\d+$/, ""), i]));
    expect(byKey.ownership).toMatchObject({ state: "check", label: "2 owners recorded" });
    expect(byKey.contributors?.label).toBe("2 contributors");
    expect(byKey.materials?.label).toBe("1 Material from outside sources");
    expect(byKey.derived?.detail).toContain("Monsoon notes");
    // Only the live exclusive license (expired and revoked ones don't limit anything).
    expect(items.filter((i) => i.key.startsWith("exclusive"))).toHaveLength(1);
    expect(byKey.exclusive?.detail).toBe("For Chai Co · India · Advertising · until 2027-01-01. It may limit what else you can offer.");
    expect(byKey.stance?.detail).toBe("Open to Social, Print");
  });

  it("notices incomplete or transferred ownership", () => {
    expect(commercialReadiness({ ...base, owners: [{ name: "Asha", sharePercent: 50 }] })[0]).toMatchObject({ state: "check", label: "Ownership isn't complete" });
    expect(commercialReadiness({ ...base, ownershipKind: "transferred" })[0]?.label).toBe("Ownership was transferred");
    expect(commercialReadiness({ ...base, copyrightHolder: " " })[1]?.state).toBe("check");
  });
});
