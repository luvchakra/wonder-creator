import type { ImagePurpose, ImageQualityIntent } from "./types";

/** Bump when model assignment changes; part of the context hash (§52). */
export const ROUTING_VERSION = "image-router-v1";

export interface ImageEnv {
  WONDERCREATOR_IMAGE_PROVIDER?: string;
  WONDERCREATOR_IMAGE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  WONDERCREATOR_AI_PROVIDER?: string;
  WONDERCREATOR_AI_API_KEY?: string;
  WONDERCREATOR_IMAGE_FAST_MODEL?: string;
  WONDERCREATOR_IMAGE_DEFAULT_MODEL?: string;
  WONDERCREATOR_IMAGE_PREMIUM_MODEL?: string;
}

export const DEFAULT_IMAGE_MODELS = {
  fast: "gemini-3.1-flash-lite-image",
  default: "gemini-3.1-flash-image",
  premium: "gemini-3-pro-image",
} as const;

/** The one place that maps a quality intent to a configured model (§20). Purpose is accepted for future routing. */
export function resolveImageModel(opts: { qualityIntent: ImageQualityIntent; purpose?: ImagePurpose }, env: ImageEnv = process.env as ImageEnv): string {
  const pick = (v: string | undefined, d: string) => v?.trim() || d;
  if (opts.qualityIntent === "preview") return pick(env.WONDERCREATOR_IMAGE_FAST_MODEL, DEFAULT_IMAGE_MODELS.fast);
  if (opts.qualityIntent === "premium") return pick(env.WONDERCREATOR_IMAGE_PREMIUM_MODEL, DEFAULT_IMAGE_MODELS.premium);
  return pick(env.WONDERCREATOR_IMAGE_DEFAULT_MODEL, DEFAULT_IMAGE_MODELS.default);
}

/** Sensible default quality for a purpose (§73): exploration is preview-tier; only explicit final work is premium. */
export function defaultQualityFor(purpose: ImagePurpose): ImageQualityIntent {
  if (purpose === "carousel" || purpose === "explore" || purpose === "transform-preview" || purpose === "moodboard") return "preview";
  if (purpose === "final" || purpose === "hero") return "premium";
  return "standard";
}
