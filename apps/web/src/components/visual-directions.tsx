"use client";
import { Button, Dialog, DialogContent, Field, Menu, MenuContent, MenuItem, MenuTrigger, Textarea, cn } from "@wonder/ui";
import { ArrowLeft, ArrowRight, Check, ImageOff, MoreHorizontal, RefreshCw, Save, Sparkles, Type, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { SlideTextDialog } from "./slide-text-dialog";

type Asset = { id: string; sequence: number; imageUrl: string | null; thumbnailUrl: string | null; directionLabel: string | null; rationale: string | null; selected: boolean; savedMaterialId: string | null; revised?: boolean; qualityIntent?: "preview" | "standard" | "premium" };
type Revision = { id: string; assetId: string; kind?: string; status: "queued" | "processing" | "failed" };
type Generation = { id: string; status: "queued" | "processing" | "complete" | "partial" | "failed" | "cancelled"; requestedCount: number; aspectRatio: string; assets: Asset[]; revisions?: Revision[] };
type Reply = { state: "generation" | "none" | "unavailable" | "no_context"; generation?: Generation; available: boolean };

/**
 * Visual directions from the creator's own context (docs/image-generation.md §27–29, §69–72): a compact carousel of
 * 3–5 concepts. It shows what's already stored for this context at once; it generates only when the creator asks; it
 * says plainly when image generation isn't connected. Small skeletons while creating, a short crossfade when ready.
 */
export function VisualDirections({
  creationId,
  materialIds,
  purpose = "explore",
  title = "Visual directions",
  className,
  slideTexts,
}: {
  creationId?: string;
  materialIds?: string[];
  purpose?: "explore" | "carousel" | "transform-preview";
  title?: string;
  className?: string;
  /** A Carousel's words per slide, in order: the text editor starts each image with its slide's line. */
  slideTexts?: string[];
}) {
  const [textAt, setTextAt] = useState<number | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify({ creationId, materialIds });
  const body = useCallback((extra: Record<string, unknown> = {}) => ({ creationId: creationId ?? null, materialIds, purpose, ...extra }), [creationId, materialIds, purpose]);
  const idem = useRef<string | null>(null);

  // What's stored for this context — never starts anything (§12).
  useEffect(() => {
    let live = true;
    api<Reply>("/api/v1/image-generations", { method: "POST", json: body({ lookupOnly: true }) })
      .then((r) => live && setReply(r))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const gen = reply?.generation;
  const working = gen && (gen.status === "queued" || gen.status === "processing");
  const changing = new Set((gen?.revisions ?? []).filter((r) => r.status !== "failed").map((r) => r.assetId));
  const follow = !!working || changing.size > 0;
  // Follow a generation (or an image being changed) in flight; the page never waits on it.
  useEffect(() => {
    if (!follow || !gen) return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ generation: Generation }>(`/api/v1/image-generations/${gen.id}`);
        setReply((prev) => (prev ? { ...prev, state: "generation", generation: r.generation } : prev));
      } catch {
        // Keep the skeletons; the next tick tries again.
      }
    }, 3000);
    return () => clearInterval(t);
  }, [follow, gen]);

  async function create(regenerate = false) {
    setBusy(true);
    setError(null);
    try {
      if (regenerate && gen) setReply(await api<Reply>(`/api/v1/image-generations/${gen.id}/regenerate`, { method: "POST" }));
      else {
        idem.current ??= crypto.randomUUID();
        setReply(await api<Reply>("/api/v1/image-generations", { method: "POST", json: body({ idempotencyKey: idem.current }) }));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const [saving, setSaving] = useState(false);
  // Keep the chosen concept (§61, §64): as a Material, or straight into this Creation's references.
  async function save(a: Asset, useInCreation: boolean) {
    if (!gen) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ materialId: string }>(`/api/v1/image-generations/${gen.id}/save`, { method: "POST", json: { assetId: a.id, useInCreation } });
      setReply((prev) => (prev?.generation ? { ...prev, generation: { ...prev.generation, assets: prev.generation.assets.map((x) => (x.id === a.id ? { ...x, savedMaterialId: r.materialId, selected: true } : x)) } } : prev));
      setSavedTo(useInCreation ? "creation" : "material");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  const [savedTo, setSavedTo] = useState<"material" | "creation" | null>(null);

  async function choose(a: Asset) {
    if (!gen) return;
    setReply((prev) => (prev?.generation ? { ...prev, generation: { ...prev.generation, assets: prev.generation.assets.map((x) => ({ ...x, selected: x.id === a.id })) } } : prev));
    await api(`/api/v1/image-generations/${gen.id}/select`, { method: "POST", json: { assetId: a.id } }).catch(() => undefined);
  }

  const isCarousel = purpose === "carousel";
  async function move(a: Asset, dir: -1 | 1) {
    if (!gen) return;
    const ids = gen.assets.map((x) => x.id);
    const i = ids.indexOf(a.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    const prevAssets = gen.assets;
    const byId = new Map(prevAssets.map((x) => [x.id, x]));
    setReply((prev) => (prev?.generation ? { ...prev, generation: { ...prev.generation, assets: ids.map((id) => byId.get(id)!) } } : prev));
    try {
      await api(`/api/v1/image-generations/${gen.id}/order`, { method: "POST", json: { assetIds: ids } });
    } catch (e) {
      setReply((prev) => (prev?.generation ? { ...prev, generation: { ...prev.generation, assets: prevAssets } } : prev));
      setError(errorMessage(e));
    }
  }

  const [changeFor, setChangeFor] = useState<Asset | null>(null);
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const revKey = useRef<string | null>(null);
  async function askChange(e: React.FormEvent) {
    e.preventDefault();
    if (!gen || !changeFor) return;
    setAsking(true);
    setChangeError(null);
    try {
      revKey.current ??= crypto.randomUUID();
      const r = await api<{ state: "generation" | "unavailable"; generation?: Generation }>(`/api/v1/image-generations/${gen.id}/assets/${changeFor.id}/revise`, {
        method: "POST",
        json: { instruction, idempotencyKey: revKey.current },
      });
      if (r.state === "unavailable" || !r.generation) {
        setChangeError("Image generation isn't connected.");
        return;
      }
      setReply((prev) => (prev ? { ...prev, state: "generation", generation: r.generation } : prev));
      setChangeFor(null);
      setInstruction("");
      revKey.current = null;
    } catch (err) {
      setChangeError(errorMessage(err));
    } finally {
      setAsking(false);
    }
  }

  // "High quality version" (§62): only when asked, for the chosen image; a failure says so rather than downgrading (§53).
  const upKey = useRef<string | null>(null);
  async function upgrade(a: Asset) {
    if (!gen) return;
    setError(null);
    try {
      upKey.current ??= crypto.randomUUID();
      const r = await api<{ state: "generation" | "unavailable"; generation?: Generation }>(`/api/v1/image-generations/${gen.id}/assets/${a.id}/upgrade`, { method: "POST", json: { idempotencyKey: upKey.current } });
      if (r.state === "unavailable" || !r.generation) setError("Image generation isn't connected.");
      else setReply((prev) => (prev ? { ...prev, state: "generation", generation: r.generation } : prev));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      upKey.current = null;
    }
  }

  const aspect = gen?.aspectRatio === "16:9" ? "aspect-video" : gen?.aspectRatio === "1:1" ? "aspect-square" : "aspect-[4/5]";
  const ready = gen && (gen.status === "complete" || gen.status === "partial") && gen.assets.length > 0;

  return (
    <section aria-labelledby="visual-directions" className={cn("scroll-mt-20 space-y-2", className)}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h2 id="visual-directions" className="text-base font-semibold text-ink">
          {title}
        </h2>
        {ready ? (
          <Button variant="ghost" size="sm" onClick={() => create(true)} loading={busy}>
            <RefreshCw className="size-4" aria-hidden /> Try another direction
          </Button>
        ) : null}
      </div>

      {!reply && !error ? <p className="text-[13px] text-ink-subtle">Looking for saved directions…</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {reply?.state === "no_context" ? <p className="text-sm text-ink-muted">Add a Material or describe the idea first.</p> : null}

      {reply && !gen && reply.state !== "no_context" ? (
        reply.available ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-soft bg-surface/80 p-3">
            <p className="min-w-0 flex-1 text-sm text-ink-muted">See a few ways this could look — made from this context, kept until it changes.</p>
            <Button size="sm" onClick={() => create()} loading={busy}>
              Create visual directions
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface/80 p-3 text-sm text-ink-muted">
            <ImageOff className="size-4 shrink-0" aria-hidden /> Image generation isn&apos;t connected.
          </p>
        )
      ) : null}

      {working ? (
        <div aria-busy="true">
          <p className="mb-2 text-[13px] text-ink-muted" role="status">
            Creating visual directions…
          </p>
          <ul className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:px-0">
            {Array.from({ length: gen!.requestedCount }).map((_, i) => (
              <li key={i} className={cn("w-40 shrink-0 rounded-xl bg-surface-muted motion-safe:animate-pulse sm:w-44", aspect)} />
            ))}
          </ul>
        </div>
      ) : null}

      {gen?.status === "failed" || (gen && !working && !ready) ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-muted">Couldn&apos;t create visual directions.</p>
          <Button variant="secondary" size="sm" onClick={() => create(true)} loading={busy}>
            Try again
          </Button>
        </div>
      ) : null}

      {ready ? (
        <>
          <ul aria-label="Visual directions" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:px-0">
            {gen!.assets.map((a, i) => (
              <li key={a.id} className="w-40 shrink-0 snap-start sm:w-44">
                <button type="button" aria-pressed={a.selected} onClick={() => choose(a)} className={cn("group block w-full text-left focus-visible:outline-none")}>
                  <span className={cn("relative block overflow-hidden rounded-xl border-2 bg-surface-muted", aspect, a.selected ? "border-accent" : "border-transparent", "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent")}>
                    {a.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.thumbnailUrl} alt={a.directionLabel ? `${a.directionLabel} direction` : "Visual direction"} loading={i === 0 ? "eager" : "lazy"} className="size-full object-cover motion-safe:animate-[fade-in_140ms_ease-out]" />
                    ) : null}
                    {isCarousel ? (
                      <span aria-hidden className="absolute left-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-navy/75 text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                    ) : null}
                    {changing.has(a.id) ? (
                      <span className="absolute inset-0 flex items-end bg-surface-muted/70 p-2 text-xs font-medium text-ink motion-safe:animate-pulse" role="status">
                        Changing…
                      </span>
                    ) : null}
                    {a.selected ? (
                      <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-accent text-white">
                        <Check className="size-4" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[13px] font-medium text-ink">
                    {isCarousel ? <span className="sr-only">Slide {i + 1}: </span> : null}
                    {a.directionLabel ?? "Direction"}
                    {a.qualityIntent === "premium" && gen!.assets.some((x) => x.qualityIntent !== "premium") ? (
                      <span className="font-normal text-ink-subtle"> · high quality</span>
                    ) : a.revised ? (
                      <span className="font-normal text-ink-subtle"> · changed</span>
                    ) : null}
                  </span>
                  {a.rationale ? <span className="block text-xs leading-snug text-ink-subtle">{a.rationale}</span> : null}
                </button>
              </li>
            ))}
          </ul>
          {(() => {
            const chosen = gen!.assets.find((a) => a.selected);
            if (!chosen) return <p className="text-xs text-ink-subtle">Tap a direction to choose it.</p>;
            const at = gen!.assets.indexOf(chosen);
            const failed = gen!.revisions?.find((r) => r.status === "failed" && r.assetId === chosen.id);
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setTextAt(at)} className={isCarousel ? "order-first" : "order-last"}>
                    <Type className="size-4" aria-hidden /> Add text
                  </Button>
                  {creationId && savedTo !== "creation" ? (
                    <Button size="sm" onClick={() => save(chosen, true)} loading={saving}>
                      Use in this Creation
                    </Button>
                  ) : null}
                  {!creationId && !chosen.savedMaterialId ? (
                    <Button size="sm" onClick={() => save(chosen, false)} loading={saving}>
                      Save as Material
                    </Button>
                  ) : null}
                  <Menu>
                    <MenuTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label="More for this image" className="order-last">
                        <MoreHorizontal className="size-4" aria-hidden />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setChangeFor(chosen)}>
                        <Wand2 className="size-4" aria-hidden /> Change this image…
                      </MenuItem>
                      {chosen.qualityIntent !== "premium" && !changing.has(chosen.id) ? (
                        <MenuItem onSelect={() => upgrade(chosen)}>
                          <Sparkles className="size-4" aria-hidden /> High quality version
                        </MenuItem>
                      ) : null}
                      {isCarousel && at > 0 ? (
                        <MenuItem onSelect={() => move(chosen, -1)}>
                          <ArrowLeft className="size-4" aria-hidden /> Move earlier
                        </MenuItem>
                      ) : null}
                      {isCarousel && at < gen!.assets.length - 1 ? (
                        <MenuItem onSelect={() => move(chosen, 1)}>
                          <ArrowRight className="size-4" aria-hidden /> Move later
                        </MenuItem>
                      ) : null}
                      {creationId && !chosen.savedMaterialId ? (
                        <MenuItem onSelect={() => save(chosen, false)}>
                          <Save className="size-4" aria-hidden /> Save as Material
                        </MenuItem>
                      ) : null}
                    </MenuContent>
                  </Menu>
                </div>
                {chosen.savedMaterialId ? (
                  <p role="status" className="text-sm text-ink-muted">
                    {savedTo === "creation" ? "Added to this Creation's references. " : "Saved to your Materials. "}
                    <a href={`/space/materials/${chosen.savedMaterialId}`} className="font-medium text-accent-ink hover:underline">
                      Open Material
                    </a>
                  </p>
                ) : null}
                {failed ? (
                  failed.kind === "upgrade" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-ink-muted">Couldn&apos;t create the high-quality version.</p>
                      <Button variant="ghost" size="sm" onClick={() => upgrade(chosen)}>
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">Couldn&apos;t change that image. Try saying it differently.</p>
                  )
                ) : null}
              </>
            );
          })()}
          {textAt !== null ? (
            <SlideTextDialog
              key={`${gen!.id}-${textAt}`}
              open
              onOpenChange={(o) => !o && setTextAt(null)}
              generationId={gen!.id}
              assets={gen!.assets}
              startAt={textAt}
              creationId={creationId}
              prefill={(a) => (isCarousel ? (slideTexts?.[gen!.assets.findIndex((x) => x.id === a.id)] ?? "") : "")}
            />
          ) : null}
          <Dialog
            open={!!changeFor}
            onOpenChange={(o) => {
              if (!o) {
                setChangeFor(null);
                setChangeError(null);
              }
            }}
          >
            <DialogContent title="Change this image">
              <form onSubmit={askChange} className="space-y-3">
                <div className="flex items-start gap-3">
                  {changeFor?.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={changeFor.thumbnailUrl} alt="" className={cn("w-16 shrink-0 rounded-lg object-cover", aspect)} />
                  ) : null}
                  <Field label="What should change?" htmlFor="change-image" className="min-w-0 flex-1">
                    <Textarea
                      id="change-image"
                      rows={3}
                      className="min-h-0"
                      maxLength={300}
                      required
                      value={instruction}
                      placeholder="e.g. make it night, with rain on the window"
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </Field>
                </div>
                <p className="text-xs text-ink-subtle">It keeps this image&apos;s place in the set. The current one stays in its history.</p>
                {changeError ? (
                  <p role="alert" className="text-sm text-danger">
                    {changeError}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={asking} disabled={!instruction.trim()}>
                    Change image
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          {gen!.status === "partial" ? (
            <p className="text-xs text-ink-subtle">
              {gen!.assets.length} of {gen!.requestedCount} ready.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
