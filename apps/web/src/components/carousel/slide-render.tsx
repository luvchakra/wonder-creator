"use client";
import { cropRect, type ImageTransform, type SlideOverlay } from "@wonder/creator-studio/carousel";
import { cn } from "@wonder/ui";
import { wrapText } from "@/lib/slide-text-layout";

/**
 * One slide, drawn two ways from the same numbers (docs/ui-redesign/carousel-composer.md §15, §20–24):
 * - `SlideFrame` — the live DOM preview. The words stay real text (selectable, readable by screen readers); positions
 *   and sizes are fractions of the image, so it looks the same at any size.
 * - `composeSlide` — the canvas render for Download and Save, matching the preview.
 */

export const FONT_STACK: Record<SlideOverlay["font"], { css: string; weight: number; italic?: boolean; variable?: string }> = {
  editorial: { css: '"Playfair Display", Georgia, serif', weight: 500, italic: true, variable: "--font-playfair" },
  serif: { css: '"Playfair Display", Georgia, serif', weight: 600, variable: "--font-playfair" },
  modern: { css: "Inter, system-ui, sans-serif", weight: 600, variable: "--font-inter" },
  handwritten: { css: '"Segoe Print", "Bradley Hand", "Comic Neue", cursive', weight: 500 },
};

export function fontFamily(font: SlideOverlay["font"]): string {
  const f = FONT_STACK[font];
  const v = f.variable && typeof document !== "undefined" ? getComputedStyle(document.body).getPropertyValue(f.variable).trim() : "";
  return v ? `${v}, ${f.css}` : f.css;
}

const ASPECT_CLASS: Record<string, string> = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };
export const aspectClass = (a: string) => ASPECT_CLASS[a] ?? "aspect-[4/5]";

/** The image, cropped by zoom + focal point, as CSS. */
export function CroppedImage({ src, transform, alt = "", className }: { src: string; transform: ImageTransform; alt?: string; className?: string }) {
  const z = Math.min(4, Math.max(1, transform.zoom || 1));
  const r = cropRect(1, 1, transform);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("absolute max-w-none select-none object-cover", className)}
      style={{ width: `${z * 100}%`, height: `${z * 100}%`, left: `${-r.sx * z * 100}%`, top: `${-r.sy * z * 100}%` }}
    />
  );
}

/** The overlay's text box, positioned by its centre. Used for preview and editing. */
export function OverlayText({ overlay, text, selected, className, ...rest }: { overlay: SlideOverlay; text: string; selected?: boolean; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const f = FONT_STACK[overlay.font];
  return (
    <div
      {...rest}
      className={cn("absolute -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap break-words leading-[1.25]", selected && "outline outline-2 outline-offset-4 outline-white/90", className)}
      style={{
        left: `${overlay.x * 100}%`,
        top: `${overlay.y * 100}%`,
        width: `${overlay.width * 100}%`,
        fontSize: `${overlay.size * 100}cqw`,
        fontFamily: `var(${f.variable ?? "--font-inter"}), ${f.css}`,
        fontWeight: f.weight,
        fontStyle: f.italic ? "italic" : "normal",
        textAlign: overlay.align,
        color: overlay.color,
        textShadow: overlay.shadow ? "0 0.04em 0.3em rgb(0 0 0 / 0.55)" : "none",
        ...(overlay.background === "band" ? { background: "rgb(251 247 240 / 0.9)", borderRadius: "0.35em", padding: "0.3em 0.5em" } : {}),
        ...rest.style,
      }}
    >
      {text}
    </div>
  );
}

/** A soft shade behind the words so they read on any image (colour is never the only cue: shadow + shade). */
function Shade({ overlay }: { overlay: SlideOverlay }) {
  if (overlay.background !== "shade") return null;
  const top = overlay.y < 0.4;
  const mid = overlay.y >= 0.4 && overlay.y <= 0.6;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: mid
          ? `linear-gradient(to bottom, transparent ${Math.max(0, overlay.y * 100 - 28)}%, rgb(0 0 0 / 0.45) ${overlay.y * 100}%, transparent ${Math.min(100, overlay.y * 100 + 28)}%)`
          : top
            ? `linear-gradient(to bottom, rgb(0 0 0 / 0.55), transparent ${Math.min(100, overlay.y * 100 + 30)}%)`
            : `linear-gradient(to top, rgb(0 0 0 / 0.6), transparent ${Math.min(100, (1 - overlay.y) * 100 + 30)}%)`,
      }}
    />
  );
}

