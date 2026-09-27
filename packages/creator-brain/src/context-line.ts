import { fenceUntrusted, UNTRUSTED_POLICY } from "@wonder/core/server";
import { z } from "zod";
import type { CreativeModelProvider } from "./providers";

/**
 * The Adaptive Context Line's AI layer (docs/ui-redesign/ai-context-line.md). Deterministic state always wins (errors,
 * offline, publishing, live, approvals, saving); this only proposes the P6 "creative context" line — one short, specific
 * observation drawn from facts the page already has — and every proposal is validated before it may be shown. It is
 * presentation text: never stored, never an action, never a chat.
 */

/** A supplied fact. Strings that came from the creator's material (titles, summaries) are marked untrusted and fenced. */
export type ContextFact = string | number | boolean | string[] | { untrusted: string } | { untrusted: string }[];

export interface ContextLineInput {
  page: string;
  lifecycle?: string | null;
  /** The page's own title, which the line must not repeat. */
  title?: string | null;
  facts: Record<string, ContextFact>;
}

export const CONTEXT_LINE_SCHEMA = z.object({
  text: z.string().nullable(),
  reason: z.enum(["creative_context", "continuity", "presence", "lifecycle", "metadata", "none"]),
  sourceKeys: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type ContextLine = z.infer<typeof CONTEXT_LINE_SCHEMA>;

export const CONTEXT_LINE_MAX = 56;
export const CONTEXT_LINE_MIN_CONFIDENCE = 0.75;

const SYSTEM = [
  "Generate one short navbar context line for Wonder Creator, a creative studio app.",
  "Use only the supplied structured context. Goal: surface the single most useful thing for the creator to know right now.",
  "Rules:",
  "- 2–7 words preferred. Maximum 56 characters. One line.",
  "- No first person. No praise. No generic advice. No emojis. No questions. No exclamation marks.",
  "- No unsupported facts. Do not repeat the page title.",
  "- Prefer specific creative context over generic metadata when safe.",
  "- Never infer rights, approvals, payments, publishing, security, live state, people, counts or dates; only restate them exactly as supplied.",
  "- Never invent activity. Never mention CreativeMind, AI or yourself.",
  UNTRUSTED_POLICY,
  "- If there is no useful observation, return text null with reason none.",
  "Patterns that work: '[Object] · [state]', '[Thing] is still unused', '[Thing] may fit [context]', '[Change] changed most', 'You left this at version N'.",
  "Return JSON: text, reason (creative_context | continuity | presence | lifecycle | metadata | none), sourceKeys (the fact keys you used), confidence (0–1).",
].join("\n");

function renderFact(key: string, v: ContextFact): string {
  const one = (x: string | { untrusted: string }) => (typeof x === "string" ? x : fenceUntrusted(key, x.untrusted, 400));
  if (Array.isArray(v)) return `${key}: ${v.map((x) => one(x as string | { untrusted: string })).join(" | ")}`;
  if (typeof v === "object") return `${key}: ${one(v)}`;
  return `${key}: ${String(v)}`;
}

/** Everything a fact says, as plain text — for checking the line doesn't invent numbers. */
function factText(facts: Record<string, ContextFact>): string {
  const flat = (v: ContextFact): string => (Array.isArray(v) ? v.map((x) => flat(x as ContextFact)).join(" ") : typeof v === "object" ? v.untrusted : String(v));
  return Object.values(facts).map(flat).join(" ");
}

const PROHIBITED = [
  /\b(I|I'm|I've|me|my)\b/,
  /\b(creativemind|ai|assistant|analysis)\b/i,
  /\b(you should|great job|well done|awesome|amazing|based on)\b/i,
  /[!?]/,
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
  /\n/,
];

/** §19 validation: short, confident, grounded in supplied keys, no prohibited pattern, no invented numbers, not the title. */
export function validateContextLine(out: ContextLine, input: ContextLineInput): string | null {
  const text = out.text?.trim();
  if (!text || out.reason === "none") return null;
  if (text.length > CONTEXT_LINE_MAX || out.confidence < CONTEXT_LINE_MIN_CONFIDENCE) return null;
  if (!out.sourceKeys.length || out.sourceKeys.some((k) => !(k in input.facts))) return null;
  if (PROHIBITED.some((r) => r.test(text))) return null;
  const known = factText(input.facts);
  if ((text.match(/\d+/g) ?? []).some((n) => !known.includes(n))) return null;
  if (input.title && text.toLowerCase() === input.title.trim().toLowerCase()) return null;
  return text;
}

/** Ask the model for one line; null when the provider isn't live, the model has nothing useful, or validation fails. */
export async function generateContextLine(provider: CreativeModelProvider, input: ContextLineInput): Promise<string | null> {
  if (!provider.live || !Object.keys(input.facts).length) return null;
  const context = [`page: ${input.page}`, input.lifecycle ? `lifecycle: ${input.lifecycle}` : null, input.title ? renderFact("page_title", { untrusted: input.title }) : null, ...Object.entries(input.facts).map(([k, v]) => renderFact(k, v))]
    .filter(Boolean)
    .join("\n");
  const res = await provider.structured({ task: "context_line", system: SYSTEM, messages: [{ role: "user", content: context }], schema: CONTEXT_LINE_SCHEMA, schemaName: "context_line", maxTokens: 2000 });
  return validateContextLine(res.value, input);
}
