import { fenceUntrusted, UNTRUSTED_POLICY } from "@wonder/core/server";
import { z } from "zod";
import type { CreativeModelProvider } from "./providers";

/**
 * CreativeMind orchestration (docs/creativemind-orchestration.md, Phase 05 §9–10): summarising a long Open
 * Conversation and grouping the replies an Ask Community question brought back. Both are optional, asynchronous
 * enhancements — nothing waits on them, nothing is applied from them, and every result is validated before it may be
 * shown. Replies are other people's words: always fenced, never instructions. Null when the provider isn't live.
 */

export interface ReplyInput {
  id: string;
  text: string;
}

const MAX_REPLIES = 60;
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/* ---------------------------------------------------------------------------------------- Conversation summary */

export const SUMMARY_SCHEMA = z.object({
  points: z.array(z.object({ text: z.string(), replyIds: z.array(z.string()) })),
});
export interface SummaryPoint {
  text: string;
  replyIds: string[];
}

const SUMMARY_SYSTEM = [
  "Summarise an online discussion between creators for someone arriving late.",
  "Rules:",
  "- 2 to 4 points. Each point one sentence, at most 140 characters.",
  "- Describe viewpoints and how many people hold them in words (most, several, a few, one) — never percentages.",
  "- Preserve disagreement. Never declare a winner, a best answer or a consensus that isn't there.",
  "- Never quote people by name. No praise, no advice, no first person, no questions, no emojis.",
  "- For each point list the ids of the replies it comes from (only ids that appear below).",
  UNTRUSTED_POLICY,
  'Return JSON: {"points":[{"text":"…","replyIds":["…"]}]}',
].join("\n");

const BANNED = [/\b(I|I'm|I've|me|my)\b/, /\b(winner|best answer|correct answer|clearly right|everyone agrees)\b/i, /\d+\s?%/, /[!?]/, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u];

/** Keep only well-formed, grounded points (known reply ids, short, no banned patterns). */
export function validateSummary(points: SummaryPoint[], replyIds: string[]): SummaryPoint[] {
  const known = new Set(replyIds);
  const out = points
    .map((p) => ({ text: p.text.trim().replace(/\s+/g, " "), replyIds: [...new Set(p.replyIds.filter((id) => known.has(id)))] }))
    .filter((p) => p.text.length >= 8 && p.text.length <= 160 && p.replyIds.length > 0 && !BANNED.some((r) => r.test(p.text)))
    .slice(0, 4);
  return out.length >= 2 ? out : [];
}

export async function summarizeConversation(provider: CreativeModelProvider, input: { title: string; body: string | null; replies: ReplyInput[] }): Promise<SummaryPoint[] | null> {
  if (!provider.live || input.replies.length < 2) return null;
  const replies = input.replies.slice(-MAX_REPLIES);
  const context = [
    fenceUntrusted("conversation_title", input.title, 200),
    input.body ? fenceUntrusted("conversation_opening", input.body, 1200) : null,
    ...replies.map((r) => fenceUntrusted(`reply ${r.id}`, clip(r.text, 600), 700)),
  ]
    .filter(Boolean)
    .join("\n");
  const res = await provider.structured({ task: "conversation_summary", system: SUMMARY_SYSTEM, messages: [{ role: "user", content: context }], schema: SUMMARY_SCHEMA, schemaName: "conversation_summary", maxTokens: 1500 });
  const points = validateSummary(res.value.points, replies.map((r) => r.id));
  return points.length ? points : null;
}

/* ------------------------------------------------------------------------------------------- Reply triage */

export const TRIAGE_SCHEMA = z.object({ groups: z.array(z.object({ label: z.string(), replyIds: z.array(z.string()) })) });
export interface TriageGroup {
  /** "suggest shortening the line" — read after a count: "2 suggest shortening the line". */
  label: string;
  replyIds: string[];
}

const TRIAGE_SYSTEM = [
  "Group feedback replies about one piece of creative work by what they suggest.",
  "Rules:",
  "- At most 4 groups. Each reply in at most one group. Leave out replies that fit no group.",
  "- A label is a short verb phrase that reads after a number, lowercase, at most 48 characters:",
  "  e.g. 'suggest shortening the line', 'prefer the current version', 'discuss the image choice'.",
  "- Describe what people suggest; never judge who is right. No names, no first person, no emojis.",
  "- Use only reply ids that appear below.",
  UNTRUSTED_POLICY,
  'Return JSON: {"groups":[{"label":"…","replyIds":["…"]}]}',
].join("\n");

export function validateTriage(groups: TriageGroup[], replyIds: string[]): TriageGroup[] {
  const known = new Set(replyIds);
  const used = new Set<string>();
  const out: TriageGroup[] = [];
  for (const g of groups) {
    const label = g.label.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");
    const ids = [...new Set(g.replyIds)].filter((id) => known.has(id) && !used.has(id));
    if (!ids.length || label.length < 4 || label.length > 48 || BANNED.some((r) => r.test(label))) continue;
    ids.forEach((id) => used.add(id));
    out.push({ label: label[0]!.toLowerCase() + label.slice(1), replyIds: ids });
    if (out.length === 4) break;
  }
  // One group of everything says nothing.
  return out.length >= 2 || (out.length === 1 && out[0]!.replyIds.length < replyIds.length) ? out : [];
}

export async function triageReplies(provider: CreativeModelProvider, input: { about: string | null; question: string; replies: ReplyInput[] }): Promise<TriageGroup[] | null> {
  if (!provider.live || input.replies.length < 3) return null;
  const replies = input.replies.slice(0, MAX_REPLIES);
  const context = [
    fenceUntrusted("question", input.question, 300),
    input.about ? fenceUntrusted("asked_about", input.about, 600) : null,
    ...replies.map((r) => fenceUntrusted(`reply ${r.id}`, clip(r.text, 500), 600)),
  ]
    .filter(Boolean)
    .join("\n");
  const res = await provider.structured({ task: "reply_triage", system: TRIAGE_SYSTEM, messages: [{ role: "user", content: context }], schema: TRIAGE_SCHEMA, schemaName: "reply_triage", maxTokens: 1200 });
  const groups = validateTriage(res.value.groups, replies.map((r) => r.id));
  return groups.length ? groups : null;
}
