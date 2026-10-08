"use client";
import { OVERLAY_COLORS, OVERLAY_FONTS } from "@wonder/creator-studio/carousel";
import {
  ASPECT_LABEL,
  DEFAULT_EDITS,
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
  type TextBox,
  MAX_TEXTS,
  newTextBox,
} from "@wonder/creator-studio/images";
import { Button, Dialog, DialogContent, KIT, KitArt, Segmented, Switch, cn } from "@wonder/ui";
import { ArrowDown, ArrowUp, Camera, Download, ImagePlus, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadImage } from "@/components/carousel/slide-render";
import { EditedImage, composeEdited } from "@/components/images/edited-image";
import { YourPictures } from "@/components/images/your-pictures";
import { ImageStage } from "@/components/images/image-stage";
import { VisualDirections } from "@/components/visual-directions";
import { api, errorMessage } from "@/lib/client";
import { sendToCreator } from "@/lib/send";

/**
 * The Images page's canvas (creation-pages.md, step 2): the picture is the work and fills the canvas; pinch and drag to
 * look closer. Edit (crop, focus, filter, light, blur behind the text, frame) is the page's primary action; Text (a box
 * on the picture, typed in place, moved and sized by hand) and Download are its two secondaries; adding, arranging and
 * captions live in More. Edits and text autosave as versions; the original pictures are never changed.
 */

