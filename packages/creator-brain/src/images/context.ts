import { createHash } from "node:crypto";
import { fenceUntrusted, UNTRUSTED_POLICY } from "@wonder/core/server";
import { ROUTING_VERSION } from "./router";
import type { AspectRatio, ImagePurpose, ImageQualityIntent } from "./types";

/** Bump when prompt semantics change; part of the context hash (§51). */
export const PROMPT_VERSION = "context-image-v1";

/**
 * What the page knows, minimised (§7, §58): the current Creation, the few selected Materials and their summaries, and
 * any creator-given mood/style. Never account history or unrelated Materials. Creator text is untrusted.
 */
export interface ImageGenerationContext {
  creation?: { id: string; title?: string | null; type?: string | null; version?: number | null; summary?: string | null; description?: string | null; lifecycle?: string | null };
  materials?: Array<{ id: string; type: string; title?: string | null; summary?: string | null; updatedAt?: string | null; hasReference?: boolean }>;
  creativeIntent?: { mood?: string[]; themes?: string[]; style?: string[]; medium?: string | null };
  currentPage?: string;
}

export interface ContextHashInput {
  creatorId: string;
  purpose: ImagePurpose;
  context: ImageGenerationContext;
  aspectRatio: AspectRatio;
  qualityIntent: ImageQualityIntent;
  count: number;
}

/** Keys sorted at every level, so equal meaning hashes equally. */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}

/**
 * The cache identity of a request (§13): Creation + version, the selected Materials and their versions, mood/style,
 * purpose, aspect, quality, count and the prompt/routing versions. Titles and summaries are left out on purpose — they
 * change with the version stamps already included — and nothing volatile goes in.
 */
