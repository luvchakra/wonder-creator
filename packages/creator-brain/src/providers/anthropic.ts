import Anthropic from "@anthropic-ai/sdk";
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
} from "./types";

const DEFAULT_MODEL = "claude-opus-5";

/** Effort per task: quick classification stays light; creative work gets depth. */
const EFFORT: Record<TaskKind, "low" | "medium" | "high"> = {
  intent: "low",
  memory: "low",
  publish_copy: "low",
  task_plan: "low",
  collaborator_query: "low",
  message_draft: "low",
  publish_plan: "low",
  describe_image: "low",
  context_line: "low",
  conversation_summary: "low",
  reply_triage: "low",
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
  task_plan: 4000,
  collaborator_query: 2000,
  message_draft: 2000,
  publish_plan: 4000,
  describe_image: 4000,
  context_line: 2000,
  conversation_summary: 4000,
  reply_triage: 4000,
  understand: 8000,
  discover: 12000,
  plan: 8000,
  critique: 8000,
  generate: 32000,
  refine: 32000,
  transform: 32000,
};

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;

function toBlocks(content: string | ContentPart[]): string | BetaContentBlockParam[] {
  if (typeof content === "string") return content;
  return content.map((p): BetaContentBlockParam =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.dataBase64 } },
  );
}

function toMessages(messages: ModelMessage[]): BetaMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: toBlocks(m.content) }));
}

function mapError(e: unknown): DomainError {
  if (e instanceof DomainError) return e;
  if (e instanceof Anthropic.RateLimitError) {
    return new DomainError("provider_unavailable", "CreativeMind is busy right now. Please try again in a moment.", { cause: e });
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new DomainError("provider_unavailable", "CreativeMind isn't available right now.", { cause: e });
  }
  if (e instanceof Anthropic.BadRequestError) {
    // Anthropic answers an empty credit balance with a 400 that says so; only a top-up fixes it.
    if (/credit balance|billing/i.test(e.message)) {
      return new DomainError("provider_unavailable", "CreativeMind is paused: the AI provider's credit has run out. Top it up in the Anthropic Console to continue.", { cause: e });
    }
    return new DomainError("provider_failed", "CreativeMind couldn't work with that request.", { cause: e });
  }
  if (e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIError) {
    return new DomainError("provider_failed", "CreativeMind didn't respond. Nothing was changed; please try again.", { cause: e });
  }
  return new DomainError("provider_failed", "CreativeMind didn't respond. Nothing was changed; please try again.", { cause: e });
}

export class AnthropicProvider implements CreativeModelProvider {
  readonly name = "anthropic";
  readonly live = true;
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey?: string; model?: string; fetch?: typeof fetch; maxRetries?: number } = {}) {
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: opts.maxRetries ?? 2, fetch: opts.fetch });
    this.model = opts.model || DEFAULT_MODEL;
  }

  modelFor(): string {
    return this.model;
  }

  private params(input: GenerateInput) {
    return {
      model: this.model,
      max_tokens: input.maxTokens ?? MAX_TOKENS[input.task],
      system: input.system,
      messages: toMessages(input.messages),
      thinking: { type: "adaptive" as const },
      output_config: { effort: EFFORT[input.task] },
      // Server-side fallback on a policy decline; the rescue model is chosen by the API.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    };
  }

  private finish(msg: Anthropic.Beta.Messages.BetaMessage): GenerateOutput {
    if (msg.stop_reason === "refusal") {
      throw new DomainError("provider_failed", "CreativeMind can't help with that particular request. Try rephrasing or choosing different material.");
    }
    const text = msg.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
      model: msg.model,
      provider: this.name,
    };
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    try {
      const stream = this.client.beta.messages.stream(this.params(input));
      return this.finish(await stream.finalMessage());
    } catch (e) {
      throw mapError(e);
    }
  }

  async *stream(input: GenerateInput): AsyncIterable<GenerateChunk> {
    let stream;
    try {
      stream = this.client.beta.messages.stream(this.params(input));
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      yield { type: "done", output: this.finish(await stream.finalMessage()) };
    } catch (e) {
      throw mapError(e);
    }
  }

  async structured<T>(input: StructuredInput<T>): Promise<StructuredOutput<T>> {
    const schema = z.toJSONSchema(input.schema, { target: "draft-7" }) as Record<string, unknown>;
    delete schema.$schema;
    try {
      const params = this.params(input);
      const stream = this.client.beta.messages.stream({
        ...params,
        output_config: { ...params.output_config, format: { type: "json_schema", schema } },
      });
      const out = this.finish(await stream.finalMessage());
      let parsed: unknown;
      try {
        parsed = JSON.parse(out.text);
      } catch (e) {
        throw new DomainError("provider_failed", "CreativeMind returned something unexpected. Please try again.", { cause: e });
      }
      const result = input.schema.safeParse(parsed);
      if (!result.success) {
        throw new DomainError("provider_failed", "CreativeMind returned something unexpected. Please try again.", { cause: result.error });
      }
      return { value: result.data, usage: out.usage, model: out.model, provider: out.provider };
    } catch (e) {
      throw mapError(e);
    }
  }
}
