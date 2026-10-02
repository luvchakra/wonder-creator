"use client";
import { Button, Dialog, DialogContent, Field, Textarea, chipBase, cn } from "@wonder/ui";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { layoutText, type TextPosition, type TextSize } from "@/lib/slide-text-layout";

export type SlideAsset = { id: string; sequence: number; imageUrl: string | null; directionLabel: string | null };
type Look = "shade" | "cream" | "clear";
type Face = "serif" | "sans";
type Style = { position: TextPosition; look: Look; size: TextSize; face: Face };

const INK = "#1f2a44";
const CREAM = "rgba(251, 247, 240, 0.92)";

function family(face: Face) {
  // next/font exposes the loaded families as CSS variables; per-glyph fallback covers Devanagari and other scripts.
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.body).getPropertyValue(face === "serif" ? "--font-playfair" : "--font-inter").trim();
  return face === "serif" ? `${v || '"Playfair Display"'}, Georgia, serif` : `${v || "Inter"}, system-ui, sans-serif`;
}

async function compose(canvas: HTMLCanvasElement, img: HTMLImageElement, text: string, s: Style) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx || !w || !h) return;
  const fam = family(s.face);
  const font = (px: number) => `${s.face === "serif" ? 600 : 700} ${px}px ${fam}`;
  if (text.trim()) await document.fonts?.load(font(48), text).catch(() => undefined);
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  if (!text.trim()) return;
  const measure = (str: string, px: number) => {
    ctx.font = font(px);
    return ctx.measureText(str).width;
  };
  const L = layoutText({ text, width: w, height: h, size: s.size, position: s.position, measure });
  ctx.font = font(L.fontPx);

  if (s.look === "shade") {
    const reach = L.margin * 1.6;
    const from = s.position === "bottom" ? L.top - reach : s.position === "top" ? L.top + L.blockHeight + reach : L.top - reach;
    const to = s.position === "bottom" ? h : s.position === "top" ? 0 : L.top + L.blockHeight + reach;
    if (s.position === "center") {
      const g = ctx.createLinearGradient(0, from, 0, to);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.25, "rgba(0,0,0,0.5)");
      g.addColorStop(0.75, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, from, w, to - from);
    } else {
      const g = ctx.createLinearGradient(0, from, 0, to);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(from, to), w, Math.abs(to - from));
    }
  } else if (s.look === "cream") {
    const widest = Math.max(...L.lines.map((l) => ctx.measureText(l).width));
    const pad = L.fontPx * 0.55;
    const bw = widest + pad * 2;
    const bh = L.blockHeight + pad * 1.4;
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.roundRect(L.centerX - bw / 2, L.top - pad * 0.7, bw, bh, Math.min(pad, 28));
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = s.look === "cream" ? INK : "#ffffff";
  if (s.look !== "cream") {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = L.fontPx * (s.look === "clear" ? 0.35 : 0.2);
    ctx.shadowOffsetY = L.fontPx * 0.04;
  }
  L.lines.forEach((line, i) => ctx.fillText(line, L.centerX, L.top + i * L.lineHeight + L.lineHeight / 2));
  ctx.shadowColor = "transparent";
}