export interface Picture {
  url: string | null;
  width: number | null;
  height: number | null;
  title: string | null;
}
export type ImagesRequest = { kind: "edit" | "text" | "download" | "add" | "arrange"; n: number } | null;

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
  // What the current version holds: an autosave that would change nothing is never sent.
  const [kept, setKept] = useState(initialSet);
  if (baseVersionId !== seenBase) {
    setSeenBase(baseVersionId);
    setBase(baseVersionId);
    setSet(initialSet);
    setKept(initialSet);
  }
  const [at, setAt] = useState(0);
  const index = Math.min(at, Math.max(0, set.items.length - 1));
  const item = set.items[index] ?? null;
  const pic = item ? pictures[item.materialId] : null;
  const natural = pic?.width && pic?.height ? { width: pic.width, height: pic.height } : null;

  const [sheet, setSheet] = useState<null | "edit" | "download" | "add" | "arrange">(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [seenReq, setSeenReq] = useState(request?.n ?? 0);
  if (request && request.n !== seenReq) {
    setSeenReq(request.n);
    if (request.kind === "text") {
      if (item && item.texts.length < MAX_TEXTS) {
        const t = newTextBox({ y: item.texts.length ? Math.min(0.9, 0.5 + 0.12 * item.texts.length) : 0.5 });
        setSet({ kind: "images", items: set.items.map((x, k) => (k === index ? { ...x, texts: [...x.texts, t] } : x)) });
        setSelected(t.id);
        setEditing(t.id);
      }
    } else setSheet(request.kind === "edit" || request.kind === "download" ? (item ? request.kind : "add") : request.kind);
  }

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function keep(next: ImageSet, label?: string, quiet = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/images`, { method: "POST", json: { set: next, baseVersionId: base, label } });
      if (!quiet) setSet(next);
      setKept(next);
      setBase(r.version.id);
      setSeenBase(r.version.id);
      onKept(r.version);
      if (!quiet) setSheet(null);
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
    const next: ImageSet = { kind: "images", items: [...set.items, { materialId, caption: "", edits: DEFAULT_EDITS, texts: [] }] };
    if (await keep(next, set.items.length ? "Added a picture" : "First picture")) setAt(next.items.length - 1);
  }

  // Text on the picture autosaves: one version per pause after a gesture ends or typing stops (never one per move).
  // A queued set waits 900ms, and waits again while a save is in flight.
  const [queued, setQueued] = useState<ImageSet | null>(null);
  useEffect(() => {
    if (!queued) return;
    const t = setTimeout(() => {
      if (busy) return;
      setQueued(null);
      void keep(queued, "Words on the picture", true);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, busy]);
  function changeTexts(texts: TextBox[], commit: boolean) {
    // A box emptied of its words goes; nothing is kept for it.
    const next = replaceAt(index, { texts: commit ? texts.filter((t) => t.text.trim()) : texts });
    setSet(next);
    if (commit) setQueued(JSON.stringify(next.items) === JSON.stringify(kept.items) ? null : next);
  }
  const selectedBox = item?.texts.find((t) => t.id === selected) ?? null;
  function endEditing() {
    setEditing(null);
    if (item) changeTexts(item.texts, true);
  }

  return (
    // The bottom bar (Edit · Working Table) floats over the page's last 4.25rem: the toolbar and thumbnails stay above it.
    <div className="relative flex h-[calc(100dvh-var(--nav-height)-var(--canvas-extra)-9.75rem)] min-h-[22rem] flex-col bg-[#f2ece3] pb-[4.25rem]" style={{ backgroundImage: `url(${KIT.texture.texturePaper.svg})`, backgroundSize: "512px" }}>
      {error ? (
        <p role="alert" className="absolute inset-x-3 top-3 z-10 rounded-2xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {item ? (
        <>
          <div className="min-h-0 flex-1">
            <ImageStage
              src={pic?.url ?? null}
              natural={natural}
              edits={item.edits}
              texts={item.texts}
              selectedId={selected}
              editingId={editing}
              label={item.caption || pic?.title || title || "Picture"}
              onSelect={setSelected}
              onEdit={(id) => (id ? setEditing(id) : endEditing())}
              onTexts={changeTexts}
            />
          </div>
          {selectedBox ? (
            <TextToolbar box={selectedBox} busy={busy} onChange={(p) => changeTexts(item.texts.map((t) => (t.id === selectedBox.id ? { ...t, ...p } : t)), true)} onEdit={() => setEditing(selectedBox.id)} onDelete={() => { changeTexts(item.texts.filter((t) => t.id !== selectedBox.id), true); setSelected(null); }} onDone={() => { if (editing) endEditing(); setSelected(null); }} />
          ) : item.caption ? (
            <p className="shrink-0 px-4 py-1.5 text-center font-display text-[13.5px] italic leading-snug text-ink-muted">{item.caption}</p>
          ) : null}
          {set.items.length > 1 ? (
            <ul aria-label="Pictures" className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
              {set.items.map((x, k) => (
                <li key={x.materialId}>
                  <button
                    type="button"
                    aria-current={k === index ? "true" : undefined}
                    aria-label={`Picture ${k + 1} of ${set.items.length}`}
                    onClick={() => {
                      setAt(k);
                      setSelected(null);
                      setEditing(null);
                    }}
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

/**
 * The selected box's settings, one scrolling row above the pictures: face, size, alignment, colour, what's behind it,
 * shadow — and Delete. Size has buttons too, so no one needs a precise pinch.
 */
function TextToolbar({ box, busy, onChange, onEdit, onDelete, onDone }: { box: TextBox; busy: boolean; onChange: (p: Partial<TextBox>) => void; onEdit: () => void; onDelete: () => void; onDone: () => void }) {
  const chip = (on: boolean) => cn("inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium", on ? "bg-accent text-white" : "bg-surface text-ink ring-1 ring-border-soft hover:bg-accent-softer");
  return (
    <div role="toolbar" aria-label="Text" className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border-soft bg-surface/95 px-2 py-1.5 backdrop-blur [scrollbar-width:none]">
      <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={onEdit}>
        Edit words
      </Button>
      <span className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
      <div role="radiogroup" aria-label="Face" className="flex gap-1">
        {OVERLAY_FONTS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={box.font === f.value} onClick={() => onChange({ font: f.value })} className="inline-flex min-h-11 items-center">
            <span className={chip(box.font === f.value)}>{f.label}</span>
          </button>
        ))}
      </div>
      <span className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
      <button type="button" aria-label="Smaller text" onClick={() => onChange({ size: Math.max(0.02, +(box.size / 1.15).toFixed(4)) })} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/[0.04]">
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="text-[12px] tabular-nums text-ink-muted">{Math.round(box.size * 100)}</span>
      <button type="button" aria-label="Larger text" onClick={() => onChange({ size: Math.min(0.3, +(box.size * 1.15).toFixed(4)) })} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/[0.04]">
        <Plus className="size-4" aria-hidden />
      </button>
      <span className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
      <div role="radiogroup" aria-label="Align" className="flex gap-1">
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} type="button" role="radio" aria-checked={box.align === a} onClick={() => onChange({ align: a })} className="inline-flex min-h-11 items-center">
            <span className={chip(box.align === a)}>{a === "center" ? "Centre" : a === "left" ? "Left" : "Right"}</span>
          </button>
        ))}
      </div>
      <span className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
      <div role="radiogroup" aria-label="Colour" className="flex gap-0.5">
        {OVERLAY_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={box.color === c} aria-label={`Colour ${c}`} onClick={() => onChange({ color: c })} className="inline-flex size-11 items-center justify-center">
            <span className={cn("size-6 rounded-full ring-1 ring-ink/15", box.color === c && "ring-2 ring-accent ring-offset-2")} style={{ background: c }} />
          </button>
        ))}
      </div>
      <span className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
      <div role="radiogroup" aria-label="Behind the text" className="flex gap-1">
        {(["none", "shade", "band"] as const).map((b) => (
          <button key={b} type="button" role="radio" aria-checked={box.background === b} onClick={() => onChange({ background: b })} className="inline-flex min-h-11 items-center">
            <span className={chip(box.background === b)}>{b === "none" ? "Clear" : b === "shade" ? "Shade" : "Band"}</span>
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={box.shadow} onClick={() => onChange({ shadow: !box.shadow })} className="inline-flex min-h-11 items-center">
        <span className={chip(box.shadow)}>Shadow</span>
      </button>
      <span className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
      <button type="button" aria-label="Delete this text" onClick={onDelete} className="inline-flex size-11 items-center justify-center rounded-full text-danger hover:bg-danger-soft">
        <Trash2 className="size-4" aria-hidden />
      </button>
      <Button size="sm" loading={busy} onClick={onDone} className="ml-auto">
        Done
      </Button>
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
            <Camera className="size-4 text-accent" aria-hidden /> {taking ? "Saving…" : "Take or choose a picture"}
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
      <input ref={camera} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Take or choose a picture" onChange={(e) => (void take(e.target.files?.[0]), (e.target.value = ""))} />
      {view === "mine" ? <YourPictures busy={busy} onPick={(id) => void onAdd(id)} /> : null}
      {view === "make" ? <VisualDirections creationId={artifactId} purpose="explore" title="Made from this Creation" useLabel="Use this picture" onUse={(id) => onAdd(id)} className="text-left" /> : null}
    </div>
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
  const hasWords = item.texts.some((t) => t.text.trim());
  const chip = (on: boolean) => cn("inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium", on ? "bg-accent text-white" : "bg-surface-muted text-ink hover:bg-accent-softer");
  return (
    <div className="space-y-3">
      <div className="mx-auto w-full" style={{ maxWidth: `min(22rem, calc(36dvh * ${aspectRatioOf(e.aspect, natural).toFixed(3)}))` }}>
        <EditedImage
          src={pic?.url ?? null}
          natural={natural}
          edits={e}
          texts={item.texts}
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
              Blur behind the text
              <span className="block text-[12px] text-ink-subtle">{hasWords ? "Softens the picture just behind them so they read." : "Add Words first; this softens the picture behind them."}</span>
            </span>
            <Switch checked={e.blurBehind} onCheckedChange={(v) => set({ blurBehind: v })} disabled={!hasWords} label="Blur behind the text" />
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

const FORMATS = [
  { type: "image/png", ext: "png", label: "PNG", note: "Best quality, larger file" },
  { type: "image/jpeg", ext: "jpg", label: "JPEG", note: "Smaller, for sharing anywhere" },
  { type: "image/webp", ext: "webp", label: "WebP", note: "Smallest, for the web" },
] as const;

/** Download the picture as shaped — crop, filter, light, text, frame — drawn at full quality in the browser. */
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
      await composeEdited(canvas, img, { edits: item.edits, texts: item.texts });
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
