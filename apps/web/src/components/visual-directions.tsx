"use client";
import { Button, cn } from "@wonder/ui";
import { Check, ImageOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Asset = { id: string; sequence: number; imageUrl: string | null; thumbnailUrl: string | null; directionLabel: string | null; rationale: string | null; selected: boolean };
type Generation = { id: string; status: "queued" | "processing" | "complete" | "partial" | "failed" | "cancelled"; requestedCount: number; aspectRatio: string; assets: Asset[] };
type Reply = { state: "generation" | "none" | "unavailable" | "no_context"; generation?: Generation; available: boolean };

/**
 * Visual directions from the creator's own context (docs/image-generation.md §27–29, §69–72): a compact carousel of
 * 3–5 concepts. It shows what's already stored for this context at once; it generates only when the creator asks; it
 * says plainly when image generation isn't connected. Small skeletons while creating, a short crossfade when ready.
 */
export function VisualDirections({ creationId, materialIds, purpose = "explore", title = "Visual directions", className }: { creationId?: string; materialIds?: string[]; purpose?: "explore" | "carousel"; title?: string; className?: string }) {
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
  // Follow a generation in flight; the page never waits on it.
  useEffect(() => {
    if (!working || !gen) return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ generation: Generation }>(`/api/v1/image-generations/${gen.id}`);
        setReply((prev) => (prev ? { ...prev, state: "generation", generation: r.generation } : prev));
      } catch {
        // Keep the skeletons; the next tick tries again.
      }
    }, 3000);
    return () => clearInterval(t);
  }, [working, gen]);

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

  async function choose(a: Asset) {
    if (!gen) return;
    setReply((prev) => (prev?.generation ? { ...prev, generation: { ...prev.generation, assets: prev.generation.assets.map((x) => ({ ...x, selected: x.id === a.id })) } } : prev));
    await api(`/api/v1/image-generations/${gen.id}/select`, { method: "POST", json: { assetId: a.id } }).catch(() => undefined);
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
                    {a.selected ? (
                      <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-accent text-white">
                        <Check className="size-4" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[13px] font-medium text-ink">{a.directionLabel ?? "Direction"}</span>
                  {a.rationale ? <span className="block text-xs leading-snug text-ink-subtle">{a.rationale}</span> : null}
                </button>
              </li>
            ))}
          </ul>
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
