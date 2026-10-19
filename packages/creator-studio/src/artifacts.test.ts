import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARTIFACT_COLUMNS } from "./artifacts";

describe("ARTIFACT_COLUMNS", () => {
  it("is every column of the table except the full-text index, so a new column isn't silently missing from reads", () => {
    const src = readFileSync(new URL("../../db/src/database.types.ts", import.meta.url), "utf8");
    const at = src.indexOf('"artifacts": {\n                  Row: {\n');
    const line = src.slice(at).split("\n")[2] ?? "";
    const cols = [...line.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]!);
    expect(cols.length).toBeGreaterThan(12);
    expect([...ARTIFACT_COLUMNS.split(",")].sort()).toEqual(cols.filter((c) => c !== "search").sort());
  });
});
