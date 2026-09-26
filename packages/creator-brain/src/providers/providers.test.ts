import { describe, expect, it } from "vitest";
import { providerReadiness, selectProvider } from "./index";
import { OfflineProvider } from "./offline";
import { directionsSchema } from "../schemas";

describe("provider selection", () => {
  it("uses Anthropic when a key is configured", () => {
    expect(selectProvider({ ANTHROPIC_API_KEY: "sk-test", NODE_ENV: "production" }).name).toBe("anthropic");
  });
  it("never pretends to be live without credentials in production", async () => {
    const p = selectProvider({ NODE_ENV: "production" });
    expect(p.live).toBe(false);
    await expect(p.generate({ task: "generate", system: "", messages: [] })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(providerReadiness({ NODE_ENV: "production" }).configured).toBe(false);
  });
  it("falls back to the offline model in development and says so", () => {
    const r = providerReadiness({ NODE_ENV: "development" });
    expect(r.provider).toBe("offline");
    expect(r.live).toBe(false);
  });
});

describe("offline provider", () => {
  it("is deterministic", async () => {
    const p = new OfflineProvider();
    const input = { task: "generate" as const, system: "", messages: [], hints: { format: "verse", title: "Father", keywords: ["door", "light"] } };
    expect((await p.generate(input)).text).toBe((await p.generate(input)).text);
  });
  it("returns schema-valid directions", async () => {
    const out = await new OfflineProvider().structured({ task: "discover", system: "", messages: [], schema: directionsSchema, schemaName: "directions", hints: { refs: ["m1"] } });
    expect(out.value.directions).toHaveLength(3);
    expect(out.value.directions[0].materialRefs).toEqual(["m1"]);
  });
});
