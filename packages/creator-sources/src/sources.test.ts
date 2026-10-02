import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGETS, syncBudgets } from "./budgets";
import { isUnfinished } from "./connectors/native-notes";
import { ago, countsLine } from "./format";
import { buildCandidates, dedupe } from "./grouping";
import { isSensitive, redact, safeExcerpt } from "./redact";
import { scopeHash } from "./server";
import type { ContextRecord } from "./types";

const now = new Date("2026-10-12T18:00:00Z");
let n = 0;
const rec = (p: Partial<ContextRecord>): ContextRecord => ({
  id: `r${++n}`,
  connectionId: "c1",
  provider: "native_notes",
  sourceType: "note",
  occurredAt: "2026-10-11T10:00:00Z",
  title: null,
  excerpt: null,
  place: null,
  previewRef: null,
  fingerprint: null,
  materialId: null,
  signals: {},
  ...p,
});

describe("redaction keeps previews to the minimum safe context", () => {
  it("removes booking references, cards, contacts, codes and links but keeps the words", () => {
    const out = redact("Your PNR: 4521889012 for Pune. Booking ref AB12CD. Card 4111 1111 1111 1111. Call +91 98765 43210 or mail ravi@example.com. https://t.co/xyz?id=99");
    expect(out).not.toMatch(/4521889012|AB12CD|4111|98765|ravi@|t\.co/);
    expect(out).toContain("for Pune");
  });
  it("leaves ordinary prose, dates and small numbers alone", () => {
    expect(redact("The streets felt unusually quiet on 12 Oct 2026, around 7 pm.")).toBe("The streets felt unusually quiet on 12 Oct 2026, around 7 pm.");
    expect(redact("order some coffee, then code a poem")).toBe("order some coffee, then code a poem");
  });
  it("cuts excerpts on a word", () => {
    const e = safeExcerpt("word ".repeat(100), 40)!;
    expect(e.length).toBeLessThanOrEqual(41);
    expect(e.endsWith("…")).toBe(true);
  });
  it("leaves security, sign-in and statement mail out of discovery", () => {
    expect(isSensitive("Your one-time code")).toBe(true);
    expect(isSensitive("New sign-in to your account")).toBe(true);
    expect(isSensitive("Reset your password")).toBe(true);
    expect(isSensitive("Your credit card statement is ready")).toBe(true);
    expect(isSensitive("Weekend in Goa", "Sea, trains and street food")).toBe(false);
  });
});

describe("budgets", () => {
  it("are conservative by default and tunable by environment, but never show more than 5 candidates", () => {
    expect(syncBudgets({})).toEqual(DEFAULT_BUDGETS);
    const b = syncBudgets({ WONDERCREATOR_SOURCES_QUICK_RECORD_CAP: "100", WONDERCREATOR_SOURCES_CANDIDATE_CAP: "40", WONDERCREATOR_SOURCES_PAGE_SIZE: "-3" });
    expect(b.quickRecordCap).toBe(100);
    expect(b.candidateCap).toBe(5);
    expect(b.pageSize).toBe(DEFAULT_BUDGETS.pageSize);
  });
});

describe("scope hash", () => {
  it("is stable for the same scope in any key order and changes with the scope", () => {
    expect(scopeHash("gmail", { a: 1, b: 2 })).toBe(scopeHash("gmail", { b: 2, a: 1 }));
    expect(scopeHash("gmail", { a: 1 })).not.toBe(scopeHash("gmail", { a: 2 }));
    expect(scopeHash("gmail", { a: 1 })).not.toBe(scopeHash("google_calendar", { a: 1 }));
  });
});

