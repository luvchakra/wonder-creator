import "server-only";
import { selectImageProvider, type ImageDeps } from "@wonder/creator-brain";
import type { Db } from "@wonder/db";
import sharp from "sharp";
import { serviceClient } from "./supabase/service";

/**
 * App wiring for contextual image generation (docs/image-generation.md). Derivatives are made here, where the image
 * library lives: a WebP master (≤1920px, never upscaled, §41) and a 480px thumbnail for carousel cards (§42).
 */
export async function deriveImages(bytes: Uint8Array) {
  const base = sharp(bytes, { failOn: "error" }).rotate();
  const master = await base.clone().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const thumbnail = await base.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  return { master: new Uint8Array(master.data), thumbnail: new Uint8Array(thumbnail), width: master.info.width, height: master.info.height };
}

export function imageDeps(db: Db, creatorId: string): ImageDeps {
  return { db, service: serviceClient(), creatorId, provider: selectImageProvider(), derive: deriveImages };
}

/** The job runner's dependencies (no creator session). */
export function imageWorkerDeps() {
  return { service: serviceClient(), provider: selectImageProvider(), derive: deriveImages };
}
