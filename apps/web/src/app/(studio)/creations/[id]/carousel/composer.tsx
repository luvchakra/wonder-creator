"use client";
import type { CarouselView, SlideView } from "@wonder/creator-brain";
import { CAROUSEL_ASPECTS, CAROUSEL_COUNTS, CAROUSEL_MAX_SLIDES, CAROUSEL_STYLES, IMAGE_INSTRUCTION_CHIPS } from "@wonder/creator-studio/carousel";
import { Button, Dialog, DialogContent, Field, Menu, MenuContent, MenuItem, MenuTrigger, Textarea, buttonClasses, chipBase, cn } from "@wonder/ui";
import { ArrowDown, ArrowUp, ChevronRight, Copy, GripVertical, ImageOff, MoreHorizontal, PenLine, Plus, RefreshCw, Rows3, Trash2, Type } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { api, errorMessage } from "@/lib/client";
import { aspectClass } from "@/components/carousel/slide-render";

/**
 * Carousel Composer — Overview (docs/ui-redesign/carousel-composer.md §6–12, §28, §50). One next step at a time:
 * setup → "Generate N images" · generating → progress only · slides → "Continue Creating" with two quiet actions
 * (Generate one more, Arrange). Everything else is in a slide's ⋯, the Palette or Details.
 */
