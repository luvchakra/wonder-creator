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
  | "publish_copy" // draft titles and captions for publishing
  | "task_plan" // suggest tasks and missing steps for a project (suggestions only)
  | "collaborator_query" // turn "find three cinematographers in my network" into search filters
  | "message_draft" // draft a message for the creator to review and send (never sent automatically)
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

export interface TranscribeInput {
  kind: "audio" | "video";
  /** Detected (not declared) MIME type of the stored original. */
  mimeType: string;
  bytes: Uint8Array;
}

export interface EmbedInput {
  /** "document" for indexed content, "query" for a search query (asymmetric retrieval). */
  purpose: "document" | "query";
  items: Array<{ title?: string | null; text: string }>;
}

export interface EmbedOutput {
  vectors: number[][];
  model: string;
  dimensions: number;
}

/** Stored embedding width; the database column is vector(768). */
export const EMBEDDING_DIMENSIONS = 768;

/** Provider-neutral creative model interface. Provider configuration is server-side only. */
export interface CreativeModelProvider {
  readonly name: string;
  readonly live: boolean;
  modelFor(task: TaskKind): string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  stream(input: GenerateInput): AsyncIterable<GenerateChunk>;
  structured<T>(input: StructuredInput<T>): Promise<StructuredOutput<T>>;
  /** Speech-to-text for audio/video. Absent when the provider can't transcribe (never faked). */
  transcribe?(input: TranscribeInput): Promise<GenerateOutput>;
  /** Text embeddings for semantic search. Absent when the provider has none (search stays lexical). */
  embed?(input: EmbedInput): Promise<EmbedOutput>;
}

export interface ProviderReadiness {
  provider: string;
  live: boolean;
  configured: boolean;
  note: string;
}