export function SlideFrame({
  image,
  overlay,
  text,
  transform,
  aspect,
  className,
  children,
  label,
}: {
  image: string | null;
  overlay: SlideOverlay;
  text: string;
  transform: ImageTransform;
  aspect: string;
  className?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-muted [container-type:inline-size]", aspectClass(aspect), className)} role={label ? "img" : undefined} aria-label={label}>
      {image ? <CroppedImage src={image} transform={transform} /> : null}
      {overlay.enabled && text.trim() ? (
        <>
          <Shade overlay={overlay} />
          {children ?? <OverlayText overlay={overlay} text={text} aria-hidden={label ? true : undefined} />}
        </>
      ) : (
        children
      )}
    </div>
  );
}

/** Canvas render of a slide (for Download / Save), matching `SlideFrame`. */
export async function composeSlide(canvas: HTMLCanvasElement, img: HTMLImageElement, s: { overlay: SlideOverlay; text: string; transform: ImageTransform; aspect: string }) {
  const [aw, ah] = s.aspect === "1:1" ? [1, 1] : s.aspect === "16:9" ? [16, 9] : [4, 5];
  const w = Math.min(1600, img.naturalWidth || 1080);
  const h = Math.round((w * ah) / aw);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // Cover-fit the image into the frame, then apply the crop.
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const cw = w / scale;
  const ch = h / scale;
  const base = { sx: (iw - cw) / 2, sy: (ih - ch) / 2 };
  const r = cropRect(cw, ch, s.transform);
  ctx.drawImage(img, base.sx + r.sx, base.sy + r.sy, r.sw, r.sh, 0, 0, w, h);

  const o = s.overlay;
  if (!o.enabled || !s.text.trim()) return;
  const f = FONT_STACK[o.font];
  const px = Math.round(o.size * w);
  const font = `${f.italic ? "italic " : ""}${f.weight} ${px}px ${fontFamily(o.font)}`;
  await document.fonts?.load(font, s.text).catch(() => undefined);
  ctx.font = font;
  const boxW = o.width * w;
  const lines = wrapText(s.text, boxW, (t) => ctx.measureText(t).width);
  const lh = px * 1.25;
  const blockH = lines.length * lh;
  const cx = o.x * w;
  const cy = o.y * h;
  if (o.background === "shade") {
    const g = o.y < 0.4 ? ctx.createLinearGradient(0, 0, 0, Math.min(h, cy + 0.3 * h)) : o.y > 0.6 ? ctx.createLinearGradient(0, h, 0, Math.max(0, cy - 0.3 * h)) : ctx.createLinearGradient(0, cy - 0.28 * h, 0, cy + 0.28 * h);
    if (o.y >= 0.4 && o.y <= 0.6) {
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5, "rgba(0,0,0,0.45)");
      g.addColorStop(1, "rgba(0,0,0,0)");
    } else {
      g.addColorStop(0, o.y < 0.4 ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.6)");
      g.addColorStop(1, "rgba(0,0,0,0)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (o.background === "band") {
    const pad = px * 0.4;
    ctx.fillStyle = "rgba(251,247,240,0.9)";
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2 - pad, cy - blockH / 2 - pad * 0.75, boxW + pad * 2, blockH + pad * 1.5, px * 0.35);
    ctx.fill();
  }
  ctx.fillStyle = o.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = o.align === "left" ? "left" : o.align === "right" ? "right" : "center";
  const x = o.align === "left" ? cx - boxW / 2 : o.align === "right" ? cx + boxW / 2 : cx;
  if (o.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = px * 0.3;
    ctx.shadowOffsetY = px * 0.04;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, cy - blockH / 2 + i * lh + lh / 2));
  ctx.shadowColor = "transparent";
}

/** Load an image the canvas may read (storage allows cross-origin reads). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image"));
    el.src = src;
  });
}

export async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const as = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
  const webp = await as("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await as("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}