/** A compact, upload-safe encoding: WebP where the browser can make it, else JPEG. */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const as = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
  const webp = await as("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await as("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(chipBase, value === v ? "bg-navy text-white" : "bg-surface-muted text-ink-muted hover:text-ink")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * Put words on slide visuals (docs/image-generation.md §61). The image model never draws text — it renders scripts
 * like Devanagari poorly — so the words are set here, in the creator's browser, with their own fonts. Each slide starts
 * with its line from the Carousel; the look is shared across slides so the set stays consistent. The finished image is
 * downloaded, or kept as a Material with provenance (the source image and the exact words).
 */
export function SlideTextDialog({
  open,
  onOpenChange,
  generationId,
  assets,
  startAt,
  prefill,
  creationId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  generationId: string;
  assets: SlideAsset[];
  startAt: number;
  prefill: (a: SlideAsset) => string;
  creationId?: string;
}) {
  const [index, setIndex] = useState(startAt);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [style, setStyle] = useState<Style>({ position: "bottom", look: "shade", size: "m", face: "serif" });
  const [img, setImg] = useState<{ id: string; el: HTMLImageElement } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, { materialId: string; text: string }>>({});
  const canvas = useRef<HTMLCanvasElement>(null);

  const asset = assets[Math.min(index, assets.length - 1)]!;
  const text = texts[asset.id] ?? prefill(asset);
  const loaded = img?.id === asset.id ? img.el : null;
  // Saved only while the words are the ones that were kept; edit them and it can be kept again.
  const keptAs = saved[asset.id]?.text === text.trim() ? saved[asset.id]!.materialId : null;

  // Load the full image for this slide, readable by the canvas (the storage URL allows cross-origin reads).
  useEffect(() => {
    if (!open || !asset.imageUrl) return;
    let live = true;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.decoding = "async";
    el.onload = () => live && setImg({ id: asset.id, el });
    el.onerror = () => live && setFailed(asset.id);
    el.src = asset.imageUrl;
    return () => {
      live = false;
    };
  }, [open, asset.id, asset.imageUrl]);

  useEffect(() => {
    if (!loaded || !canvas.current) return;
    let live = true;
    const c = canvas.current;
    const id = requestAnimationFrame(() => {
      if (live) void compose(c, loaded, text, style);
    });
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [loaded, text, style]);

  function go(delta: number) {
    setError(null);
    setIndex((i) => (i + delta + assets.length) % assets.length);
  }

  async function finished() {
    if (!canvas.current || !loaded) throw new Error("not ready");
    await compose(canvas.current, loaded, text, style);
    try {
      return await encode(canvas.current);
    } catch {
      throw new Error("Couldn't prepare this image here. Please try again.");
    }
  }

  async function download() {
    setBusy("download");
    setError(null);
    try {
      const blob = await finished();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `slide-${index + 1}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const blob = await finished();
      const form = new FormData();
      form.set("file", blob, `slide-${index + 1}`);
      form.set("assetId", asset.id);
      form.set("text", text.trim());
      if (creationId) form.set("useInCreation", "true");
      const r = await api<{ materialId: string }>(`/api/v1/image-generations/${generationId}/text`, { method: "POST", body: form });
      setSaved((m) => ({ ...m, [asset.id]: { materialId: r.materialId, text: text.trim() } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const many = assets.length > 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add text" wide>
        <div className="space-y-2.5">
          {many ? (
            <div className="-my-1.5 flex items-center justify-between">
              <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <p className="text-[13px] font-medium text-ink" aria-live="polite">
                Slide {index + 1} of {assets.length}
                {keptAs ? <span className="text-ink-subtle"> · Saved</span> : null}
              </p>
              <button type="button" onClick={() => go(1)} aria-label="Next slide" className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="flex min-h-32 items-center justify-center rounded-xl bg-surface-muted">
            {failed === asset.id || !asset.imageUrl ? (
              <p className="p-4 text-sm text-ink-muted">This image couldn&apos;t be opened for editing.</p>
            ) : (
              <canvas ref={canvas} role="img" aria-label={text.trim() ? `Preview with the words: ${text.trim()}` : "Preview"} className={cn("block h-auto max-h-[34dvh] w-auto max-w-full rounded-xl", !loaded && "invisible")} />
            )}
          </div>

          <Field label="Words on this slide" htmlFor="slide-text">
            <Textarea id="slide-text" rows={2} className="min-h-0" maxLength={280} value={text} onChange={(e) => setTexts((t) => ({ ...t, [asset.id]: e.target.value }))} />
          </Field>

          <div className="-mx-5 space-y-1 overflow-x-auto px-5">
            <Choice label="Position" value={style.position} options={[["top", "Top"], ["center", "Centre"], ["bottom", "Bottom"]]} onChange={(position) => setStyle((s) => ({ ...s, position }))} />
            <Choice label="Look" value={style.look} options={[["shade", "Shade"], ["cream", "Cream band"], ["clear", "Clear"]]} onChange={(look) => setStyle((s) => ({ ...s, look }))} />
            <div className="flex items-center gap-3">
              <Choice label="Size" value={style.size} options={[["s", "S"], ["m", "M"], ["l", "L"]]} onChange={(size) => setStyle((s) => ({ ...s, size }))} />
              <span aria-hidden className="h-5 w-px bg-border-soft" />
              <Choice label="Font" value={style.face} options={[["serif", "Serif"], ["sans", "Sans"]]} onChange={(face) => setStyle((s) => ({ ...s, face }))} />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {keptAs ? (
            <p role="status" className="text-sm text-ink-muted">
              {creationId ? "Added to this Creation's references. " : "Saved to your Materials. "}
              <a href={`/materials/${keptAs}`} className="font-medium text-accent-ink hover:underline">
                Open Material
              </a>
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-border-soft bg-surface px-5 py-2">
            <Button variant="ghost" size="sm" onClick={download} loading={busy === "download"} disabled={!loaded || busy !== null}>
              <Download className="size-4" aria-hidden /> Download
            </Button>
            <Button size="sm" onClick={save} loading={busy === "save"} disabled={!loaded || !text.trim() || busy !== null || Boolean(keptAs)}>
              {creationId ? "Add to this Creation" : "Save as Material"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
