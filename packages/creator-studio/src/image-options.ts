import { z } from "zod";
import { DEFAULT_OVERLAY, type SlideOverlay } from "./carousel";

/**
 * The Images page (docs/ui-redesign/creation-pages.md, step 2). Client-safe: no database access.
 *
 * An Images Creation is a short sequence of the creator's own pictures (one is a picture, several a photo essay). Each
 * keeps its original Material untouched; what the creator does to it — crop, focus, filter, light, blur behind the
 * words, a frame, words on the picture, a caption — is a set of numbers kept in the Creation's version
 * (`structured_content`). Every "Keep" is a new version, so any earlier look can be brought back.
 */

export const IMAGE_ASPECTS = ["original", "1:1", "4:5", "16:9", "9:16"] as const;
export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
export const ASPECT_LABEL: Record<ImageAspect, string> = { original: "Free", "1:1": "1:1", "4:5": "4:5", "16:9": "16:9", "9:16": "9:16" };

export const IMAGE_FILTERS = ["none", "warm", "cool", "film", "mono", "fade"] as const;
export type ImageFilter = (typeof IMAGE_FILTERS)[number];
export const FILTER_LABEL: Record<ImageFilter, string> = { none: "Original", warm: "Warm", cool: "Cool", film: "Film", mono: "Mono", fade: "Fade" };

export const IMAGE_FRAMES = ["none", "paper", "border"] as const;
export type ImageFrame = (typeof IMAGE_FRAMES)[number];
export const FRAME_LABEL: Record<ImageFrame, string> = { none: "None", paper: "Paper edge", border: "Fine border" };

export interface ImageEdits {
  aspect: ImageAspect;
  zoom: number;
  focalX: number;
  focalY: number;
  filter: ImageFilter;
  /** 1 is unchanged. */
  brightness: number;
  contrast: number;
  /** A soft blur of the picture behind the words, so they read on a busy image. */
  blurBehind: boolean;
  frame: ImageFrame;
}

export const DEFAULT_EDITS: ImageEdits = { aspect: "original", zoom: 1, focalX: 0.5, focalY: 0.5, filter: "none", brightness: 1, contrast: 1, blurBehind: false, frame: "none" };
/** Words start off; a picture is first a picture. Same shape as a Carousel slide's overlay. */
export const DEFAULT_WORDS: SlideOverlay = { ...DEFAULT_OVERLAY, enabled: false, text: "" };

export interface CreationImage {
  materialId: string;
  caption: string;
  edits: ImageEdits;
  words: SlideOverlay;
}
export interface ImageSet {
  kind: "images";
  items: CreationImage[];
}
export const MAX_IMAGES = 24;

const editsSchema = z.object({
  aspect: z.enum(IMAGE_ASPECTS),
  zoom: z.number().min(1).max(4),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  filter: z.enum(IMAGE_FILTERS),
  brightness: z.number().min(0.5).max(1.5),
  contrast: z.number().min(0.5).max(1.5),
  blurBehind: z.boolean(),
  frame: z.enum(IMAGE_FRAMES),
});
const wordsSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(600).nullish(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.2).max(1),
  font: z.enum(["editorial", "serif", "modern", "handwritten"]),
  size: z.number().min(0.02).max(0.2),
  align: z.enum(["left", "center", "right"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  shadow: z.boolean(),
  background: z.enum(["none", "shade", "band"]),
});
export const imageSetSchema = z.object({
  kind: z.literal("images"),
  items: z
    .array(
      z.object({
        materialId: z.string().uuid(),
        caption: z.string().max(600),
        edits: editsSchema,
        words: wordsSchema,
      }),
    )
    .max(MAX_IMAGES),
});

/** A version's pictures, tolerant of older or partial shapes (unknown values fall back to the defaults). */
export function imageSetOf(structured: unknown): ImageSet {
  const raw = structured as { kind?: string; items?: unknown[] } | null;
  if (!raw || raw.kind !== "images" || !Array.isArray(raw.items)) return { kind: "images", items: [] };
  const items: CreationImage[] = [];
  for (const it of raw.items.slice(0, MAX_IMAGES)) {
    const o = (it ?? {}) as Partial<CreationImage>;
    if (typeof o.materialId !== "string" || !/^[0-9a-f-]{36}$/i.test(o.materialId)) continue;
    const e = editsSchema.safeParse({ ...DEFAULT_EDITS, ...(o.edits ?? {}) });
    const w = wordsSchema.safeParse({ ...DEFAULT_WORDS, ...(o.words ?? {}) });
    items.push({ materialId: o.materialId, caption: typeof o.caption === "string" ? o.caption.slice(0, 600) : "", edits: e.success ? e.data : DEFAULT_EDITS, words: w.success ? (w.data as SlideOverlay) : DEFAULT_WORDS });
  }
  return { kind: "images", items };
}

