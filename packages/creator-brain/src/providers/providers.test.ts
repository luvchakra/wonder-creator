import { describe, expect, it } from "vitest";
import { providerReadiness, selectProvider } from "./index";
import { OfflineProvider } from "./offline";
import { directionsSchema } from "../schemas";

describe("provider selection", () => {
  it("uses Gemini when WONDERCREATOR_AI_PROVIDER=gemini and a key is set", () => {
    const p = selectProvider({ WONDERCREATOR_AI_PROVIDER: "gemini", WONDERCREATOR_AI_API_KEY: "g-test", NODE_ENV: "production" });
    expect(p.name).toBe("gemini");
    expect(p.live).toBe(true);
    expect(p.modelFor("generate")).toBe("gemini-3.8-flash");
  });
  it("uses Anthropic when selected, and honours the model override", () => {
    const p = selectProvider({ WONDERCREATOR_AI_PROVIDER: "Anthropic", WONDERCREATOR_AI_API_KEY: "sk-test", WONDERCREATOR_AI_MODEL: "claude-sonnet-5", NODE_ENV: "production" });
    expect(p.name).toBe("anthropic");
    expect(p.modelFor("generate")).toBe("claude-sonnet-5");
  });
  it("never pretends to be live without credentials in production", async () => {
    const p = selectProvider({ NODE_ENV: "production" });
    expect(p.live).toBe(false);
    await expect(p.generate({ task: "generate", system: "", messages: [] })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(providerReadiness({ NODE_ENV: "production" }).configured).toBe(false);
  });
  it("explains a provider without a key, or an unknown provider, without leaking values", () => {
    const noKey = providerReadiness({ WONDERCREATOR_AI_PROVIDER: "gemini", NODE_ENV: "production" });
    expect(noKey).toMatchObject({ provider: "none", configured: false });
    expect(noKey.note).toContain("no API key");
    const unknown = providerReadiness({ WONDERCREATOR_AI_PROVIDER: "gpt", WONDERCREATOR_AI_API_KEY: "secret-value", NODE_ENV: "production" });
    expect(unknown.note).toContain("Unknown AI provider");
    expect(unknown.note).not.toContain("secret-value");
  });
  it("falls back to the offline model in development and says so", () => {
    const r = providerReadiness({ NODE_ENV: "development" });
    expect(r.provider).toBe("offline");
    expect(r.live).toBe(false);
  });
  it("can be forced offline even with a key (CI)", () => {
    expect(selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline", WONDERCREATOR_AI_API_KEY: "k", NODE_ENV: "production" }).name).toBe("offline");
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
