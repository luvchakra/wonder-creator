import { artifactType, isKnownArtifactType } from "@wonder/creator-studio";
import { z } from "zod";

/**
 * Intent clarification (P0.1-03). Before a creation run, decide whether CreatorBrain knows enough.
 * Deterministic and cheap: it runs on every create request and never calls the model.
 * - Safe assumptions (tone, usual style, a first-draft length) are made and shown, never asked about.
 * - Missing information is asked about only when it materially changes the piece (long-form length,
 *   audience for audience-facing formats, which format when several were named, which material to lead
 *   with when there's a lot of it).
 * - Consequential assumptions (publishing, commercial use, imitating someone) are never made silently:
 *   the creator must acknowledge each one before the run starts.
 */

export const briefSchema = z.object({
  format: z.string().min(1).max(40),
  audience: z.string().trim().max(120).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  tone: z.string().trim().max(120).optional(),
  style: z.enum(["preserve", "experiment"]).optional(),
  emphasisMaterialId: z.string().uuid().nullable().optional(),
});
export type IntentBrief = z.infer<typeof briefSchema>;

export type MissingInfo = "format" | "length" | "audience" | "emphasis";

export interface ConsequentialAssumption {
  key: "publish" | "commercial" | "imitation";
  text: string;
}

export interface IntentAssessment {
  intent: "create";
  artifactType: string | null;
  /** Formats the request named, when there was more than one. */
  candidateTypes: string[];
  confidence: number;
  missingInformation: MissingInfo[];
  safeAssumptions: string[];
  consequentialAssumptions: ConsequentialAssumption[];
  clarificationRequired: boolean;
  recommendedNextAction: "proceed" | "clarify";
  /** Pre-filled brief the creator can edit. */
  defaults: IntentBrief;
}

const LONG_FORM = new Set(["screenplay", "script", "short_film", "film_treatment", "documentary", "story", "article", "essay", "biography", "podcast_concept", "trailer"]);
const AUDIENCE_FACING = new Set(["copy", "social_post", "newsletter", "media_kit", "proposal", "pitch_deck", "presentation", "blog_post", "carousel", "social_series"]);

const LENGTH_CUE = /\b(\d+\s*(min(ute)?s?|pages?|words?|seconds?|secs?|scenes?|slides?|lines?|verses?)|short|brief|long|quick|tiny|feature[- ]length|one[- ]page)\b/i;
const AUDIENCE_CUE = /\b(audience|readers?|followers?|listeners?|viewers?|clients?|customers?|investors?|fans|kids|children|students|teens?|parents|community|subscribers|for (my|our|a|an|the) \w+)\b/i;
const EMPHASIS_CUE = /\b(especially|mainly|mostly|focus(ed)? on|centred on|centered on|lead with|the (first|second|last|photo|picture|image|voice note|recording|video))\b/i;

const CONSEQUENTIAL: Array<[RegExp, ConsequentialAssumption]> = [
  [
    /\b(publish|post (it|this)|upload|release|share (it|this)? ?(on|to) (instagram|youtube|tiktok|facebook|x|twitter|linkedin|spotify))\b/i,
    { key: "publish", text: "This makes a private draft only. Publishing is a separate step that you review and approve." },
  ],
  [
    /\b(sell|selling|commercial(ly)?|client|brand deal|sponsor(ed|ship)?|licen[cs]e|advert(isement)?|\bads?\b|campaign for)\b/i,
    { key: "commercial", text: "Creating doesn't grant or decide any rights. The draft stays private until you set its rights and licences." },
  ],
  [
    /\b(in the style of|sound(s)? like|write like|as if (written|made) by|imitat(e|ing))\b/i,
    { key: "imitation", text: "I'll take inspiration from that style without copying protected work or presenting it as theirs." },
  ],
];

export function assessIntent(
  message: string,
  ctx: { artifactType: string | null; mentionedTypes: string[]; materialCount: number; usualVoice?: string | null },
): IntentAssessment {
  const text = message.trim();
  const candidateTypes = [...new Set(ctx.mentionedTypes.filter(isKnownArtifactType))];
  const type = ctx.artifactType && isKnownArtifactType(ctx.artifactType) ? ctx.artifactType : (candidateTypes[0] ?? null);
  const missing: MissingInfo[] = [];
  if (!type || candidateTypes.length > 1) missing.push("format");
  if (type && LONG_FORM.has(type) && !LENGTH_CUE.test(text)) missing.push("length");
  if (type && AUDIENCE_FACING.has(type) && !AUDIENCE_CUE.test(text)) missing.push("audience");
  if (ctx.materialCount >= 3 && !EMPHASIS_CUE.test(text)) missing.push("emphasis");

  const consequential = CONSEQUENTIAL.filter(([r]) => r.test(text)).map(([, c]) => c);

  const label = type ? artifactType(type).label.toLowerCase() : "piece";
  const safe = [
    ctx.usualVoice ? `In your usual voice (${ctx.usualVoice}).` : "In your usual voice and style.",
    !missing.includes("length") ? `A first-draft length that suits a ${label}; you can extend it in the Studio.` : null,
    "Saved as a private draft (v1). Nothing is shared or published.",
  ].filter((x): x is string => !!x);

  const clarificationRequired = missing.length > 0 || consequential.length > 0;
  return {
    intent: "create",
    artifactType: type,
    candidateTypes: candidateTypes.length > 1 ? candidateTypes : [],
    confidence: Math.max(0.3, Math.round((1 - 0.2 * missing.length - 0.1 * consequential.length) * 100) / 100),
    missingInformation: missing,
    safeAssumptions: safe,
    consequentialAssumptions: consequential,
    clarificationRequired,
    recommendedNextAction: clarificationRequired ? "clarify" : "proceed",
    defaults: { format: type ?? "poem", length: LONG_FORM.has(type ?? "") ? "short" : undefined, style: "preserve" },
  };
}

const LENGTH_TEXT: Record<NonNullable<IntentBrief["length"]>, string> = {
  short: "short (a first draft that can grow)",
  medium: "medium",
  long: "long and fully developed",
};

/** The confirmed brief, as plain instructions appended to the creator's request. */
export function renderBrief(brief: IntentBrief, materialTitle?: string | null): string {
  const lines = [
    `Format: ${artifactType(brief.format).label}`,
    brief.audience ? `Audience: ${brief.audience}` : null,
    brief.length ? `Length: ${LENGTH_TEXT[brief.length]}` : null,
    brief.tone ? `Tone: ${brief.tone}` : null,
    brief.style === "experiment" ? "Style: experiment beyond my usual style" : brief.style === "preserve" ? "Style: keep my usual style" : null,
    brief.emphasisMaterialId ? `Lead with this material: ${materialTitle || "the one I chose"}` : null,
  ].filter(Boolean);
  return `Confirmed brief:\n${lines.join("\n")}`;
}
