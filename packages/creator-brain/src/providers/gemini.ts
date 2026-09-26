import { DomainError } from "@wonder/core";
import { z } from "zod";
import type {
  ContentPart,
  CreativeModelProvider,
  GenerateChunk,
  GenerateInput,
  GenerateOutput,
  ModelMessage,
  StructuredInput,
  StructuredOutput,
  TaskKind,
  TranscribeInput,
  EmbedInput,
  EmbedOutput,
} from "./types";
import { EMBEDDING_DIMENSIONS } from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";
/** Fixed (not configurable): stored vectors are only comparable within one embedding model. */
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
const EMBED_BATCH = 100;
/** ~8k-token input limit; keep well under it. */
const EMBED_MAX_CHARS = 20_000;
const API_ORIGIN = "https://generativelanguage.googleapis.com";
const API_BASE = `${API_ORIGIN}/v1beta`;

/** Requests are capped at 20 MB; base64 inflates by a third, so larger media goes through the File API. */
const INLINE_MEDIA_MAX_BYTES = 14 * 1024 * 1024;
const FILE_READY_TIMEOUT_MS = 120_000;
const FILE_POLL_MS = 2_000;

/**
 * Container MIME types Gemini accepts for media it doesn't list by audio name
 * (browser voice notes are audio/webm; .m4a is audio/mp4).
 */
const MEDIA_MIME: Record<string, string> = { "audio/webm": "video/webm", "audio/mp4": "video/mp4", "audio/x-flac": "audio/flac", "audio/x-wav": "audio/wav" };

const TRANSCRIBE_PROMPT = {
  audio:
    "Transcribe this recording verbatim in its original language(s). Mark speaker changes as \"Speaker 1:\", \"Speaker 2:\" when there is more than one voice. " +
    "Write [inaudible] for unclear parts. Output only the transcript, with no introduction or commentary. If there is no speech, output exactly: [no speech]",
  video:
    "Transcribe the speech in this video verbatim in its original language(s). Mark speaker changes as \"Speaker 1:\", \"Speaker 2:\" when there is more than one voice. " +
    "After the transcript, add a line \"Visual notes:\" followed by up to five short lines on what is shown (setting, people, on-screen text). " +
    "Output nothing else. If there is no speech, write [no speech] in place of the transcript.",
};

/** Thinking depth per task: quick classification stays light; creative work gets depth. */
const THINKING: Record<TaskKind, "low" | "medium" | "high"> = {
  intent: "low",
  memory: "low",
  publish_copy: "low",
  describe_image: "low",
  understand: "medium",
  discover: "medium",
  plan: "medium",
  critique: "medium",
  generate: "high",
  refine: "high",
  transform: "high",
};

const MAX_TOKENS: Record<TaskKind, number> = {
  intent: 2000,
  memory: 4000,
  publish_copy: 4000,
  describe_image: 4000,
  understand: 8000,
  discover: 12000,
  plan: 8000,
  critique: 8000,
  generate: 32000,
  refine: 32000,
  transform: 32000,
};

/** Finish reasons that mean the model declined or was stopped by a content policy. */
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "LANGUAGE"]);

/** JSON Schema keywords Gemini's responseJsonSchema accepts; others are dropped (zod still validates them). */
const SCHEMA_KEYS = new Set([
  "type", "title", "description", "properties", "required", "additionalProperties",
  "enum", "format", "minimum", "maximum", "items", "prefixItems", "minItems", "maxItems", "anyOf", "nullable",
]);

type GeminiPart = { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } };
type GeminiFile = { name: string; uri?: string; state?: "PROCESSING" | "ACTIVE" | "FAILED"; mimeType?: string };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
};

function toParts(content: string | ContentPart[]): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((p) => (p.type === "text" ? { text: p.text } : { inlineData: { mimeType: p.mediaType, data: p.dataBase64 } }));
}

function toContents(messages: ModelMessage[]) {
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) }));
}

function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!SCHEMA_KEYS.has(k)) continue;
    if (k === "properties" && v && typeof v === "object") {
      out[k] = Object.fromEntries(Object.entries(v).map(([name, s]) => [name, sanitizeSchema(s)]));
    } else {
      out[k] = sanitizeSchema(v);
    }
  }
  return out;
}

const unexpected = (cause?: unknown) => new DomainError("provider_failed", "CreatorBrain returned something unexpected. Please try again.", { cause });
const noResponse = (cause?: unknown) => new DomainError("provider_failed", "CreatorBrain didn't respond. Nothing was changed; please try again.", { cause });
const declined = () => new DomainError("provider_failed", "CreatorBrain can't help with that particular request. Try rephrasing or choosing different material.");

