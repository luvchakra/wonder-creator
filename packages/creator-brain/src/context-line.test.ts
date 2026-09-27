import { describe, expect, it } from "vitest";
import { generateContextLine, validateContextLine, type ContextLine, type ContextLineInput } from "./context-line";
import { OfflineProvider, type CreativeModelProvider } from "./providers";

const input: ContextLineInput = {
  page: "creation",
  lifecycle: "in-progress",
  title: "Harbour Lights",
  facts: { version: 4, unused_materials: [{ untrusted: "Dad voice note" }], recent_change: { untrusted: "Opening shortened" } },
};
const line = (o: Partial<ContextLine>): ContextLine => ({ text: "Dad voice note is still unused", reason: "creative_context", sourceKeys: ["unused_materials"], confidence: 0.9, ...o });

function fakeProvider(value: ContextLine): CreativeModelProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: "fake",
    live: true,
    prompts,
    modelFor: () => "fake",
    generate: async () => ({ text: "", usage: { inputTokens: 0, outputTokens: 0 }, model: "fake", provider: "fake" }),
    stream: async function* () {},
    structured: async (i) => {
      prompts.push(String(i.messages[0]?.content));
      return { value: i.schema.parse(value), usage: { inputTokens: 1, outputTokens: 1 }, model: "fake", provider: "fake" };
    },
  } as CreativeModelProvider & { prompts: string[] };
}

describe("validateContextLine", () => {
  it("accepts a short, grounded, confident observation", () => {
    expect(validateContextLine(line({}), input)).toBe("Dad voice note is still unused");
  });

  it("rejects what the spec forbids", () => {
    expect(validateContextLine(line({ text: null, reason: "none" }), input)).toBeNull();
    expect(validateContextLine(line({ confidence: 0.6 }), input)).toBeNull();
    expect(validateContextLine(line({ text: "x".repeat(57) }), input)).toBeNull();
    expect(validateContextLine(line({ sourceKeys: ["collaborators"] }), input)).toBeNull(); // not supplied
    expect(validateContextLine(line({ sourceKeys: [] }), input)).toBeNull();
    expect(validateContextLine(line({ text: "I think the opening works" }), input)).toBeNull();
    expect(validateContextLine(line({ text: "CreativeMind suggests a new ending" }), input)).toBeNull();
    expect(validateContextLine(line({ text: "Great job on the opening!" }), input)).toBeNull();
    expect(validateContextLine(line({ text: "Harbour Lights" }), input)).toBeNull(); // repeats the title
  });

  it("never lets the model invent numbers", () => {
    expect(validateContextLine(line({ text: "You left this at version 4", sourceKeys: ["version"] }), input)).toBe("You left this at version 4");
    expect(validateContextLine(line({ text: "3 photos may fit this scene" }), input)).toBeNull();
  });
});

describe("generateContextLine", () => {
  it("fences the creator's material and returns a validated line", async () => {
    const p = fakeProvider(line({}));
    expect(await generateContextLine(p, input)).toBe("Dad voice note is still unused");
    expect(p.prompts[0]).toContain("<untrusted_material");
    expect(p.prompts[0]).toContain("Dad voice note");
  });

  it("stays quiet without a live provider — no fake insight", async () => {
    expect(await generateContextLine(new OfflineProvider(), input)).toBeNull();
  });

  it("returns null when validation fails", async () => {
    expect(await generateContextLine(fakeProvider(line({ text: "2 collaborators are here", sourceKeys: ["version"] })), input)).toBeNull();
  });
});
