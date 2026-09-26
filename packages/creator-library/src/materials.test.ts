import { describe, expect, it } from "vitest";
import { toTsQuery } from "./materials";

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
