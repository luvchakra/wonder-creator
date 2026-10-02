"use client";
import { RIGHTS_HINT, RIGHTS_LABEL, USAGE_LABEL, canInsert, materialActionsFor, type MaterialAction, type RightsState, type WorkingSetView, type WorkingSource } from "@wonder/creator-studio/working-set";
import { Dialog, DialogContent, KIT, cn } from "@wonder/ui";
import { ChevronDown, ChevronRight, Columns2, Compass, Eye, Image as ImageIcon, ImagePlus, Loader2, MessagesSquare, PenLine, Pin, Plus, RefreshCw, Scissors, Search, Settings2, Sparkles, Type } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSoundtrack } from "@/components/soundtrack/audio-provider";
import { useFeature } from "@/components/features";
import { api, errorMessage } from "@/lib/client";
import { responsesLine, type ResponsesSummary } from "./studio-community";
import { SourceIcon } from "./working-set";

/**
 * The Working Table (owner board "Working Table Redesign", 29 Sep 2026): pulled up from the bottom bar, it holds what's
 * on the table in three tabs — In use, Available, External. Each material is a card that stays collapsed with its
 * quick actions visible; the one opened last shows what it holds. External searches royalty-free pictures (Openverse,
 * Pixabay, Unsplash) right here: "Use as slide", "Use for mood", "Add to Table". Pinning, selecting several and "Use
 * together" live one tap away under Manage.
 */

type Tab = "in_use" | "available" | "external";

// Which card is open (any can be closed — all closed too). Kept in the Studio session so it survives navigation and
// devices (Phase 04 §10, §19); this device's copy answers instantly, "none" meaning all were closed on purpose.
const listeners = new Set<() => void>();
const keyFor = (artifactId: string) => `wc.studio.open-source:${artifactId}`;
function readOpen(artifactId: string): string | null {
  try {
    return localStorage.getItem(keyFor(artifactId));
  } catch {
    return null;
  }
}
function writeOpen(artifactId: string, id: string | null, sessionId: string | null) {
  try {
    localStorage.setItem(keyFor(artifactId), id ?? "none");
  } catch {
    /* private mode: the session still remembers */
  }
  listeners.forEach((l) => l());
  if (sessionId) void api(`/api/v1/studio-sessions/${sessionId}`, { method: "PATCH", json: { lastOpenedSourceId: id } }).catch(() => undefined);
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
  direction: Compass,
  visual_ref: Eye,
  pin: Pin,
};

export interface ExternalAdded {
  title: string;
  thumbUrl: string;
  message: string;
  slideId: string | null;
}

