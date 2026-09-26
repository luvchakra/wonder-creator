import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "./gemini";

const usage = { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 2 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function reply(text: string, finishReason = "STOP") {
  return json({ candidates: [{ content: { role: "model", parts: [{ text: "thinking…", thought: true }, { text }] }, finishReason }], usageMetadata: usage, modelVersion: "gemini-3.8-flash" });
}

function sse(chunks: unknown[]) {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function recorder(respond: () => Response) {
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return respond();
  }) as typeof fetch;
  return { calls, f };
}

describe("GeminiProvider contract", () => {
  it("sends the expected request and returns visible text only", async () => {
    const { calls, f } = recorder(() => reply("A poem."));
    const p = new GeminiProvider({ apiKey: "test-key", fetch: f });
    const out = await p.generate({
      task: "generate",
      system: "sys",
      messages: [
        { role: "user", content: [{ type: "text", text: "Write" }, { type: "image", mediaType: "image/png", dataBase64: "AAAA" }] },
        { role: "assistant", content: "Draft" },
      ],
    });
    expect(out).toMatchObject({ text: "A poem.", provider: "gemini", model: "gemini-3.8-flash", usage: { inputTokens: 12, outputTokens: 7 } });
    const call = calls[0];
    expect(call.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(call.url).not.toContain("test-key");
    expect(call.headers.get("x-goog-api-key")).toBe("test-key");
    expect(call.body.systemInstruction).toEqual({ parts: [{ text: "sys" }] });
    expect(call.body.contents).toEqual([
      { role: "user", parts: [{ text: "Write" }, { inlineData: { mimeType: "image/png", data: "AAAA" } }] },
      { role: "model", parts: [{ text: "Draft" }] },
    ]);
    expect(call.body.generationConfig).toEqual({ maxOutputTokens: 32000, thinkingConfig: { thinkingLevel: "high" } });
  });

  it("uses light thinking for classification and honours the model override", async () => {
    const { calls, f } = recorder(() => reply("ok"));
    await new GeminiProvider({ apiKey: "k", model: "gemini-3.5-flash-lite", fetch: f }).generate({ task: "intent", system: "", messages: [{ role: "user", content: "hi" }] });
    expect(calls[0].url).toContain("/models/gemini-3.5-flash-lite:generateContent");
    expect((calls[0].body.generationConfig as { thinkingConfig: unknown }).thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(calls[0].body.systemInstruction).toBeUndefined();
  });

  it("requests JSON-schema output, drops unsupported keywords, and validates with zod", async () => {
    const { calls, f } = recorder(() => reply(JSON.stringify({ title: "Home", count: 2 })));
    const schema = z.object({ title: z.string().min(1).max(80), count: z.number().int() });
    const out = await new GeminiProvider({ apiKey: "k", fetch: f }).structured({ task: "plan", system: "", messages: [{ role: "user", content: "x" }], schema, schemaName: "plan" });
    expect(out.value).toEqual({ title: "Home", count: 2 });
    const config = calls[0].body.generationConfig as { responseMimeType: string; responseJsonSchema: Record<string, unknown> };
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema.type).toBe("object");
    expect(config.responseJsonSchema.$schema).toBeUndefined();
    expect(JSON.stringify(config.responseJsonSchema)).not.toMatch(/minLength|maxLength/);
  });

  it("rejects schema-invalid structured output with a creator-readable error", async () => {
    const { f } = recorder(() => reply(JSON.stringify({ title: 5 })));
    const p = new GeminiProvider({ apiKey: "k", fetch: f });
    await expect(p.structured({ task: "plan", system: "", messages: [{ role: "user", content: "x" }], schema: z.object({ title: z.string() }), schemaName: "plan" })).rejects.toMatchObject({ code: "provider_failed" });
  });

  it("streams text chunks and finishes with usage", async () => {
    const { calls, f } = recorder(() =>
      sse([
        { candidates: [{ content: { parts: [{ text: "plan", thought: true }] } }] },
        { candidates: [{ content: { parts: [{ text: "Hello " }] } }] },
        { candidates: [{ content: { parts: [{ text: "world" }] }, finishReason: "STOP" }], usageMetadata: usage, modelVersion: "gemini-3.8-flash" },
      ]),
    );
    const chunks = [];
    for await (const c of new GeminiProvider({ apiKey: "k", fetch: f }).stream({ task: "refine", system: "", messages: [{ role: "user", content: "x" }] })) chunks.push(c);
    expect(calls[0].url).toContain(":streamGenerateContent?alt=sse");
    expect(chunks.slice(0, 2)).toEqual([{ type: "text", text: "Hello " }, { type: "text", text: "world" }]);
    expect(chunks[2]).toMatchObject({ type: "done", output: { text: "Hello world", usage: { inputTokens: 12, outputTokens: 7 } } });
  });

  it("maps blocked prompts and safety stops to a calm, recoverable error", async () => {
    const blockedPrompt = recorder(() => json({ promptFeedback: { blockReason: "SAFETY" } }));
    await expect(new GeminiProvider({ apiKey: "k", fetch: blockedPrompt.f }).generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_failed" });
    const safetyStop = recorder(() => reply("", "SAFETY"));
    await expect(new GeminiProvider({ apiKey: "k", fetch: safetyStop.f }).generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_failed" });
  });

  it("maps rate limits and bad keys to provider_unavailable", async () => {
    const limited = recorder(() => json({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }, 429));
    await expect(new GeminiProvider({ apiKey: "k", fetch: limited.f }).generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_unavailable" });
    const badKey = recorder(() => json({ error: { code: 400, status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }, 400));
    await expect(new GeminiProvider({ apiKey: "k", fetch: badKey.f }).generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("maps network failures to provider_failed", async () => {
    const f = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(new GeminiProvider({ apiKey: "k", fetch: f }).generate({ task: "generate", system: "", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "provider_failed" });
  });
});

describe("GeminiProvider transcription", () => {
  const ok = (text: string) => reply(text);

  it("sends small media inline with a transcription prompt and maps browser webm voice notes", async () => {
    const { calls, f } = recorder(() => ok("Speaker 1: hello"));
    const out = await new GeminiProvider({ apiKey: "k", fetch: f }).transcribe({ kind: "audio", mimeType: "audio/webm", bytes: new Uint8Array([1, 2, 3]) });
    expect(out.text).toBe("Speaker 1: hello");
    expect(calls).toHaveLength(1);
    const parts = (calls[0].body.contents as Array<{ parts: Array<Record<string, unknown>> }>)[0].parts;
    expect(parts[0]).toEqual({ inlineData: { mimeType: "video/webm", data: "AQID" } });
    expect(String(parts[1].text)).toContain("Transcribe this recording verbatim");
  });

  it("uploads large media through the File API, waits for processing, and deletes it afterwards", async () => {
    const seen: Array<{ url: string; method: string; headers: Headers }> = [];
    let polls = 0;
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      seen.push({ url, method, headers: new Headers(init?.headers) });
      if (url.endsWith("/upload/v1beta/files")) {
        return new Response("{}", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=abc" } });
      }
      if (url.includes("upload_id=abc")) return json({ file: { name: "files/f1", uri: "https://generativelanguage.googleapis.com/v1beta/files/f1", state: "PROCESSING" } });
      if (method === "GET" && url.endsWith("/v1beta/files/f1")) {
        polls++;
        return json({ name: "files/f1", uri: "https://generativelanguage.googleapis.com/v1beta/files/f1", state: "ACTIVE" });
      }
      if (method === "DELETE") return json({});
      return ok("Speaker 1: long take");
    }) as typeof fetch;
    const out = await new GeminiProvider({ apiKey: "k", fetch: f }).transcribe({ kind: "video", mimeType: "video/mp4", bytes: new Uint8Array(15 * 1024 * 1024) });
    expect(out.text).toBe("Speaker 1: long take");
    expect(polls).toBe(1);
    const start = seen[0];
    expect(start.headers.get("x-goog-upload-protocol")).toBe("resumable");
    expect(start.headers.get("x-goog-upload-header-content-type")).toBe("video/mp4");
    expect(start.headers.get("x-goog-api-key")).toBe("k");
    expect(seen[1].headers.get("x-goog-upload-command")).toBe("upload, finalize");
    const gen = seen.find((c) => c.url.includes(":generateContent"));
    expect(gen).toBeDefined();
    expect(seen.at(-1)).toMatchObject({ method: "DELETE", url: "https://generativelanguage.googleapis.com/v1beta/files/f1" });
  });

  it("rejects an upload URL on a foreign host", async () => {
    const f = (async () => new Response("{}", { status: 200, headers: { "x-goog-upload-url": "https://evil.example/upload" } })) as typeof fetch;
    await expect(new GeminiProvider({ apiKey: "k", fetch: f }).transcribe({ kind: "video", mimeType: "video/mp4", bytes: new Uint8Array(15 * 1024 * 1024) })).rejects.toMatchObject({ code: "provider_failed" });
  });
});

describe("GeminiProvider embeddings", () => {
  const vec = (x: number) => Array.from({ length: 768 }, (_, i) => (i === 0 ? x : 0));

  it("formats documents and queries for gemini-embedding-2 and batches requests", async () => {
    const { calls, f } = recorder(() => json({ embeddings: Array.from({ length: 100 }, () => ({ values: vec(1) })) }));
    const p = new GeminiProvider({ apiKey: "k", fetch: f });
    const items = Array.from({ length: 100 }, (_, i) => ({ title: i === 0 ? "Riverbank" : null, text: `note ${i}\n\nmore` }));
    const out = await p.embed({ purpose: "document", items });
    expect(out).toMatchObject({ model: "gemini-embedding-2", dimensions: 768 });
    expect(out.vectors).toHaveLength(100);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents");
    const reqs = calls[0].body.requests as Array<{ model: string; content: { parts: Array<{ text: string }> }; output_dimensionality: number }>;
    expect(reqs[0]).toEqual({ model: "models/gemini-embedding-2", content: { parts: [{ text: "title: Riverbank | text: note 0 more" }] }, output_dimensionality: 768 });
    expect(reqs[1].content.parts[0].text).toBe("title: none | text: note 1 more");

    const q = recorder(() => json({ embeddings: [{ values: vec(1) }] }));
    await new GeminiProvider({ apiKey: "k", fetch: q.f }).embed({ purpose: "query", items: [{ text: "quiet river" }] });
    expect((q.calls[0].body.requests as Array<{ content: { parts: Array<{ text: string }> } }>)[0].content.parts[0].text).toBe("task: search result | query: quiet river");
  });

  it("splits more than 100 items into several batches", async () => {
    let n = 0;
    const f = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      n++;
      const count = (JSON.parse(String(init?.body)) as { requests: unknown[] }).requests.length;
      return json({ embeddings: Array.from({ length: count }, () => ({ values: vec(1) })) });
    }) as typeof fetch;
    const out = await new GeminiProvider({ apiKey: "k", fetch: f }).embed({ purpose: "document", items: Array.from({ length: 150 }, () => ({ text: "x" })) });
    expect(n).toBe(2);
    expect(out.vectors).toHaveLength(150);
  });

  it("rejects a response with the wrong count or width", async () => {
    const { f } = recorder(() => json({ embeddings: [{ values: [1, 2, 3] }] }));
    await expect(new GeminiProvider({ apiKey: "k", fetch: f }).embed({ purpose: "query", items: [{ text: "x" }] })).rejects.toMatchObject({ code: "provider_failed" });
  });
});
