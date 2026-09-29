import { describe, expect, it } from "vitest";
import { homeContextLine, homeMode, pickContinue, selectSlots, summarizeAway, type AwayItem } from "./ranking";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

describe("Home modes", () => {
  it("quiet when nothing needs attention — a memory or someone's post alone doesn't count", () => {
    expect(homeMode({ lastVisit: hoursAgo(100), now: NOW, available: {} })).toBe("quiet");
    expect(homeMode({ lastVisit: hoursAgo(100), now: NOW, available: { spark: "creative_memory", worthHearing: "general_activity" } })).toBe("quiet");
    // …but something live right now is.
    expect(homeMode({ lastVisit: hoursAgo(1), now: NOW, available: { worthHearing: "relevant_huddle" } })).toBe("active");
  });
  it("return after a real absence with something to show; active otherwise (and on a first visit)", () => {
    expect(homeMode({ lastVisit: hoursAgo(49), now: NOW, available: { whileAway: "collaborator_response" } })).toBe("return");
    expect(homeMode({ lastVisit: hoursAgo(5), now: NOW, available: { whileAway: "collaborator_response" } })).toBe("active");
    expect(homeMode({ lastVisit: null, now: NOW, available: { dejavu: "creative_memory" } })).toBe("active");
  });
});

describe("which modules earn a place", () => {
  const all = { whileAway: "collaborator_response", worldConnecting: "moment_connection", dejavu: "creative_memory", spark: "creative_memory", worthHearing: "relevant_huddle", couldHelp: "requires_decision" } as const;
  it("active: the update, one discovery, one human signal — in page order", () => {
    expect(selectSlots("active", all)).toEqual(["whileAway", "worldConnecting", "couldHelp"]);
    expect(selectSlots("active", { spark: "creative_memory", worthHearing: "relevant_huddle" })).toEqual(["spark", "worthHearing"]);
  });
  it("return: the most significant, capped, never a feed", () => {
    const s = selectSlots("return", all);
    expect(s).toHaveLength(5);
    expect(s).not.toContain("spark"); // lowest significance, and placed after the DejaVu on ties
    expect(s[0]).toBe("whileAway");
  });
  it("replies to your own question count as a human signal and outrank others' asks", () => {
    expect(selectSlots("active", { yourQuestion: "collaborator_response", couldHelp: "help_opportunity", worthHearing: "relevant_conversation" })).toEqual(["yourQuestion"]);
    expect(homeMode({ lastVisit: hoursAgo(2), now: NOW, available: { yourQuestion: "collaborator_response" } })).toBe("active");
  });
  it("quiet: at most one memory; empty modules never render", () => {
    expect(selectSlots("quiet", all)).toEqual(["spark"]);
    expect(selectSlots("quiet", {})).toEqual([]);
    expect(selectSlots("active", {})).toEqual([]);
  });
});

describe("While you were away", () => {
  const item = (kind: string, candidate: AwayItem["candidate"], h: number, title = kind): AwayItem => ({ id: `${kind}${h}`, kind, candidate, title, href: `/${kind}`, at: hoursAgo(h) });
  it("names up to three things, most significant first", () => {
    const s = summarizeAway([item("visuals_ready", "completed_output", 1, "Carousel finished generating"), item("comment", "collaborator_response", 2, "Maya commented on the ending")])!;
    expect(s.lines.map((l) => l.text)).toEqual(["Maya commented on the ending", "Carousel finished generating"]);
    expect(s.total).toBe(2);
  });
  it("summarises more than three instead of listing them", () => {
    const s = summarizeAway([
      item("comment", "collaborator_response", 1),
      item("comment", "collaborator_response", 2),
      item("visuals_ready", "completed_output", 3),
      item("visuals_ready", "completed_output", 4),
      item("publish_failed", "requires_decision", 5, "Publishing to Blog failed"),
    ])!;
    expect(s.lines.map((l) => l.text)).toEqual(["Publishing to Blog failed", "2 new comments", "2 sets of visuals ready"]);
    expect(s.total).toBe(5);
  });
  it("never more than three lines", () => {
    const s = summarizeAway([item("a", "general_activity", 1), item("b", "general_activity", 2), item("c", "general_activity", 3), item("d", "general_activity", 4), item("d", "general_activity", 5)])!;
    expect(s.lines).toHaveLength(3);
    expect(s.lines[2]!.text).toBe("3 more updates");
  });
  it("nothing to say, nothing shown", () => expect(summarizeAway([])).toBeNull());
});

describe("Context Line", () => {
  it("one short truth, 2–7 words", () => {
    expect(homeContextLine({ mode: "quiet" })).toBe("Nothing urgent");
    expect(homeContextLine({ mode: "active", whileAway: { total: 3, lines: [], candidate: "general_activity" } })).toBe("3 things changed");
    expect(homeContextLine({ mode: "active", whileAway: { total: 1, lines: [], candidate: "completed_output" }, singleReady: "Your visuals are ready" })).toBe("Your visuals are ready");
    expect(homeContextLine({ mode: "active", connection: true })).toBe("A new connection was found");
    expect(homeContextLine({ mode: "active", dejavuName: "Railways" })).toBe("Railways surfaced again");
    for (const l of ["Nothing urgent", "3 things changed", "A new connection was found", "Railways surfaced again"]) expect(l.split(" ").length).toBeLessThanOrEqual(7);
  });
});

describe("Continue", () => {
  it("unsaved work and output in flight beat recency; finished work yields to work in progress", () => {
    const recent = { id: "recent", status: "draft", updatedAt: hoursAgo(1) };
    const unsaved = { id: "unsaved", status: "draft", updatedAt: hoursAgo(72), unsavedDraft: true };
    expect(pickContinue([recent, unsaved], NOW)!.id).toBe("unsaved");
    const done = { id: "done", status: "published", updatedAt: hoursAgo(1) };
    const wip = { id: "wip", status: "draft", updatedAt: hoursAgo(30) };
    expect(pickContinue([done, wip], NOW)!.id).toBe("wip");
    expect(pickContinue([], NOW)).toBeNull();
  });
});
