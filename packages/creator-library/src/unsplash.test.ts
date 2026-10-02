import { beforeEach, describe, expect, it, vi } from "vitest";

// The network is replaced: every call through the SSRF guard is recorded and answered here.
const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
let answer: unknown = {};
vi.mock("@wonder/core/server", () => ({
  safeFetch: vi.fn(async (url: string, opts: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: opts?.headers });
    return { status: 200, truncated: false, contentType: "application/json", body: new TextEncoder().encode(JSON.stringify(answer)) };
  }),
}));

const { lookupExternalImage, markExternalImageUsed, searchExternalImages } = await import("./external-images");

const photo = {
  id: "Abc_12-xyZ",
  alt_description: "a rainy street at night",
  description: null,
  urls: { raw: "https://images.unsplash.com/photo-1?ixid=x", full: "f", regular: "https://images.unsplash.com/photo-1?w=1080", small: "https://images.unsplash.com/photo-1?w=400", thumb: "t" },
  links: { html: "https://unsplash.com/photos/Abc_12-xyZ", download_location: "https://api.unsplash.com/photos/Abc_12-xyZ/download?ixid=x" },
  user: { name: "Maya Rao", username: "mayarao", links: { html: "https://unsplash.com/@mayarao" } },
};
const keys = { unsplash: "access-key" };

beforeEach(() => {
  calls.length = 0;
});

describe("Unsplash", () => {
  it("searches with the Client-ID key and maps the photo with its credit, licence and links back", async () => {
    answer = { results: [photo] };
    const r = await searchExternalImages("unsplash", "rain", keys);
    expect(calls[0]!.url).toMatch(/^https:\/\/api\.unsplash\.com\/search\/photos\?query=rain&per_page=12&content_filter=high$/);
    expect(calls[0]!.headers).toMatchObject({ authorization: "Client-ID access-key", "accept-version": "v1" });
    const img = r.results[0]!;
    expect(img).toMatchObject({
      provider: "unsplash",
      id: "Abc_12-xyZ",
      title: "a rainy street at night",
      creator: "Maya Rao",
      license: "Unsplash License",
      rights: "reuse_permitted",
      attribution: "Photo by Maya Rao on Unsplash",
      thumbUrl: "https://images.unsplash.com/photo-1?w=400",
      sourceUrl: "https://unsplash.com/photos/Abc_12-xyZ?utm_source=wonder_creator&utm_medium=referral",
      creatorUrl: "https://unsplash.com/@mayarao?utm_source=wonder_creator&utm_medium=referral",
    });
    // Pictures come from Unsplash's own image service, at a sensible size.
    expect(new URL(img.imageUrl).host).toBe("images.unsplash.com");
    expect(img.imageUrl).toContain("w=2400");
  });

  it("looks one photo up by id, and reports its use to Unsplash's download endpoint only", async () => {
    answer = photo;
    const img = await lookupExternalImage("unsplash", "Abc_12-xyZ", keys);
    expect(calls[0]!.url).toBe("https://api.unsplash.com/photos/Abc_12-xyZ");
    calls.length = 0;
    answer = { url: "https://images.unsplash.com/photo-1" };
    await markExternalImageUsed("unsplash", img, keys);
    expect(calls).toEqual([{ url: photo.links.download_location, headers: { authorization: "Client-ID access-key", "accept-version": "v1" } }]);
    // A tracking address anywhere else is never called with the key.
    calls.length = 0;
    await markExternalImageUsed("unsplash", { ...img, useTrackingUrl: "https://evil.example/collect" }, keys);
    expect(calls).toEqual([]);
    // No key, no call.
    await markExternalImageUsed("unsplash", img, {});
    expect(calls).toEqual([]);
  });
});
