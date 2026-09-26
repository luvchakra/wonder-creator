import { describe, expect, it } from "vitest";
import { checksFor, heuristicChecks, mergeChecks } from "./quality";

describe("quality checks", () => {
  it("chooses checks by artifact type", () => {
    expect(checksFor("screenplay")).toContain("Formatting");
    expect(checksFor("lyrics")).toContain("Rhythm");
    expect(checksFor("poster")).toContain("Composition");
  });
  it("flags missing scene headings in scripts", () => {
    const c = heuristicChecks("short_film", "A man walks to the door and opens it slowly, remembering everything that happened here.");
    expect(c.find((x) => x.key === "formatting")?.status).toBe("attention");
  });
  it("flags things the creator asked to avoid", () => {
    const c = heuristicChecks("essay", "In today's fast-paced world, we must unlock our potential and delve into the tapestry of life.", { avoid: ["fast-paced world", "tapestry"] });
    expect(c.find((x) => x.key === "constraints")?.status).toBe("attention");
  });
  it("merge keeps attention over good", () => {
    const merged = mergeChecks([{ key: "a", label: "A", status: "good", note: "" }], [{ key: "a", label: "A", status: "attention", note: "x" }]);
    expect(merged[0].status).toBe("attention");
  });
});