export function contextHash(input: ContextHashInput): string {
  const c = input.context;
  const material = (c.materials ?? []).map((m) => ({ id: m.id, v: m.updatedAt ?? null, ref: !!m.hasReference })).sort((a, b) => a.id.localeCompare(b.id));
  const payload = stable({
    creatorId: input.creatorId,
    purpose: input.purpose,
    creationId: c.creation?.id ?? null,
    creationVersion: c.creation?.version ?? null,
    materials: material,
    intent: c.creativeIntent ?? null,
    aspectRatio: input.aspectRatio,
    qualityIntent: input.qualityIntent,
    count: input.count,
    promptVersion: PROMPT_VERSION,
    routingVersion: ROUTING_VERSION,
  });
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** A context worth generating from (§72): something the creator made or brought, with words to go on. */
export function hasMeaningfulContext(c: ImageGenerationContext): boolean {
  const words = [c.creation?.title, c.creation?.summary, c.creation?.description, ...(c.materials ?? []).flatMap((m) => [m.title, m.summary])].filter((x) => x?.trim()).length;
  return words > 0 || (c.materials ?? []).some((m) => m.hasReference);
}

export interface ImageDirection {
  label: string;
  guidance: string;
  rationale: string;
}

const POOLS: Record<string, ImageDirection[]> = {
  memory: [
    { label: "Documentary", guidance: "documentary realism, natural light, honest everyday detail", rationale: "A true-to-life take that keeps the memory grounded." },
    { label: "Atmospheric", guidance: "atmospheric, soft focus, the texture of remembered time", rationale: "Leans into how the memory feels." },
    { label: "Editorial", guidance: "considered editorial composition, strong negative space", rationale: "A composed frame with room to breathe." },
    { label: "Symbolic", guidance: "symbolic and poetic, one quiet object standing for the story", rationale: "Tells the story through a single symbol." },
    { label: "Archival", guidance: "archival photograph look, gentle grain, faded warm tones", rationale: "Feels like it came from the family album." },
  ],
  film: [
    { label: "Establishing frame", guidance: "wide cinematic establishing shot, sense of place", rationale: "Sets the world of the piece." },
    { label: "Close-up", guidance: "intimate character close-up, shallow depth of field", rationale: "Brings the viewer close to a person." },
    { label: "Light study", guidance: "mood lighting study, motivated light, strong colour temperature", rationale: "Explores the light of a key moment." },
    { label: "Poster", guidance: "poster-style key art composition without any text", rationale: "One image that could carry the whole piece." },
    { label: "Storyboard", guidance: "loose storyboard frame, clear staging", rationale: "A working frame for blocking the scene." },
  ],
  words: [
    { label: "Still life", guidance: "lyrical still life, tactile objects, quiet light", rationale: "Gives the words something to hold." },
    { label: "Landscape", guidance: "atmospheric landscape that mirrors the mood", rationale: "Places the piece in an open space." },
    { label: "Portrait", guidance: "intimate portrait, gentle and human", rationale: "Finds the person inside the words." },
    { label: "Abstract", guidance: "abstract texture and colour field inspired by the mood", rationale: "Pure feeling, no literal scene." },
    { label: "Illustrated", guidance: "hand-painted illustration, watercolour and ink", rationale: "A painted interpretation." },
  ],
  general: [
    { label: "Editorial", guidance: "considered editorial composition", rationale: "A clean, composed direction." },
    { label: "Atmospheric", guidance: "atmospheric, soft light, strong mood", rationale: "Leads with mood." },
    { label: "Close detail", guidance: "close detail, texture and material", rationale: "Looks closely at one detail." },
    { label: "Symbolic", guidance: "symbolic, poetic, minimal", rationale: "Says it with a single idea." },
    { label: "Illustrated", guidance: "hand-painted illustration", rationale: "A painted interpretation." },
  ],
};

/** Meaningfully different directions for this context (§10) — chosen from what the work is, not one fixed set. */
export function directionsFor(c: ImageGenerationContext, count: number): ImageDirection[] {
  const type = (c.creation?.type ?? "").toLowerCase();
  const kinds = new Set((c.materials ?? []).map((m) => m.type));
  const themes = [...(c.creativeIntent?.themes ?? []), ...(c.creativeIntent?.mood ?? [])].join(" ").toLowerCase();
  const pool = /film|script|trailer|video|scene/.test(type)
    ? POOLS.film
    : /poem|lyric|story|essay|song|letter/.test(type)
      ? POOLS.words
      : kinds.has("voice") || kinds.has("audio") || kinds.has("image") || /memory|family|childhood|nostalg/.test(themes)
        ? POOLS.memory
        : POOLS.general;
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}

export const IMAGE_SYSTEM = [
  "You create visual concepts for a creator's own work in Wonder Creator.",
  "Stay faithful to the supplied context; do not add real people's likenesses, logos, brands or watermarks.",
  "Never render text, captions or lettering in the image.",
  "Keep images human, editorial and tasteful.",
  UNTRUSTED_POLICY,
].join("\n");

/** The internal prompt (§9): purpose, context, direction and constraints. Creator material is fenced, never instructions. */
export function buildImagePrompt(c: ImageGenerationContext, purpose: ImagePurpose, aspectRatio: AspectRatio, direction: ImageDirection): string {
  const lines: string[] = [`Create a ${purpose === "carousel" || purpose === "explore" ? "visual concept" : "finished image"} for a creator's work.`, "", "Context:"];
  const fence = (label: string, s?: string | null) => (s?.trim() ? fenceUntrusted(label, s.trim(), 600) : null);
  if (c.creation) {
    lines.push(`- A ${c.creation.type ?? "creative"} Creation${c.creation.lifecycle ? ` (${c.creation.lifecycle})` : ""}.`);
    for (const [k, v] of [["creation title", c.creation.title], ["creation summary", c.creation.summary], ["creation description", c.creation.description]] as const) {
      const f = fence(k, v);
      if (f) lines.push(f);
    }
  }
  for (const m of (c.materials ?? []).slice(0, 5)) {
    lines.push(`- A ${m.type} Material${m.hasReference ? " (its image is attached as a visual reference; keep continuity with it)" : ""}.`);
    const f = fence("material", [m.title, m.summary].filter(Boolean).join(" — "));
    if (f) lines.push(f);
  }
  const intent = c.creativeIntent;
  if (intent?.mood?.length) lines.push(`- Mood: ${intent.mood.slice(0, 5).join(", ")}.`);
  if (intent?.themes?.length) lines.push(`- Themes: ${intent.themes.slice(0, 5).join(", ")}.`);
  if (intent?.style?.length) lines.push(`- Style: ${intent.style.slice(0, 5).join(", ")}.`);
  lines.push("", `ImageDirection: ${direction.guidance}.`, "Avoid embedded text.", `Aspect ratio: ${aspectRatio}.`);
  return lines.join("\n");
}