async function errorFor(res: Response): Promise<DomainError> {
  let detail = "";
  try {
    detail = JSON.stringify(await res.json());
  } catch {
    /* body is not JSON */
  }
  const cause = new Error(`Gemini API ${res.status}: ${detail.slice(0, 500)}`);
  if (res.status === 429) return new DomainError("provider_unavailable", "CreatorBrain is busy right now. Please try again in a moment.", { cause });
  if (res.status === 401 || res.status === 403 || detail.includes("API_KEY_INVALID")) {
    return new DomainError("provider_unavailable", "CreatorBrain isn't available right now.", { cause });
  }
  if (res.status === 400) return new DomainError("provider_failed", "CreatorBrain couldn't work with that request.", { cause });
  return noResponse(cause);
}

/** Google Gemini via the Generative Language REST API (server-side only; the key never reaches the browser). */
export class GeminiProvider implements CreativeModelProvider {
  readonly name = "gemini";
  readonly live = true;
  private apiKey: string;
  private model: string;
  private fetch: typeof fetch;

  constructor(opts: { apiKey: string; model?: string; fetch?: typeof fetch }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model || DEFAULT_MODEL;
    this.fetch = opts.fetch ?? fetch;
  }

  modelFor(): string {
    return this.model;
  }

  private body(input: GenerateInput, extra: Record<string, unknown> = {}) {
    return {
      contents: toContents(input.messages),
      ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
      generationConfig: {
        maxOutputTokens: input.maxTokens ?? MAX_TOKENS[input.task],
        thinkingConfig: { thinkingLevel: THINKING[input.task] },
        ...extra,
      },
    };
  }

  private post(method: "generateContent" | "streamGenerateContent", body: unknown): Promise<Response> {
    const query = method === "streamGenerateContent" ? "?alt=sse" : "";
    return this.postTo(`models/${encodeURIComponent(this.model)}:${method}${query}`, body);
  }

