"use client";
import { MOOD_LABEL, MOODS, formatDuration, rankTracks, type MoodFilter } from "@wonder/creator-soundtrack";
import { Button, DOCK_GAP, Dialog, DialogContent, Menu, MenuContent, MenuItem, MenuTrigger, cn, dockStyle, useEdgeDock, type DockSide } from "@wonder/ui";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  CloudRain,
  Feather,
  Heart,
  Info,
  LayoutGrid,
  Leaf,
  ListMusic,
  MoreHorizontal,
  MoreVertical,
  Music2,
  Palette as PaletteIcon,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { placeClear, type Box } from "@/lib/mini-player-placement";
import { useSoundtrack, useSoundtrackTime, type LibraryTrack, type Soundtrack } from "./audio-provider";

/** The collapsed tab's height (px): 6.5rem. */
const TAB_H = 104;

const MOOD_ICON: Record<MoodFilter, React.ComponentType<{ className?: string }>> = {
  calm: Feather,
  dreamy: Sparkles,
  focus: CloudRain,
  creative: PaletteIcon,
  energy: Zap,
  cinematic: Clapperboard,
  nature: Leaf,
  all: LayoutGrid,
};
const MOOD_TINT: Record<string, string> = {
  calm: "bg-[#e9f1f7] text-[#3f6b8c]",
  dreamy: "bg-[#efe9fb] text-accent-ink",
  focus: "bg-[#eef0f4] text-[#4b5673]",
  creative: "bg-[#fdeee6] text-[#a4552c]",
  energy: "bg-[#fff3d9] text-[#8a5a00]",
  cinematic: "bg-[#ece8f2] text-[#3d3560]",
  nature: "bg-[#e8f3ea] text-[#3c6b47]",
};

/** Artwork: the track's mood as a small tinted tile (no invented cover art). */
function Art({ t, size = "size-10" }: { t?: LibraryTrack; size?: string }) {
  const m = t?.moods[0] ?? "calm";
  const Icon = MOOD_ICON[m] ?? Music2;
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", size, MOOD_TINT[m])}>
      <Icon className="size-1/2" />
    </span>
  );
}

function Progress({ s, className }: { s: Soundtrack; className?: string }) {
  const { time, duration } = useSoundtrackTime();
  const total = duration || s.current?.duration || 0;
  return (
    <input
      type="range"
      aria-label="Position"
      aria-valuetext={`${formatDuration(time)} of ${formatDuration(total)}`}
      min={0}
      max={Math.max(1, Math.floor(total))}
      step={1}
      value={Math.floor(time)}
      onChange={(e) => s.seek(Number(e.target.value))}
      className={cn("h-11 w-full cursor-pointer accent-[var(--color-accent)]", className)}
    />
  );
}

const iconBtn = "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40";

/**
 * The CreativeRadio mini player (§2): shown once music has started, in the shell (not a page), clear of the Palette.
 * On phones it keeps title, previous / play / next and the queue; the rest waits for wider screens.
 */
