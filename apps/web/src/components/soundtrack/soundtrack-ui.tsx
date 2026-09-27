"use client";
import { MOOD_LABEL, MOODS, formatDuration, rankTracks, type MoodFilter } from "@wonder/creator-soundtrack";
import { Button, Dialog, DialogContent, Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@wonder/ui";
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  CloudRain,
  Feather,
  Heart,
  Info,
  LayoutGrid,
  Leaf,
  ListMusic,
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
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useSoundtrack, type LibraryTrack, type Soundtrack } from "./audio-provider";

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
  const total = s.state.duration || s.current?.duration || 0;
  return (
    <input
      type="range"
      aria-label="Position"
      aria-valuetext={`${formatDuration(s.state.time)} of ${formatDuration(total)}`}
      min={0}
      max={Math.max(1, Math.floor(total))}
      step={1}
      value={Math.floor(s.state.time)}
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
export function MiniPlayer() {
  const s = useSoundtrack();
  if (!s?.current) return null;
  const t = s.current;
  const fav = s.state.favorites.includes(t.id);
  return (
    <div
      role="region"
      aria-label="CreativeRadio"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 right-[calc(1rem+4.25rem)] z-30 rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur sm:left-auto sm:w-[30rem]"
    >
      <div className="flex h-14 items-center gap-1 pl-1.5 pr-1">
        <button type="button" onClick={() => s.openPanel("songs")} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-1 text-left focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Open CreativeRadio — ${t.title}`}>
          <Art t={t} size="size-9" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink">{t.title}</span>
            <span className="block truncate text-xs text-ink-subtle">
              {t.artist}
              <span className="hidden sm:inline"> · {MOOD_LABEL[s.state.mood]}</span>
            </span>
          </span>
        </button>
        <button type="button" className={cn(iconBtn, "hidden sm:inline-flex")} onClick={s.previous} aria-label="Previous">
          <SkipBack className="size-4" aria-hidden />
        </button>
        <button type="button" className={cn(iconBtn, "bg-accent text-white hover:bg-accent-ink")} onClick={s.toggle} aria-label={s.state.playing ? `Pause ${t.title}` : `Play ${t.title}`}>
          {s.state.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <button type="button" className={iconBtn} onClick={s.next} aria-label="Next">
          <SkipForward className="size-4" aria-hidden />
        </button>
        <button type="button" className={cn(iconBtn, "hidden sm:inline-flex")} onClick={() => s.toggleFavorite(t.id)} aria-pressed={fav} aria-label={fav ? `Unfavourite ${t.title}` : `Favourite ${t.title}`}>
          <Heart className={cn("size-4", fav && "fill-accent text-accent")} aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={() => s.openPanel("queue")} aria-label="Up next">
          <ListMusic className="size-4" aria-hidden />
        </button>
      </div>
      <div className="relative -mt-1 h-1 overflow-hidden rounded-b-2xl bg-border-soft/60" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${Math.min(100, (s.state.time / (s.state.duration || t.duration || 1)) * 100)}%` }} />
      </div>
      {s.state.notice ? (
        <p role="status" className="absolute -top-8 left-2 right-2 truncate rounded-lg bg-ink px-3 py-1 text-xs text-white">
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
      <div className="-mt-2 flex justify-between text-[11px] tabular-nums text-ink-subtle">
        <span>{formatDuration(s.state.time)}</span>
        <span>{formatDuration(s.state.duration || t.duration)}</span>
      </div>
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
