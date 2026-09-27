import { DomainError } from "@wonder/core";
import type { ImageProvider, ProviderImageRequest, ProviderImageResult } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT", "OTHER"]);

interface GeminiImageResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> } }>;
  modelVersion?: string;
}

/**
 * Gemini image generation over REST (§19). Provider quirks stay here: the key travels in a header (never the URL), the
 * model returns inline image data, and a blocked or empty answer is an honest failure — nothing is stored for it (§56).
 */
export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";
  readonly live = true;
  private apiKey: string;
  private fetch: typeof fetch;

  constructor(opts: { apiKey: string; fetch?: typeof fetch }) {
    this.apiKey = opts.apiKey;
    this.fetch = opts.fetch ?? fetch;
  }

  async generate(req: ProviderImageRequest): Promise<ProviderImageResult> {
    const parts: Array<Record<string, unknown>> = [{ text: req.prompt }, ...(req.references ?? []).map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.dataBase64 } }))];
    let res: Response;
    try {
      res = await this.fetch(`${API_BASE}/models/${encodeURIComponent(req.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: req.aspectRatio } },
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      throw new DomainError("provider_failed", "Image generation didn't respond. Please try again.", { cause: e });
    }
    if (!res.ok) {
      throw new DomainError(res.status === 429 ? "rate_limited" : "provider_failed", res.status === 429 ? "Image generation is busy. Please try again shortly." : "Image generation couldn't complete.", {
        details: { status: res.status },
      });
    }
    const body = (await res.json().catch(() => null)) as GeminiImageResponse | null;
    const c = body?.candidates?.[0];
    if (!body || body.promptFeedback?.blockReason || (c?.finishReason && BLOCKED.has(c.finishReason))) {
      throw new DomainError("provider_failed", "This couldn't be created.", { details: { blocked: true } });
    }
    const part = c?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new DomainError("provider_failed", "Image generation returned nothing.");
    return {
      image: { mimeType: part.inlineData.mimeType ?? "image/png", bytes: Uint8Array.from(Buffer.from(part.inlineData.data, "base64")) },
      model: body.modelVersion || req.model,
    };
  }
}

/** Nothing configured: honest, never fake (§55). */
export class UnavailableImageProvider implements ImageProvider {
  readonly name = "none";
  readonly live = false;
  async generate(): Promise<ProviderImageResult> {
    throw new DomainError("provider_unavailable", "Image generation isn't connected.");
  }
}
