"use client";
import { useMiniPlayerConstraint } from "@/components/soundtrack/audio-provider";
import type { CarouselView, SlideView } from "@wonder/creator-brain";
import { DEFAULT_TRANSFORM, OVERLAY_COLORS, OVERLAY_FONTS, SNAP_POINTS, snapPosition, type ImageTransform, type SlideOverlay } from "@wonder/creator-studio/carousel";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, Switch, Textarea, chipBase, cn } from "@wonder/ui";
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronLeft, ChevronRight, Copy, Download, Expand, Image as ImageIcon, MoreHorizontal, Palette, RefreshCw, Save, Scissors, Shuffle, Trash2, Type, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { OverlayText, SlideFrame, composeSlide, encodeCanvas, loadImage } from "@/components/carousel/slide-render";
import { api, errorMessage } from "@/lib/client";
import { RegenerateSheet } from "../../carousel/composer";

type Tool = "text" | "style" | "image" | null;

/**
 * The Slide Editor (carousel-composer.md §13–27, §51). The image leads; one tool at a time reveals its controls.
 * Read mode (no tool): the words are plain selectable text and a swipe moves between slides. Edit mode (a tool open):
 * the overlay can be dragged — with snapping and keyboard nudges — and nothing else competes for the gesture (§14, §43).
 * Every change autosaves (§34).
 */
