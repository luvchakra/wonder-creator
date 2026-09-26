import { describe, expect, it } from "vitest";
import { findingsOf, RIGHTS_CHECK_KEY, selectiveInstruction, withRightsCheck } from "./quality-workflow";

const report = {
  checks: [
    { key: "structure", label: "Structure", status: "good", note: "Fine." },
    { key: "pacing", label: "Pacing", status: "attention", note: "The middle drags." },
    { key: RIGHTS_CHECK_KEY, label: "Rights & provenance", status: "attention", note: "Uses a web link." },
  ],
  suggestions: [{ title: "Closer detail", detail: "Use one object." }, { title: "Shorter ending", detail: "Cut the last line." }],
  dismissed: ["s1"],
  applied: ["c:pacing"],
};

describe("quality findings", () => {
  it("lists attention checks and suggestions with stable keys and their state", () => {
    const f = findingsOf(report);
    expect(f.map((x) => [x.key, x.state])).toEqual([
      ["c:pacing", "applied"],
      [`c:${RIGHTS_CHECK_KEY}`, "open"],
      ["s0", "open"],
      ["s1", "dismissed"],
    ]);
    expect(f.find((x) => x.key === `c:${RIGHTS_CHECK_KEY}`)?.locked).toBe(true);
    expect(f.filter((x) => x.locked)).toHaveLength(1);
  });

  it("the provenance check always replaces a model check with the same key", () => {
    const merged = withRightsCheck([{ key: RIGHTS_CHECK_KEY, label: "x", status: "good", note: "model says fine" }], { key: RIGHTS_CHECK_KEY, label: "Rights & provenance", status: "attention", note: "from provenance" });
    expect(merged).toEqual([{ key: RIGHTS_CHECK_KEY, label: "Rights & provenance", status: "attention", note: "from provenance" }]);
  });

  it("builds an instruction that applies only the chosen findings, and a summary naming them", () => {
    const chosen = findingsOf(report).filter((x) => x.key === "s0");
    const { instruction, summary } = selectiveInstruction(chosen);
    expect(instruction).toContain("Apply only these improvements");
    expect(instruction).toContain("Closer detail: Use one object.");
    expect(instruction).not.toContain("Shorter ending");
    expect(summary).toBe("Applied quality suggestions: Closer detail");
  });
});
