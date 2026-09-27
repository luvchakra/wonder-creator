import { inferAllArtifactTypes, inferArtifactType } from "@wonder/creator-studio";
import type { Intent } from "./schemas";

export interface IntentResult {
  intent: Intent;
  artifactType: string | null;
  refinementAction: string | null;
}

const DISCOVER = [/don'?t know what (this|it) should (be|become)/i, /what (could|can|should) (this|these|it) (be|become)/i, /\bsuggest (some )?(ideas|directions)\b/i, /\bsurprise me\b/i, /\bexplore\b/i];
const CORRECT = [/that'?s not (how|what) i (write|am|do|like|mean)/i, /\bi (don'?t|never) (write|like|use)\b/i, /\bforget (that|this)\b/i, /\bthat'?s wrong about me\b/i];
const REMEMBER = [/\bremember (that|this)\b/i, /\bkeep in mind\b/i, /\bnote that i\b/i];
const REFINE: Array<[RegExp, string]> = [
  [/\b(make (it|this|that) )?(shorter|more concise|tighter|trim)\b/i, "shorter"],
  [/\b(make (it|this|that) )?(longer|expand|more detail)\b/i, "longer"],
  [/\b(less|more) formal\b/i, "tone"],
  [/\b(darker|lighter|warmer|bolder|softer|sadder|happier|more emotional|more playful)\b/i, "tone"],
  [/\bchange (the )?tone\b/i, "tone"],
  [/\b(improve|polish|refine|revise|rework|fix)\b/i, "improve"],
  [/\badd (a )?(scene|flashback|verse|chorus|stanza|ending)\b/i, "add"],
  [/\b(better )?opening( line)?\b/i, "opening"],
];
const TRANSFORM = [/\b(take|use) (the|my|that|this|our) [\w ]{2,40}\b(and|to) (make|turn|write|create)\b/i, /\b(turn|convert|adapt|transform|make)\b.*\binto\b/i, /\b(create|make) (a |an )?(\w+ ){0,2}(from|out of) (it|this|that|the)\b/i];
const CREATE = [/\b(write|create|make|draft|compose|generate)\b/i, /\bi want to make\b/i];
const QUESTION = [/\?\s*$/];

/** Deterministic intent detection. The model never decides authorization; this only routes the request. */
export function detectIntent(message: string, ctx: { hasSelectedArtifact: boolean; hasMaterials: boolean }): IntentResult {
  const text = message.trim();
  const type = inferArtifactType(text);
  if (CORRECT.some((r) => r.test(text))) return { intent: "correct_memory", artifactType: null, refinementAction: null };
  if (REMEMBER.some((r) => r.test(text))) return { intent: "remember", artifactType: null, refinementAction: null };
  if (DISCOVER.some((r) => r.test(text)) && !type) return { intent: "discover", artifactType: null, refinementAction: null };

  if (TRANSFORM.some((r) => r.test(text)) && type && (ctx.hasSelectedArtifact || /\b(it|this|that|the (poem|script|story|song|lyrics))\b/i.test(text))) {
    return { intent: ctx.hasMaterials && !ctx.hasSelectedArtifact ? "create" : "transform", artifactType: type, refinementAction: null };
  }
  const refine = REFINE.find(([r]) => r.test(text));
  if (refine && !type) return { intent: "refine", artifactType: null, refinementAction: refine[1] };
  if (type && (CREATE.some((r) => r.test(text)) || TRANSFORM.some((r) => r.test(text)))) return { intent: "create", artifactType: type, refinementAction: null };
  if (CREATE.some((r) => r.test(text)) && ctx.hasMaterials) return { intent: "discover", artifactType: null, refinementAction: null };
  if (ctx.hasMaterials && !QUESTION.some((r) => r.test(text)) && text.length < 40) return { intent: "discover", artifactType: null, refinementAction: null };
  if (QUESTION.some((r) => r.test(text))) return { intent: "question", artifactType: type, refinementAction: null };
  return { intent: "chat", artifactType: type, refinementAction: null };
}

const DEICTIC = /\b(that|this|it|the (last|previous) one|the (poem|script|story|song|lyrics|piece|draft))\b/i;

export interface Candidate {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
}

export type Resolution = { kind: "resolved"; artifactId: string } | { kind: "ask"; question: string; options: Candidate[] } | { kind: "none" };

/**
 * Resolve which artifact a refine/transform request refers to. Server-side and deterministic:
 * the model never invents IDs. If "that" could mean several pieces, ask one focused question.
 */
export function resolveArtifactReference(message: string, selectedArtifactId: string | null, recent: Candidate[], now = new Date()): Resolution {
  if (selectedArtifactId) return { kind: "resolved", artifactId: selectedArtifactId };
  if (!recent.length) return { kind: "none" };
  const types = inferAllArtifactTypes(message);
  const type = types[0] ?? null;
  let pool = types.length ? recent.filter((c) => types.includes(c.type)) : recent;
  if (/\byesterday\b/i.test(message)) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const day = y.toISOString().slice(0, 10);
    const hit = pool.filter((c) => c.updatedAt.slice(0, 10) === day);
    if (hit.length) pool = hit;
  }
  if (pool.length === 1) return { kind: "resolved", artifactId: pool[0].id };
  if (!pool.length) pool = recent;
  if (DEICTIC.test(message) || type) {
    return { kind: "ask", question: "Which Creation do you mean?", options: pool.slice(0, 4) };
  }
  return { kind: "none" };
}
