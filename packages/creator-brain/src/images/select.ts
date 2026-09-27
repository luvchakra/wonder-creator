import { GeminiImageProvider, UnavailableImageProvider } from "./gemini-image";
import type { ImageEnv } from "./router";
import type { ImageProvider } from "./types";

/**
 * The configured image provider (§3–4). Gemini by default; its key is WONDERCREATOR_IMAGE_API_KEY or GEMINI_API_KEY, or
 * the CreativeMind key when CreativeMind already runs on Gemini. There is no offline image model: without a key the
 * product says so.
 */
export function selectImageProvider(env: ImageEnv = process.env as ImageEnv): ImageProvider {
  const wanted = (env.WONDERCREATOR_IMAGE_PROVIDER?.trim().toLowerCase() || "gemini") as string;
  if (wanted !== "gemini") return new UnavailableImageProvider();
  const key = env.WONDERCREATOR_IMAGE_API_KEY?.trim() || env.GEMINI_API_KEY?.trim() || (env.WONDERCREATOR_AI_PROVIDER?.trim().toLowerCase() === "gemini" ? env.WONDERCREATOR_AI_API_KEY?.trim() : undefined);
  return key ? new GeminiImageProvider({ apiKey: key }) : new UnavailableImageProvider();
}
