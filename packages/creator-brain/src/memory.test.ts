import { describe, expect, it } from "vitest";
import { onboardingMemoryStatements } from "./memory";

describe("onboarding memories", () => {
  it("writes human statements from the creator's answers", () => {
    const m = onboardingMemoryStatements({
      disciplines: ["Photography", "Writing"],
      tones: ["Warm", "Poetic"],
      writingStyle: "narrative",
      visualStyles: ["Cinematic"],
      preserve: ["My voice"],
      avoid: ["Generic AI tone"],
      languages: ["English", "Hindi"],
    });
    expect(m.map((x) => x.statement)).toEqual([
      "You work across photography and writing.",
      "You create in English and Hindi.",
      "You prefer warm and poetic tone and narrative writing.",
      "Your visual style leans cinematic.",
      "Always preserve: My voice.",
      "Avoid: Generic AI tone.",
    ]);
  });
  it("returns nothing when nothing was shared", () => {
    expect(onboardingMemoryStatements({ disciplines: [], tones: [], writingStyle: null, visualStyles: [], preserve: [], avoid: [], languages: ["English"] })).toEqual([]);
  });
});