describe("cheap grouping", () => {
  it("groups a day in one place across sources, titled by the day and the place, with the creator's own words", () => {
    const rs = [
      rec({ sourceType: "photo", place: "Pune", occurredAt: "2026-10-11T08:00:00Z" }),
      rec({ sourceType: "photo", place: "pune", occurredAt: "2026-10-11T09:00:00Z" }),
      rec({ sourceType: "note", place: "Pune", occurredAt: "2026-10-11T12:00:00Z", excerpt: "The streets felt unusually quiet. Then the rain." }),
      rec({ sourceType: "email", place: "Pune", occurredAt: "2026-10-10T20:00:00Z" }),
    ];
    const [c] = buildCandidates(rs, { now });
    expect(c!.title).toBe("Sunday in Pune");
    expect(c!.quote).toBe("The streets felt unusually quiet.");
    expect(countsLine(c!.counts)).toBe("2 photos · 1 note · 1 email");
  });

  it("names a multi-day trip by place and dates; signatures are stable across runs", () => {
    const rs = [rec({ sourceType: "event", place: "Goa", occurredAt: "2026-09-01T08:00:00Z" }), rec({ sourceType: "email", place: "Goa", occurredAt: "2026-09-04T08:00:00Z" })];
    const a = buildCandidates(rs, { now });
    expect(a[0]!.title).toBe("Goa, 1 Sept–4 Sept");
    expect(buildCandidates(rs, { now })[0]!.signature).toBe(a[0]!.signature);
  });

  it("joins a travel email to the trip it names (cross-source), but not one that merely shares the dates", () => {
    const rs = [
      rec({ sourceType: "event", place: "Goa", title: "Goa by train", occurredAt: "2026-09-10T08:00:00Z" }),
      rec({ sourceType: "photo", place: "Goa", occurredAt: "2026-09-11T08:00:00Z" }),
      rec({ sourceType: "email", title: "Your train tickets to Goa", occurredAt: "2026-09-08T08:00:00Z" }),
      rec({ sourceType: "email", title: "Quarterly report", occurredAt: "2026-09-10T09:00:00Z" }),
      rec({ sourceType: "email", title: "Goals for next year", occurredAt: "2026-09-10T09:00:00Z" }),
    ];
    const [c] = buildCandidates(rs, { now });
    expect(countsLine(c!.counts)).toBe("1 photo · 1 email · 1 event");
  });

  it("finds an unfinished thought only once it has rested a while", () => {
    const old = rec({ excerpt: "What if the lighthouse kept every name it ever saw,", occurredAt: "2026-06-01T08:00:00Z", signals: { unfinished: true } });
    const fresh = rec({ excerpt: "Tomorrow, maybe —", occurredAt: "2026-10-11T08:00:00Z", signals: { unfinished: true } });
    const out = buildCandidates([old, fresh], { now });
    expect(out.map((c) => c.title)).toEqual(["An unfinished thought"]);
    expect(out[0]!.explanation).toBe("From your notes · 4 months ago");
  });

  it("notices a phrase written across several days", () => {
    const rs = ["2026-08-01", "2026-08-09", "2026-09-02"].map((d) => rec({ excerpt: `I keep thinking about the quiet platform at dawn`, occurredAt: `${d}T08:00:00Z` }));
    expect(buildCandidates(rs, { now }).some((c) => c.title.includes("keeps coming back"))).toBe(true);
  });

  it("returns at most the limit, never repeats the same records, and counts the same item once", () => {
    const rs = Array.from({ length: 30 }, (_, i) => rec({ sourceType: i % 2 ? "photo" : "note", place: `Place ${i % 8}`, occurredAt: `2026-09-${String((i % 8) + 1).padStart(2, "0")}T08:00:00Z` }));
    const out = buildCandidates(rs, { now, limit: 5 });
    expect(out.length).toBeLessThanOrEqual(5);
    expect(dedupe([rec({ fingerprint: "x" }), rec({ fingerprint: "x" }), rec({})]).length).toBe(2);
  });
});

describe("helpers", () => {
  it("spots a thought left mid-way", () => {
    expect(isUnfinished("The sea looked like it was waiting for…")).toBe(true);
    expect(isUnfinished("A complete sentence about the sea.")).toBe(false);
    expect(isUnfinished("hm,")).toBe(false);
  });
  it("says how long ago, gently", () => {
    expect(ago("2026-10-12T08:00:00Z", now)).toBe("today");
    expect(ago("2026-06-01T08:00:00Z", now)).toBe("4 months ago");
    expect(ago("2024-06-01T08:00:00Z", now)).toBe("2 years ago");
  });
});
