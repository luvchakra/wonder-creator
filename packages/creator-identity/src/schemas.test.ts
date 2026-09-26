import { describe, expect, it } from "vitest";
import { aboutSchema, handleSchema, nextOnboardingStep, normalizeTags } from "./schemas";

describe("identity schemas", () => {
  it("normalises handles", () => {
    expect(handleSchema.parse("  Maya_Sen ")).toBe("maya_sen");
    expect(() => handleSchema.parse("ma")).toThrow();
    expect(() => handleSchema.parse("maya sen")).toThrow();
    expect(() => handleSchema.parse("maya<script>")).toThrow();
  });
  it("requires a display name", () => {
    expect(() => aboutSchema.parse({ displayName: " ", handle: "maya" })).toThrow();
  });
  it("advances onboarding and finishes", () => {
    expect(nextOnboardingStep("welcome")).toBe("about");
    expect(nextOnboardingStep("ready")).toBe("complete");
  });
  it("dedupes tags case-insensitively", () => {
    expect(normalizeTags(["Film", "film ", " Poetry", "", "poetry"])).toEqual(["Film", "Poetry"]);
  });
});
