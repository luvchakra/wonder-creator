/**
 * Contextual image generation (docs/image-generation.md). Product-level types only: feature code speaks in purposes and
 * quality intents, never provider model names (§5, §75).
 */

export const IMAGE_QUALITY_INTENTS = ["preview", "standard", "premium"] as const;
export type ImageQualityIntent = (typeof IMAGE_QUALITY_INTENTS)[number];

export const IMAGE_PURPOSES = ["carousel", "explore", "creation", "transform-preview", "moodboard", "hero", "final"] as const;
export type ImagePurpose = (typeof IMAGE_PURPOSES)[number];

export const ASPECT_RATIOS = ["1:1", "4:5", "3:2", "16:9", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** A visual reference the creator is allowed to use (their own clean image Material), passed inline to the model. */
export interface ImageReference {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

export interface ProviderImageRequest {
  model: string;
  /** Wonder Creator's fixed instructions; never contains creator material. */
  system: string;
  /** The assembled context prompt; creator material inside it is fenced as untrusted. */
  prompt: string;
  aspectRatio: AspectRatio;
  references?: ImageReference[];
}

export interface ProviderImage {
  mimeType: string;
  bytes: Uint8Array;
}

export interface ProviderImageResult {
  image: ProviderImage;
  model: string;
}

export interface ImageProvider {
  readonly name: string;
  /** False when nothing is configured: callers show "Image generation isn't connected" — never a fake image (§55). */
  readonly live: boolean;
  generate(request: ProviderImageRequest): Promise<ProviderImageResult>;
}
