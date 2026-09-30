import { describe, expect, it } from "vitest";
import { momentFace, type ScrapbookAttachment } from "./scrapbook-options";

const att = (itemType: string, mimeType: string | null = null): ScrapbookAttachment => ({ id: "a", kind: "material", itemId: "m", title: "t", itemType, excerpt: null, mimeType, fileUrl: null, canOpen: true });

describe("how a Moment shows on a Profile", () => {
  it("reads the form from what the entry holds", () => {
    expect(momentFace({ kind: "thought", body: "", attachments: [att("image", "image/jpeg")] }).face).toBe("photo");
    expect(momentFace({ kind: "sketch", body: "", attachments: [att("image", "image/png")] }).face).toBe("sketch");
    expect(momentFace({ kind: "thought", body: "", attachments: [att("voice", "audio/webm")] })).toEqual({ face: "audio", label: "Audio note" });
    expect(momentFace({ kind: "thought", body: "", attachments: [att("url")] }).face).toBe("link");
    expect(momentFace({ kind: "thought", body: "", attachments: [att("inspiration")] }).face).toBe("inspiration");
  });

  it("words alone are a note, a reflection, or a quote when quoted", () => {
    expect(momentFace({ kind: "thought", body: "A quieter mind creates a kinder world.", attachments: [] })).toEqual({ face: "note", label: "Note" });
    expect(momentFace({ kind: "reflection", body: "On noticing.", attachments: [] }).label).toBe("Reflection");
    expect(momentFace({ kind: "thought", body: "“Not all those who wander are lost.” — J.R.R. Tolkien", attachments: [] }).face).toBe("quote");
  });
});
