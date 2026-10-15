import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, TYPING_GROUP_MS, record, redo, startHistory, undo } from "./text-history";

describe("Studio undo / redo", () => {
  it("groups typing into one step, and a pause starts the next", () => {
    let h = startHistory("");
    h = record(h, "M", { typing: true, now: 1000 });
    h = record(h, "Mo", { typing: true, now: 1200 });
    h = record(h, "Moon", { typing: true, now: 1500 });
    h = record(h, "Moon wanes", { typing: true, now: 1500 + TYPING_GROUP_MS + 1 });
    expect(h.past).toEqual(["", "Moon"]);
    h = undo(h);
    expect(h.present).toBe("Moon");
    h = undo(h);
    expect(h.present).toBe("");
    expect(undo(h)).toBe(h); // nothing further back
  });

  it("a change from code is always its own step, and redo walks forward until something new happens", () => {
    let h = record(startHistory("draft"), "draft and more", { typing: true, now: 1 });
    h = record(h, "A kept revision.", { now: 2 });
    expect(undo(h).present).toBe("draft and more");
    h = undo(h);
    h = redo(h);
    expect(h.present).toBe("A kept revision.");
    expect(redo(h)).toBe(h);
    // Undo, then type: the undone step is gone.
    h = record(undo(h), "draft and more!", { typing: true, now: 3 });
    expect(h.future).toEqual([]);
  });

  it("ignores no-op changes and keeps a bounded history", () => {
    const h0 = startHistory("same");
    expect(record(h0, "same")).toBe(h0);
    let h = h0;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, `v${i}`);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
