import { describe, expect, it } from "vitest";
import { keyHint } from "./catalog";
import { validateProviderKey } from "./validate";

const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("validateProviderKey", () => {
  it("lists usable models for a valid key, sending the key only in a header", async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return new Response(JSON.stringify({ models: [{ name: "models/gemini-x", supportedGenerationMethods: ["generateContent"] }, { name: "models/embed-1", supportedGenerationMethods: ["embedContent"] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await validateProviderKey("gemini", "AIzaSy-test-key-123", f)).toEqual({ status: "valid", models: ["gemini-x"] });
    expect(seen!.url).not.toContain("AIzaSy");
    expect(seen!.headers["x-goog-api-key"]).toBe("AIzaSy-test-key-123");
    expect(await validateProviderKey("anthropic", "sk-ant-test-123456", respond(200, { data: [{ id: "claude-a" }] }))).toEqual({ status: "valid", models: ["claude-a"] });
  });

  it("distinguishes a rejected key from an unreachable provider, without echoing the key", async () => {
    const bad = await validateProviderKey("anthropic", "sk-ant-wrong-000000", respond(401, { error: "nope" }));
    expect(bad).toEqual({ status: "invalid", message: "The provider didn't accept this key." });
    const down = await validateProviderKey("gemini", "AIzaSy-test-key-123", (async () => {
      throw new Error("ECONNRESET for AIzaSy-test-key-123");
    }) as unknown as typeof fetch);
    expect(down.status).toBe("unreachable");
    expect(JSON.stringify(down)).not.toContain("AIzaSy");
    expect((await validateProviderKey("gemini", "short", respond(200, {}))).status).toBe("invalid");
    expect(keyHint("sk-ant-abcdef1234")).toBe("1234");
  });
});
