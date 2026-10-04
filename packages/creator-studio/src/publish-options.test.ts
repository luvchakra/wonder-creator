import { describe, expect, it } from "vitest";
import { DEFAULT_OVERLAY, DEFAULT_TRANSFORM } from "./carousel";
import { descriptorFor, experiencesFor, manifestFor, slugify, type PublishedSnapshot } from "./publish-options";

const snap = (over: Partial<PublishedSnapshot> = {}): PublishedSnapshot => ({ title: "T", description: null, typeLabel: "Poem", artifactType: "poem", versionNumber: 1, content: "", ...over });

describe("CreatorPublish experiences (§4–5)", () => {
  it("infers the experience from the type, and offers only what the work can honestly be", () => {
    expect(experiencesFor("poem", snap({ content: "line" }))).toEqual(["read"]);
    const slides = [{ objectId: null, text: "a", overlay: DEFAULT_OVERLAY, transform: DEFAULT_TRANSFORM }];
    expect(experiencesFor("carousel", snap({ content: "a", slides }))[0]).toBe("swipe");
    // A photo essay is made on the Images page now (creation-pages.md, step 2): it is viewed, pictures first.
    expect(experiencesFor("photo_essay", snap({ content: "p", blocks: [{ kind: "image", objectId: "o", alt: "" }, { kind: "text", text: "p" }], images: [{ objectId: "o", alt: "" }] }))[0]).toBe("view");
    expect(experiencesFor("documentary", snap({ content: "p", blocks: [{ kind: "image", objectId: "o", alt: "" }, { kind: "text", text: "p" }] }))[0]).toBe("journey");
    expect(experiencesFor("short_film", snap({ media: { kind: "video", objectId: "v", title: "t", durationSeconds: 272 } }))[0]).toBe("watch");
    // A short film with no film yet is read as its words.
    expect(experiencesFor("short_film", snap({ content: "treatment" }))).toEqual(["read"]);
    expect(experiencesFor("spoken_word", snap({ content: "w", media: { kind: "audio", objectId: "a", title: "t" } }))[0]).toBe("listen");
  });

  it("describes a work the way its card should (§17)", () => {
    const slides = Array.from({ length: 5 }, () => ({ objectId: null, text: "a", overlay: DEFAULT_OVERLAY, transform: DEFAULT_TRANSFORM }));
    expect(descriptorFor("carousel", "swipe", snap({ slides }))).toBe("Visual story · 5 slides");
    expect(descriptorFor("spoken_word", "listen", snap({ media: { kind: "audio", objectId: "a", title: "t", durationSeconds: 134 } }))).toBe("Spoken Word · 2:14");
    expect(descriptorFor("poem", "read", snap({ content: "short" }))).toBe("Poem");
  });

  it("keeps a chosen experience only if it fits, and picks the experience's first treatment otherwise", () => {
    const s = snap({ content: "words", images: [{ objectId: "o", alt: "" }] });
    expect(manifestFor("essay", s, { experience: "watch" }).experience).toBe("read");
    expect(manifestFor("essay", s, { experience: "view", treatment: "museum" })).toMatchObject({ experience: "view", treatment: "museum", allowZoom: true });
    expect(manifestFor("poem", snap({ content: "x" }), { treatment: "nonsense" })).toMatchObject({ poem: true, treatment: "page", theme: "paper" });
    expect(manifestFor("short_film", snap({ media: { kind: "video", objectId: "v", title: "t" } }), {}).theme).toBe("cinematic");
  });

  it("makes stable, URL-safe addresses", () => {
    expect(slugify("A Life in Moments!")).toBe("a-life-in-moments");
    expect(slugify("Café · Nuit")).toBe("cafe-nuit");
    expect(slugify("चाँद अमावस")).toBe("work");
  });
});
