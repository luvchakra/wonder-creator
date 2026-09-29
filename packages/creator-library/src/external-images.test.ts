import { describe, expect, it } from "vitest";
import { externalConnected, lookupExternalImage, searchExternalImages } from "./external-images";

describe("external royalty-free pictures", () => {
  it("Openverse needs no key; Pixabay and Pexels are honest about a missing key", async () => {
    expect(externalConnected("openverse", {})).toBe(true);
    expect(externalConnected("pixabay", {})).toBe(false);
    expect(externalConnected("pexels", { pexels: "k" })).toBe(true);
    expect(await searchExternalImages("pixabay", "rain", {})).toEqual({ connected: false, results: [] });
    await expect(lookupExternalImage("pexels", "123", {})).rejects.toThrow(/isn't connected/);
  });

  it("an empty search asks nothing of the provider, and ids are checked before any request", async () => {
    expect(await searchExternalImages("openverse", "   ", {})).toEqual({ connected: true, results: [] });
    await expect(lookupExternalImage("openverse", "../../admin", {})).rejects.toThrow(/isn't available/);
    await expect(lookupExternalImage("pixabay", "12a", { pixabay: "k" })).rejects.toThrow(/isn't available/);
  });
});
