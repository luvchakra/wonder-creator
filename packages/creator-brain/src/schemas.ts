import { z } from "zod";

export const INTENTS = ["discover", "create", "refine", "transform", "remember", "correct_memory", "question", "chat"] as const;
export type Intent = (typeof INTENTS)[number];

export const understandingSchema = z.object({
  summary: z.string().describe("Two or three warm sentences describing what the material is about."),
  themes: z.array(z.string()).describe("Up to 6 short themes, e.g. Family, Memory."),
  moods: z.array(z.string()).describe("Up to 4 moods, e.g. Nostalgic, Warm."),
  suggestedTitle: z.string(),
  perMaterial: z.array(z.object({ ref: z.string(), note: z.string() })).describe("One short observation per provided material, keyed by its ref."),
});
export type Understanding = z.infer<typeof understandingSchema>;

export const directionSchema = z.object({
  title: z.string(),
  artifactType: z.string().describe("One of the known artifact type keys."),
  description: z.string().describe("One sentence describing the piece."),
  why: z.string().describe("One simple sentence on why this fits the material. No scores."),
  styleTags: z.array(z.string()),
  materialRefs: z.array(z.string()),
});
export const directionsSchema = z.object({
  intro: z.string().describe("One sentence introducing the directions, e.g. 'I found three directions this material could take.'"),
  directions: z.array(directionSchema),
});
export type Direction = z.infer<typeof directionSchema>;
export type Directions = z.infer<typeof directionsSchema>;

export const planSchema = z.object({
  title: z.string(),
  approach: z.string(),
  outline: z.array(z.string()),
});
export type Plan = z.infer<typeof planSchema>;

export const qualityCheckSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["good", "attention"]),
  note: z.string(),
});
export const critiqueSchema = z.object({
  checks: z.array(qualityCheckSchema),
  suggestions: z.array(z.object({ title: z.string(), detail: z.string() })),
});
export type Critique = z.infer<typeof critiqueSchema>;

export const MEMORY_CATEGORIES = [
  "creative_preference", "creative_voice", "style_preference", "creative_fact",
  "creative_history", "relationship_context", "project_context", "recurring_theme",
] as const;

export const memoriesSchema = z.object({
  memories: z.array(
    z.object({
      category: z.enum(MEMORY_CATEGORIES),
      statement: z.string().describe("Second person, e.g. 'You prefer poetic writing with strong visual imagery.'"),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export type ExtractedMemories = z.infer<typeof memoriesSchema>;

export const imageDescriptionSchema = z.object({
  description: z.string(),
  subjects: z.array(z.string()),
  moods: z.array(z.string()),
  palette: z.array(z.string()),
});
export type ImageDescription = z.infer<typeof imageDescriptionSchema>;
