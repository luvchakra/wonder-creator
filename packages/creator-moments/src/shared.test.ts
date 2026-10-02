import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, filterClause } from "./moments";
import { cleanDejaVuName, filterOf, isLiveMomentType, momentHref, normalizeDejaVuName, periodOf } from "./shared";

describe("DejaVu names", () => {
  it("one thread however it's typed", () => {
    expect(normalizeDejaVuName("Railways")).toBe(normalizeDejaVuName("  railways "));
    expect(normalizeDejaVuName("Mumbai   Monsoon")).toBe("mumbai monsoon");
    expect(cleanDejaVuName("  Things  we almost\nforgot ")).toBe("Things we almost forgot");
    expect(cleanDejaVuName("x".repeat(80))).toHaveLength(60);
  });
});

describe("Moments", () => {
  it("only Materials and Creations are live in this phase; each opens in its own domain", () => {
    expect(isLiveMomentType("material")).toBe(true);
    expect(isLiveMomentType("creation")).toBe(true);
    expect(isLiveMomentType("huddle")).toBe(false);
    expect(momentHref({ entityType: "material", entityId: "m1" })).toBe("/materials/m1");
    expect(momentHref({ entityType: "creation", entityId: "c1" })).toBe("/creations/c1");
    expect(momentHref({ entityType: "huddle", entityId: "h1" })).toBeNull();
  });

  it("type filters: notes are note-like Materials, the rest of Materials stay Materials", () => {
    expect(filterOf({ entityType: "material", subtype: "voice" })).toBe("notes");
    expect(filterOf({ entityType: "material", subtype: "note" })).toBe("notes");
    expect(filterOf({ entityType: "material", subtype: "image" })).toBe("materials");
    expect(filterOf({ entityType: "creation", subtype: "poem" })).toBe("creations");
    expect(filterOf({ entityType: "conversation", subtype: null })).toBe("conversations");
    expect(filterClause("notes")).toContain("subtype.in.(note,");
    expect(filterClause("materials")).toContain("subtype.not.in.(note,");
  });

  it("sections: Today, Yesterday, the month this year, then the year", () => {
    const now = new Date(2026, 8, 29, 18, 0);
    expect(periodOf(new Date(2026, 8, 29, 1, 0), now)).toBe("Today");
    expect(periodOf(new Date(2026, 8, 28, 23, 0), now)).toBe("Yesterday");
    expect(periodOf(new Date(2026, 8, 2), now)).toBe("September");
    expect(periodOf(new Date(2026, 0, 2), now)).toBe("January");
    expect(periodOf(new Date(2019, 5, 1), now)).toBe("2019");
  });

  it("cursors round-trip and reject anything tampered with", () => {
    const c = { occurredAt: "2026-09-29T10:00:00.123456+00:00", id: "0b0f7c1e-6c2a-4c55-9d7e-1b5a0f2f9a11" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("nonsense")).toBeNull();
    expect(decodeCursor(Buffer.from("2026-01-01|not-a-uuid").toString("base64url"))).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });
});

describe("suggestions from words", () => {
  it("whole-word mentions only, any case", async () => {
    const { mentionedDejaVus } = await import("./suggest");
    const all = [{ name: "Railways" }, { name: "Dad" }, { name: "Mumbai Monsoon" }, { name: "Rail" }];
    expect(mentionedDejaVus("Dad's story about the old RAILWAYS, in the mumbai   monsoon.", all).map((d) => d.name)).toEqual(["Railways", "Dad", "Mumbai Monsoon"]);
    expect(mentionedDejaVus("my dad waited", all).map((d) => d.name)).toEqual(["Dad"]);
    expect(mentionedDejaVus("", all)).toEqual([]);
    expect(mentionedDejaVus("the railway station", all).map((d) => d.name)).toEqual(["Railways"]);
    expect(mentionedDejaVus("the rails at night", all).map((d) => d.name)).toEqual(["Rail"]);
  });
});