export function WorkingTable({
  open,
  onOpenChange,
  initialTab = "in_use",
  set,
  artifactId,
  creationTitle,
  creationType,
  slideId,
  onAction,
  onUsePart,
  onManage,
  onBringIn,
  onExternalAdded,
  responses,
  onResponses,
  onDejaVu,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab?: Tab;
  set: WorkingSetView | null;
  artifactId: string;
  creationTitle: string;
  creationType: string;
  /** The slide on screen (Carousel), for "Use as slide". */
  slideId: string | null;
  onAction: (row: WorkingSource, action: MaterialAction) => Promise<void>;
  onUsePart: (row: WorkingSource) => void;
  onManage: () => void;
  onBringIn: () => void;
  onExternalAdded: (r: ExternalAdded) => void;
  /** Replies to what the creator asked Community about this Creation ("7 community responses · 2 new"). */
  responses: ResponsesSummary | null;
  onResponses: () => void;
  /** The DejaVu being explored here: its Moments, one tap away. */
  onDejaVu: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Working Table" art={KIT.painted.leafSprigSage} wide className="sm:max-w-2xl">
        {open ? (
          <TableBody
            initialTab={initialTab}
            set={set}
            artifactId={artifactId}
            creationTitle={creationTitle}
            creationType={creationType}
            slideId={slideId}
            onAction={async (row, a) => {
              await onAction(row, a);
            }}
            onUsePart={(row) => {
              onOpenChange(false);
              onUsePart(row);
            }}
            onManage={onManage}
            onBringIn={onBringIn}
            onExternalAdded={(r) => {
              onOpenChange(false);
              onExternalAdded(r);
            }}
            responses={responses}
            onResponses={onResponses}
            onDejaVu={onDejaVu}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TableBody({
  initialTab,
  set,
  artifactId,
  creationTitle,
  creationType,
  slideId,
  onAction,
  onUsePart,
  onManage,
  onBringIn,
  onExternalAdded,
  responses,
  onResponses,
  onDejaVu,
}: {
  initialTab: Tab;
  set: WorkingSetView | null;
  artifactId: string;
  creationTitle: string;
  creationType: string;
  slideId: string | null;
  onAction: (row: WorkingSource, action: MaterialAction) => Promise<void>;
  onUsePart: (row: WorkingSource) => void;
  onManage: () => void;
  onBringIn: () => void;
  onExternalAdded: (r: ExternalAdded) => void;
  responses: ResponsesSummary | null;
  onResponses: () => void;
  onDejaVu: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const line = responsesLine(responses);
  const all = (set?.sources ?? []).filter((s) => s.available);
  const inUse = all.filter((s) => s.state !== "available");
  const available = all.filter((s) => s.state === "available");
  const externalOn = useFeature("external_image_sources_enabled");
  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "in_use", label: "In use", count: inUse.length },
    { key: "available", label: "Available", count: available.length },
    ...(externalOn ? [{ key: "external" as const, label: "External" }] : []),
  ];
  return (
    <div className="space-y-3">
      {/* Groups that stay closed until asked for (Phase 04 §5, §14): a DejaVu being explored, and Community replies. */}
      {set?.dejavu || line ? (
        <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface/70" aria-label="More on the table">
          {set?.dejavu ? (
            <li>
              <button type="button" onClick={onDejaVu} className="flex min-h-12 w-full items-center gap-2.5 px-3 py-1.5 text-left">
                <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                  <span className="font-medium">{set.dejavu.name}</span> · {set.dejavu.count} {set.dejavu.count === 1 ? "Moment" : "Moments"} available
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </button>
            </li>
          ) : null}
          {line ? (
            <li>
              <button type="button" onClick={onResponses} className="flex min-h-12 w-full items-center gap-2.5 px-3 py-1.5 text-left">
                <MessagesSquare className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{line}</span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      <div role="tablist" aria-label="Working Table" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className="inline-flex min-h-11 shrink-0 items-center"
          >
            <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", tab === t.key ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>
              {t.label}
              {t.count !== undefined ? <span className="rounded-full bg-white/70 px-1.5 text-[11.5px]">{t.count}</span> : null}
            </span>
          </button>
        ))}
      </div>

      {tab === "external" ? (
        <External sessionId={set?.sessionId ?? null} creationTitle={creationTitle} carousel={creationType === "carousel"} slideId={slideId} onAdded={onExternalAdded} />
      ) : (
        <div role="tabpanel" aria-label={tab === "in_use" ? "In use" : "Available"} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-[15px] font-semibold text-ink">{tab === "in_use" ? "Used in this project" : "On the table, not used yet"}</h3>
            <span className="text-[12.5px] text-ink-subtle">
              {(tab === "in_use" ? inUse : available).length} {(tab === "in_use" ? inUse : available).length === 1 ? "item" : "items"}
            </span>
          </div>
          <Cards rows={tab === "in_use" ? inUse : available} set={set} artifactId={artifactId} creationType={creationType} onAction={onAction} onUsePart={onUsePart} />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onBringIn} className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-accent/50 px-3.5 text-[13px] font-medium text-accent-ink hover:bg-accent-softer">
                <Plus className="size-4" aria-hidden /> Bring in
              </span>
            </button>
            <button type="button" onClick={onManage} className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-muted hover:text-ink">
                <Settings2 className="size-4" aria-hidden /> Manage · pin, select, use together
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Cards({
  rows,
  set,
  artifactId,
  creationType,
  onAction,
  onUsePart,
}: {
  rows: WorkingSource[];
  set: WorkingSetView | null;
  artifactId: string;
  creationType: string;
  onAction: (row: WorkingSource, action: MaterialAction) => Promise<void>;
  onUsePart: (row: WorkingSource) => void;
}) {
  const remembered = useSyncExternalStore(
    subscribe,
    () => readOpen(artifactId),
    () => null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number[]>>({});
  const sessionId = set?.sessionId ?? null;
  useEffect(() => {
    if (!sessionId) return;
    let live = true;
    api<{ usage: Record<string, number[]> }>(`/api/v1/studio-sessions/${sessionId}/usage`)
      .then((r) => live && setUsage(r.usage))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [sessionId]);
  if (!rows.length) return <p className="rounded-2xl bg-surface-muted/60 px-4 py-5 text-center text-[13.5px] text-ink-muted">Nothing here yet.</p>;
  const want = remembered === "none" ? null : (remembered ?? set?.lastOpenedSourceId ?? null);
  const openId = want && rows.some((r) => r.id === want) ? want : null;
  return (
    <ul className="space-y-2" aria-label="Materials">
      {rows.map((row) => {
        const open = row.id === openId;
        const actions = materialActionsFor(row, creationType);
        const how = row.usageNote ? `“${row.usageNote}”` : row.usageIntent ? USAGE_LABEL[row.usageIntent] : null;
        const sub = row.fresh && !how ? `Freshly brought in · ${row.kind}` : [how, usedIn(usage[row.id])].filter(Boolean).join(" · ") || row.kind;
        // Rights show only when they limit what can be done (Phase 04 §8) — never a badge on your own things.
        const limit = row.rights !== "reuse_permitted" ? RIGHTS_LABEL[row.rights] : null;
        return (
          <li key={row.id} className="rounded-2xl border border-border-soft bg-surface">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`source-${row.id}`}
              onClick={() => writeOpen(artifactId, open ? null : row.id, sessionId)}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
            >
              <SourceIcon s={row} size="size-11" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {row.fresh ? <span className="shrink-0 rounded-full bg-accent-softer px-1.5 py-px text-[11px] font-semibold text-accent-ink">New</span> : null}
                  <span className="truncate text-[14.5px] font-semibold text-ink">{row.title}</span>
                </span>
                <span className="block truncate text-[12.5px] text-ink-subtle">
                  {limit ? <span className={cn("font-medium", canInsert(row.rights) ? "text-ink-muted" : "text-accent-ink")}>{limit} · </span> : null}
                  {sub}
                </span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-ink-subtle transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
            </button>
            {open && set ? <SourceBody row={row} sessionId={set.sessionId} artifactId={artifactId} onUsePart={() => onUsePart(row)} /> : null}
            {actions.length ? (
              <div className="flex flex-wrap gap-x-1.5 px-3 pb-2" role="group" aria-label={`Use ${row.title}`}>
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
                      className="group inline-flex min-h-11 items-center disabled:opacity-60"
                    >
                      {/* Content-sized, wrapping pills: a label is never cut off (owner, 29 Sep 2026). */}
                      <span className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-soft px-3 text-[12.5px] font-medium text-ink group-hover:bg-accent-softer">
                        {busy === key ? <Loader2 className="size-4 shrink-0 text-accent motion-safe:animate-spin" aria-hidden /> : <Icon className="size-4 shrink-0 text-accent-ink" aria-hidden />}
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
  );
}

/** What the open card holds. Loaded when opened; the card never waits for it. */
function SourceBody({ row, sessionId, artifactId, onUsePart }: { row: WorkingSource; sessionId: string; artifactId: string; onUsePart: () => void }) {
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
    <div id={`source-${row.id}`} className="mx-3 mb-2.5 space-y-2 rounded-xl bg-surface-muted/70 px-3 py-2.5">
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
      {row.attribution || row.author || row.rights !== "reuse_permitted" ? (
        <p className="text-[12px] leading-snug text-ink-subtle">
          {row.attribution ?? (row.author && row.author !== "You" ? `By ${row.author}` : null)}
          {row.attribution || (row.author && row.author !== "You") ? " · " : ""}
          {RIGHTS_HINT[row.rights]}
        </p>
      ) : null}
      <p className="flex flex-wrap gap-x-4 text-[13px]">
        {row.href ? (
          <Link href={`${row.href}${row.href.includes("?") ? "&" : "?"}from=studio:${artifactId}`} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
            See more
          </Link>
        ) : null}
        {canPart ? (
          <button type="button" onClick={onUsePart} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
            Use a part of it…
          </button>
        ) : null}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- External */

type Provider = "openverse" | "pixabay" | "unsplash";
const PROVIDER_LABEL: Record<Provider, string> = { openverse: "Openverse", pixabay: "Pixabay", unsplash: "Unsplash" };
type Pic = { provider: Provider; id: string; title: string; thumbUrl: string; creator: string | null; creatorUrl?: string | null; license: string; sourceUrl: string; rights: RightsState; attribution: string | null };

/** Royalty-free pictures, searched right here (board 3). Every picture shows its licence; nothing is used until tapped. */
function External({ sessionId, creationTitle, carousel, slideId, onAdded }: { sessionId: string | null; creationTitle: string; carousel: boolean; slideId: string | null; onAdded: (r: ExternalAdded) => void }) {
  const [q, setQ] = useState(creationTitle.slice(0, 80));
  const [provider, setProvider] = useState<Provider>("openverse");
  const [state, setState] = useState<{ key: string; connected: boolean; results: Pic[]; providers: Array<{ provider: Provider; connected: boolean }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [asked, setAsked] = useState(`${provider}:${creationTitle.slice(0, 80)}`);
  useEffect(() => {
    let live = true;
    const [p, ...rest] = asked.split(":");
    api<{ connected: boolean; results: Pic[]; providers: Array<{ provider: Provider; connected: boolean }> }>(`/api/v1/external-images?provider=${p}&q=${encodeURIComponent(rest.join(":"))}`)
      .then((r) => {
        if (!live) return;
        setError(null);
        setState({ key: asked, ...r });
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [asked]);
  const loading = !error && state?.key !== asked;
  async function add(pic: Pic, use: "table" | "slide" | "mood") {
    if (!sessionId) return;
    setBusy(`${pic.id}:${use}`);
    setError(null);
    try {
      const r = await api<{ title: string; thumbUrl: string; message: string; slideId: string | null }>(`/api/v1/studio-sessions/${sessionId}/external`, {
        method: "POST",
        json: { provider: pic.provider, imageId: pic.id, use, slideId },
      });
      onAdded({ title: r.title, thumbUrl: r.thumbUrl, message: r.message, slideId: r.slideId });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div role="tabpanel" aria-label="External" className="space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(`${provider}:${q.trim()}`);
        }}
        className="flex items-center gap-2 rounded-full border border-border-soft bg-surface px-3"
      >
        <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <label htmlFor="external-q" className="sr-only">
          Search royalty-free pictures
        </label>
        <input id="external-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="moonlit road, rain, night, poetic…" className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none" />
      </form>
      <div role="radiogroup" aria-label="Picture service" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => {
          const connected = state?.providers.find((x) => x.provider === p)?.connected ?? p === "openverse";
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={provider === p}
              onClick={() => {
                setProvider(p);
                setAsked(`${p}:${q.trim()}`);
              }}
              className="inline-flex min-h-11 shrink-0 items-center"
            >
              <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium", provider === p ? "bg-accent text-white" : "bg-surface-muted text-ink-muted hover:text-ink", !connected && provider !== p && "opacity-60")}>
                {PROVIDER_LABEL[p]}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="aspect-[4/3] rounded-2xl bg-surface-muted motion-safe:animate-pulse" />
          ))}
        </div>
      ) : state && !state.connected ? (
        <p className="rounded-2xl bg-surface-muted/60 px-4 py-5 text-center text-[13.5px] text-ink-muted">{PROVIDER_LABEL[provider]} isn&apos;t connected. Openverse works without a key.</p>
      ) : state && !state.results.length ? (
        <p className="rounded-2xl bg-surface-muted/60 px-4 py-5 text-center text-[13.5px] text-ink-muted">{asked.split(":").slice(1).join(":").trim() ? "Nothing found. Try other words." : "Search for a mood, a place or a thing."}</p>
      ) : state ? (
        <ul className="grid grid-cols-2 gap-2.5" aria-label={`${PROVIDER_LABEL[provider]} pictures`}>
          {state.results.map((pic) => (
            <li key={pic.id} className="overflow-hidden rounded-2xl border border-border-soft bg-surface">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pic.thumbUrl} alt={pic.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
              </div>
              {pic.provider === "unsplash" ? (
                // Unsplash's credit, as its API guidelines ask: photographer and Unsplash, both linked.
                <p className="truncate px-2.5 pt-1.5 text-[11.5px] text-ink-subtle" title={`${pic.attribution ?? ""} · ${pic.license}`}>
                  Photo by{" "}
                  <a href={pic.creatorUrl ?? pic.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {pic.creator}
                  </a>{" "}
                  on{" "}
                  <a href="https://unsplash.com/?utm_source=wonder_creator&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    Unsplash
                  </a>
                </p>
              ) : (
                <p className="truncate px-2.5 pt-1.5 text-[11.5px] text-ink-subtle" title={`${pic.creator ?? ""} · ${pic.license} · ${RIGHTS_LABEL[pic.rights]}`}>
                  {pic.creator ? `${pic.creator} · ` : ""}
                  {pic.license}
                </p>
              )}
              <p className="truncate px-2.5 text-[11.5px] text-ink-subtle">
                {RIGHTS_LABEL[pic.rights]} ·{" "}
                <a href={pic.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {PROVIDER_LABEL[pic.provider]}
                </a>
              </p>
              <div className="px-2 pb-1">
                <button
                  type="button"
                  disabled={!!busy || (carousel && !canInsert(pic.rights))}
                  onClick={() => add(pic, carousel ? "slide" : "mood")}
                  className="group flex min-h-11 w-full items-center disabled:opacity-60"
                >
                  <span className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-accent-softer px-2 text-[12.5px] font-medium text-accent-ink group-hover:bg-accent-soft">
                    {busy === `${pic.id}:${carousel ? "slide" : "mood"}` ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> : null}
                    {carousel ? "Use as slide" : "Use for mood"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => add(pic, "table")}
                  aria-label={`Add to Table: ${pic.title}`}
                  className="flex min-h-11 w-full items-center justify-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-ink hover:bg-surface-muted disabled:opacity-60"
                >
                  {busy === `${pic.id}:table` ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />} Add to Table
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11.5px] text-ink-subtle">Royalty-free pictures from outside Wonder Creator. The licence and creator are kept with the picture.</p>
    </div>
  );
}
