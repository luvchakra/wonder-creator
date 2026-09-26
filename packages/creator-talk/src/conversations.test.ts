import { describe, expect, it } from "vitest";
import { titleFrom } from "./conversations";
import { turnSchema } from "./turn";

describe("titleFrom", () => {
  it("uses the first sentence", () => {
    expect(titleFrom("I want to make a short film about my father's life. Here are some photos.")).toBe("I want to make a short film about my father's life");
  });
  it("truncates long first sentences", () => {
    expect(titleFrom("a".repeat(100)).length).toBeLessThanOrEqual(60);
  });
  it("defaults when empty", () => {
    expect(titleFrom("   ")).toBe("New conversation");
  });
});

describe("turnSchema", () => {
  it("rejects non-uuid material ids (ID tampering)", () => {
    expect(() => turnSchema.parse({ message: "hi", materialIds: ["1 or 1=1"] })).toThrow();
  });
  it("limits attachments", () => {
    expect(() => turnSchema.parse({ message: "hi", materialIds: Array.from({ length: 13 }, () => crypto.randomUUID()) })).toThrow();
  });
});

import { chatHistory } from "./turn";
describe("chatHistory", () => {
  it("alternates roles and ends with the creator", () => {
    const h = chatHistory(
      [
        { role: "brain", content: "hello" },
        { role: "creator", content: "a" },
        { role: "creator", content: "b" },
        { role: "brain", content: "c" },
        { role: "creator", content: "latest (already stored)" },
      ],
      "latest",
    );
    expect(h.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(h[0].content).toBe("a\n\nb");
    expect(h.at(-1)?.content).toBe("latest");
  });
});
