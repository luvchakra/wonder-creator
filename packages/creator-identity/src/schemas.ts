import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
const tagList = (max: number, each = 60) => z.array(z.string().trim().min(1).max(each)).max(max);

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 letters, numbers or underscores.");

export const aboutSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us what to call you.").max(80),
  handle: handleSchema,
  bio: shortText(300).optional().default(""),
  location: shortText(120).optional().default(""),
  showLocation: z.boolean().optional().default(false),
  languages: tagList(10).default([]),
});

export const identitySchema = z.object({
  disciplines: tagList(12).min(1, "Pick at least one discipline."),
  skills: tagList(20).default([]),
  interests: tagList(20).default([]),
});

export const voiceSchema = z.object({
  tones: tagList(6, 30).default([]),
  formality: z.enum(["casual", "balanced", "formal"]).nullable().optional(),
  writingStyle: z.enum(["concise", "detailed", "narrative", "technical", "poetic", "experimental"]).nullable().optional(),
  vocabulary: shortText(300).nullable().optional(),
  languageStyle: shortText(300).nullable().optional(),
  codeSwitching: z.boolean().optional(),
  narrativeStyle: shortText(300).nullable().optional(),
  recurringThemes: tagList(12, 40).default([]),
  visualStyles: tagList(6, 30).default([]),
  visualMoods: tagList(8, 30).default([]),
  colorPreferences: tagList(8, 30).default([]),
  compositionNotes: shortText(500).nullable().optional(),
  experimentation: z.enum(["stay_close", "balanced", "experiment"]).optional(),
});

export const boundariesSchema = z.object({
  preserve: tagList(12, 120).default([]),
  avoid: tagList(12, 120).default([]),
  sensitive: tagList(12, 120).default([]),
});

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  handle: handleSchema,
  bio: shortText(300).default(""),
  location: shortText(120).default(""),
  showLocation: z.boolean().default(false),
  visibility: z.enum(["public", "creators_only", "private"]),
  collaborationAvailability: z.enum(["open", "selective", "closed"]),
});

export type AboutInput = z.infer<typeof aboutSchema>;
export type IdentityInput = z.infer<typeof identitySchema>;
export type VoiceInput = z.infer<typeof voiceSchema>;
export type BoundariesInput = z.infer<typeof boundariesSchema>;
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

export const ONBOARDING_STEPS = ["welcome", "about", "identity", "style", "boundaries", "ready"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function nextOnboardingStep(step: OnboardingStep | "complete"): OnboardingStep | "complete" {
  if (step === "complete") return "complete";
  const i = ONBOARDING_STEPS.indexOf(step);
  return i === ONBOARDING_STEPS.length - 1 ? "complete" : ONBOARDING_STEPS[i + 1];
}

/** Dedupe case-insensitively while preserving first spelling and order. */
export function normalizeTags(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim().replace(/\s+/g, " ");
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