export function CarouselComposer({
  artifactId,
  title,
  meta,
  source,
  initial,
  hideHeader = false,
  onView,
}: {
  artifactId: string;
  title: string;
  meta: string;
  source: string | null;
  initial: CarouselView;
  /** Inside the Creative Studio, whose own bar names the Creation. */
  hideHeader?: boolean;
  /** Tells the Studio canvas what the Composer now knows (e.g. the first slides are ready). */
  onView?: (v: CarouselView) => void;
}) {
  const [view, setViewState] = useState(initial);
  const setView = useCallback(
    (v: CarouselView) => {
      setViewState(v);
      onView?.(v);
    },
    [onView],
  );
  const [error, setError] = useState<string | null>(null);
  const strip = useStripSignal();
  const refresh = useCallback(async () => {
    try {
      setView(await api<CarouselView>(`/api/v1/carousels/${artifactId}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [artifactId, setView]);

  // Follow anything in flight (the first set, one more, a slide's new image). The page never waits on it.
  const busy = !!view.generating || view.adding > 0 || view.slides.some((s) => s.change && s.change.status !== "failed");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  // Operational truth in the navbar (§32).
  useEffect(() => {
    const changing = view.slides.findIndex((s) => s.change && s.change.status !== "failed");
    if (view.generating) strip("carousel", { text: `${view.generating.ready} of ${view.generating.requested} images ready`, tone: "active" });
    else if (changing >= 0) strip("carousel", { text: `Regenerating slide ${changing + 1}…`, tone: "active" });
    else if (view.adding) strip("carousel", { text: "Creating one more slide…", tone: "active" });
    else strip("carousel", null);
    return () => strip("carousel", null);
  }, [view, strip]);

  const [arranging, setArranging] = useState(false);
  const [adding, setAdding] = useState(false);

  const header = hideHeader ? null : (
    <header className="space-y-1">
      <h1 className="break-words font-display text-[22px] leading-tight text-ink sm:text-[26px]">{title}</h1>
      <p className="text-[12.5px] text-ink-subtle">
        {meta}
        {source ? <span className="block">Created from “{source}”</span> : null}
      </p>
    </header>
  );

  if (!view.settings || (!view.slides.length && !view.generating && !view.failed)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {header}
        {view.isOwner ? (
          <Setup artifactId={artifactId} sourceText={view.sourceText} existing={view.existing} onStarted={refresh} />
        ) : (
          <p className="text-sm text-ink-muted">The creator hasn&apos;t made this Carousel&apos;s images yet.</p>
        )}
        <DetailsLink artifactId={artifactId} />
      </div>
    );
  }

  if (view.generating || view.failed) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {header}
        {view.failed ? <FailedStart artifactId={artifactId} settings={view.settings} onRetry={refresh} /> : <Generating g={view.generating!} aspect={view.settings.aspectRatio} />}
        <DetailsLink artifactId={artifactId} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {header}
      {arranging ? (
        <Arrange
          artifactId={artifactId}
          slides={view.slides}
          aspect={view.settings.aspectRatio}
          onDone={async () => {
            setArranging(false);
            await refresh();
          }}
        />
      ) : (
        <>
          <section aria-labelledby="slides-h" className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="slides-h" className="text-base font-semibold text-ink">
                Slides
              </h2>
              <p className="text-[12.5px] text-ink-subtle">{view.slides.length} slides · your words are matched to each image</p>
            </div>
            <ol aria-label="Slides" className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
              {view.slides.map((s, i) => (
                <SlideRow
                  key={s.id}
                  artifactId={artifactId}
                  slide={s}
                  index={i}
                  total={view.slides.length}
                  aspect={view.settings!.aspectRatio}
                  canEdit={view.canEdit}
                  isOwner={view.isOwner}
                  onChanged={refresh}
                  onError={setError}
                />
              ))}
              {view.adding > 0 ? (
                <li className="flex items-center gap-3 p-2" role="status">
                  <span className={cn("w-14 shrink-0 rounded-lg bg-surface-muted motion-safe:animate-pulse", aspectClass(view.settings.aspectRatio))} />
                  <span className="text-[13px] text-ink-muted">Creating one more slide…</span>
                </li>
              ) : null}
            </ol>
            {view.addFailed && !view.adding ? <p className="text-[13px] text-ink-muted">Couldn&apos;t create one more slide. Try again.</p> : null}
          </section>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            {view.isOwner && view.slides.length < CAROUSEL_MAX_SLIDES ? (
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)} disabled={view.adding > 0}>
                <Plus className="size-4" aria-hidden /> Generate one more
              </Button>
            ) : (
              <span />
            )}
            {view.canEdit && view.slides.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setArranging(true)}>
                <Rows3 className="size-4" aria-hidden /> Arrange
              </Button>
            ) : null}
          </div>
          {view.canEdit ? (
            <Link href={`/creations/${artifactId}/slides/${view.slides[0]!.id}`} className={buttonClasses({ className: "w-full" })}>
              <PenLine className="size-4" aria-hidden /> Continue Creating
            </Link>
          ) : null}
          <DetailsLink artifactId={artifactId} />
          {adding ? <AddOneSheet artifactId={artifactId} onClose={() => setAdding(false)} onQueued={refresh} /> : null}
        </>
      )}
    </div>
  );
}

/** The first two lines of the source, for a compact reminder of what the images come from. */
function preview(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(0, 2).join("\n") + (lines.length > 2 ? " …" : "");
}

function DetailsLink({ artifactId }: { artifactId: string }) {
  return (
    <Link href={`/creations/${artifactId}?details=1`} className="flex min-h-11 items-center justify-between rounded-xl px-1 text-sm text-ink-muted hover:text-ink">
      Details
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

function Chips<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
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

/** Setup (§6): how many images first; style and aspect optional; one CTA that says what it will do. */
function Setup({ artifactId, sourceText, existing, onStarted }: { artifactId: string; sourceText: string; existing: CarouselView["existing"]; onStarted: () => void }) {
  const [adopting, setAdopting] = useState(false);
  const [count, setCount] = useState<number | "custom">(5);
  const [custom, setCustom] = useState(7);
  const [style, setStyle] = useState<string>("auto");
  const [aspect, setAspect] = useState<string>("4:5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const n = count === "custom" ? Math.min(CAROUSEL_MAX_SLIDES, Math.max(1, custom)) : count;
  if (!sourceText.trim()) {
    return (
      <div className="space-y-2 rounded-2xl border border-border-soft bg-surface p-3">
        <p className="text-sm text-ink-muted">Add more text or Material to build the Carousel.</p>
        <Link href={`/creations/${artifactId}/studio`} className={buttonClasses({ size: "sm" })}>
          Add words
        </Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="setup-h" className="space-y-4">
      <h2 id="setup-h" className="sr-only">
        Create Carousel
      </h2>
      <p className="whitespace-pre-line rounded-xl bg-surface-muted px-3 py-2 font-display text-[14px] leading-snug text-ink-muted">{preview(sourceText)}</p>
      {existing ? (
        <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface p-2">
          <span className="flex shrink-0 -space-x-3" aria-hidden>
            {existing.thumbnails.slice(0, 3).map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={t} src={t} alt="" className="size-10 rounded-lg border-2 border-surface object-cover" />
            ))}
          </span>
          <p className="min-w-0 flex-1 text-[13px] text-ink-muted">You already have {existing.count} images for this Carousel.</p>
          <Button
            variant="secondary"
            size="sm"
            loading={adopting}
            onClick={async () => {
              setAdopting(true);
              setError(null);
              try {
                await api(`/api/v1/carousels/${artifactId}/adopt`, { method: "POST", json: { generationId: existing.generationId } });
                onStarted();
              } catch (e) {
                setError(errorMessage(e));
                setAdopting(false);
              }
            }}
          >
            Use these
          </Button>
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-ink">How many images?</h3>
        <Chips label="How many images?" value={count} options={[...CAROUSEL_COUNTS.map((c) => [c, String(c)] as [number, string]), ["custom", "Custom"] as ["custom", string]]} onChange={setCount} />
        {count === "custom" ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            Slides
            <input
              type="number"
              min={1}
              max={CAROUSEL_MAX_SLIDES}
              value={custom}
              onChange={(e) => setCustom(Number(e.target.value) || 1)}
              className="h-11 w-20 rounded-xl border border-border bg-surface px-3"
            />
            <span className="text-xs text-ink-subtle">up to {CAROUSEL_MAX_SLIDES}</span>
          </label>
        ) : null}
      </div>
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-ink">
          Visual style <span className="font-normal text-ink-subtle">(optional)</span>
        </h3>
        <Chips label="Visual style" value={style} options={CAROUSEL_STYLES.map((s) => [s.value, s.label])} onChange={setStyle} />
      </div>
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-ink">Aspect ratio</h3>
        <Chips label="Aspect ratio" value={aspect} options={CAROUSEL_ASPECTS.map((a) => [a.value, `${a.value} ${a.label}`])} onChange={setAspect} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            key.current ??= crypto.randomUUID();
            const r = await api<{ state: string }>(`/api/v1/carousels/${artifactId}/start`, {
              method: "POST",
              json: { count: n, visualStyle: style, aspectRatio: aspect, idempotencyKey: key.current },
            });
            if (r.state === "unavailable") setError("Image generation isn't connected.");
            else onStarted();
          } catch (e) {
            setError(errorMessage(e));
            key.current = null;
          } finally {
            setBusy(false);
          }
        }}
      >
        Generate {n} {n === 1 ? "image" : "images"}
      </Button>
    </section>
  );
}

/** Generating (§7): real progress only, compact skeletons, no theatre. */
function Generating({ g, aspect }: { g: { ready: number; requested: number }; aspect: string }) {
  return (
    <section aria-busy="true" className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-ink">Creating your carousel…</h2>
        <p className="text-[13px] text-ink-muted">Generating {g.requested} images and matching text</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={g.requested} aria-valuenow={g.ready} aria-label="Images ready">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.max(4, (g.ready / g.requested) * 100)}%` }} />
      </div>
      <p className="text-[12.5px] text-ink-subtle" role="status">
        {g.ready} of {g.requested} images ready
      </p>
      <ul className="space-y-2" aria-hidden>
        {Array.from({ length: Math.min(g.requested, 4) }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className={cn("w-14 shrink-0 rounded-lg bg-surface-muted motion-safe:animate-pulse", aspectClass(aspect))} />
            <span className="h-3 w-2/3 rounded bg-surface-muted motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FailedStart({ artifactId, settings, onRetry }: { artifactId: string; settings: NonNullable<CarouselView["settings"]>; onRetry: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-2xl border border-border-soft bg-surface p-3">
      <p className="flex items-center gap-2 text-sm text-ink">
        <ImageOff className="size-4 text-ink-subtle" aria-hidden /> Couldn&apos;t create the images.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const r = await api<{ state: string }>(`/api/v1/carousels/${artifactId}/start`, {
              method: "POST",
              json: { count: settings.requestedCount, visualStyle: settings.visualStyle, aspectRatio: settings.aspectRatio, retry: true },
            });
            if (r.state === "unavailable") setError("Image generation isn't connected.");
            else onRetry();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Try again
      </Button>
    </div>
  );
}

function SlideRow({
  artifactId,
  slide,
  index,
  total,
  aspect,
  canEdit,
  isOwner,
  onChanged,
  onError,
}: {
  artifactId: string;
  slide: SlideView;
  index: number;
  total: number;
  aspect: string;
  canEdit: boolean;
  isOwner: boolean;
  onChanged: () => void;
  onError: (m: string | null) => void;
}) {
  const [regen, setRegen] = useState(false);
  const act = async (path: string, init: RequestInit & { json?: unknown } = { method: "POST" }) => {
    onError(null);
    try {
      await api(path, init);
      onChanged();
    } catch (e) {
      onError(errorMessage(e));
    }
  };
  const status = slide.change?.status === "failed" ? "Couldn't regenerate this slide." : slide.change ? "Regenerating…" : slide.pending ? "New image ready" : null;
  return (
    <li className="relative flex items-center gap-3 p-2">
      <span className="w-5 shrink-0 text-center text-[12.5px] font-semibold text-ink-subtle" aria-hidden>
        {index + 1}
      </span>
      <Link
        href={`/creations/${artifactId}/slides/${slide.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 after:absolute after:inset-0 after:content-['']"
        aria-label={`Slide ${index + 1} of ${total}: ${slide.displayText || "no words yet"}`}
      >
        <span className={cn("relative w-14 shrink-0 overflow-hidden rounded-lg bg-surface-muted", aspectClass(aspect))}>
          {slide.image?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.image.thumbnailUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="absolute inset-0 m-auto size-4 text-ink-subtle" aria-hidden />
          )}
          {slide.change && slide.change.status !== "failed" ? <span className="absolute inset-0 bg-surface-muted/70 motion-safe:animate-pulse" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-3 whitespace-pre-line font-display text-[14px] leading-snug text-ink">
            {slide.displayText || <span className="font-sans text-ink-subtle">No words yet</span>}
          </span>
          {status ? <span className={cn("mt-0.5 block text-[12px]", slide.pending ? "font-medium text-accent-ink" : "text-ink-subtle")}>{status}</span> : null}
        </span>
      </Link>
      {slide.overlay.enabled ? <Type className="relative size-4 shrink-0 text-ink-subtle" aria-label="Words on the image" /> : null}
      {canEdit ? (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`More for slide ${index + 1}`} className="relative">
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {isOwner ? (
              <MenuItem onSelect={() => setRegen(true)}>
                <RefreshCw className="size-4" aria-hidden /> {slide.image ? "Regenerate this image…" : "Create this image…"}
              </MenuItem>
            ) : null}
            <MenuItem onSelect={() => act(`/api/v1/carousel-slides/${slide.id}/duplicate`)}>
              <Copy className="size-4" aria-hidden /> Duplicate slide
            </MenuItem>
            {total > 1 ? (
              <MenuItem destructive onSelect={() => act(`/api/v1/carousel-slides/${slide.id}`, { method: "DELETE" })}>
                <Trash2 className="size-4" aria-hidden /> Remove slide
              </MenuItem>
            ) : null}
          </MenuContent>
        </Menu>
      ) : null}
      {regen ? <RegenerateSheet slide={slide} index={index} onClose={() => setRegen(false)} onQueued={onChanged} /> : null}
    </li>
  );
}

/** Instruction sheet shared by "Regenerate this image" and "Generate one more" (§11, §26). */
function InstructionSheet({
  title,
  description,
  cta,
  placeholder,
  required,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  description: string;
  cta: string;
  placeholder: string;
  required?: boolean;
  onSubmit: (instruction: string, key: string) => Promise<{ state: string }>;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const add = (chip: string) => setText((t) => (t.trim() ? `${t.trim().replace(/[.,]$/, "")}, ${chip.toLowerCase()}` : chip));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title} description={description}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              key.current ??= crypto.randomUUID();
              const r = await onSubmit(text.trim(), key.current);
              if (r.state === "unavailable") setError("Image generation isn't connected.");
              else onClose();
            } catch (err) {
              setError(errorMessage(err));
              key.current = null;
            } finally {
              setBusy(false);
            }
          }}
        >
          {children}
          <Field label={required ? "What should change?" : "Instruction (optional)"} htmlFor="img-instruction" counter={`${text.length} / 300`}>
            <Textarea id="img-instruction" rows={2} className="min-h-0" maxLength={300} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
            {IMAGE_INSTRUCTION_CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => add(c)} className={cn(chipBase, "bg-surface-muted text-ink-muted hover:text-ink")}>
                {c}
              </button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={busy}>
              {cta}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegenerateSheet({ slide, index, onClose, onQueued }: { slide: SlideView; index: number; onClose: () => void; onQueued: () => void }) {
  return (
    <InstructionSheet
      title={slide.image ? "Regenerate this image" : "Create this image"}
      description={`Slide ${index + 1}. The rest of the Carousel stays as it is${slide.image ? "; you'll choose between the current and the new image" : ""}.`}
      cta={slide.image ? "Regenerate" : "Create image"}
      placeholder="e.g. moodier, with warmer light and more negative space"
      onClose={onClose}
      onSubmit={async (instruction, key) => {
        const r = await api<{ state: string }>(`/api/v1/carousel-slides/${slide.id}/regenerate`, { method: "POST", json: { instruction: instruction || null, idempotencyKey: key } });
        onQueued();
        return r;
      }}
    >
      {slide.image?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.image.thumbnailUrl} alt="" className="h-20 w-auto rounded-lg object-cover" />
      ) : null}
    </InstructionSheet>
  );
}

export function AddOneSheet({ artifactId, onClose, onQueued }: { artifactId: string; onClose: () => void; onQueued: () => void }) {
  return (
    <InstructionSheet
      title="Add one more slide"
      description="One new image at the end, in this Carousel's style. The other slides stay as they are."
      cta="Generate one more"
      placeholder="e.g. a moonlit street with trees"
      onClose={onClose}
      onSubmit={async (instruction, key) => {
        const r = await api<{ state: string }>(`/api/v1/carousels/${artifactId}/slides`, { method: "POST", json: { instruction: instruction || null, idempotencyKey: key } });
        onQueued();
        return r;
      }}
    />
  );
}

/**
 * Arrange (§28): drag rows by their handle, or use Move up / Move down (keyboard and precision-free, §42).
 * Nothing else is shown while arranging; nothing is generated. Done saves the order.
 */
export function Arrange({ artifactId, slides, aspect, onDone }: { artifactId: string; slides: SlideView[]; aspect: string; onDone: () => void }) {
  const [order, setOrder] = useState(slides);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const [announce, setAnnounce] = useState("");
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((o) => {
      const next = [...o];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setAnnounce(`Moved to position ${to + 1} of ${order.length}.`);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !list.current) return;
    const rows = [...list.current.querySelectorAll<HTMLLIElement>("li[data-id]")];
    const from = order.findIndex((s) => s.id === dragging);
    const to = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    if (to >= 0 && to !== from) move(from, to);
  };
  return (
    <section aria-labelledby="arrange-h" className="space-y-3">
      <div>
        <h2 id="arrange-h" className="text-base font-semibold text-ink">
          Arrange slides
        </h2>
        <p className="text-[13px] text-ink-muted">Drag to change the order, or use the arrows.</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ol
        ref={list}
        aria-label="Slide order"
        className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {order.map((s, i) => (
          <li key={s.id} data-id={s.id} className={cn("flex items-center gap-2 p-2", dragging === s.id && "bg-accent-softer")}>
            <span
              role="presentation"
              className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-ink-subtle active:cursor-grabbing"
              onPointerDown={(e) => {
                (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                setDragging(s.id);
              }}
            >
              <GripVertical className="size-4" aria-hidden />
            </span>
            <span className="w-4 shrink-0 text-[12.5px] font-semibold text-ink-subtle">{i + 1}</span>
            <span className={cn("w-11 shrink-0 overflow-hidden rounded-md bg-surface-muted", aspectClass(aspect))}>
              {s.image?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image.thumbnailUrl} alt="" className="size-full object-cover" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-[14px] text-ink">{s.displayText.split("\n")[0] || "No words yet"}</span>
            <Button variant="ghost" size="sm" aria-label={`Move slide ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Move slide ${i + 1} down`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>
              <ArrowDown className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOrder(slides)} disabled={order.every((s, i) => s.id === slides[i]?.id)}>
          Reset order
        </Button>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              if (!order.every((s, i) => s.id === slides[i]?.id)) await api(`/api/v1/carousels/${artifactId}/order`, { method: "POST", json: { slideIds: order.map((s) => s.id) } });
              onDone();
            } catch (e) {
              setError(errorMessage(e));
              setBusy(false);
            }
          }}
        >
          Done
        </Button>
      </div>
    </section>
  );
}
