"use client";
import { BED_FADE_SECONDS, BED_LEVEL, BED_TEMPO, bedLength, clockOf, type AudioBed } from "@wonder/creator-studio/audio";
import { Button, Dialog, DialogContent, KIT, cn } from "@wonder/ui";
import { ChevronLeft, Music2, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { mixSeconds, renderBedMix } from "@/components/audio/bed-mix";
import { useSoundtrack } from "@/components/soundtrack/audio-provider";
import { api, errorMessage } from "@/lib/client";
import { sendToCreator } from "@/lib/send";

/**
 * Background music on the Audio page (owner, 6 Oct 2026: "add bg music from the music library of the inbuilt music
 * player … increase or reduce the tempo, trim the music"). One quiet row under the recording opens a sheet: choose a
 * track from the CreativeRadio library, then shape it while hearing it under your take — level, tempo (pitch kept), where
 * it starts and ends. "Use this music" mixes the two on this device and keeps the mix as a new version: it's what plays
 * here, in the Room and on the published page, credited as the track's license asks.
 */
type LibraryTrack = { id: string; title: string; artist: string; duration: number; moods: readonly string[]; audioUrl: string; license: string; attribution?: string };
type Shape = { trackId: string; from: number; to: number; tempo: number; level: number };

export function BackgroundMusicRow({
  artifactId,
  baseVersionId,
  take,
  bed,
  mixed,
  onSaved,
}: {
  artifactId: string;
  baseVersionId: string | null;
  take: { url: string | null; seconds: number };
  bed: AudioBed | null;
  /** Whether the current take has been mixed with the music (a new take needs mixing again). */
  mixed: boolean;
  onSaved: (v: { id: string; version_number: number; content: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // The version is kept; the page reads the take, its music and the mix again.
  const saved = (v: { id: string; version_number: number; content: string }) => {
    onSaved(v);
    router.refresh();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!take.url}
        className="mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left disabled:opacity-60"
        aria-label={bed ? `Background music: ${bed.title}. Change it` : "Add background music"}
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <Music2 className="size-4" aria-hidden />
        </span>
        {bed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-ink">
              {bed.title} <span className="font-normal text-ink-muted">· {bed.artist}</span>
            </span>
            <span className={cn("block truncate text-[12px]", mixed ? "text-ink-muted" : "text-accent-ink")}>
              {mixed ? `${Math.round(bed.tempo * 100)}% tempo · ${clockOf(bed.from)}–${clockOf(bed.to)} · under your take` : "Mix it with this take"}
            </span>
          </span>
        ) : (
          <span className="text-[13.5px] font-medium text-accent-ink">Add background music</span>
        )}
      </button>
      {open && take.url ? <MusicSheet artifactId={artifactId} baseVersionId={baseVersionId} take={{ url: take.url, seconds: take.seconds }} bed={bed} onClose={() => setOpen(false)} onSaved={saved} /> : null}
    </>
  );
}

function MusicSheet({ artifactId, baseVersionId, take, bed, onClose, onSaved }: { artifactId: string; baseVersionId: string | null; take: { url: string; seconds: number }; bed: AudioBed | null; onClose: () => void; onSaved: (v: { id: string; version_number: number; content: string }) => void }) {
  const [tracks, setTracks] = useState<LibraryTrack[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shape, setShape] = useState<Shape | null>(bed ? { trackId: bed.trackId, from: bed.from, to: bed.to, tempo: bed.tempo, level: bed.level } : null);
  const [step, setStep] = useState<"idle" | "mixing" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ tracks: LibraryTrack[] }>("/api/v1/soundtrack")
      .then((r) => live && setTracks(r.tracks))
      .catch((e) => live && setLoadError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  const track = shape && tracks ? (tracks.find((t) => t.id === shape.trackId) ?? null) : null;
  const preview = usePreview(take, track?.audioUrl ?? null, shape);

  const choose = (t: LibraryTrack) => {
    // A first choice starts at the top of the track and runs as long as the take (or the track, if shorter).
    setShape({ trackId: t.id, from: 0, to: Math.min(t.duration, Math.max(10, Math.ceil(take.seconds + BED_FADE_SECONDS))), tempo: BED_TEMPO.default, level: BED_LEVEL.default });
  };

  async function use() {
    if (!shape || !track) return;
    preview.stop();
    setError(null);
    try {
      setStep("mixing");
      const { blob, seconds } = await renderBedMix({ takeUrl: take.url, musicUrl: track.audioUrl, bed: shape, takeSeconds: take.seconds });
      setStep("uploading");
      const sent = await sendToCreator({ files: [new File([blob], `${track.title} — mix.wav`, { type: "audio/wav" })] });
      const materialId = sent.accepted[0]?.materialId;
      if (!materialId) throw new Error(sent.rejected[0]?.message ?? "The mix didn't upload. Try again.");
      setStep("saving");
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/audio/music`, {
        method: "POST",
        json: { bed: shape, mixMaterialId: materialId, mixSeconds: Math.round(seconds), baseVersionId },
      });
      onSaved(r.version);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStep("idle");
    }
  }
  async function remove() {
    preview.stop();
    setStep("saving");
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/audio/music`, { method: "POST", json: { bed: null, baseVersionId } });
      onSaved(r.version);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setStep("idle");
    }
  }

  const busy = step !== "idle";
  const length = shape ? bedLength(shape) : 0;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && (preview.stop(), onClose())}>
      <DialogContent title="Background music" description={shape && track ? `${track.title} · ${track.artist}` : "From the CreativeRadio library — it plays under your take."} art={KIT.mark.sparklePurple}>
        {!shape || !track ? (
          tracks ? (
            <ul aria-label="Music" className="-mx-1 max-h-[55dvh] divide-y divide-border-soft overflow-y-auto">
              {tracks.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => choose(t)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-surface-muted">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                      <Music2 className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{t.title}</span>
                      <span className="block truncate text-[12px] text-ink-muted">
                        {t.artist} · {t.moods.slice(0, 2).join(", ")} · {clockOf(t.duration)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p role={loadError ? "alert" : "status"} className={cn("py-4 text-[13.5px]", loadError ? "text-danger" : "text-ink-muted")}>
              {loadError ?? "Opening the library…"}
            </p>
          )
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={() => (preview.stop(), setShape(null))} disabled={busy} className="-ml-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-accent-ink">
              <ChevronLeft className="size-4" aria-hidden /> Other music
            </button>
            {/* Hear it under the take, as you shape it. */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (preview.playing ? preview.pause() : void preview.play())}
                aria-label={preview.playing ? "Pause" : "Play with your take"}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white"
              >
                {preview.playing ? <Pause className="size-5" aria-hidden /> : <Play className="ml-0.5 size-5" aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <input type="range" aria-label="Position" min={0} max={Math.max(1, preview.total)} step={0.1} value={Math.min(preview.at, preview.total)} onChange={(e) => preview.seek(Number(e.target.value))} className="block h-8 w-full accent-[var(--color-accent)]" />
                <p className="-mt-0.5 flex justify-between text-[12px] tabular-nums text-ink-muted">
                  <span>{clockOf(preview.at)}</span>
                  <span>{clockOf(preview.total)}</span>
                </p>
              </div>
            </div>
            <Slider label="Music level" value={shape.level} min={BED_LEVEL.min} max={BED_LEVEL.max} step={BED_LEVEL.step} show={`${Math.round(shape.level * 100)}%`} ends={["Quiet", "Loud"]} onChange={(level) => setShape({ ...shape, level })} />
            <Slider label="Tempo" value={shape.tempo} min={BED_TEMPO.min} max={BED_TEMPO.max} step={BED_TEMPO.step} show={`${Math.round(shape.tempo * 100)}%`} ends={["Slower", "Faster"]} onChange={(tempo) => setShape({ ...shape, tempo: Math.round(tempo * 100) / 100 })} />
            <Slider label="Starts at" value={shape.from} min={0} max={Math.max(0, track.duration - 1)} step={0.5} show={clockOf(shape.from)} onChange={(from) => setShape({ ...shape, from, to: Math.max(shape.to, from + 1) })} />
            <Slider label="Ends at" value={shape.to} min={Math.min(track.duration, shape.from + 1)} max={track.duration} step={0.5} show={clockOf(shape.to)} onChange={(to) => setShape({ ...shape, to })} />
            <p className="text-[12px] leading-snug text-ink-muted">
              Plays for {clockOf(length)}, fading out at the end{length > take.seconds + 1 ? ` — ${clockOf(length - take.seconds)} after your voice` : ""}. When published, it&rsquo;s credited:{" "}
              <span className="text-ink">
                “{track.title}” by {track.artist} · {track.license}
              </span>
              .
            </p>
            {error ? (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button onClick={() => void use()} loading={busy && step !== "saving"} disabled={busy}>
                {step === "mixing" ? "Mixing…" : step === "uploading" ? "Uploading…" : step === "saving" ? "Saving…" : "Use this music"}
              </Button>
              {bed ? (
                <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex min-h-11 items-center px-2 text-[13px] font-medium text-ink-muted hover:text-ink">
                  Take the music away
                </button>
              ) : null}
            </div>
            <p className="text-[11.5px] text-ink-subtle">Mixed on this device: {clockOf(mixSeconds(take.seconds, shape))} of audio.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Slider({ label, value, min, max, step, show, ends, onChange }: { label: string; value: number; min: number; max: number; step: number; show: string; ends?: [string, string]; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px] text-ink">
        {label} <span className="tabular-nums text-ink-muted">{show}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="block h-8 w-full accent-[var(--color-accent)]" />
      {ends ? (
        <span aria-hidden className="-mt-1 flex justify-between text-[11px] text-ink-subtle">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      ) : null}
    </label>
  );
}

/**
 * The take and the music played together, live, so every change is heard at once: the take as recorded; the music from
 * its start point, at its tempo with the pitch kept (the browser's own time-stretch), at its level with the same fades
 * the mix will have. Background music from the player steps aside while it plays.
 */
function usePreview(take: { url: string; seconds: number }, musicUrl: string | null, shape: Shape | null) {
  const soundtrack = useSoundtrack();
  const voice = useRef<HTMLAudioElement | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const frame = useRef(0);
  const startedAt = useRef(0);
  const offset = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const shapeRef = useRef(shape);
  useEffect(() => {
    shapeRef.current = shape;
  }, [shape]);
  const total = shape ? Math.max(take.seconds, bedLength(shape)) : take.seconds;

  const ensure = useCallback(() => {
    if (!voice.current) {
      voice.current = new Audio(take.url);
      voice.current.preload = "auto";
    }
    if (musicUrl && (!music.current || music.current.dataset.src !== musicUrl)) {
      music.current?.pause();
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.dataset.src = musicUrl;
      el.src = musicUrl;
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      ctx.current ??= new AudioContext();
      const g = ctx.current.createGain();
      ctx.current.createMediaElementSource(el).connect(g).connect(ctx.current.destination);
      gain.current = g;
      music.current = el;
    }
  }, [take.url, musicUrl]);

  // Where the music should be, and how loud, `t` seconds into the piece.
  const place = useCallback((t: number, start: boolean) => {
    const s = shapeRef.current;
    const m = music.current;
    if (!s || !m) return;
    const len = bedLength(s);
    m.playbackRate = s.tempo;
    if (t >= len) {
      m.pause();
      return;
    }
    const level = s.level * Math.min(1, t / 0.25, (len - t) / BED_FADE_SECONDS);
    if (gain.current && ctx.current) gain.current.gain.setTargetAtTime(Math.max(0, level), ctx.current.currentTime, 0.05);
    if (start) {
      m.currentTime = s.from + t * s.tempo;
      void m.play().catch(() => undefined);
    }
  }, []);

  const tickRef = useRef<() => void>(() => undefined);
  const tick = useCallback(() => {
    const t = offset.current + (performance.now() - startedAt.current) / 1000;
    setAt(t);
    place(t, false);
    if (t >= Math.max(take.seconds, shapeRef.current ? bedLength(shapeRef.current) : 0)) {
      voice.current?.pause();
      music.current?.pause();
      setPlaying(false);
      offset.current = 0;
      setAt(0);
      return;
    }
    frame.current = requestAnimationFrame(() => tickRef.current());
  }, [place, take.seconds]);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const play = useCallback(async () => {
    ensure();
    soundtrack?.pauseFor("Paused while you hear the music under your take");
    await ctx.current?.resume();
    const t = offset.current;
    if (voice.current && t < take.seconds) {
      voice.current.currentTime = t;
      void voice.current.play().catch(() => undefined);
    }
    place(t, true);
    startedAt.current = performance.now();
    setPlaying(true);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
  }, [ensure, place, soundtrack, take.seconds, tick]);

  const pause = useCallback(() => {
    cancelAnimationFrame(frame.current);
    offset.current = offset.current + (performance.now() - startedAt.current) / 1000;
    voice.current?.pause();
    music.current?.pause();
    setPlaying(false);
  }, []);
  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    voice.current?.pause();
    music.current?.pause();
    offset.current = 0;
    setAt(0);
    setPlaying(false);
  }, []);
  const seek = useCallback(
    (t: number) => {
      offset.current = t;
      setAt(t);
      if (playing) void play();
    },
    [play, playing],
  );

  // A changed start, tempo or end while playing: the music moves to where it should now be.
  const key = shape ? `${shape.trackId}:${shape.from}:${shape.to}:${shape.tempo}` : "";
  const lastKey = useRef(key);
  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (!playing) return;
    ensure();
    const t = offset.current + (performance.now() - startedAt.current) / 1000;
    place(t, true);
  }, [key, playing, ensure, place]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      voice.current?.pause();
      music.current?.pause();
      void ctx.current?.close();
    },
    [],
  );
  return { playing, at, total, play, pause, stop, seek };
}
