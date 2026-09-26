import { describe, expect, it } from "vitest";
import { titleFromInstruction } from "./pipeline";

describe("titleFromInstruction", () => {
  it("derives a working title from the creator's words", () => {
    expect(titleFromInstruction("I want to make a short film about my father's life. Here are photos.")).toBe("My Father's Life");
    expect(titleFromInstruction("Write a poem about the monsoon and my grandmother")).toBe("Monsoon");
    expect(titleFromInstruction("Make something")).toBeNull();
  });
});
