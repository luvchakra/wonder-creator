import type { z } from "zod";

export type TaskKind =
  | "intent" // classify what the creator wants
  | "understand" // cross-modal understanding of materials
  | "discover" // propose creative directions
  | "plan"
  | "generate"
  | "critique"
  | "refine"
  | "transform"
  | "memory" // extract durable creative memories
  | "describe_image";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; dataBase64: string };

export interface ModelMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

export interface GenerateInput {
  task: TaskKind;
  system: string;
  messages: ModelMessage[];
  maxTokens?: number;
  /** Plain hints for deterministic providers (ignored by live models). Never contains private content. */
  hints?: { artifactType?: string; format?: string; title?: string; keywords?: string[]; refs?: string[]; action?: string };
}

export interface StructuredInput<T> extends GenerateInput {
  schema: z.ZodType<T>;
  schemaName: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateOutput {
  text: string;
  usage: Usage;
  model: string;
  provider: string;
}

export interface StructuredOutput<T> extends Omit<GenerateOutput, "text"> {
  value: T;
}

export type GenerateChunk = { type: "text"; text: string } | { type: "done"; output: GenerateOutput };

/** Provider-neutral creative model interface. Provider configuration is server-side only. */
export interface CreativeModelProvider {
  readonly name: string;
  readonly live: boolean;
  modelFor(task: TaskKind): string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  stream(input: GenerateInput): AsyncIterable<GenerateChunk>;
  structured<T>(input: StructuredInput<T>): Promise<StructuredOutput<T>>;
}

export interface ProviderReadiness {
  provider: string;
  live: boolean;
  configured: boolean;
  note: string;
}
