import { describe, expect, it } from "vitest";
import { journeyLine, journeyStep, type JourneyFacts } from "./journey";

const facts = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({ caught: false, made: false, connected: false, together: false, ...over });

describe("the next small step", () => {
  it("starts with a capture, then making, then connecting, then collaborating — the first one not yet taken", () => {
    expect(journeyStep(facts())).toBe("capture");
    expect(journeyStep(facts({ caught: true }))).toBe("make");
    expect(journeyStep(facts({ caught: true, made: true }))).toBe("connect");
    expect(journeyStep(facts({ caught: true, made: true, connected: true }))).toBe("collaborate");
    expect(journeyStep(facts({ caught: true, made: true, connected: true, together: true }))).toBeNull();
  });

  it("someone who made something straight away has begun: no capture step, and what they caught doesn't matter", () => {
    expect(journeyStep(facts({ made: true }))).toBe("connect");
    expect(journeyStep(facts({ made: true, caught: true }))).toBe("connect");
  });

  it("steps already taken are never asked for again, whatever order they were taken in", () => {
    // In a Community and a Room before making anything: making is still the next step.
    expect(journeyStep(facts({ caught: true, connected: true, together: true }))).toBe("make");
    // Collaborating without having joined a Community: connecting is next only after making.
    expect(journeyStep(facts({ caught: true, made: true, together: true }))).toBe("connect");
  });

  it("only the first two steps say anything under the greeting", () => {
    expect(journeyLine("capture")).toMatch(/small thing/);
    expect(journeyLine("make")).toMatch(/Creation/);
    expect(journeyLine("connect")).toBeNull();
    expect(journeyLine("collaborate")).toBeNull();
    expect(journeyLine(null)).toBeNull();
  });
});
