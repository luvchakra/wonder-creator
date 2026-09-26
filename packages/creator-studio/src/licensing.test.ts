import { describe, expect, it } from "vitest";
import { describeTerms, isConsequential, licenseTermsSchema, termsFromRecord, termsToRecord } from "./licensing";

describe("license terms", () => {
  it("requires a fee for paid licenses and a size for limited editions", () => {
    expect(() => licenseTermsSchema.parse({ licenseType: "editorial", mode: "paid_nonexclusive" })).toThrow(/fee and currency/);
    expect(() => licenseTermsSchema.parse({ licenseType: "editorial", mode: "limited_edition" })).toThrow(/how many/);
    expect(licenseTermsSchema.parse({ licenseType: "editorial", mode: "paid_nonexclusive", feeAmount: "2500", feeCurrency: "inr" })).toMatchObject({ feeAmount: 2500, feeCurrency: "INR" });
  });

  it("treats commercial, paid, limited and exclusive terms as consequential", () => {
    expect(isConsequential({ licenseType: "editorial", mode: "free_license" })).toBe(false);
    expect(isConsequential({ licenseType: "commercial", mode: "free" })).toBe(true);
    expect(isConsequential({ licenseType: "editorial", mode: "exclusive" })).toBe(true);
    expect(isConsequential({ licenseType: "personal", mode: "paid_nonexclusive" })).toBe(true);
  });

  it("summarises terms in plain lines and round-trips through the stored form", () => {
    const t = licenseTermsSchema.parse({ licenseType: "editorial", mode: "limited_edition", editionSize: 50, feeAmount: 100, feeCurrency: "USD", derivativesAllowed: true, territory: "India", endsOn: "2027-01-01" });
    expect(describeTerms(t)).toEqual(["Editorial use · Limited edition · USD 100 · edition of 50", "India, now – 2027-01-01", "Allows derivative works", "Credit required"]);
    expect(termsFromRecord(termsToRecord(t))).toEqual(t);
    expect(termsToRecord({ ...t, mode: "exclusive" }).exclusive).toBe(true);
  });
});