/** A quiet equalizer while music plays; still (and motionless under reduced motion) when paused. */
function Bars({ playing }: { playing: boolean }) {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0.55, 1, 0.7, 0.85].map((h, i) => (
        <span
          key={i}
          className={cn("w-[2.5px] origin-bottom rounded-full bg-accent", playing && "motion-safe:animate-[eq_900ms_ease-in-out_infinite_alternate]")}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

/** Visible primary actions: primary buttons (by their style) and anything marked `data-primary-action`. */
function primaryObstacles(exclude: HTMLElement | null): Box[] {
  const vh = window.innerHeight;
  const out: Box[] = [];
  // The Palette trigger, wherever the creator docked it, with the >=72px separation (§15).
  const palette = document.querySelector<HTMLElement>("[data-palette-trigger]")?.getBoundingClientRect();
  if (palette && palette.width > 0) out.push({ top: palette.top - DOCK_GAP, bottom: palette.bottom + DOCK_GAP, left: palette.left - 8, right: palette.right + 8 });
  document.querySelectorAll<HTMLElement>('[data-primary-action], [class*="gradient-primary"]').forEach((el) => {
    if (exclude?.contains(el) || el.closest('[role="dialog"]')) return;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0 && r.bottom > 0 && r.top < vh) out.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  });
  return out;
}

/**
 * Where the expanded panel can sit without covering a primary action or the Palette, recomputed on scroll, resize and
 * page changes. `dy` is the vertical shift from its anchor beside the tab; null = nowhere clear right now.
 */
function useClearOfPrimaryActions(active: boolean, panel: React.RefObject<HTMLDivElement | null>, side: DockSide, centre: number) {
  const [dy, setDy] = useState<number | null>(0);
  const height = useRef(188);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (panel.current) height.current = panel.current.offsetHeight || height.current;
        const width = Math.min(320, vw - 16);
        const c = Math.min(Math.max(centre, height.current / 2 + 8), vh - height.current / 2 - 8);
        const box: Box = { top: c - height.current / 2, bottom: c + height.current / 2, ...(side === "left" ? { left: 8, right: 8 + width } : { right: vw - 8, left: vw - 8 - width }) };
        const navBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 72;
        // Clear of the navbar and the page's bottom edge; the Palette is one of the obstacles.
        const next = placeClear(box, primaryObstacles(panel.current), { min: Math.max(8, navBottom + 8), max: vh - 8 });
        setDy((cur) => (cur === next ? cur : next));
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    window.addEventListener("resize", measure);
    const poll = setInterval(measure, 1000); // pages change under a persistent player
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
      clearInterval(poll);
    };
  }, [active, panel, side, centre]);
  return { dy: active ? dy : 0 };
}

/**
 * The CreativeRadio mini player (docs/ui-redesign/mini-player.md): docked to the right edge around the vertical middle
 * by default. The creator can drag the tab anywhere; it settles against the nearest left or right edge at that height
 * and stays there (`useEdgeDock`). Collapsed, it's a slim tab (art, a playing indicator, a chevron) whose only job is
 * awareness + expand. Expanded, a compact panel opens away from that edge with track info, progress and previous / play
 * / next / More. Collapse (the chevron, a swipe toward the edge, or Escape) tucks it back; collapsing never stops
 * playback. It stays clear of the Palette trigger (>=72px), stays collapsed on immersive screens, and sits below sheets
 * and dialogs.
 */
