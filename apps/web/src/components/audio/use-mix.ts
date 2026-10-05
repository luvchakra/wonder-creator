"use client";
import { mixLength, mixTrackOf, placeAt, type ListenTrack, type Mix } from "@wonder/creator-projects/parts-options";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSoundtrack } from "@/components/soundtrack/audio-provider";
import { encodeWav } from "@/lib/wav";

/**
 * Listen together (creative-room-parts.md, step 4): the parts' kept takes played as one in the browser, each from its
 * offset at its level. Takes are fetched and decoded once, on the first Play or Download; a level or mute changes the
 * sound in place, an offset restarts from where the playhead is. The download is rendered here too (an offline
 * render of the same mix, as a WAV) — nothing is mixed or stored on the server.
 */
export type MixStatus = "idle" | "loading" | "ready" | "error";

const RATE = 44_100;

export function useMix(tracks: ListenTrack[], mix: Mix) {
  const soundtrack = useSoundtrack();
  const [status, setStatus] = useState<MixStatus>("idle");
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const ctx = useRef<AudioContext | null>(null);
  const nodes = useRef(new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>());
  const startedAt = useRef(0);
  const frame = useRef(0);
  const loading = useRef<Promise<boolean> | null>(null);
  const mixRef = useRef(mix);
  useEffect(() => {
    mixRef.current = mix;
  }, [mix]);
  // A take's real length once decoded (the stored seconds are rounded).
  const [decoded, setDecoded] = useState<Record<string, number>>({});
  const duration = mixLength(tracks.map((t) => ({ partId: t.partId, seconds: decoded[t.partId] ?? t.seconds })), mix);
  const lengthNow = useCallback(() => mixLength(tracks.map((t) => ({ partId: t.partId, seconds: buffers.current.get(t.partId)?.duration ?? t.seconds })), mixRef.current), [tracks]);

  const load = useCallback((): Promise<boolean> => {
    if (loading.current) return loading.current;
    setStatus("loading");
    // Any context decodes; an offline one needs no tap, so Download works before Play.
    const decoder = new OfflineAudioContext(1, 1, RATE);
    loading.current = Promise.all(
      tracks.map(async (t) => {
        const res = await fetch(t.url);
        if (!res.ok) throw new Error(`${t.title}: ${res.status}`);
        buffers.current.set(t.partId, await decoder.decodeAudioData(await res.arrayBuffer()));
      }),
    ).then(
      () => {
        setDecoded(Object.fromEntries([...buffers.current].map(([id, b]) => [id, b.duration])));
        setStatus("ready");
        return true;
      },
      () => {
        loading.current = null;
        setStatus("error");
        return false;
      },
    );
    return loading.current;
  }, [tracks]);

  const stopNodes = useCallback(() => {
    for (const { src } of nodes.current.values()) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* never started */
      }
      src.disconnect();
    }
    nodes.current.clear();
    cancelAnimationFrame(frame.current);
  }, []);

  /** Lay every take on `target` from playhead `from`, as the mix says. Muted tracks stay laid, at level 0. */
  const schedule = useCallback((target: BaseAudioContext, from: number, when: number) => {
    const laid = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
    for (const t of tracks) {
      const buffer = buffers.current.get(t.partId);
      if (!buffer) continue;
      const m = mixTrackOf(mixRef.current, t.partId);
      const place = placeAt(m.offsetMs, buffer.duration, from);
      if (!place) continue;
      const src = target.createBufferSource();
      src.buffer = buffer;
      const gain = target.createGain();
      gain.gain.value = m.muted ? 0 : m.gain;
      src.connect(gain).connect(target.destination);
      src.start(when + place.wait, place.from);
      laid.set(t.partId, { src, gain });
    }
    return laid;
  }, [tracks]);

  const pause = useCallback(() => {
    const c = ctx.current;
    if (c) setAt(Math.min(duration, c.currentTime - startedAt.current));
    stopNodes();
    setPlaying(false);
  }, [duration, stopNodes]);

  const play = useCallback(
    async (from?: number) => {
      // The tap itself makes the context, so the browser lets it sound.
      const c = (ctx.current ??= new AudioContext());
      if (c.state === "suspended") await c.resume();
      if (!(await load())) return;
      stopNodes();
      const length = lengthNow();
      const start = from ?? at;
      const head = start >= length ? 0 : start;
      nodes.current = schedule(c, head, c.currentTime);
      startedAt.current = c.currentTime - head;
      soundtrack?.pauseFor("Paused for Listen together");
      setPlaying(true);
      const tick = () => {
        const now = c.currentTime - startedAt.current;
        if (now >= lengthNow()) {
          stopNodes();
          setPlaying(false);
          setAt(0);
          return;
        }
        setAt(now);
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [at, lengthNow, load, schedule, soundtrack, stopNodes],
  );

  const seek = useCallback(
    (t: number) => {
      if (playing) void play(t);
      else setAt(t);
    },
    [play, playing],
  );

  // Levels and mutes change the sound in place; a moved start restarts from the playhead.
  const offsets = tracks.map((t) => mixTrackOf(mix, t.partId).offsetMs).join(",");
  const lastOffsets = useRef(offsets);
  useEffect(() => {
    const c = ctx.current;
    if (!playing || !c) {
      lastOffsets.current = offsets;
      return;
    }
    if (offsets !== lastOffsets.current) {
      lastOffsets.current = offsets;
      void play(c.currentTime - startedAt.current);
      return;
    }
    for (const [partId, { gain }] of nodes.current) {
      const m = mixTrackOf(mix, partId);
      gain.gain.setTargetAtTime(m.muted ? 0 : m.gain, c.currentTime, 0.02);
    }
  }, [mix, offsets, play, playing]);

  useEffect(
    () => () => {
      stopNodes();
      void ctx.current?.close();
    },
    [stopNodes],
  );

  /** The mix as a WAV file, rendered offline from the same takes and settings. */
  const render = useCallback(async (): Promise<Blob | null> => {
    if (!(await load())) return null;
    const length = lengthNow();
    if (length <= 0) return null;
    const off = new OfflineAudioContext(2, Math.ceil(length * RATE), RATE);
    schedule(off, 0, 0);
    const out = await off.startRendering();
    return new Blob([encodeWav([out.getChannelData(0), out.getChannelData(1)], RATE)], { type: "audio/wav" });
  }, [lengthNow, load, schedule]);

  return { status, playing, at, duration, play, pause, seek, render };
}
