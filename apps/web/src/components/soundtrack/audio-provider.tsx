"use client";
import { buildQueue, moreLikeThis, previousAction, type MoodFilter, type Track } from "@wonder/creator-soundtrack";
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
}

const KEY = "wc.soundtrack.v1";
const DEFAULTS: Persisted = { trackId: null, mood: "calm", queue: [], history: [], volume: 0.7, position: 0, shuffle: false, repeat: "off", seed: 1 };

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
  state: Persisted & { playing: boolean; time: number; duration: number; favorites: string[]; notice: string | null };
  panel: { open: boolean; view: PanelView; detailsId: string | null };
  openPanel: (view?: PanelView, detailsId?: string | null) => void;
  closePanel: () => void;
  play: (id?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setMood: (m: MoodFilter, switchNow?: boolean) => void;
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
  const [panel, setPanel] = useState<{ open: boolean; view: PanelView; detailsId: string | null }>({ open: false, view: "songs", detailsId: null });
  const restored = useRef(false);
  const failures = useRef(0);
  const loadedLibrary = useRef(false);

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

  // Point the element at the current track.
  useEffect(() => {
    const el = audio.current;
    if (!el || !current) return;
    if (el.dataset.trackId !== current.id) {
      el.dataset.trackId = current.id;
      el.src = current.audioUrl;
      el.currentTime = 0;
    }
  }, [current]);
  useEffect(() => {
    if (audio.current) audio.current.volume = p.volume;
  }, [p.volume]);

  const startPlayback = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    el.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, []);

  const goTo = useCallback(
    (id: string, rest?: string[]) => {
      setP((s) => ({ ...s, trackId: id, queue: rest ?? s.queue.filter((q) => q !== id), history: s.trackId && s.trackId !== id ? [s.trackId, ...s.history].slice(0, 30) : s.history }));
      setTime(0);
      requestAnimationFrame(startPlayback);
    },
    [startPlayback],
  );

  const freshQueue = useCallback((s: Persisted, mood: MoodFilter, seed: number, exclude: string[] = []) => buildQueue(tracks, { mood, history: s.history, favorites, exclude: [...exclude, ...(s.trackId ? [s.trackId] : [])], seed }), [tracks, favorites]);

  const next = useCallback(() => {
    setP((s) => {
      let queue = s.queue.length ? s.queue : freshQueue(s, s.mood, s.seed + 1);
      if (!queue.length) return s;
      const i = s.shuffle ? Math.floor(Math.random() * queue.length) : 0;
      const id = queue[i]!;
      queue = queue.filter((_, j) => j !== i);
      requestAnimationFrame(startPlayback);
      return { ...s, trackId: id, queue, history: s.trackId ? [s.trackId, ...s.history].slice(0, 30) : s.history, seed: s.queue.length ? s.seed : s.seed + 1 };
    });
    setTime(0);
  }, [freshQueue, startPlayback]);

  const api = useMemo<Soundtrack>(
    () => ({
      ready,
      error,
      tracks,
      byId,
      current,
      state: { ...p, playing, time, duration, favorites, notice },
      panel,
      openPanel: (view = "songs", detailsId = null) => {
        void ensureLibrary();
        setPanel({ open: true, view, detailsId });
      },
      closePanel: () => setPanel((x) => ({ ...x, open: false })),
      play: (id) => {
        if (id) return goTo(id);
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
        if (el.paused) startPlayback();
        else {
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
        setP((s) => ({ ...s, trackId: a.id, history: s.history.slice(1), queue: s.trackId ? [s.trackId, ...s.queue] : s.queue }));
        setTime(0);
        requestAnimationFrame(startPlayback);
      },
      seek: (t) => {
        if (audio.current) audio.current.currentTime = t;
        setTime(t);
      },
      setVolume: (v) => setP((s) => ({ ...s, volume: Math.min(1, Math.max(0, v)) })),
      // Changing mood never stops the current song (§11): the queue changes; "Switch now" moves on immediately.
      setMood: (m, switchNow = false) => {
        setP((s) => ({ ...s, mood: m, queue: freshQueue(s, m, s.seed) }));
        if (switchNow) requestAnimationFrame(next);
      },
      refreshMix: () => setP((s) => ({ ...s, seed: s.seed + 1, queue: freshQueue(s, s.mood, s.seed + 1) })),
      playNext: (id) => setP((s) => ({ ...s, queue: [id, ...s.queue.filter((q) => q !== id)] })),
      addToQueue: (id) => setP((s) => ({ ...s, queue: [...s.queue.filter((q) => q !== id), id] })),
      removeFromQueue: (i) => setP((s) => ({ ...s, queue: s.queue.filter((_, j) => j !== i) })),
      moveInQueue: (i, dir) =>
        setP((s) => {
          const j = i + dir;
          if (j < 0 || j >= s.queue.length) return s;
          const q = [...s.queue];
          [q[i], q[j]] = [q[j]!, q[i]!];
          return { ...s, queue: q };
        }),
      clearQueue: () => setP((s) => ({ ...s, queue: [] })),
      playMoreLikeThis: (id) => {
        const of = byId(id);
        if (!of) return;
        const like = moreLikeThis(tracks, of, { history: p.history, seed: p.seed });
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
    [ready, error, tracks, byId, current, p, playing, time, duration, favorites, notice, panel, ensureLibrary, goTo, freshQueue, startPlayback, next],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
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
