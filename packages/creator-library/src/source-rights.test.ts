import { describe, expect, it } from "vitest";
import { attributionLine, canInsert, licenseRights } from "./source-rights";

describe("source rights (Phase 04 §8)", () => {
  it("reads a stated licence literally and never assumes an unknown one is open", () => {
    expect(licenseRights("CC0 1.0")).toBe("reuse_permitted");
    expect(licenseRights("PDM 1.0")).toBe("reuse_permitted");
    expect(licenseRights("Pixabay Content License")).toBe("reuse_permitted");
    expect(licenseRights("Pexels License")).toBe("reuse_permitted");
    expect(licenseRights("CC BY 4.0")).toBe("attribution_required");
    expect(licenseRights("CC BY-SA 2.0")).toBe("attribution_required");
    expect(licenseRights("CC BY-ND 4.0")).toBe("reference_only");
    expect(licenseRights("All rights reserved")).toBe("unknown");
    expect(licenseRights(null)).toBe("unknown");
  });
  it("lets only permitted or credited sources into the piece", () => {
    expect(canInsert("reuse_permitted")).toBe(true);
    expect(canInsert("attribution_required")).toBe(true);
    for (const r of ["reference_only", "unknown", "restricted"] as const) expect(canInsert(r)).toBe(false);
  });
  it("keeps the credit in one line", () => {
    expect(attributionLine({ creator: "Maya Rao", license: "CC BY 4.0", provider: "Openverse" })).toBe("By Maya Rao · CC BY 4.0 · Openverse");
    expect(attributionLine({})).toBeNull();
  });
});
