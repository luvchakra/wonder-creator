"use client";
import { buildQueue, isMood, moreLikeThis, previousAction, type MoodFilter, type Track } from "@wonder/creator-soundtrack";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * The CreativeRadio engine (docs/ui-redesign/music-player.md §18–23; presentation name only — code, tables and APIs keep
 * "soundtrack"). One <audio> element lives here, above every route, so
 * music keeps playing across navigation. Track, mood, queue, history, volume and position are saved locally and
 * restored after a reload (paused — browsers need a tap before sound).
 */

export type LibraryTrack = Track & { audioUrl: string };
type Repeat = "off" | "one" | "all";
type PanelView = "songs" | "queue" | "details";

interface Persisted {
  trackId: string | null;
  mood: MoodFilter;
  queue: string[];
  history: string[];
  volume: number;
  position: number;
  shuffle: boolean;
  repeat: Repeat;
  seed: number;
  /** Songs the creator queued themselves (Play next, Add to queue, More like this): kept whatever the mood. */
  pinned: string[];
}

const KEY = "wc.soundtrack.v1";
const UI_KEY = "wc.soundtrack.ui";
export type PlayerUi = "collapsed" | "expanded";
/** What a screen may ask of the mini player (mini-player.md §53). Playback always continues. */
export interface MiniPlayerConstraint {
  forceCollapsed?: boolean;
}
const DEFAULTS: Persisted = { trackId: null, mood: "calm", queue: [], history: [], volume: 0.7, position: 0, shuffle: false, repeat: "off", seed: 1, pinned: [] };

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export interface Soundtrack {
  ready: boolean;
  error: string | null;
  tracks: LibraryTrack[];
  byId: (id: string | null | undefined) => LibraryTrack | undefined;
  current: LibraryTrack | undefined;
  state: Persisted & { playing: boolean; favorites: string[]; notice: string | null; interruption: string | null };
  panel: { open: boolean; view: PanelView; detailsId: string | null };
  openPanel: (view?: PanelView, detailsId?: string | null) => void;
  /** The right-middle mini player's state (mini-player.md §2). Collapsing never stops playback. */
  playerUi: PlayerUi;
  setPlayerUi: (ui: PlayerUi) => void;
  /** A screen asked for the compact tab (immersive editing, §13). */
  forceCollapsed: boolean;
  constrain: (id: string, c: MiniPlayerConstraint | null) => void;
  /** Pause because something else needs the sound (a Huddle, a video), saying why (§28–30). */
  pauseFor: (reason: string) => void;
  resume: () => void;
  /** Stop: clear what's playing (the queue stays). Different from pause (§46). */
  stop: () => void;
  closePanel: () => void;
  play: (id?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  /** Up next becomes this mood at once; a song of another mood gives way to one of this mood. */
  setMood: (m: MoodFilter) => void;
  refreshMix: () => void;
  playNext: (id: string) => void;
  addToQueue: (id: string) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (i: number, dir: -1 | 1) => void;
  clearQueue: () => void;
  playMoreLikeThis: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
}

const Ctx = createContext<Soundtrack | null>(null);
export const useSoundtrack = () => useContext(Ctx);
/** Playback position, kept apart so progress updates re-render only the few places that show time (§39). */
const TimeCtx = createContext<{ time: number; duration: number }>({ time: 0, duration: 0 });
export const useSoundtrackTime = () => useContext(TimeCtx);

/** Ask the mini player to stay compact while this screen is shown (e.g. a full-screen editor). */
export function useMiniPlayerConstraint(c: MiniPlayerConstraint) {
  const s = useContext(Ctx);
  const constrain = s?.constrain;
  const force = !!c.forceCollapsed;
  useEffect(() => {
    if (!constrain) return;
    const id = Math.random().toString(36).slice(2);
    constrain(id, { forceCollapsed: force });
    return () => constrain(id, null);
  }, [constrain, force]);
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [p, setP] = useState<Persisted>(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [playerUi, setUi] = useState<PlayerUi>("collapsed");
  useEffect(() => {
    // Remembered per device (a convenience); deferred so hydration matches the server.
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(UI_KEY) === "expanded") setUi("expanded");
      } catch {
        // Storage unavailable: start collapsed.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const setPlayerUi = useCallback((ui: PlayerUi) => {
    setUi(ui);
    try {
      localStorage.setItem(UI_KEY, ui);
    } catch {
      // Private mode: it just won't be remembered.
    }
  }, []);
  const [constraints, setConstraints] = useState<Record<string, MiniPlayerConstraint>>({});
  const constrain = useCallback((id: string, c: MiniPlayerConstraint | null) => {
    setConstraints((all) => {
      const next = { ...all };
      if (c) next[id] = c;
      else delete next[id];
      return next;
    });
  }, []);
  const forceCollapsed = Object.values(constraints).some((c) => c.forceCollapsed);
  // Immersive screens start with the player tucked in (the remembered choice isn't touched), but a tap still opens it
  // (owner, 29 Sep 2026: "the music player is not maximizing" in the Studio).
  const [seenForce, setSeenForce] = useState(false);
  if (forceCollapsed !== seenForce) {
    setSeenForce(forceCollapsed);
    if (forceCollapsed) setUi("collapsed");
  }
  const [interruption, setInterruption] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ open: boolean; view: PanelView; detailsId: string | null }>({ open: false, view: "songs", detailsId: null });
  const restored = useRef(false);
  const failures = useRef(0);
  const loadedLibrary = useRef(false);
  /** The creator asked to play: honoured once the library and the track's source are in place. */
  const wantPlay = useRef(false);
  const playWhenReady = useRef(false);

  const byId = useCallback((id: string | null | undefined) => (id ? tracks.find((t) => t.id === id) : undefined), [tracks]);
  const current = byId(p.trackId);

  // Restore after mount (localStorage is browser-only).
  useEffect(() => {
    // Deferred a tick so the first client render matches the server's (nothing playing).
    const t = setTimeout(() => {
      const saved = load();
      restored.current = true;
      setP(saved);
      setTime(saved.position);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // The library loads on first need: when something was playing before, or when the panel opens.
  const ensureLibrary = useCallback(async () => {
    if (loadedLibrary.current) return;
    loadedLibrary.current = true;
    try {
      const res = await fetch("/api/v1/soundtrack");
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { tracks: LibraryTrack[]; favorites: string[] };
      setTracks(body.tracks);
      setFavorites(body.favorites);
      setReady(true);
    } catch {
      loadedLibrary.current = false;
      setError("The soundtrack couldn't load. Try again in a moment.");
    }
  }, []);
  useEffect(() => {
    if (restored.current && p.trackId) void ensureLibrary();
  }, [p.trackId, ensureLibrary]);

  // Save (position at most every few seconds via timeupdate below).
  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...p, position: Math.floor(time) }));
    } catch {
      // Private mode or full storage: playback still works, it just won't be remembered.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, Math.floor(time / 5)]);

  useEffect(() => {
    if (audio.current) audio.current.volume = p.volume;
  }, [p.volume]);

  const startPlayback = useCallback(() => {
    const el = audio.current;
    wantPlay.current = true;
    if (!el || !el.src) return; // the source effect starts it
    el.play().then(
      () => setPlaying(true),
      (e: unknown) => {
        setPlaying(false);
        // A browser that blocks playback outside a tap says so; never fail silently.
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          wantPlay.current = false;
          setNotice("Tap play to start the music.");
          setTimeout(() => setNotice(null), 4000);
        }
      },
    );
  }, []);

  /** Play the current source again from the top. */
  const restart = useCallback(() => {
    const el = audio.current;
    if (el) el.currentTime = 0;
    startPlayback();
  }, [startPlayback]);

  // Point the element at the current track.
  useEffect(() => {
    const el = audio.current;
    if (!el || !current) return;
    if (el.dataset.trackId !== current.id) {
      el.dataset.trackId = current.id;
      el.src = current.audioUrl;
      el.currentTime = 0;
      // Play was asked for before this source was set (a new track): start it now.
      if (wantPlay.current) startPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  const goTo = useCallback(
    (id: string, rest?: string[]) => {
      wantPlay.current = true;
      setP((s) => {
        if (id === s.trackId) queueMicrotask(restart);
        return { ...s, trackId: id, queue: rest ?? s.queue.filter((q) => q !== id), history: s.trackId && s.trackId !== id ? [s.trackId, ...s.history].slice(0, 30) : s.history };
      });
      setTime(0);
    },
    [restart],
  );

  const freshQueue = useCallback(
    (s: Persisted, mood: MoodFilter, seed: number, exclude: string[] = []) =>
      buildQueue(tracks, { mood, history: s.history, favorites, exclude: [...exclude, ...(s.trackId ? [s.trackId] : [])], seed }),
    [tracks, favorites],
  );

  // What's left in Up next for this mood: its own songs and the ones the creator queued themselves (a queue saved under
  // another mood, or an older catalogue, never plays other moods behind the creator's back).
  const moodQueue = useCallback(
    (s: Persisted) =>
      s.queue.filter(
        (id) =>
          s.pinned.includes(id) ||
          (() => {
            const t = tracks.find((x) => x.id === id);
            return !!t && isMood(t, s.mood);
          })(),
      ),
    [tracks],
  );

  // The next track starts from the source effect once its src is set. That has to be decided now, synchronously: a
  // requestAnimationFrame never fires while the tab is hidden or the phone is locked, which is exactly when a song ends
  // unattended — so the music stopped after one song. Playing from the `ended` handler's own turn also keeps the
  // browser's permission to continue without a tap.
  const next = useCallback(() => {
    wantPlay.current = true;
    setP((s) => {
      const kept = tracks.length ? moodQueue(s) : s.queue;
      let queue = kept.length ? kept : freshQueue(s, s.mood, s.seed + 1);
      if (!queue.length) return s;
      const i = s.shuffle ? Math.floor(Math.random() * queue.length) : 0;
      const id = queue[i]!;
      queue = queue.filter((_, j) => j !== i);
      // The same track again (a one-song mood): the source doesn't change, so restart it here.
      if (id === s.trackId) queueMicrotask(restart);
      return {
        ...s,
        trackId: id,
        queue,
        pinned: s.pinned.filter((x) => x !== id && queue.includes(x)),
        history: s.trackId ? [s.trackId, ...s.history].slice(0, 30) : s.history,
        seed: kept.length ? s.seed : s.seed + 1,
      };
    });
    setTime(0);
  }, [freshQueue, moodQueue, restart, tracks.length]);

  // Honour a play that was asked for while the library was loading.
  const playRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (ready && playWhenReady.current) {
      playWhenReady.current = false;
      playRef.current();
    }
  }, [ready]);

  const api = useMemo<Soundtrack>(
    () => ({
      ready,
      error,
      tracks,
      byId,
      current,
      state: { ...p, playing, favorites, notice, interruption },
      panel,
      openPanel: (view = "songs", detailsId = null) => {
        void ensureLibrary();
        setPanel({ open: true, view, detailsId });
      },
      closePanel: () => setPanel((x) => ({ ...x, open: false })),
      playerUi,
      setPlayerUi,
      forceCollapsed,
      constrain,
      pauseFor: (reason) => {
        const el = audio.current;
        if (!el || el.paused) return;
        wantPlay.current = false;
        el.pause();
        setPlaying(false);
        setInterruption(reason);
      },
      resume: () => {
        setInterruption(null);
        startPlayback();
      },
      stop: () => {
        const el = audio.current;
        wantPlay.current = false;
        if (el) {
          el.pause();
          el.removeAttribute("src");
          delete el.dataset.trackId;
          el.load();
        }
        setPlaying(false);
        setInterruption(null);
        setTime(0);
        setP((s) => ({ ...s, trackId: null, position: 0 }));
      },
      play: (id) => {
        setInterruption(null);
        if (id) return goTo(id);
        if (!tracks.length) {
          // First play before the library has loaded: load it, then start (see the effect below).
          playWhenReady.current = true;
          void ensureLibrary();
          return;
        }
        if (!p.trackId) {
          const q = freshQueue(p, p.mood, p.seed);
          if (q[0]) goTo(q[0], q.slice(1));
          return;
        }
        startPlayback();
      },
      toggle: () => {
        const el = audio.current;
        if (!el || !current) return api.play();
        if (el.paused) {
          setInterruption(null);
          startPlayback();
        } else {
          wantPlay.current = false;
          el.pause();
          setPlaying(false);
        }
      },
      next,
      previous: () => {
        const a = previousAction(audio.current?.currentTime ?? 0, p.history);
        if (a.kind === "restart") {
          if (audio.current) audio.current.currentTime = 0;
          return;
        }
        wantPlay.current = true;
        setP((s) => {
          if (a.id === s.trackId) queueMicrotask(restart);
          return { ...s, trackId: a.id, history: s.history.slice(1), queue: s.trackId ? [s.trackId, ...s.queue] : s.queue };
        });
        setTime(0);
      },
      seek: (t) => {
        if (audio.current) audio.current.currentTime = t;
        setTime(t);
      },
      setVolume: (v) => setP((s) => ({ ...s, volume: Math.min(1, Math.max(0, v)) })),
      // Choosing a mood is respected at once (owner): Up next becomes that mood (keeping songs the creator queued
      // themselves), and a song of another mood gives way to one of the new mood — playing on if it was playing.
      setMood: (m) => {
        const cur = current;
        const moveOn = !!cur && !isMood(cur, m) && tracks.length > 0;
        setP((s) => {
          const mine = s.queue.filter((id) => s.pinned.includes(id));
          const fresh = freshQueue(s, m, s.seed, mine);
          if (!moveOn || !fresh.length) return { ...s, mood: m, queue: [...mine, ...fresh] };
          const [first, ...rest] = fresh;
          if (playing) {
            wantPlay.current = true;
            if (first === s.trackId) queueMicrotask(restart);
          }
          return { ...s, mood: m, trackId: first!, queue: [...mine, ...rest], history: s.trackId ? [s.trackId, ...s.history].slice(0, 30) : s.history };
        });
        if (moveOn) setTime(0);
      },
      refreshMix: () => setP((s) => ({ ...s, seed: s.seed + 1, queue: freshQueue(s, s.mood, s.seed + 1) })),
      playNext: (id) => setP((s) => ({ ...s, queue: [id, ...s.queue.filter((q) => q !== id)], pinned: [...new Set([...s.pinned, id])] })),
      addToQueue: (id) => setP((s) => ({ ...s, queue: [...s.queue.filter((q) => q !== id), id], pinned: [...new Set([...s.pinned, id])] })),
      removeFromQueue: (i) => setP((s) => ({ ...s, queue: s.queue.filter((_, j) => j !== i), pinned: s.pinned.filter((x) => x !== s.queue[i]) })),
      moveInQueue: (i, dir) =>
        setP((s) => {
          const j = i + dir;
          if (j < 0 || j >= s.queue.length) return s;
          const q = [...s.queue];
          [q[i], q[j]] = [q[j]!, q[i]!];
          return { ...s, queue: q };
        }),
      clearQueue: () => setP((s) => ({ ...s, queue: [], pinned: [] })),
      playMoreLikeThis: (id) => {
        const of = byId(id);
        if (!of) return;
        const like = moreLikeThis(tracks, of, { history: p.history, seed: p.seed });
        // Asked for explicitly, so these play even across moods.
        setP((s) => ({ ...s, pinned: [...new Set([...s.pinned, ...like])] }));
        goTo(id, like);
      },
      toggleFavorite: (id) => {
        const on = !favorites.includes(id);
        setFavorites((f) => (on ? [...f, id] : f.filter((x) => x !== id)));
        void fetch(`/api/v1/soundtrack/favourites/${id}`, { method: on ? "PUT" : "DELETE" }).catch(() => undefined);
      },
      setShuffle: (on) => setP((s) => ({ ...s, shuffle: on })),
      cycleRepeat: () => setP((s) => ({ ...s, repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
    }),
    [ready, error, tracks, byId, current, p, playing, favorites, notice, interruption, panel, playerUi, setPlayerUi, forceCollapsed, constrain, ensureLibrary, goTo, freshQueue, startPlayback, next, restart],
  );

  useEffect(() => {
    playRef.current = () => api.play();
  }, [api]);

  // Another sound on the page (a video, a Material's audio) wins: pause, and say why (§29).
  useEffect(() => {
    const onPlay = (e: Event) => {
      const el = audio.current;
      const other = e.target as HTMLMediaElement | null;
      if (!el || !other || other === el || other.muted || el.paused) return;
      wantPlay.current = false;
      el.pause();
      setPlaying(false);
      setInterruption("Paused for other audio");
    };
    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, []);

  // OS media controls and lock screen where supported (§54–55).
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    ms.metadata = current && typeof MediaMetadata !== "undefined" ? new MediaMetadata({ title: current.title, artist: current.artist, album: "CreativeRadio" }) : null;
    ms.playbackState = current ? (playing ? "playing" : "paused") : "none";
  }, [current, playing]);
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms) return;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        // Unsupported action on this platform.
      }
    };
    set("play", () => apiRef.current.toggle());
    set("pause", () => apiRef.current.toggle());
    set("nexttrack", () => apiRef.current.next());
    set("previoustrack", () => apiRef.current.previous());
    return () => ["play", "pause", "nexttrack", "previoustrack"].forEach((a) => set(a as MediaSessionAction, null));
  }, []);
  const timeValue = useMemo(() => ({ time, duration }), [time, duration]);

  return (
    <Ctx.Provider value={api}>
      <TimeCtx.Provider value={timeValue}>{children}</TimeCtx.Provider>
      <audio
        ref={audio}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || current?.duration || 0);
          // Resume where it was after a reload.
          if (time > 0 && e.currentTarget.currentTime === 0 && time < (e.currentTarget.duration || Infinity)) e.currentTarget.currentTime = time;
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(e) => {
          if (p.repeat === "one") {
            e.currentTarget.currentTime = 0;
            startPlayback();
          } else next();
        }}
        onPlaying={() => {
          failures.current = 0;
        }}
        onError={() => {
          if (!current) return;
          // Skip a broken track (§24), but don't run through the whole library when the network is down.
          failures.current += 1;
          if (failures.current >= 3) {
            setPlaying(false);
            setNotice("The soundtrack can't play right now. Check your connection and try again.");
            setTimeout(() => setNotice(null), 6000);
            return;
          }
          setNotice("This track couldn't be played. Skipping to the next one.");
          setTimeout(() => setNotice(null), 4000);
          next();
        }}
      />
    </Ctx.Provider>
  );
}
