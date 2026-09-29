"use client";
import { USAGE_LABEL, groupSources, materialActionsFor, type MaterialAction, type WorkingSetView, type WorkingSource } from "@wonder/creator-studio/working-set";
import { cn } from "@wonder/ui";
import { ChevronDown, ChevronRight, Columns2, Loader2, Image as ImageIcon, ImagePlus, PenLine, RefreshCw, Scissors, Sparkles, Type } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import { useSoundtrack } from "@/components/soundtrack/audio-provider";
import { SourceIcon } from "./working-set";

/**
 * "Used materials" (owner board, 28 Sep 2026): every source on the table, right under the canvas, as compact rows —
 * all collapsed but the last one opened, which shows what it holds (the picture, the words, the recording). Each row
 * says where it's used ("Used in slides 1–3", derived from what's recorded) or, when that can't be known, its state.
 * The device remembers which row is open. Nothing here changes the Working Set; that stays in the sheet.
 */

const STATE_LABEL = { pinned: "Pinned", in_use: "In use", available: "Available" } as const;

// Which row is open, remembered per Creation on this device. A tiny external store so the first render already knows.
const listeners = new Set<() => void>();
const keyFor = (artifactId: string) => `wc.studio.open-source:${artifactId}`;
function readOpen(artifactId: string): string | null {
  try {
    return localStorage.getItem(keyFor(artifactId));
  } catch {
    return null;
  }
}
function writeOpen(artifactId: string, id: string | null) {
  try {
    if (id) localStorage.setItem(keyFor(artifactId), id);
    else localStorage.removeItem(keyFor(artifactId));
  } catch {
    /* private mode: it just won't be remembered */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** "Used in slides 1–3", "Used in slides 1, 3", "Used in slide 2". */
export function usedIn(slides: number[] | undefined): string | null {
  if (!slides?.length) return null;
  const runs: string[] = [];
  let start = slides[0]!;
  let prev = start;
  for (const s of slides.slice(1).concat([Number.NaN])) {
    if (s === prev + 1) {
      prev = s;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = s;
  }
  return `Used in ${slides.length === 1 ? "slide" : "slides"} ${runs.join(", ")}`;
}

const ACTION_ICON: Record<MaterialAction, typeof ImageIcon> = {
  new_slide: ImagePlus,
  slide_image: RefreshCw,
  cover: ImageIcon,
  slide_words: Type,
  split_slides: Columns2,
  refine_slide: Sparkles,
  draft_words: PenLine,
  refine_draft: Sparkles,
  part: Scissors,
};

export function SourcesPanel({
  set,
  artifactId,
  creationType,
  onSeeAll,
  onUsePart,
  onAction,
}: {
  set: WorkingSetView | null;
  artifactId: string;
  creationType: string;
  onSeeAll: () => void;
  onUsePart: (row: WorkingSource) => void;
  /** Make a one-tap use happen (the Studio knows the slide on screen and the draft). */
  onAction: (row: WorkingSource, action: MaterialAction) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const remembered = useSyncExternalStore(
    subscribe,
    () => readOpen(artifactId),
    () => null,
  );
  const [usage, setUsage] = useState<Record<string, number[]>>({});
  const sessionId = set?.sessionId ?? null;
  const count = set?.sources.length ?? 0;
  useEffect(() => {
    if (!sessionId || !count) return;
    let live = true;
    api<{ usage: Record<string, number[]> }>(`/api/v1/studio-sessions/${sessionId}/usage`)
      .then((r) => live && setUsage(r.usage))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [sessionId, count]);

  const all = set?.sources ?? [];
  const rows = groupSources(all.filter((s) => s.available)).flatMap((g) => g.sources);
  if (!rows.length) return null;
  const lost = all.length - rows.length;
  // Only the last one opened stays open — and any can be closed, so all can be (owner, 29 Sep 2026).
  const openId = remembered && rows.some((r) => r.id === remembered) ? remembered : null;
  return (
    <section aria-labelledby="sources-title" className="mt-3 rounded-3xl border border-border-soft bg-surface/80 p-3 pt-2 shadow-[var(--shadow-card)]">
      <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-border-soft" />
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 id="sources-title" className="text-[15px] font-semibold text-ink">
            Used materials
          </h2>
          <p className="text-[12.5px] text-ink-subtle">
            {rows.length} {rows.length === 1 ? "material" : "materials"} · {lost ? `${lost} no longer available` : "All visible on this creation"}
          </p>
        </div>
        <button type="button" onClick={onSeeAll} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-full px-2 text-[13px] text-ink-muted hover:text-ink">
          See all <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
        {rows.map((row) => {
          const open = row.id === openId;
          const actions = materialActionsFor(row, creationType);
          const how = row.usageNote ? `“${row.usageNote}”` : row.usageIntent ? USAGE_LABEL[row.usageIntent] : null;
          const where = [how, usedIn(usage[row.id]) ?? (how ? null : STATE_LABEL[row.state])].filter(Boolean).join(" · ");
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`source-${row.id}`}
                onClick={() => writeOpen(artifactId, open ? null : row.id)}
                className="flex min-h-12 w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-black/[0.02]"
              >
                <SourceIcon s={row} size="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {row.fresh ? <span className="shrink-0 rounded-full bg-accent-softer px-1.5 py-px text-[11px] font-semibold text-accent-ink">New</span> : null}
                    <span className="truncate text-[14px] font-medium text-ink">{row.title}</span>
                  </span>
                  <span className="block truncate text-[12px] text-ink-subtle">{row.kind}</span>
                </span>
                <span className="hidden shrink-0 text-[12.5px] text-ink-muted sm:block">{where}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-ink-subtle transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
              </button>
              <p className="-mt-1 px-2.5 pb-1 pl-[3.5rem] text-[12px] text-ink-muted sm:hidden">{row.fresh && !how ? "Freshly brought in" : where}</p>
              {open && set ? <SourceBody row={row} sessionId={set.sessionId} onUsePart={() => onUsePart(row)} /> : null}
              {/* How to use it here, one tap each (owner board): context-based, always visible, open or not. */}
              {actions.length ? (
                <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-2.5 pb-2.5 [scrollbar-width:none]" role="group" aria-label={`Use ${row.title}`}>
                  {actions.map((x) => {
                    const Icon = ACTION_ICON[x.action];
                    const key = `${row.id}:${x.action}`;
                    return (
                      <button
                        key={x.action}
                        type="button"
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy(key);
                          try {
                            await onAction(row, x.action);
                          } finally {
                            setBusy(null);
                          }
                        }}
                        className="inline-flex min-h-11 shrink-0 items-center"
                      >
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-softer px-3 text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft">
                          {busy === key ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
                          {busy === key ? "Working…" : x.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What the open source holds. Loaded when opened; the row never waits for it. */
function SourceBody({ row, sessionId, onUsePart }: { row: WorkingSource; sessionId: string; onUsePart: () => void }) {
  const sound = useSoundtrack();
  const [detail, setDetail] = useState<{ text: string | null; audioUrl: string | null; durationSeconds: number | null } | null>(null);
  useEffect(() => {
    let live = true;
    api<{ text: string | null; audioUrl: string | null; durationSeconds: number | null }>(`/api/v1/studio-sessions/${sessionId}/sources/${row.id}/detail`)
      .then((d) => live && setDetail(d))
      .catch(() => live && setDetail({ text: null, audioUrl: null, durationSeconds: null }));
    return () => {
      live = false;
    };
  }, [sessionId, row.id]);
  const text = row.fragment?.text ?? detail?.text ?? null;
  const canPart = !!(detail?.audioUrl || text);
  return (
    <div id={`source-${row.id}`} className="mx-2.5 mb-2.5 space-y-2 rounded-xl bg-surface-muted/70 px-3 py-2.5">
      {row.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.thumbnailUrl} alt="" className="max-h-40 w-auto max-w-full rounded-xl border border-border-soft object-cover" />
      ) : null}
      {text ? <p className="line-clamp-4 whitespace-pre-line text-[13px] leading-snug text-ink-muted">{text}</p> : null}
      {detail?.audioUrl ? (
        // Foreground audio interrupts CreativeRadio (mini-player.md §12); it doesn't fight it.
        <audio controls preload="none" src={detail.audioUrl} onPlay={() => sound?.pauseFor("source")} className="h-9 w-full max-w-sm" aria-label={`Play ${row.title}`} />
      ) : null}
      {!row.thumbnailUrl && !text && !detail?.audioUrl ? <p className="text-[12.5px] text-ink-subtle">{detail ? "Nothing to show here yet." : "Loading…"}</p> : null}
      {row.roles.length ? (
        <p className="flex flex-wrap gap-1" aria-label="Roles">
          {row.roles.map((r) => (
            <span key={r} className="rounded-full bg-accent-softer px-2 py-0.5 text-[11.5px] font-medium text-accent-ink">
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </span>
          ))}
        </p>
      ) : null}
      <p className="flex flex-wrap gap-x-4 text-[13px]">
        {row.href ? (
          <Link href={row.href} className="inline-flex min-h-9 items-center font-medium text-accent-ink hover:underline">
            See more
          </Link>
        ) : null}
        {canPart ? (
          <button type="button" onClick={onUsePart} className="inline-flex min-h-9 items-center font-medium text-accent-ink hover:underline">
            Use a part of it…
          </button>
        ) : null}
      </p>
    </div>
  );
}
