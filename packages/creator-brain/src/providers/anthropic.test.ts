import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicProvider } from "./anthropic";

/** Minimal SSE stream the SDK's MessageStream understands. */
function sse(message: Record<string, unknown>, text: string, stopReason = "end_turn") {
  const events = [
    { type: "message_start", message: { ...message, content: [], stop_reason: null, usage: { input_tokens: 12, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 7 } },
    { type: "message_stop" },
  ];
  const body = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const baseMessage = { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5" };

function recorder(respond: () => Response) {
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return respond();
  }) as typeof fetch;
  return { calls, f };
}

describe("AnthropicProvider contract", () => {
  it("sends the expected request and parses streamed text", async () => {
    const { calls, f } = recorder(() => sse(baseMessage, "A poem."));
    const p = new AnthropicProvider({ apiKey: "test-key", fetch: f, maxRetries: 0 });
    const out = await p.generate({ task: "generate", system: "sys", messages: [{ role: "user", content: "Write" }] });
    expect(out.text).toBe("A poem.");
    expect(out.usage).toEqual({ inputTokens: 12, outputTokens: 7 });
    const body = calls[0].body;
    expect(calls[0].url).toContain("/v1/messages");
    expect(body.model).toBe("claude-opus-5");
    expect(body.stream).toBe(true);
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "high" });
    expect(body.fallbacks).toBe("default");
    expect(calls[0].headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.system).toBe("sys");
  });

  it("uses light effort for classification-like tasks and honours the model override", async () => {
    const { calls, f } = recorder(() => sse(baseMessage, "ok"));
    const p = new AnthropicProvider({ apiKey: "k", fetch: f, model: "claude-sonnet-5", maxRetries: 0 });
    await p.generate({ task: "intent", system: "", messages: [{ role: "user", content: "hi" }] });
    expect(calls[0].body.model).toBe("claude-sonnet-5");
    expect(calls[0].body.output_config).toEqual({ effort: "low" });
  });

  it("requests JSON-schema structured output and validates it", async () => {
    const { calls, f } = recorder(() => sse(baseMessage, JSON.stringify({ title: "Home", count: 2 })));
    const p = new AnthropicProvider({ apiKey: "k", fetch: f, maxRetries: 0 });
    const out = await p.structured({ task: "plan", system: "", messages: [{ role: "user", content: "x" }], schema: z.object({ title: z.string(), count: z.number() }), schemaName: "plan" });
    expect(out.value).toEqual({ title: "Home", count: 2 });
    const format = (calls[0].body.output_config as { format: { type: string; schema: { type: string } } }).format;
    expect(format.type).toBe("json_schema");
    expect(format.schema.type).toBe("object");
  });

  it("rejects schema-invalid structured output with a creator-readable error", async () => {
    const { f } = recorder(() => sse(baseMessage, JSON.stringify({ title: 5 })));
    const p = new AnthropicProvider({ apiKey: "k", fetch: f, maxRetries: 0 });
    await expect(p.structured({ task: "plan", system: "", messages: [{ role: "user", content: "x" }], schema: z.object({ title: z.string() }), schemaName: "plan" })).rejects.toMatchObject({ code: "provider_failed" });
  });

  it("maps refusals to a calm, recoverable error", async () => {
    const { f } = recorder(() => sse(baseMessage, "", "refusal"));
    const p = new AnthropicProvider({ apiKey: "k", fetch: f, maxRetries: 0 });
    await expect(p.generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_failed" });
  });

  it("maps rate limits to provider_unavailable", async () => {
    const { f } = recorder(() => new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "slow down" } }), { status: 429, headers: { "content-type": "application/json" } }));
    const p = new AnthropicProvider({ apiKey: "k", fetch: f, maxRetries: 0 });
    await expect(p.generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_unavailable" });
  });
});
