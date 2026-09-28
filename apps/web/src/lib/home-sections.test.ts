import { describe, expect, it } from "vitest";
import { agoPhrase, pickSpark, splitHomeItems } from "./home-sections";

const now = Date.parse("2026-09-28T12:00:00Z");
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("splitHomeItems", () => {
  const items = [
    { id: "1", kind: "shared_with_you", title: "Lena shared", href: "/a", at: daysAgo(0.5) },
    { id: "2", kind: "message", title: "Old message", href: "/b", at: daysAgo(5) },
    { id: "3", kind: "proposal_review", title: "James proposed", href: "/c", at: daysAgo(9) },
    { id: "4", kind: "run_active", title: "Working", href: "/d", at: daysAgo(0.1) },
  ];
  it("away = updates since the last visit; asks = everything waiting on you, however old", () => {
    const s = splitHomeItems(items, daysAgo(1), now);
    expect(s.away.map((i) => i.id)).toEqual(["1"]);
    expect(s.asks.map((i) => i.id)).toEqual(["3"]);
  });
  it("uses the last few days on a first visit", () => {
    expect(splitHomeItems(items, null, now).away.map((i) => i.id)).toEqual(["1"]);
    expect(splitHomeItems(items, daysAgo(10), now).away.map((i) => i.id)).toEqual(["1", "2"]);
  });
});

describe("pickSpark", () => {
  it("never picks recent things", () => {
    expect(pickSpark([{ id: "a", title: "x", created_at: daysAgo(10) }], now)).toBeNull();
  });
  it("prefers an anniversary", () => {
    const c = [
      { id: "a", title: "x", created_at: daysAgo(100) },
      { id: "b", title: "y", created_at: daysAgo(370) },
    ];
    expect(pickSpark(c, now)?.id).toBe("b");
  });
  it("otherwise is stable through the day", () => {
    const c = [
      { id: "a", title: "x", created_at: daysAgo(100) },
      { id: "b", title: "y", created_at: daysAgo(200) },
    ];
    expect(pickSpark(c, now)?.id).toBe(pickSpark([...c].reverse(), now + 3600_000)?.id);
  });
});

describe("agoPhrase", () => {
  it("speaks in years or months", () => {
    expect(agoPhrase(daysAgo(365), now)).toBe("A year ago");
    expect(agoPhrase(daysAgo(740), now)).toBe("2 years ago");
    expect(agoPhrase(daysAgo(95), now)).toBe("3 months ago");
  });
});
