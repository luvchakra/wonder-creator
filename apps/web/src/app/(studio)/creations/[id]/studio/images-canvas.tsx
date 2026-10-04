"use client";
import { OVERLAY_COLORS, OVERLAY_FONTS, type SlideOverlay } from "@wonder/creator-studio/carousel";
import {
  ASPECT_LABEL,
  DEFAULT_EDITS,
  DEFAULT_WORDS,
  FILTER_LABEL,
  FRAME_LABEL,
  IMAGE_ASPECTS,
  IMAGE_FILTERS,
  IMAGE_FRAMES,
  MAX_IMAGES,
  aspectRatioOf,
  cssFilter,
  type CreationImage,
  type ImageEdits,
  type ImageSet,
} from "@wonder/creator-studio/images";
import { Button, Dialog, DialogContent, KIT, KitArt, Segmented, Switch, cn } from "@wonder/ui";
import { ArrowDown, ArrowUp, Camera, Download, ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadImage } from "@/components/carousel/slide-render";
import { EditedImage, composeEdited } from "@/components/images/edited-image";
import { VisualDirections } from "@/components/visual-directions";
import { api, errorMessage } from "@/lib/client";
import { sendToCreator } from "@/lib/send";

/**
 * The Images page's canvas (creation-pages.md, step 2): the picture is the work. Edit (crop, focus, filter, light, blur
 * behind the words, frame) is the page's primary action; Words and Download are its two secondaries; adding, arranging and
 * captions live in More. Every Keep is a new version; the original pictures are never changed.
 */

export interface Picture {
  url: string | null;
  width: number | null;
  height: number | null;
  title: string | null;
}
export type ImagesRequest = { kind: "edit" | "words" | "download" | "add" | "arrange"; n: number } | null;