  private async postTo(path: string, body: unknown): Promise<Response> {
    let res: Response;
    try {
      // Key in a header, not the URL, so it never lands in request logs.
      res = await this.fetch(`${API_BASE}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw noResponse(e);
    }
    if (!res.ok) throw await errorFor(res);
    return res;
  }

  /** Visible text of a response chunk; throws when the prompt or answer was blocked. */
  private textOf(r: GeminiResponse): string {
    if (r.promptFeedback?.blockReason) throw declined();
    const c = r.candidates?.[0];
    if (c?.finishReason && BLOCKED.has(c.finishReason)) throw declined();
    return (c?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  }

  private output(text: string, r: GeminiResponse): GenerateOutput {
    const u = r.usageMetadata ?? {};
    return {
      text,
      usage: { inputTokens: u.promptTokenCount ?? 0, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) },
      model: r.modelVersion || this.model,
      provider: this.name,
    };
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    return this.complete(this.body(input));
  }

  private async complete(body: unknown): Promise<GenerateOutput> {
    const res = await this.post("generateContent", body);
    let r: GeminiResponse;
    try {
      r = (await res.json()) as GeminiResponse;
    } catch (e) {
      throw unexpected(e);
    }
    return this.output(this.textOf(r), r);
  }

  async *stream(input: GenerateInput): AsyncIterable<GenerateChunk> {
    const res = await this.post("streamGenerateContent", this.body(input));
    if (!res.body) throw noResponse();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let text = "";
    let last: GeminiResponse = {};
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (value) buffer += value;
        // SSE events are separated by a blank line; each carries one JSON response chunk.
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = done ? "" : (events.pop() ?? "");
        for (const event of events) {
          const data = event
            .split(/\r?\n/)
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!data) continue;
          let chunk: GeminiResponse;
          try {
            chunk = JSON.parse(data) as GeminiResponse;
          } catch (e) {
            throw unexpected(e);
          }
          const piece = this.textOf(chunk);
          if (chunk.usageMetadata || chunk.modelVersion) last = { ...last, ...chunk };
          if (piece) {
            text += piece;
            yield { type: "text", text: piece };
          }
        }
        if (done) break;
      }
    } catch (e) {
      throw e instanceof DomainError ? e : noResponse(e);
    } finally {
      reader.releaseLock();
    }
    yield { type: "done", output: this.output(text, last) };
  }

  async structured<T>(input: StructuredInput<T>): Promise<StructuredOutput<T>> {
    const schema = sanitizeSchema(z.toJSONSchema(input.schema, { target: "draft-7" }));
    const out = await this.complete(this.body(input, { responseMimeType: "application/json", responseJsonSchema: schema }));
    let parsed: unknown;
    try {
      parsed = JSON.parse(out.text);
    } catch (e) {
      throw unexpected(e);
    }
    const result = input.schema.safeParse(parsed);
    if (!result.success) throw unexpected(result.error);
    return { value: result.data, usage: out.usage, model: out.model, provider: out.provider };
  }

  /** Speech-to-text via Gemini's audio/video understanding. Uploaded File API copies are deleted after use. */
  async transcribe(input: TranscribeInput): Promise<GenerateOutput> {
    const mimeType = MEDIA_MIME[input.mimeType] ?? input.mimeType;
    let uploaded: { name: string; uri: string } | null = null;
    try {
      let media: Record<string, unknown>;
      if (input.bytes.byteLength <= INLINE_MEDIA_MAX_BYTES) {
        media = { inlineData: { mimeType, data: Buffer.from(input.bytes).toString("base64") } };
      } else {
        uploaded = await this.uploadFile(input.bytes, mimeType);
        media = { fileData: { mimeType, fileUri: uploaded.uri } };
      }
      return await this.complete({
        contents: [{ role: "user", parts: [media, { text: TRANSCRIBE_PROMPT[input.kind] }] }],
        generationConfig: { maxOutputTokens: 32000, thinkingConfig: { thinkingLevel: "low" } },
      });
    } finally {
      if (uploaded) await this.deleteFile(uploaded.name);
    }
  }

  private async uploadFile(bytes: Uint8Array, mimeType: string): Promise<{ name: string; uri: string }> {
    const headers = { "x-goog-api-key": this.apiKey };
    let start: Response;
    try {
      start = await this.fetch(`${API_ORIGIN}/upload/v1beta/files`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-goog-upload-protocol": "resumable",
          "x-goog-upload-command": "start",
          "x-goog-upload-header-content-length": String(bytes.byteLength),
          "x-goog-upload-header-content-type": mimeType,
        },
        body: JSON.stringify({ file: { display_name: "wonder-creator-media" } }),
      });
    } catch (e) {
      throw noResponse(e);
    }
    if (!start.ok) throw await errorFor(start);
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl?.startsWith(`${API_ORIGIN}/`)) throw unexpected(new Error("missing or foreign upload URL"));

    let done: Response;
    try {
      done = await this.fetch(uploadUrl, {
        method: "POST",
        headers: { ...headers, "x-goog-upload-offset": "0", "x-goog-upload-command": "upload, finalize" },
        body: bytes as unknown as BodyInit,
      });
    } catch (e) {
      throw noResponse(e);
    }
    if (!done.ok) throw await errorFor(done);
    let file = ((await done.json()) as { file?: GeminiFile }).file;
    if (!file?.name || !file.uri) throw unexpected(new Error("upload returned no file"));

    // Video (and some audio) is processed server-side before it can be referenced.
    const deadline = Date.now() + FILE_READY_TIMEOUT_MS;
    while (file.state === "PROCESSING") {
      if (Date.now() > deadline) {
        await this.deleteFile(file.name);
        throw noResponse(new Error("file processing timed out"));
      }
      await new Promise((r) => setTimeout(r, FILE_POLL_MS));
      const res = await this.fetch(`${API_BASE}/${file.name}`, { headers });
      if (!res.ok) throw await errorFor(res);
      file = (await res.json()) as GeminiFile;
    }
    if (file.state === "FAILED") {
      await this.deleteFile(file.name);
      throw new DomainError("provider_failed", "CreatorBrain couldn't read this recording. The original is saved.");
    }
    return { name: file.name, uri: file.uri! };
  }

  /** Best effort: Gemini also expires uploaded files on its own after 48 hours. */
  private async deleteFile(name: string): Promise<void> {
    try {
      await this.fetch(`${API_BASE}/${name}`, { method: "DELETE", headers: { "x-goog-api-key": this.apiKey } });
    } catch {
      /* expiry covers it */
    }
  }

  /** Retrieval embeddings (gemini-embedding-2 uses prompt prefixes instead of task types). */
  async embed(input: EmbedInput): Promise<EmbedOutput> {
    const texts = input.items.map((it) => {
      const text = it.text.replace(/\s+/g, " ").trim().slice(0, EMBED_MAX_CHARS);
      return input.purpose === "query" ? `task: search result | query: ${text}` : `title: ${it.title?.trim() || "none"} | text: ${text}`;
    });
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH);
      const res = await this.postTo(`models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`, {
        requests: batch.map((text) => ({
          model: `models/${GEMINI_EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          output_dimensionality: EMBEDDING_DIMENSIONS,
        })),
      });
      let body: { embeddings?: Array<{ values?: number[] }> };
      try {
        body = (await res.json()) as typeof body;
      } catch (e) {
        throw unexpected(e);
      }
      const got = body.embeddings ?? [];
      if (got.length !== batch.length || got.some((e) => e.values?.length !== EMBEDDING_DIMENSIONS)) {
        throw unexpected(new Error("embedding count or width mismatch"));
      }
      for (const e of got) vectors.push(e.values!);
    }
    return { vectors, model: GEMINI_EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS };
  }
}
