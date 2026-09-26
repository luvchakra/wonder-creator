import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("marks added and removed lines", () => {
    const d = diffLines("a\nb\nc", "a\nx\nc");
    expect(d).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });
  it("handles identical input", () => {
    expect(diffLines("same", "same")).toEqual([{ kind: "same", text: "same" }]);
  });
});