export function ImagesCanvas({
  artifactId,
  title,
  set: initialSet,
  pictures,
  baseVersionId,
  request,
  onKept,
}: {
  artifactId: string;
  title: string;
  set: ImageSet;
  pictures: Record<string, Picture>;
  baseVersionId: string | null;
  request: ImagesRequest;
  onKept: (v: { id: string; version_number: number; content: string }) => void;
}) {
  const router = useRouter();
  const [set, setSet] = useState(initialSet);
  const [base, setBase] = useState(baseVersionId);
  // A refreshed page (another device, a restore) brings a newer version: show it.
  const [seenBase, setSeenBase] = useState(baseVersionId);
  if (baseVersionId !== seenBase) {
    setSeenBase(baseVersionId);
    setBase(baseVersionId);
    setSet(initialSet);
  }
  const [at, setAt] = useState(0);
  const index = Math.min(at, Math.max(0, set.items.length - 1));
  const item = set.items[index] ?? null;
  const pic = item ? pictures[item.materialId] : null;

  const [sheet, setSheet] = useState<null | "edit" | "words" | "download" | "add" | "arrange">(null);
  const [seenReq, setSeenReq] = useState(request?.n ?? 0);
  if (request && request.n !== seenReq) {
    setSeenReq(request.n);
    setSheet(request.kind === "edit" || request.kind === "words" || request.kind === "download" ? (item ? request.kind : "add") : request.kind);
  }

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function keep(next: ImageSet, label?: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/images`, { method: "POST", json: { set: next, baseVersionId: base, label } });
      setSet(next);
      setBase(r.version.id);
      setSeenBase(r.version.id);
      onKept(r.version);
      setSheet(null);
      router.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const replaceAt = (i: number, patch: Partial<CreationImage>): ImageSet => ({ kind: "images", items: set.items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  async function add(materialId: string) {
    if (set.items.some((x) => x.materialId === materialId)) {
      setAt(set.items.findIndex((x) => x.materialId === materialId));
      setSheet(null);
      return;
    }
    const next: ImageSet = { kind: "images", items: [...set.items, { materialId, caption: "", edits: DEFAULT_EDITS, words: DEFAULT_WORDS }] };
    if (await keep(next, set.items.length ? "Added a picture" : "First picture")) setAt(next.items.length - 1);
  }

  return (
    <div className="relative flex h-[calc(100dvh-var(--nav-height)-var(--canvas-extra)-9.75rem)] min-h-[22rem] flex-col bg-[#f2ece3]" style={{ backgroundImage: `url(${KIT.texture.texturePaper.svg})`, backgroundSize: "512px" }}>
      {error ? (
        <p role="alert" className="m-3 rounded-2xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {item ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
            <figure className="flex max-h-full w-full flex-col items-center" style={{ maxWidth: `min(34rem, calc(56dvh * ${aspectRatioOf(item.edits.aspect, pic?.width && pic?.height ? { width: pic.width, height: pic.height } : null).toFixed(3)}))` }}>
              <EditedImage
                src={pic?.url ?? null}
                natural={pic?.width && pic?.height ? { width: pic.width, height: pic.height } : null}
                edits={item.edits}
                words={item.words}
                label={item.caption || pic?.title || title || "Picture"}
                className="w-full max-w-full rounded-sm shadow-[0_22px_50px_-30px_rgba(40,30,20,0.6)]"
              />
              {item.caption ? <figcaption className="mt-3 max-w-[30rem] text-center font-display text-[15px] italic leading-snug text-ink-muted">{item.caption}</figcaption> : null}
            </figure>
          </div>
          {set.items.length > 1 ? (
            <ul aria-label="Pictures" className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
              {set.items.map((x, k) => (
                <li key={x.materialId}>
                  <button
                    type="button"
                    aria-current={k === index ? "true" : undefined}
                    aria-label={`Picture ${k + 1} of ${set.items.length}`}
                    onClick={() => setAt(k)}
                    className={cn("block size-11 overflow-hidden rounded-lg ring-offset-2 ring-offset-[#f2ece3]", k === index ? "ring-2 ring-accent" : "opacity-75 hover:opacity-100")}
                  >
                    {pictures[x.materialId]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pictures[x.materialId]!.url!} alt="" className="size-full object-cover" style={{ filter: cssFilter(x.edits) }} />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        // Empty: one short line and the ways to bring the first picture.
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <KitArt art={KIT.iconChip.image} sizes="3.5rem" className="size-14" />
          <p className="font-display text-[22px] leading-tight text-ink">Begin with a picture</p>
          <p className="max-w-xs text-[13.5px] text-ink-muted">Take one, choose one of yours, or let CreativeMind make one from what this is about.</p>
          <AddChoices artifactId={artifactId} busy={busy} onAdd={add} onError={setError} />
        </div>
      )}

      <EditSheet open={sheet === "edit" && !!item} onOpenChange={(o) => !o && setSheet(null)} item={item} pic={pic} busy={busy} onKeep={(edits) => void keep(replaceAt(index, { edits }), "Edited")} />
      <WordsSheet open={sheet === "words" && !!item} onOpenChange={(o) => !o && setSheet(null)} item={item} pic={pic} busy={busy} onKeep={(words) => void keep(replaceAt(index, { words }), words.enabled ? "Words on the picture" : "Words removed")} />
      <DownloadSheet open={sheet === "download" && !!item} onOpenChange={(o) => !o && setSheet(null)} item={item} pic={pic} title={title} index={index} />
      <Dialog open={sheet === "add"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent title="Add a picture" description="It joins this Creation; the original stays as it is." art={KIT.iconChip.image}>
          {sheet === "add" ? (set.items.length >= MAX_IMAGES ? <p className="text-sm text-ink-muted">This Creation holds {MAX_IMAGES} pictures at most.</p> : <AddChoices artifactId={artifactId} busy={busy} onAdd={add} onError={setError} expanded />) : null}
        </DialogContent>
      </Dialog>
      <ArrangeSheet open={sheet === "arrange"} onOpenChange={(o) => !o && setSheet(null)} set={set} pictures={pictures} busy={busy} onKeep={(next) => void keep(next, "Arranged")} />
    </div>
  );
}

/** Three ways to bring a picture: the camera (with the phone's own settings), your pictures, or CreativeMind. */
function AddChoices({ artifactId, busy, onAdd, onError, expanded }: { artifactId: string; busy: boolean; onAdd: (materialId: string) => Promise<void>; onError: (e: string | null) => void; expanded?: boolean }) {
  const camera = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<null | "mine" | "make">(expanded ? "mine" : null);
  const [taking, setTaking] = useState(false);
  async function take(file: File | undefined) {
    if (!file) return;
    setTaking(true);
    onError(null);
    try {
      const r = await sendToCreator({ files: [file], kind: "camera" });
      const id = r.accepted[0]?.materialId;
      if (!id) throw new Error(r.rejected[0]?.message ?? "We couldn't save that picture.");
      await onAdd(id);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setTaking(false);
    }
  }
  const pill = "inline-flex min-h-11 items-center";
  const face = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3.5 text-[13px] font-medium text-ink shadow-[var(--shadow-card)] hover:bg-accent-softer";
  return (
    <div className="w-full max-w-md space-y-3">
      <div className="flex flex-wrap justify-center gap-1.5">
        <button type="button" disabled={busy || taking} onClick={() => camera.current?.click()} className={pill}>
          <span className={face}>
            <Camera className="size-4 text-accent" aria-hidden /> {taking ? "Saving…" : "Take a picture"}
          </span>
        </button>
        <button type="button" aria-pressed={view === "mine"} onClick={() => setView(view === "mine" ? null : "mine")} className={pill}>
          <span className={cn(face, view === "mine" && "border-accent bg-accent-softer")}>
            <ImagePlus className="size-4 text-accent" aria-hidden /> Your pictures
          </span>
        </button>
        <button type="button" aria-pressed={view === "make"} onClick={() => setView(view === "make" ? null : "make")} className={pill}>
          <span className={cn(face, view === "make" && "border-accent bg-accent-softer")}>
            <Sparkles className="size-4 text-accent" aria-hidden /> Make one
          </span>
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture className="sr-only" tabIndex={-1} aria-label="Take a picture" onChange={(e) => (void take(e.target.files?.[0]), (e.target.value = ""))} />
      {view === "mine" ? <YourPictures busy={busy} onPick={(id) => void onAdd(id)} /> : null}
      {view === "make" ? <VisualDirections creationId={artifactId} purpose="explore" title="Made from this Creation" useLabel="Use this picture" onUse={(id) => onAdd(id)} className="text-left" /> : null}
    </div>
  );
}

function YourPictures({ busy, onPick }: { busy: boolean; onPick: (materialId: string) => void }) {
  const [items, setItems] = useState<Array<{ id: string; title: string | null; previewUrl: string | null }> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ items: Array<{ id: string; title: string | null; previewUrl: string | null }> }>("/api/v1/materials?filter=images")
      .then((r) => live && setItems(r.items.filter((m) => m.previewUrl).slice(0, 24)))
      .catch((e) => live && setFailed(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  if (failed) return <p className="text-sm text-danger">{failed}</p>;
  if (!items) return <p className="text-[13px] text-ink-subtle">Looking for your pictures…</p>;
  if (!items.length) return <p className="text-[13px] text-ink-muted">No pictures yet. A Quick Pic from Home, or a picture brought in, will show here.</p>;
  return (
    <ul className="grid grid-cols-4 gap-1.5" aria-label="Your pictures">
      {items.map((m) => (
        <li key={m.id}>
          <button type="button" disabled={busy} onClick={() => onPick(m.id)} aria-label={`Add ${m.title?.trim() || "this picture"}`} className="block aspect-square w-full overflow-hidden rounded-xl bg-cream-deep focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.previewUrl!} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const TOOLS = [
  { value: "crop", label: "Crop" },
  { value: "focus", label: "Focus" },
  { value: "filter", label: "Filter" },
  { value: "light", label: "Light" },
  { value: "blur", label: "Blur" },
  { value: "frame", label: "Frame" },
] as const;
type Tool = (typeof TOOLS)[number]["value"];

/** Edit: six tools on a live preview; Keep makes a new version, the original stays. */
function EditSheet({ open, onOpenChange, item, pic, busy, onKeep }: { open: boolean; onOpenChange: (o: boolean) => void; item: CreationImage | null; pic: Picture | null; busy: boolean; onKeep: (e: ImageEdits) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit" description="Nothing changes the original — Keep makes a new version." art={KIT.iconChip.image} wide>
        {open && item ? <EditBody item={item} pic={pic} busy={busy} onKeep={onKeep} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditBody({ item, pic, busy, onKeep, onCancel }: { item: CreationImage; pic: Picture | null; busy: boolean; onKeep: (e: ImageEdits) => void; onCancel: () => void }) {
  const [e, setE] = useState<ImageEdits>(item.edits);
  const [tool, setTool] = useState<Tool>("crop");
  const set = (p: Partial<ImageEdits>) => setE((x) => ({ ...x, ...p }));
  const natural = pic?.width && pic?.height ? { width: pic.width, height: pic.height } : null;
  const hasWords = item.words.enabled && !!(item.words.text ?? "").trim();
  const chip = (on: boolean) => cn("inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium", on ? "bg-accent text-white" : "bg-surface-muted text-ink hover:bg-accent-softer");
  return (
    <div className="space-y-3">
      <div className="mx-auto w-full" style={{ maxWidth: `min(22rem, calc(36dvh * ${aspectRatioOf(e.aspect, natural).toFixed(3)}))` }}>
        <EditedImage
          src={pic?.url ?? null}
          natural={natural}
          edits={e}
          words={item.words}
          className="w-full"
        >
          {tool === "focus" ? (
            // Tap where the picture's centre of interest is; the crop keeps it in view.
            <button
              type="button"
              aria-label="Set the focus where you tap"
              className="absolute inset-0 cursor-crosshair"
              onClick={(ev) => {
                const r = ev.currentTarget.getBoundingClientRect();
                set({ focalX: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), focalY: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) });
              }}
            >
              <span aria-hidden className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${e.focalX * 100}%`, top: `${e.focalY * 100}%` }} />
            </button>
          ) : null}
        </EditedImage>
      </div>
      <Segmented label="Tool" value={tool} onChange={setTool} options={TOOLS} className="w-full justify-between" />
      <div className="min-h-[5.5rem]">
        {tool === "crop" ? (
          <div className="space-y-2">
            <div role="radiogroup" aria-label="Shape" className="flex flex-wrap gap-1.5">
              {IMAGE_ASPECTS.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={e.aspect === a} onClick={() => set({ aspect: a })} className="inline-flex min-h-11 items-center">
                  <span className={chip(e.aspect === a)}>{ASPECT_LABEL[a]}</span>
                </button>
              ))}
            </div>
            <Range label="Zoom" min={1} max={4} step={0.05} value={e.zoom} onChange={(v) => set({ zoom: v })} />
          </div>
        ) : tool === "focus" ? (
          <div className="space-y-1">
            <p className="text-[13px] text-ink-muted">Tap the picture where it matters most, or choose a spot.</p>
            <div role="group" aria-label="Focus" className="grid w-36 grid-cols-3 gap-1">
              {[0.2, 0.5, 0.8].flatMap((y) =>
                [0.2, 0.5, 0.8].map((x) => (
                  <button
                    key={`${x}${y}`}
                    type="button"
                    aria-label={`${y < 0.4 ? "Top" : y > 0.6 ? "Bottom" : "Middle"} ${x < 0.4 ? "left" : x > 0.6 ? "right" : "centre"}`}
                    aria-pressed={Math.abs(e.focalX - x) < 0.05 && Math.abs(e.focalY - y) < 0.05}
                    onClick={() => set({ focalX: x, focalY: y })}
                    className="inline-flex size-11 items-center justify-center rounded-lg bg-surface-muted aria-pressed:bg-accent aria-pressed:text-white"
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  </button>
                )),
              )}
            </div>
          </div>
        ) : tool === "filter" ? (
          <ul role="radiogroup" aria-label="Filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {IMAGE_FILTERS.map((f) => (
              <li key={f}>
                <button type="button" role="radio" aria-checked={e.filter === f} onClick={() => set({ filter: f })} className="flex w-16 flex-col items-center gap-1">
                  <span className={cn("block size-14 overflow-hidden rounded-xl ring-offset-2", e.filter === f ? "ring-2 ring-accent" : "")}>
                    {pic?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pic.url} alt="" className="size-full object-cover" style={{ filter: cssFilter({ filter: f, brightness: e.brightness, contrast: e.contrast }) }} />
                    ) : null}
                  </span>
                  <span className="text-[12px] font-medium text-ink">{FILTER_LABEL[f]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : tool === "light" ? (
          <div className="space-y-1">
            <Range label="Brightness" min={0.5} max={1.5} step={0.01} value={e.brightness} onChange={(v) => set({ brightness: v })} />
            <Range label="Contrast" min={0.5} max={1.5} step={0.01} value={e.contrast} onChange={(v) => set({ contrast: v })} />
          </div>
        ) : tool === "blur" ? (
          <label className="flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink">
            <span>
              Blur behind the words
              <span className="block text-[12px] text-ink-subtle">{hasWords ? "Softens the picture just behind them so they read." : "Add Words first; this softens the picture behind them."}</span>
            </span>
            <Switch checked={e.blurBehind} onCheckedChange={(v) => set({ blurBehind: v })} disabled={!hasWords} label="Blur behind the words" />
          </label>
        ) : (
          <div role="radiogroup" aria-label="Frame" className="flex flex-wrap gap-1.5">
            {IMAGE_FRAMES.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={e.frame === f} onClick={() => set({ frame: f })} className="inline-flex min-h-11 items-center">
                <span className={chip(e.frame === f)}>{FRAME_LABEL[f]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="sticky -bottom-4 -mx-1 flex items-center gap-2 bg-surface/95 px-1 py-2 backdrop-blur">
        <Button className="flex-1" loading={busy} onClick={() => onKeep(e)}>
          Keep
        </Button>
        <Button variant="ghost" onClick={() => setE(DEFAULT_EDITS)} disabled={busy}>
          Original
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-[13.5px] text-ink">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(ev) => onChange(Number(ev.target.value))} className="h-11 w-full accent-[var(--color-accent,#6d5dfc)]" />
    </label>
  );
}

const PLACES = [
  { label: "Top", y: 0.14 },
  { label: "Middle", y: 0.5 },
  { label: "Bottom", y: 0.84 },
] as const;

/** Words on the picture: the text, where it sits, its face, size, colour and what's behind it. Real text, never pixels. */
function WordsSheet({ open, onOpenChange, item, pic, busy, onKeep }: { open: boolean; onOpenChange: (o: boolean) => void; item: CreationImage | null; pic: Picture | null; busy: boolean; onKeep: (w: SlideOverlay) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Words" description="Words on the picture stay real text; the original stays as it is." art={KIT.iconChip.type} wide>
        {open && item ? <WordsBody item={item} pic={pic} busy={busy} onKeep={onKeep} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function WordsBody({ item, pic, busy, onKeep }: { item: CreationImage; pic: Picture | null; busy: boolean; onKeep: (w: SlideOverlay) => void }) {
  const [w, setW] = useState<SlideOverlay>({ ...item.words, enabled: true });
  const set = (p: Partial<SlideOverlay>) => setW((x) => ({ ...x, ...p }));
  const chip = (on: boolean) => cn("inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium", on ? "bg-accent text-white" : "bg-surface-muted text-ink hover:bg-accent-softer");
  return (
    <div className="space-y-3">
      <div className="mx-auto w-full" style={{ maxWidth: `min(22rem, calc(32dvh * ${aspectRatioOf(item.edits.aspect, pic?.width && pic?.height ? { width: pic.width, height: pic.height } : null).toFixed(3)}))` }}>
        <EditedImage src={pic?.url ?? null} natural={pic?.width && pic?.height ? { width: pic.width, height: pic.height } : null} edits={item.edits} words={w} className="w-full" />
      </div>
      <label className="block text-[13.5px] font-medium text-ink">
        Words on the picture
        <textarea value={w.text ?? ""} onChange={(e) => set({ text: e.target.value.slice(0, 600) })} rows={2} className="mt-1 block w-full resize-none rounded-xl border border-border-soft bg-surface px-3 py-2 font-display text-[16px] text-ink focus:border-accent focus:outline-none" placeholder="A line for this picture…" />
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <div role="radiogroup" aria-label="Where" className="flex gap-1">
          {PLACES.map((p) => (
            <button key={p.label} type="button" role="radio" aria-checked={Math.abs(w.y - p.y) < 0.05} onClick={() => set({ y: p.y, x: 0.5 })} className="inline-flex min-h-11 items-center">
              <span className={chip(Math.abs(w.y - p.y) < 0.05)}>{p.label}</span>
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Align" className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={w.align === a} onClick={() => set({ align: a })} className="inline-flex min-h-11 items-center">
              <span className={chip(w.align === a)}>{a === "center" ? "Centre" : a === "left" ? "Left" : "Right"}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="radiogroup" aria-label="Face" className="flex flex-wrap gap-1">
        {OVERLAY_FONTS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={w.font === f.value} onClick={() => set({ font: f.value })} className="inline-flex min-h-11 items-center">
            <span className={chip(w.font === f.value)}>{f.label}</span>
          </button>
        ))}
      </div>
      <Range label="Size" min={0.03} max={0.14} step={0.005} value={w.size} onChange={(v) => set({ size: v })} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div role="radiogroup" aria-label="Colour" className="flex gap-1">
          {OVERLAY_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={w.color === c} aria-label={`Colour ${c}`} onClick={() => set({ color: c })} className="inline-flex size-11 items-center justify-center">
              <span className={cn("size-7 rounded-full ring-1 ring-ink/15", w.color === c && "ring-2 ring-accent ring-offset-2")} style={{ background: c }} />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Behind the words" className="flex gap-1">
          {(["none", "shade", "band"] as const).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={w.background === b} onClick={() => set({ background: b })} className="inline-flex min-h-11 items-center">
              <span className={chip(w.background === b)}>{b === "none" ? "Clear" : b === "shade" ? "Shade" : "Band"}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink">
        Soft shadow
        <Switch checked={w.shadow} onCheckedChange={(v) => set({ shadow: v })} label="Soft shadow" />
      </label>
      <div className="sticky -bottom-4 -mx-1 flex items-center gap-2 bg-surface/95 px-1 py-2 backdrop-blur">
        <Button className="flex-1" loading={busy} disabled={!(w.text ?? "").trim()} onClick={() => onKeep(w)}>
          Keep
        </Button>
        {item.words.enabled ? (
          <Button variant="ghost" disabled={busy} onClick={() => onKeep({ ...w, enabled: false })}>
            Remove words
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const FORMATS = [
  { type: "image/png", ext: "png", label: "PNG", note: "Best quality, larger file" },
  { type: "image/jpeg", ext: "jpg", label: "JPEG", note: "Smaller, for sharing anywhere" },
  { type: "image/webp", ext: "webp", label: "WebP", note: "Smallest, for the web" },
] as const;

/** Download the picture as shaped — crop, filter, light, words, frame — drawn at full quality in the browser. */
function DownloadSheet({ open, onOpenChange, item, pic, title, index }: { open: boolean; onOpenChange: (o: boolean) => void; item: CreationImage | null; pic: Picture | null; title: string; index: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function download(f: (typeof FORMATS)[number]) {
    if (!item || !pic?.url) return;
    setBusy(f.ext);
    setError(null);
    try {
      const img = await loadImage(pic.url);
      const canvas = document.createElement("canvas");
      await composeEdited(canvas, img, { edits: item.edits, words: item.words });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, f.type, 0.92));
      if (!blob) throw new Error("This browser couldn't make that file.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const name = (title || "picture").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "picture";
      a.download = `${name}${index ? `-${index + 1}` : ""}.${f.ext}`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Download" description="The picture as you've shaped it, at full quality." art={KIT.iconChip.image}>
        <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
          {FORMATS.map((f) => (
            <li key={f.ext}>
              <button type="button" disabled={!!busy} onClick={() => void download(f)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02] disabled:opacity-60">
                <Download className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{busy === f.ext ? "Preparing…" : f.label}</span>
                  <span className="block text-[12px] text-ink-subtle">{f.note}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Arrange and caption (a photo essay): order with Move up/down (no precision drag needed), a caption each, remove. */
function ArrangeSheet({ open, onOpenChange, set, pictures, busy, onKeep }: { open: boolean; onOpenChange: (o: boolean) => void; set: ImageSet; pictures: Record<string, Picture>; busy: boolean; onKeep: (s: ImageSet) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Arrange & captions" description="The order they're seen in, and a line under each." art={KIT.iconChip.layers}>
        {open ? <ArrangeBody set={set} pictures={pictures} busy={busy} onKeep={onKeep} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ArrangeBody({ set, pictures, busy, onKeep }: { set: ImageSet; pictures: Record<string, Picture>; busy: boolean; onKeep: (s: ImageSet) => void }) {
  const [items, setItems] = useState(set.items);
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  return (
    <div className="space-y-3">
      <ol className="divide-y divide-border-soft rounded-2xl border border-border-soft" aria-label="Pictures in order">
        {items.map((x, i) => (
          <li key={x.materialId} className="flex items-center gap-2 p-2">
            <span className="block size-12 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
              {pictures[x.materialId]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pictures[x.materialId]!.url!} alt="" className="size-full object-cover" style={{ filter: cssFilter(x.edits) }} />
              ) : null}
            </span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Caption for picture {i + 1}</span>
              <input
                value={x.caption}
                onChange={(e) => setItems((xs) => xs.map((y, k) => (k === i ? { ...y, caption: e.target.value.slice(0, 600) } : y)))}
                placeholder="A caption…"
                className="h-11 w-full rounded-lg border border-transparent bg-transparent px-2 font-display text-[15px] italic text-ink hover:border-border-soft focus:border-accent focus:outline-none"
              />
            </label>
            <button type="button" aria-label={`Move picture ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5 disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label={`Move picture ${i + 1} later`} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5 disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label={`Take picture ${i + 1} out`} onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[12px] text-ink-subtle">Taking a picture out of this Creation keeps it in your Materials.</p>
      <Button className="w-full" loading={busy} onClick={() => onKeep({ kind: "images", items })}>
        Keep
      </Button>
    </div>
  );
}