/**
 * The look of a filter + light as a CSS filter (the live preview and the published page). The canvas export applies the
 * same numbers pixel by pixel (`pixelOps`), so a download matches the screen in every browser.
 */
export interface PixelOps {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  /** Added to red/blue after the rest (warm > 0, cool < 0), in 0–255 units. */
  tint: number;
  /** Lifts the blacks (fade), 0–255. */
  lift: number;
}
const FILTER_OPS: Record<ImageFilter, Omit<PixelOps, "brightness" | "contrast"> & { b: number; c: number }> = {
  none: { b: 1, c: 1, saturate: 1, sepia: 0, tint: 0, lift: 0 },
  warm: { b: 1.03, c: 1.02, saturate: 1.12, sepia: 0.12, tint: 10, lift: 0 },
  cool: { b: 1.02, c: 1.03, saturate: 0.95, sepia: 0, tint: -12, lift: 0 },
  film: { b: 1.02, c: 0.92, saturate: 0.88, sepia: 0.2, tint: 4, lift: 14 },
  mono: { b: 1.02, c: 1.12, saturate: 0, sepia: 0, tint: 0, lift: 0 },
  fade: { b: 1.06, c: 0.82, saturate: 0.8, sepia: 0.05, tint: 0, lift: 26 },
};

export function pixelOps(e: Pick<ImageEdits, "filter" | "brightness" | "contrast">): PixelOps {
  const f = FILTER_OPS[e.filter] ?? FILTER_OPS.none;
  return { brightness: f.b * e.brightness, contrast: f.c * e.contrast, saturate: f.saturate, sepia: f.sepia, tint: f.tint, lift: f.lift };
}

/** CSS for the preview. Tint and lift are approximated with sepia/hue and brightness; close to the export, not identical. */
export function cssFilter(e: Pick<ImageEdits, "filter" | "brightness" | "contrast">): string {
  const p = pixelOps(e);
  const parts = [`brightness(${(p.brightness * (1 + p.lift / 400)).toFixed(3)})`, `contrast(${(p.contrast * (1 - p.lift / 500)).toFixed(3)})`, `saturate(${p.saturate.toFixed(3)})`];
  if (p.sepia) parts.push(`sepia(${p.sepia.toFixed(3)})`);
  if (p.tint > 0) parts.push(`sepia(${(p.tint / 120).toFixed(3)})`);
  if (p.tint < 0) parts.push(`hue-rotate(${Math.round(p.tint * 0.9)}deg)`);
  return parts.join(" ");
}

/** Applies the ops to RGBA pixels in place (the canvas export). */
export function applyPixelOps(data: Uint8ClampedArray, p: PixelOps): void {
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;
    // brightness, then contrast around mid-grey
    r = (r * p.brightness - 128) * p.contrast + 128;
    g = (g * p.brightness - 128) * p.contrast + 128;
    b = (b * p.brightness - 128) * p.contrast + 128;
    // saturation (luma-preserving)
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l + (r - l) * p.saturate;
    g = l + (g - l) * p.saturate;
    b = l + (b - l) * p.saturate;
    if (p.sepia) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = r + (sr - r) * p.sepia;
      g = g + (sg - g) * p.sepia;
      b = b + (sb - b) * p.sepia;
    }
    r += p.tint;
    b -= p.tint;
    if (p.lift) {
      const k = 1 - p.lift / 255;
      r = p.lift + r * k;
      g = p.lift + g * k;
      b = p.lift + b * k;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/** The frame's shape for a picture of this aspect: width/height, or null to follow the picture. */
export function aspectRatioOf(a: ImageAspect, natural?: { width: number; height: number } | null): number {
  if (a === "original") return natural && natural.width && natural.height ? natural.width / natural.height : 4 / 5;
  const [w, h] = a.split(":").map(Number);
  return w! / h!;
}