export function MiniPlayer() {
  const s = useSoundtrack();
  const panel = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const wantExpanded = s?.playerUi === "expanded" && !s.forceCollapsed;
  const [override, setOverride] = useState(false);
  const dock = useEdgeDock("wc.player.dock", {
    height: TAB_H,
    // Around the vertical middle, clear of the default Palette spot.
    defaultY: (vh) => Math.min(vh / 2, vh - 204),
    bounds: (vh) => ({ min: (document.querySelector("header")?.getBoundingClientRect().bottom ?? 64) + 8 + TAB_H / 2, max: vh - 8 - TAB_H / 2 }),
  });
  const left = dock.pos?.side === "left";
  const centre = dock.pos?.y ?? 0;
  const place = useClearOfPrimaryActions(wantExpanded && !!s?.current && !!dock.pos, panel, left ? "left" : "right", centre);
  // Never cover a primary action (§15): shift vertically, or show the tab until there's room — unless the creator
  // just tapped the tab to open it anyway.
  const expanded = wantExpanded && (place.dy !== null || override);
  useEffect(() => {
    if (expanded) panel.current?.focus();
  }, [expanded]);
  if (!s?.current) return null;
  const t = s.current;
  const collapse = () => {
    setOverride(false);
    s.setPlayerUi("collapsed");
  };
  // Before the dock is measured (first paint), the right-middle default.
  const anchor = dock.pos ? undefined : "top-[min(50%,calc(100dvh-12.75rem))] -translate-y-1/2";
  const status = s.state.interruption ?? (s.state.playing ? null : "Paused");

  if (!expanded) {
    return (
      <button
        type="button"
        {...dock.handlers}
        onClick={() => {
          if (dock.consumeClick()) return; // the end of a drag, not a tap
          if (wantExpanded) setOverride(true);
          else s.setPlayerUi("expanded");
        }}
        aria-label={`Open audio player — ${s.state.playing ? "playing" : "paused"}: ${t.title}`}
        aria-describedby="player-move-hint"
        aria-expanded={false}
        data-player-tab=""
        data-dock-side={left ? "left" : "right"}
        style={dockStyle(dock, { w: 48, h: TAB_H }, "0px")}
        className={cn(
          "fixed right-0 z-30 flex h-[6.5rem] w-12 cursor-grab select-none flex-col items-center justify-between border border-border-soft bg-surface/95 py-2 shadow-[var(--shadow-card)] backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing",
          left ? "rounded-r-2xl border-l-0 pl-[env(safe-area-inset-left)]" : "rounded-l-2xl border-r-0 pr-[env(safe-area-inset-right)]",
          dock.drag && "rounded-2xl border",
          anchor,
        )}
      >
        <Art t={t} size="size-8" />
        {s.state.interruption ? <Pause className="size-3.5 text-ink-subtle" aria-hidden /> : <Bars playing={s.state.playing} />}
        {left ? <ChevronRight className="size-4 text-ink-muted" aria-hidden /> : <ChevronLeft className="size-4 text-ink-muted" aria-hidden />}
        <span id="player-move-hint" hidden>
          Drag it, or press Shift with the arrow keys, to move it to either side.
        </span>
      </button>
    );
  }

  const fav = s.state.favorites.includes(t.id);
  return (
    <div
      ref={panel}
      id="creativeradio-player"
      role="region"
      aria-label="CreativeRadio"
      tabIndex={-1}
      style={{
        ...(dock.pos ? { top: dock.pos.y, [left ? "left" : "right"]: `calc(0.5rem + env(safe-area-inset-${left ? "left" : "right"}))` } : {}),
        translate: `0 calc(-50% + ${place.dy ?? 0}px)`,
        ["--mini-dx" as string]: left ? "-1.5rem" : "1.5rem",
        transformOrigin: left ? "left center" : "right center",
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") collapse();
        if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault();
          s.toggle();
        }
      }}
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const d = swipe.current;
        swipe.current = null;
        // A swipe toward the docked edge tucks it away.
        if (d && (left ? d.x - e.clientX : e.clientX - d.x) > 60 && Math.abs(e.clientY - d.y) < 40) collapse();
      }}
      className={cn(
        "fixed z-30 w-[min(20rem,calc(100vw-1rem))] rounded-2xl border border-border-soft bg-surface/95 p-2.5 shadow-[var(--shadow-card)] backdrop-blur focus:outline-none",
        "motion-safe:animate-[mini-in_220ms_ease-out] motion-reduce:animate-[fade-in_120ms_ease-out]",
        !dock.pos && "right-[calc(0.5rem+env(safe-area-inset-right))] top-[min(50%,calc(100dvh-15rem))]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => s.openPanel("details", t.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Song details for ${t.title}`}>
          <Art t={t} size="size-11" />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{t.title}</span>
            <span className="block truncate text-xs text-ink-subtle">{status ? `${status} · ${t.artist}` : t.artist}</span>
          </span>
        </button>
        <button type="button" className={iconBtn} onClick={() => s.toggleFavorite(t.id)} aria-pressed={fav} aria-label={fav ? `Unfavourite ${t.title}` : `Favourite ${t.title}`}>
          <Heart className={cn("size-4", fav && "fill-accent text-accent")} aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={collapse} aria-label="Collapse player">
          {left ? <ChevronLeft className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
        </button>
      </div>
      <Progress s={s} className="-mb-2" />
      <Times fallback={t.duration} className="px-0.5" />
      <div className="flex items-center justify-center gap-1">
        <button type="button" className={iconBtn} onClick={s.previous} aria-label="Previous">
          <SkipBack className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={s.state.interruption ? s.resume : s.toggle}
          aria-label={s.state.playing ? `Pause ${t.title}` : s.state.interruption ? `Resume ${t.title}` : `Play ${t.title}`}
        >
          {s.state.playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
        </button>
        <button type="button" className={iconBtn} onClick={s.next} aria-label="Next">
          <SkipForward className="size-5" aria-hidden />
        </button>
        <Menu>
          <MenuTrigger className={iconBtn} aria-label="More">
            <MoreHorizontal className="size-5" aria-hidden />
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => s.openPanel("queue")}>
              <ListMusic className="size-4" aria-hidden /> Up next
            </MenuItem>
            <MenuItem onSelect={() => s.openPanel("songs")}>
              <Sparkles className="size-4" aria-hidden /> Change mood
            </MenuItem>
            <MenuItem onSelect={() => s.openPanel("details", t.id)}>
              <Info className="size-4" aria-hidden /> Song details
            </MenuItem>
            <MenuItem onSelect={s.stop}>
              <Square className="size-4" aria-hidden /> Stop playback
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {s.state.notice ? (
        <p role="status" className="mt-1 rounded-lg bg-ink px-3 py-1 text-xs text-white">
          {s.state.notice}
        </p>
      ) : null}
    </div>
  );
}

function TrackRow({ s, t, index }: { s: Soundtrack; t: LibraryTrack; index?: number }) {
  const playing = s.current?.id === t.id;
  const fav = s.state.favorites.includes(t.id);
  return (
    <li className={cn("flex min-h-[52px] items-center gap-1 rounded-xl pr-1", playing && "bg-accent-softer")}>
      <button type="button" onClick={() => s.play(t.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Play ${t.title}`} aria-current={playing ? "true" : undefined}>
        {index !== undefined ? <span className="w-4 shrink-0 text-center text-xs tabular-nums text-ink-subtle">{index + 1}</span> : <Art t={t} size="size-9" />}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[13px] font-medium", playing ? "text-accent-ink" : "text-ink")}>{t.title}</span>
          <span className="block truncate text-xs text-ink-subtle">{t.artist}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-subtle">{formatDuration(t.duration)}</span>
      </button>
      {index === undefined ? (
        <button type="button" className={iconBtn} onClick={() => s.toggleFavorite(t.id)} aria-pressed={fav} aria-label={fav ? `Unfavourite ${t.title}` : `Favourite ${t.title}`}>
          <Heart className={cn("size-4", fav && "fill-accent text-accent")} aria-hidden />
        </button>
      ) : null}
      <Menu>
        <MenuTrigger className={iconBtn} aria-label={`More for ${t.title}`}>
          <MoreVertical className="size-4" aria-hidden />
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => s.play(t.id)}>Play now</MenuItem>
          {index === undefined ? (
            <>
              <MenuItem onSelect={() => s.playNext(t.id)}>Play next</MenuItem>
              <MenuItem onSelect={() => s.addToQueue(t.id)}>Add to queue</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onSelect={() => s.moveInQueue(index, -1)}>
                <ArrowUp className="size-4" aria-hidden /> Move up
              </MenuItem>
              <MenuItem onSelect={() => s.moveInQueue(index, 1)}>
                <ArrowDown className="size-4" aria-hidden /> Move down
              </MenuItem>
              <MenuItem onSelect={() => s.removeFromQueue(index)}>
                <X className="size-4" aria-hidden /> Remove
              </MenuItem>
            </>
          )}
          <MenuItem onSelect={() => s.toggleFavorite(t.id)}>{fav ? "Unfavourite" : "Favourite"}</MenuItem>
          <MenuItem onSelect={() => s.openPanel("details", t.id)}>
            <Info className="size-4" aria-hidden /> Song details
          </MenuItem>
          <MenuItem onSelect={() => s.playMoreLikeThis(t.id)}>More like this</MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

function Times({ fallback, className }: { fallback: number; className?: string }) {
  const { time, duration } = useSoundtrackTime();
  return (
    <div className={cn("flex justify-between text-[11px] tabular-nums text-ink-subtle", className)}>
      <span>{formatDuration(time)}</span>
      <span>{formatDuration(duration || fallback)}</span>
    </div>
  );
}

function NowPlaying({ s }: { s: Soundtrack }) {
  const t = s.current;
  if (!t) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border-soft p-3">
        <p className="min-w-0 flex-1 text-sm text-ink-muted">Choose a feeling, press play, keep creating.</p>
        <Button size="sm" onClick={() => s.play()} disabled={!s.ready}>
          <Play className="size-4" aria-hidden /> Play {MOOD_LABEL[s.state.mood]}
        </Button>
      </div>
    );
  }
  const RepeatIcon = s.state.repeat === "one" ? Repeat1 : Repeat;
  return (
    <section aria-label="Now playing" className="rounded-xl border border-border-soft p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => s.openPanel("details", t.id)} className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Song details for ${t.title}`}>
          <Art t={t} size="size-12" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
          <p className="truncate text-xs text-ink-subtle">{t.artist}</p>
        </div>
      </div>
      <Progress s={s} className="mt-1" />
      <Times fallback={t.duration} className="-mt-2" />
      <div className="mt-1 flex items-center justify-center gap-1">
        <button type="button" className={cn(iconBtn, s.state.shuffle && "text-accent")} onClick={() => s.setShuffle(!s.state.shuffle)} aria-pressed={s.state.shuffle} aria-label="Shuffle">
          <Shuffle className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={s.previous} aria-label="Previous">
          <SkipBack className="size-5" aria-hidden />
        </button>
        <button type="button" className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={s.toggle} aria-label={s.state.playing ? `Pause ${t.title}` : `Play ${t.title}`}>
          {s.state.playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
        </button>
        <button type="button" className={iconBtn} onClick={s.next} aria-label="Next">
          <SkipForward className="size-5" aria-hidden />
        </button>
        <button type="button" className={cn(iconBtn, s.state.repeat !== "off" && "text-accent")} onClick={s.cycleRepeat} aria-label={`Repeat: ${s.state.repeat}`}>
          <RepeatIcon className="size-4" aria-hidden />
        </button>
      </div>
      <label className="mt-1 flex items-center gap-2 text-ink-subtle">
        <Volume2 className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Volume</span>
        <input type="range" min={0} max={100} value={Math.round(s.state.volume * 100)} onChange={(e) => s.setVolume(Number(e.target.value) / 100)} className="h-11 w-full accent-[var(--color-accent)]" />
      </label>
    </section>
  );
}

function Details({ s, id }: { s: Soundtrack; id: string }) {
  const t = s.byId(id);
  if (!t) return null;
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-border-soft/70 py-2 text-[13px] last:border-0">
      <dt className="text-ink-subtle">{k}</dt>
      <dd className="min-w-0 text-right text-ink">{v}</dd>
    </div>
  );
  return (
    <section aria-label="Song details" className="space-y-3">
      <button type="button" onClick={() => s.openPanel("songs")} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
        ← Songs
      </button>
      <div className="flex items-center gap-3">
        <Art t={t} size="size-14" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{t.title}</p>
          <p className="text-sm text-ink-muted">{t.artist}</p>
        </div>
      </div>
      <p className="flex flex-wrap gap-1.5">
        {t.moods.map((m) => (
          <span key={m} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">
            {MOOD_LABEL[m]}
          </span>
        ))}
      </p>
      <dl>
        {row("Duration", formatDuration(t.duration))}
        {t.genre ? row("Genre", t.genre) : null}
        {row("Energy", t.energy[0]!.toUpperCase() + t.energy.slice(1))}
        {t.collection ? row("Collection", t.collection) : null}
        {row(
          "License",
          <a href={t.licenseUrl} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
            {t.license}
          </a>,
        )}
        {row("Source", t.infoUrl ? <a href={t.infoUrl} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">{t.source}</a> : t.source)}
      </dl>
      {t.attribution ? <p className="text-xs leading-relaxed text-ink-subtle">{t.attribution}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => s.play(t.id)}>
          <Play className="size-4" aria-hidden /> Play this song
        </Button>
        <Button size="sm" variant="secondary" onClick={() => s.playMoreLikeThis(t.id)}>
          Play more like this
        </Button>
      </div>
    </section>
  );
}

/** The CreativeRadio panel (music-player §3–17; "Soundtrack" in the spec): mood chips, songs for the mood, now playing, details and the queue. */
export function SoundtrackPanel() {
  const s = useSoundtrack();
  if (!s) return null;
  const mood = s.state.mood;
  const list = s.ready ? rankTracks(s.tracks, { mood, history: s.state.history, favorites: s.state.favorites, seed: s.state.seed }) : [];
  const queue = s.state.queue.map((id) => s.byId(id)).filter((t): t is LibraryTrack => !!t);
  return (
    <Dialog open={s.panel.open} onOpenChange={(o) => (o ? s.openPanel(s.panel.view) : s.closePanel())}>
      <DialogContent title="CreativeRadio" description="Music for your creativity" wide>
        {s.error ? (
          <p role="alert" className="text-sm text-danger">
            {s.error}
          </p>
        ) : null}
        {s.panel.view === "details" && s.panel.detailsId ? (
          <Details s={s} id={s.panel.detailsId} />
        ) : (
          <div className="space-y-3">
            <NowPlaying s={s} />
            <div role="radiogroup" aria-label="Mood" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {[...MOODS, "all" as const].map((m) => {
                const Icon = MOOD_ICON[m];
                const on = m === mood;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => s.setMood(m)}
                    className={cn("inline-flex min-h-11 shrink-0 items-center", "focus-visible:outline-none [&>span]:focus-visible:outline-2 [&>span]:focus-visible:outline-accent")}
                  >
                    <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px]", on ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-muted")}>
                      <Icon className="size-3.5" aria-hidden /> {MOOD_LABEL[m]}
                      {on ? <span className="sr-only"> (selected)</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {s.current && !s.current.moods.includes(mood as never) && mood !== "all" ? (
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                Up next is {MOOD_LABEL[mood]}.{" "}
                <button type="button" onClick={() => s.setMood(mood, true)} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
                  Switch now
                </button>
              </p>
            ) : null}

            <div role="tablist" aria-label="CreativeRadio view" className="flex gap-1 border-b border-border-soft">
              {(["songs", "queue"] as const).map((v) => (
                <button key={v} role="tab" type="button" aria-selected={s.panel.view === v} onClick={() => s.openPanel(v)} className={cn("-mb-px min-h-11 border-b-2 px-3 text-[13px] font-medium", s.panel.view === v ? "border-accent text-accent-ink" : "border-transparent text-ink-muted")}>
                  {v === "songs" ? `Songs for ${MOOD_LABEL[mood]}` : `Up next${queue.length ? ` · ${queue.length}` : ""}`}
                </button>
              ))}
              <span className="ml-auto flex items-center">
                {s.panel.view === "songs" ? (
                  <button type="button" onClick={s.refreshMix} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-accent-ink hover:underline">
                    <RefreshCw className="size-3.5" aria-hidden /> Refresh mix
                  </button>
                ) : queue.length ? (
                  <button type="button" onClick={s.clearQueue} className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-accent-ink hover:underline">
                    Clear
                  </button>
                ) : null}
              </span>
            </div>

            {!s.ready && !s.error ? (
              <ul aria-busy="true" className="space-y-1">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="h-[52px] rounded-xl bg-surface-muted motion-safe:animate-pulse" />
                ))}
              </ul>
            ) : s.panel.view === "queue" ? (
              queue.length ? (
                <ul aria-label="Up next" className="space-y-0.5">
                  {queue.map((t, i) => (
                    <TrackRow key={`${t.id}-${i}`} s={s} t={t} index={i} />
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-ink-muted">Nothing queued. The next song comes from {MOOD_LABEL[mood]}.</p>
              )
            ) : list.length ? (
              <>
                <p className="text-xs text-ink-subtle">
                  {list.length} {list.length === 1 ? "song" : "songs"}
                </p>
                <ul aria-label={`Songs for ${MOOD_LABEL[mood]}`} className="space-y-0.5">
                  {list.map((t) => (
                    <TrackRow key={t.id} s={s} t={t} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-3 text-sm text-ink-muted">No songs available for this mood yet.</p>
            )}
            <p className="border-t border-border-soft pt-2 text-[11px] leading-relaxed text-ink-subtle">
              Music by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0, and Frédéric Chopin recordings from Musopen (CC0). Credits for each song are in its details.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
