import { describe, expect, it } from "vitest";
import { extractPage, parseYouTubeId, splitLinks } from "./links";
import { canTransition, stepIndex } from "./states";

describe("parseYouTubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("%s", (url, id) => expect(parseYouTubeId(url)).toBe(id));
  it("rejects look-alikes", () => {
    expect(parseYouTubeId("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("splitLinks", () => {
  it("pulls out multiple URLs and keeps the note", () => {
    const r = splitLinks("Some refs: https://a.example/x, https://b.example/y. And my thought.");
    expect(r.urls).toEqual(["https://a.example/x", "https://b.example/y"]);
    expect(r.rest).toContain("my thought");
  });
});

describe("extractPage", () => {
  it("reads metadata and text, ignoring scripts", () => {
    const html = `<html><head><title>Goa &amp; Light</title><meta property="og:description" content="Evening sea"><meta property="og:image" content="/img.jpg"><script>alert('x')</script></head><body><main><h1>Sunset</h1><p>Warm tones.</p></main></body></html>`;
    const p = extractPage(html, "https://example.com/post");
    expect(p.title).toBe("Goa & Light");
    expect(p.description).toBe("Evening sea");
    expect(p.image).toBe("https://example.com/img.jpg");
    expect(p.text).toContain("Warm tones.");
    expect(p.text).not.toContain("alert");
  });
  it("drops javascript: image URLs", () => {
    expect(extractPage(`<meta property="og:image" content="javascript:alert(1)">`, "https://e.com").image).toBeNull();
  });
});

describe("intake states", () => {
  it("enforces transitions", () => {
    expect(canTransition("received", "validating")).toBe(true);
    expect(canTransition("quarantined", "ready")).toBe(false);
    expect(canTransition("failed", "extracting")).toBe(true);
    expect(stepIndex("understood")).toBe(3);
  });
});