export function SlideEditor({ artifactId, slideId, initial }: { artifactId: string; slideId: string; initial: CarouselView }) {
  const router = useRouter();
  const strip = useStripSignal();
  // Full-screen editing: the mini player stays a slim tab (music keeps playing; mini-player.md §32).
  useMiniPlayerConstraint({ forceCollapsed: true });
  const [view, setView] = useState(initial);
  const index = Math.max(0, view.slides.findIndex((s) => s.id === slideId));
  const server = view.slides[index]!;
  const [slide, setSlide] = useState<SlideView>(server);
  const [tool, setTool] = useState<Tool>(null);
  const [error, setError] = useState<string | null>(null);
  const [regen, setRegen] = useState(false);
  const [full, setFull] = useState(false);
  const [preview, setPreview] = useState<"current" | "new">("new");
  const aspect = view.settings?.aspectRatio ?? "4:5";
  const ratio = aspect === "1:1" ? 1 : aspect === "16:9" ? 16 / 9 : 0.8;
  const total = view.slides.length;
  const overlayText = slide.overlay.text ?? slide.displayText;

  const refresh = useCallback(async () => {
    try {
      const v = await api<CarouselView>(`/api/v1/carousels/${artifactId}`);
      setView(v);
      const s = v.slides.find((x) => x.id === slideId);
      // Keep local edits; take the server's images and change state.
      if (s) setSlide((cur) => ({ ...cur, image: s.image, pending: s.pending, change: s.change }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [artifactId, slideId]);
  const busy = !!slide.change && slide.change.status !== "failed";
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  // Autosave: the latest words / overlay / crop go out after a short pause (§34); the navbar says Saving… / Saved.
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    strip("save", { text: "Saving…", tone: "active" });
    try {
      await api(`/api/v1/carousel-slides/${slideId}`, { method: "PATCH", json: patch });
      strip("save", { text: "Saved", tone: "success", ttl: 1500 });
    } catch (e) {
      strip("save", { text: "Couldn't save", tone: "error" });
      setError(errorMessage(e));
    }
  }, [slideId, strip]);
  const save = useCallback(
    (patch: { displayText?: string; sourceText?: string; overlay?: SlideOverlay; transform?: ImageTransform }) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );
  useEffect(() => {
    strip("slide", { text: busy ? `Regenerating slide ${index + 1}…` : `Slide ${index + 1} of ${total}`, tone: busy ? "active" : "neutral", priority: 5.5 });
    return () => strip("slide", null);
  }, [index, total, busy, strip]);

  const setOverlay = (patch: Partial<SlideOverlay>) =>
    setSlide((s) => {
      const overlay = { ...s.overlay, ...patch };
      save({ overlay });
      return { ...s, overlay };
    });
  const setTransform = (patch: Partial<ImageTransform>) =>
    setSlide((s) => {
      const transform = { ...s.transform, ...patch };
      save({ transform });
      return { ...s, transform };
    });
  const setText = (displayText: string) =>
    setSlide((s) => {
      save({ displayText });
      return { ...s, displayText };
    });

  const go = (to: number) => {
    const next = view.slides[(to + total) % total];
    if (next && next.id !== slideId) router.replace(`/artifacts/${artifactId}/slides/${next.id}`);
  };

  // Gestures on the image: read mode swipes between slides; Image mode drags the focal point; Text/Style drag the words.
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "swipe" | "focal" | "text" | "width"; x: number; y: number; start: SlideOverlay | ImageTransform } | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const onPointerDown = (e: React.PointerEvent, kind: "swipe" | "focal" | "text" | "width") => {
    if (!view.canEdit && kind !== "swipe") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, start: kind === "focal" ? slide.transform : slide.overlay };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.x) / box.width;
    const dy = (e.clientY - d.y) / box.height;
    if (d.kind === "text") {
      const o = d.start as SlideOverlay;
      const p = snapPosition(o.x + dx, o.y + dy);
      setGuide(p.snapped);
      setSlide((s) => ({ ...s, overlay: { ...s.overlay, x: p.x, y: p.y } }));
    } else if (d.kind === "width") {
      const o = d.start as SlideOverlay;
      setSlide((s) => ({ ...s, overlay: { ...s.overlay, width: Math.min(1, Math.max(0.3, o.width + dx * 2)) } }));
    } else if (d.kind === "focal") {
      const t = d.start as ImageTransform;
      const z = t.zoom || 1;
      setSlide((s) => ({ ...s, transform: { ...s.transform, focalX: Math.min(1, Math.max(0, t.focalX - dx / z)), focalY: Math.min(1, Math.max(0, t.focalY - dy / z)) } }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setGuide(null);
    if (!d) return;
    if (d.kind === "swipe") {
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - d.y)) go(index + (dx < 0 ? 1 : -1));
      return;
    }
    if (d.kind === "focal") save({ transform: slide.transform });
    else save({ overlay: slide.overlay });
  };
  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = m[e.key];
    if (!v) return;
    e.preventDefault();
    const p = snapPosition(slide.overlay.x + v[0], slide.overlay.y + v[1], 0);
    setOverlay({ x: p.x, y: p.y });
  };

  const [working, setWorking] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  async function composed(): Promise<Blob> {
    const src = slide.image?.url;
    if (!src) throw new Error("This slide has no image yet.");
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    await composeSlide(canvas, img, { overlay: { ...slide.overlay, text: null }, text: overlayText, transform: slide.transform, aspect });
    try {
      return await encodeCanvas(canvas);
    } catch {
      throw new Error("Couldn't prepare this image here. Please try again.");
    }
  }
  async function run(label: string, fn: () => Promise<void>) {
    setWorking(label);
    setError(null);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
  const download = () =>
    run("download", async () => {
      const blob = await composed();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slide-${index + 1}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  const saveMaterial = () =>
    run("material", async () => {
      await flush();
      const blob = await composed();
      const form = new FormData();
      form.set("file", blob, `slide-${index + 1}`);
      form.set("text", (overlayText || slide.displayText || `Slide ${index + 1}`).slice(0, 500));
      const r = await api<{ materialId: string }>(`/api/v1/carousel-slides/${slideId}/material`, { method: "POST", body: form });
      setStatus(r.materialId);
    });
  const postAndGo = (path: string, init: RequestInit & { json?: unknown } = { method: "POST" }, to?: (r: { slideId?: string }) => string) =>
    run(path, async () => {
      await flush();
      const r = await api<{ slideId?: string }>(path, init);
      router.replace(to ? to(r) : `/artifacts/${artifactId}`);
      router.refresh();
    });

  const shown = slide.pending && preview === "new" ? slide.pending.url : slide.image?.url;

  return (
    <div className="-mx-4 -mt-6 flex min-h-[calc(100dvh-4.5rem-var(--palette-clearance))] flex-col bg-[#15161c] px-3 pb-3 pt-1 text-white sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-5">
      {/* Header: back · n of N · More (§51). */}
      <div className="flex items-center justify-between">
        <Link href={`/artifacts/${artifactId}`} aria-label="Back to slides" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <p className="text-sm font-medium">
          {index + 1} of {total}
        </p>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label="More for this slide" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setFull(true)}>
              <Expand className="size-4" aria-hidden /> View full screen
            </MenuItem>
            {slide.image ? (
              <>
                <MenuItem onSelect={saveMaterial}>
                  <Save className="size-4" aria-hidden /> Save to Materials
                </MenuItem>
                <MenuItem onSelect={download}>
                  <Download className="size-4" aria-hidden /> Download
                </MenuItem>
              </>
            ) : null}
            {view.canEdit ? (
              <>
                <MenuItem onSelect={() => postAndGo(`/api/v1/carousel-slides/${slideId}/duplicate`, { method: "POST" }, (r) => `/artifacts/${artifactId}/slides/${r.slideId}`)}>
                  <Copy className="size-4" aria-hidden /> Duplicate slide
                </MenuItem>
                {total > 1 ? (
                  <MenuItem destructive onSelect={() => postAndGo(`/api/v1/carousel-slides/${slideId}`, { method: "DELETE" })}>
                    <Trash2 className="size-4" aria-hidden /> Remove slide
                  </MenuItem>
                ) : null}
              </>
            ) : null}
          </MenuContent>
        </Menu>
      </div>

      {/* The image leads (§13). */}
      <div className="flex flex-1 items-center justify-center py-2">
        <div
          ref={frame}
          className={cn("relative w-full touch-pan-y", tool === "image" && "touch-none cursor-move")}
          // The image fits the space left by the controls, so it stays in view while editing (§13).
          style={{ maxWidth: `min(28rem, calc((100dvh - ${tool ? 34 : 20}rem) * ${ratio}))` }}
          onPointerDown={(e) => onPointerDown(e, tool === "image" ? "focal" : "swipe")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
        >
          <SlideFrame image={shown ?? null} overlay={slide.overlay} text={overlayText} transform={slide.pending && preview === "new" ? DEFAULT_TRANSFORM : slide.transform} aspect={aspect} className="rounded-2xl">
            {slide.overlay.enabled && overlayText.trim() ? (
              <OverlayText
                overlay={slide.overlay}
                text={overlayText}
                selected={tool === "text" || tool === "style"}
                tabIndex={tool === "text" || tool === "style" ? 0 : undefined}
                role={tool === "text" || tool === "style" ? "application" : undefined}
                aria-label={tool ? "Words on the image. Drag, or use the arrow keys, to move them." : undefined}
                onKeyDown={tool ? nudge : undefined}
                onPointerDown={tool === "text" || tool === "style" ? (e) => onPointerDown(e, "text") : undefined}
                className={cn(tool === "text" || tool === "style" ? "cursor-grab touch-none select-none" : "select-text")}
              />
            ) : null}
            {(tool === "text" || tool === "style") && slide.overlay.enabled ? (
              <span
                aria-hidden
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-accent"
                style={{ left: `${(slide.overlay.x + slide.overlay.width / 2) * 100}%`, top: `${slide.overlay.y * 100}%` }}
                onPointerDown={(e) => onPointerDown(e, "width")}
              />
            ) : null}
            {guide ? (
              <>
                <span aria-hidden className="pointer-events-none absolute inset-[6%] rounded-lg border border-dashed border-white/40" />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/40" />
              </>
            ) : null}
            {busy ? (
              <span role="status" className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-[13px]">
                Regenerating this image…
              </span>
            ) : null}
          </SlideFrame>
        </div>
      </div>

      {/* A regenerated image waits beside the current one: Use new / Keep current (§27). */}
      {slide.pending && view.isOwner ? (
        <div className="mb-2 space-y-2 rounded-2xl bg-white/5 p-2">
          <div role="radiogroup" aria-label="Compare images" className="flex justify-center gap-1.5">
            {(["current", "new"] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={preview === p} onClick={() => setPreview(p)} className={cn(chipBase, preview === p ? "bg-white text-navy" : "bg-white/10 text-white")}>
                {p === "current" ? "Current image" : "New image"}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" loading={working === "keep"} onClick={() => run("keep", async () => { await api(`/api/v1/carousel-slides/${slideId}/choose`, { method: "POST", json: { choice: "keep" } }); setSlide((s) => ({ ...s, pending: null })); setPreview("new"); })}>
              Keep current
            </Button>
            <Button size="sm" loading={working === "use"} onClick={() => run("use", async () => { await api(`/api/v1/carousel-slides/${slideId}/choose`, { method: "POST", json: { choice: "use" } }); await refresh(); setSlide((s) => ({ ...s, transform: DEFAULT_TRANSFORM })); save({ transform: DEFAULT_TRANSFORM }); setPreview("new"); })}>
              Use new
            </Button>
          </div>
        </div>
      ) : null}
      {slide.change?.status === "failed" ? (
        <p className="mb-2 text-center text-[13px] text-white/80">
          Couldn&apos;t regenerate this slide.{" "}
          <button type="button" className="min-h-11 font-medium underline" onClick={() => setRegen(true)}>
            Try again
          </button>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-2 text-center text-sm text-[#fca5a5]">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="mb-2 text-center text-[13px] text-white/80">
          Saved to your Materials.{" "}
          <Link href={`/space/materials/${status}`} className="font-medium underline">
            Open Material
          </Link>
        </p>
      ) : null}

      {/* The one open tool's controls (§13: advanced controls only after a tool is chosen). */}
      {tool && view.canEdit ? (
        <div className="mb-2 rounded-2xl bg-surface p-3 text-ink">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[15px] font-semibold">{tool === "text" ? "Text" : tool === "style" ? "Style" : "Image"}</p>
            <button type="button" aria-label="Close" onClick={() => setTool(null)} className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {tool === "text" ? (
            <TextTool
              slide={slide}
              setText={setText}
              setOverlay={setOverlay}
              save={save}
              setSlide={setSlide}
              slideId={slideId}
              splitting={working === "split"}
              onSplit={() =>
                run("split", async () => {
                  await flush();
                  await api(`/api/v1/carousel-slides/${slideId}/split`, { method: "POST" });
                  // Stay on this slide (now the first part); the new slide follows it.
                  const v = await api<CarouselView>(`/api/v1/carousels/${artifactId}`);
                  setView(v);
                  const s = v.slides.find((x) => x.id === slideId);
                  if (s) setSlide(s);
                })
              }
            />
          ) : null}
          {tool === "style" ? <StyleTool overlay={slide.overlay} setOverlay={setOverlay} /> : null}
          {tool === "image" ? (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="flex justify-between">
                  Zoom <span className="text-ink-subtle">{slide.transform.zoom.toFixed(1)}×</span>
                </span>
                <input type="range" min={1} max={3} step={0.05} value={slide.transform.zoom} onChange={(e) => setTransform({ zoom: Number(e.target.value) })} className="h-11 w-full accent-[var(--color-accent)]" />
              </label>
              <p className="text-xs text-ink-subtle">Drag the image to move what&apos;s in focus.</p>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Focus">
                {(
                  [
                    ["Top", 0.5, 0.2],
                    ["Centre", 0.5, 0.5],
                    ["Bottom", 0.5, 0.8],
                  ] as const
                ).map(([l, fx, fy]) => (
                  <button key={l} type="button" onClick={() => setTransform({ focalX: fx, focalY: fy })} className={cn(chipBase, "justify-center bg-surface-muted text-ink-muted")}>
                    Focus {l.toLowerCase()}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTransform(DEFAULT_TRANSFORM)}>
                <Undo2 className="size-4" aria-hidden /> Reset
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Tool rail: only the core categories (§47). */}
      {view.canEdit ? (
        <div role="toolbar" aria-label="Edit slide" className="grid grid-cols-4 gap-1">
          {(
            [
              ["text", "Text", Type],
              ["style", "Style", Palette],
              ["image", "Image", ImageIcon],
            ] as const
          ).map(([t, label, Icon]) => (
            <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool((cur) => (cur === t ? null : t))} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[12px]", tool === t ? "bg-white/15" : "hover:bg-white/10")}>
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          ))}
          {view.isOwner ? (
            <button type="button" onClick={() => setRegen(true)} disabled={busy} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className="size-5" aria-hidden />
              Regenerate
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Slides strip (§13). */}
      <nav aria-label="Slides" className="mt-2 flex items-center gap-1">
        <button type="button" aria-label="Previous slide" onClick={() => go(index - 1)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <ol className="flex flex-1 justify-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
          {view.slides.map((s, i) => (
            <li key={s.id}>
              <Link href={`/artifacts/${artifactId}/slides/${s.id}`} replace aria-current={s.id === slideId ? "true" : undefined} aria-label={`Slide ${i + 1}`} className={cn("block size-11 overflow-hidden rounded-lg border-2", s.id === slideId ? "border-white" : "border-transparent opacity-70")}>
                {s.image?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center bg-white/10 text-xs">{i + 1}</span>
                )}
              </Link>
            </li>
          ))}
        </ol>
        <button type="button" aria-label="Next slide" onClick={() => go(index + 1)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </nav>
      <Link href={`/artifacts/${artifactId}`} onClick={() => void flush()} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-white text-sm font-medium text-navy">
        <Check className="mr-1.5 size-4" aria-hidden /> Done
      </Link>

      {regen ? <RegenerateSheet slide={slide} index={index} onClose={() => setRegen(false)} onQueued={refresh} /> : null}
      {full ? (
        <div role="dialog" aria-modal="true" aria-label={`Slide ${index + 1}, full screen`} className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setFull(false)} onKeyDown={(e) => e.key === "Escape" && setFull(false)}>
          <button type="button" autoFocus aria-label="Close full screen" onClick={() => setFull(false)} className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white">
            <X className="size-5" aria-hidden />
          </button>
          <SlideFrame image={slide.image?.url ?? null} overlay={slide.overlay} text={overlayText} transform={slide.transform} aspect={aspect} className="max-h-[100dvh] w-full max-w-[min(100vw,calc(100dvh*0.8))]" />
        </div>
      ) : null}
    </div>
  );
}

function TextTool({
  slide,
  setText,
  setOverlay,
  save,
  setSlide,
  slideId,
  onSplit,
  splitting,
}: {
  slide: SlideView;
  setText: (t: string) => void;
  setOverlay: (p: Partial<SlideOverlay>) => void;
  save: (p: { displayText?: string; sourceText?: string; overlay?: SlideOverlay }) => void;
  setSlide: React.Dispatch<React.SetStateAction<SlideView>>;
  slideId: string;
  onSplit: () => void;
  splitting: boolean;
}) {
  const [alts, setAlts] = useState<string[] | null>(null);
  const [altAt, setAltAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const separate = slide.overlay.text != null;
  const lines = useMemo(() => slide.displayText.split("\n").length, [slide.displayText]);
  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className="flex items-baseline justify-between text-sm font-medium">
          Words for this slide <span className="text-xs font-normal text-ink-subtle">{slide.displayText.length} / 2000</span>
        </span>
        <Textarea rows={Math.min(5, Math.max(2, lines))} className="mt-1 min-h-0 font-display" maxLength={2000} value={slide.displayText} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm">Place on image</span>
        <Switch checked={slide.overlay.enabled} onCheckedChange={(v) => setOverlay({ enabled: v })} label="Place on image" />
      </div>
      {slide.overlay.enabled ? (
        <>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm">
              Same words on the image
              <span className="block text-xs text-ink-subtle">Turn off to show different words on the image</span>
            </span>
            <Switch checked={!separate} onCheckedChange={(same) => setOverlay({ text: same ? null : slide.displayText })} label="Same words on the image" />
          </div>
          {separate ? <Textarea aria-label="Words on the image" rows={2} className="min-h-0 font-display" maxLength={2000} value={slide.overlay.text ?? ""} onChange={(e) => setOverlay({ text: e.target.value })} /> : null}
        </>
      ) : null}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        <button
          type="button"
          className={cn(chipBase, "gap-1 bg-surface-muted text-ink")}
          disabled={loading}
          onClick={async () => {
            if (!alts) {
              setLoading(true);
              try {
                const r = await api<{ chunks: string[] }>(`/api/v1/carousel-slides/${slideId}/suggestions`);
                setAlts(r.chunks);
                if (r.chunks[0]) {
                  setSlide((s) => ({ ...s, displayText: r.chunks[0]!, sourceText: r.chunks[0]! }));
                  save({ displayText: r.chunks[0], sourceText: r.chunks[0] });
                }
                setAltAt(1);
              } finally {
                setLoading(false);
              }
              return;
            }
            if (!alts.length) return;
            const next = alts[altAt % alts.length]!;
            setAltAt((i) => i + 1);
            setSlide((s) => ({ ...s, displayText: next, sourceText: next }));
            save({ displayText: next, sourceText: next });
          }}
        >
          <Shuffle className="size-3.5" aria-hidden /> Suggest another chunk
        </button>
        <button type="button" className={cn(chipBase, "gap-1 bg-surface-muted text-ink")} disabled={splitting} onClick={onSplit}>
          <Scissors className="size-3.5" aria-hidden /> Split into two slides
        </button>
        {slide.displayText !== slide.sourceText && slide.sourceText ? (
          <button type="button" className={cn(chipBase, "gap-1 bg-surface-muted text-ink")} onClick={() => setText(slide.sourceText)}>
            <Undo2 className="size-3.5" aria-hidden /> Use original words
          </button>
        ) : null}
      </div>
      {alts && !alts.length ? <p className="text-xs text-ink-subtle">No other words to suggest from the source.</p> : null}
    </div>
  );
}

function StyleTool({ overlay, setOverlay }: { overlay: SlideOverlay; setOverlay: (p: Partial<SlideOverlay>) => void }) {
  if (!overlay.enabled) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">The words aren&apos;t on the image yet.</span>
        <Button size="sm" variant="secondary" onClick={() => setOverlay({ enabled: true })}>
          Place on image
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Font" className="grid grid-cols-4 gap-1.5">
        {OVERLAY_FONTS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={overlay.font === f.value} onClick={() => setOverlay({ font: f.value })} className={cn("flex min-h-12 flex-col items-center justify-center rounded-xl border text-[11.5px]", overlay.font === f.value ? "border-accent bg-accent-softer text-accent-ink" : "border-border-soft text-ink-muted")}>
            <span className={cn("text-lg leading-none text-ink", f.value === "modern" ? "font-sans font-semibold" : f.value === "handwritten" ? "[font-family:cursive]" : "font-display", f.value === "editorial" && "italic")}>Aa</span>
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Size
          <input type="range" min={0.03} max={0.14} step={0.002} value={overlay.size} onChange={(e) => setOverlay({ size: Number(e.target.value) })} className="h-11 w-full accent-[var(--color-accent)]" />
        </label>
        <label className="block text-sm">
          Width
          <input type="range" min={0.3} max={1} step={0.01} value={overlay.width} onChange={(e) => setOverlay({ width: Number(e.target.value) })} className="h-11 w-full accent-[var(--color-accent)]" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Alignment" className="flex gap-1">
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([a, Icon]) => (
            <button key={a} type="button" role="radio" aria-checked={overlay.align === a} aria-label={`Align ${a}`} onClick={() => setOverlay({ align: a })} className={cn("inline-flex size-11 items-center justify-center rounded-xl", overlay.align === a ? "bg-accent-softer text-accent-ink" : "text-ink-muted")}>
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Colour" className="flex gap-1">
          {OVERLAY_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={overlay.color === c} aria-label={`Colour ${c}`} onClick={() => setOverlay({ color: c })} className="inline-flex size-11 items-center justify-center">
              <span className={cn("size-6 rounded-full border", overlay.color === c ? "ring-2 ring-accent ring-offset-2" : "border-border")} style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Behind the words" className="flex gap-1.5">
          {(
            [
              ["none", "None"],
              ["shade", "Shade"],
              ["band", "Band"],
            ] as const
          ).map(([b, label]) => (
            <button key={b} type="button" role="radio" aria-checked={overlay.background === b} onClick={() => setOverlay({ background: b })} className={cn(chipBase, overlay.background === b ? "bg-navy text-white" : "bg-surface-muted text-ink-muted")}>
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Shadow
          <Switch checked={overlay.shadow} onCheckedChange={(v) => setOverlay({ shadow: v })} label="Shadow" />
        </label>
      </div>
      <div>
        <p className="mb-1 text-sm">Position</p>
        <div role="group" aria-label="Position" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {SNAP_POINTS.map((p) => (
            <button key={p.label} type="button" aria-pressed={overlay.x === p.x && overlay.y === p.y} onClick={() => setOverlay({ x: p.x, y: p.y, align: p.x < 0.5 ? "left" : p.x > 0.5 ? "right" : "center" })} className={cn(chipBase, overlay.x === p.x && overlay.y === p.y ? "bg-navy text-white" : "bg-surface-muted text-ink-muted")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
