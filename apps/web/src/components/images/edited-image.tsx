"use client";
import { cropRect } from "@wonder/creator-studio/carousel";
import { applyPixelOps, aspectRatioOf, cssFilter, overlayOf, pixelOps, type ImageEdits, type TextBox } from "@wonder/creator-studio/images";
import { cn } from "@wonder/ui";
import { CroppedImage, OverlayText, Shade, drawWords } from "@/components/carousel/slide-render";

/**
 * A picture as the creator shaped it on the Images page (creation-pages.md, step 2), drawn two ways from the same numbers:
 * - `EditedImage` — the live preview: crop and focus, filter and light, text boxes on it (real text), blur behind each,
 *   a frame. The original is never touched.
 * - `composeEdited` — the canvas render for Download, matching the preview pixel by pixel where it matters (filters are
 *   applied to the pixels, so every browser downloads the same picture).
 */

const PAPER = "#fbf7f0";

export function EditedImage({
  src,
  natural,
  edits,
  texts,
  className,
  label,
  children,
}: {
  src: string | null;
  natural?: { width: number; height: number } | null;
  edits: ImageEdits;
  texts: TextBox[];
  className?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  const ratio = aspectRatioOf(edits.aspect, natural);
  const shown = texts.filter((t) => t.text.trim());
  const frame = edits.frame;
  return (
    <div
      className={cn(frame === "paper" && "p-[4.5%] shadow-[0_18px_40px_-22px_rgba(40,30,20,0.55)]", frame === "border" && "p-[1.5%] ring-1 ring-ink/10", className)}
      style={frame !== "none" ? { background: frame === "paper" ? PAPER : "#ffffff" } : undefined}
    >
      <div className="relative w-full overflow-hidden bg-surface-muted [container-type:inline-size]" style={{ aspectRatio: String(ratio) }} role={label ? "img" : undefined} aria-label={label}>
        {/* The filter and light as CSS on the picture; the canvas export applies the same numbers to the pixels. */}
        {src ? <CroppedImage src={src} transform={{ zoom: edits.zoom, focalX: edits.focalX, focalY: edits.focalY }} style={filterStyle(edits)} className="transition-[filter] duration-150 motion-reduce:transition-none" /> : null}
        {edits.blurBehind ? shown.map((t) => <BlurBand key={`b${t.id}`} y={t.y} />) : null}
        {shown.map((t) => {
          const o = overlayOf(t);
          return (
            <span key={t.id} className="contents">
              <Shade overlay={o} />
              <OverlayText overlay={o} text={t.text.trim()} aria-hidden={label ? true : undefined} />
            </span>
          );
        })}
        {children}
      </div>
    </div>
  );
}

/** A soft blur of the picture behind a box, so the words read on a busy image. */
export function BlurBand({ y }: { y: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 backdrop-blur-md"
      style={{ top: `${Math.max(0, y - 0.14) * 100}%`, height: "28%", maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)" }}
    />
  );
}

/** The CSS filter for a picture's look, for wrappers that render the `<img>` themselves. */
export const filterStyle = (e: ImageEdits): React.CSSProperties => ({ filter: cssFilter(e) });

/** Canvas render of a picture as shaped, at up to 2400 px wide (never larger than the original's crop). */
export async function composeEdited(canvas: HTMLCanvasElement, img: HTMLImageElement, s: { edits: ImageEdits; texts: TextBox[] }) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const e = s.edits;
  const ratio = aspectRatioOf(e.aspect, { width: iw, height: ih });
  // The largest window of the original with that shape, then the zoom + focus inside it.
  const cw = iw / ih > ratio ? ih * ratio : iw;
  const ch = iw / ih > ratio ? ih : iw / ratio;
  const base = { sx: (iw - cw) / 2, sy: (ih - ch) / 2 };
  const r = cropRect(cw, ch, { zoom: e.zoom, focalX: e.focalX, focalY: e.focalY });
  const w = Math.max(1, Math.round(Math.min(2400, r.sw)));
  const h = Math.max(1, Math.round(w / ratio));
  const inner = document.createElement("canvas");
  inner.width = w;
  inner.height = h;
  const ctx = inner.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, base.sx + r.sx, base.sy + r.sy, r.sw, r.sh, 0, 0, w, h);
  const ops = pixelOps(e);
  if (ops.brightness !== 1 || ops.contrast !== 1 || ops.saturate !== 1 || ops.sepia || ops.tint || ops.lift) {
    const px = ctx.getImageData(0, 0, w, h);
    applyPixelOps(px.data, ops);
    ctx.putImageData(px, 0, 0);
  }
  for (const t of s.texts) {
    const text = t.text.trim();
    if (!text) continue;
    if (e.blurBehind) blurBand(ctx, inner, w, h, t.y);
    await drawWords(ctx, w, h, overlayOf(t), text);
  }
  const m = e.frame === "paper" ? Math.round(w * 0.045) : e.frame === "border" ? Math.round(w * 0.015) : 0;
  canvas.width = w + 2 * m;
  canvas.height = h + 2 * m;
  const out = canvas.getContext("2d")!;
  if (m) {
    out.fillStyle = e.frame === "paper" ? PAPER : "#ffffff";
    out.fillRect(0, 0, canvas.width, canvas.height);
  }
  out.drawImage(inner, m, m);
}

/** A soft blur behind a box: the band scaled down and back up, then feathered at its edges. */
function blurBand(ctx: CanvasRenderingContext2D, inner: HTMLCanvasElement, w: number, h: number, y: number) {
  const by = Math.max(0, Math.round((y - 0.14) * h));
  const bh = Math.min(h - by, Math.round(0.28 * h));
  if (bh <= 4) return;
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(w / 24));
  small.height = Math.max(1, Math.round(bh / 24));
  small.getContext("2d")!.drawImage(inner, 0, by, w, bh, 0, 0, small.width, small.height);
  const band = document.createElement("canvas");
  band.width = w;
  band.height = bh;
  const bctx = band.getContext("2d")!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, w, bh);
  bctx.globalCompositeOperation = "destination-in";
  const g = bctx.createLinearGradient(0, 0, 0, bh);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.3, "rgba(0,0,0,1)");
  g.addColorStop(0.7, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, w, bh);
  ctx.drawImage(band, 0, by);
}
