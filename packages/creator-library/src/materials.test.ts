import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MATERIAL_COLUMNS, toTsQuery } from "./materials";

/** The column names of a table's Row in the generated types file (one line per Row). */
function rowColumns(table: string): string[] {
  const src = readFileSync(new URL("../../db/src/database.types.ts", import.meta.url), "utf8");
  const at = src.indexOf(`"${table}": {\n                  Row: {\n`);
  const line = src.slice(at).split("\n")[2] ?? "";
  return [...line.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]!);
}

describe("MATERIAL_COLUMNS", () => {
  it("is every column of the table except the full-text index, so a new column isn't silently missing from lists", () => {
    const cols = rowColumns("creative_materials");
    expect(cols.length).toBeGreaterThan(15);
    expect([...MATERIAL_COLUMNS.split(",")].sort()).toEqual(cols.filter((c) => c !== "search").sort());
  });
});

describe("toTsQuery", () => {
  it("builds prefix queries and strips operators", () => {
    expect(toTsQuery("Father house")).toBe("father:* & house:*");
    expect(toTsQuery("a & b | !c <-> d")).toBe("a:* & b:* & c:* & d:*");
    expect(toTsQuery("   ")).toBe("''");
  });
  it("keeps unicode letters", () => {
    expect(toTsQuery("गोवा sunset")).toBe("गोवा:* & sunset:*");
  });
});
