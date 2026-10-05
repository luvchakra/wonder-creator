"use client";
import { blankShot, MAX_SHOTS, runtimeOf, SHOT_SECONDS, type Shot, type Storyboard } from "@wonder/creator-studio/storyboard";
import { clockOf } from "@wonder/creator-studio/audio";
import { Dialog, DialogContent, KIT, KitArt, cn } from "@wonder/ui";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ImagePlus, Minus, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { YourPictures } from "@/components/images/your-pictures";
import { api, errorMessage } from "@/lib/client";

/**
 * The Video page's canvas (creation-pages.md, step 5): the storyboard. The current shot large — its frame, or a painted
 * card with its line until there is one — and the shots beneath with the runtime. Write (the primary action) opens the
 * shot's line, direction, length and frame; Add shot and Play through are the secondaries. Play through is the
 * animatic: each frame held for its length with its line beneath. Every change autosaves as a version.
 */
export interface VideoControls {
  write: () => void;
  add: () => void;
  play: () => void;
  render: () => void;
}

export function VideoCanvas({ artifactId, initial, frames: initialFrames, baseVersionId, controls, onKept }: { artifactId: string; initial: Storyboard; frames: Record<string, string | null>; baseVersionId: string | null; controls: Ref<VideoControls>; onKept: (v: { id: string; version_number: number; content: string }) => void }) {
  const [sb, setSb] = useState<Storyboard>(initial);
  const [frames, setFrames] = useState(initialFrames);
  const [at, setAt] = useState(0);
  const [writing, setWriting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const base = useRef(baseVersionId);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(sb);
  const lineField = useRef<HTMLTextAreaElement>(null);
  const i = Math.min(at, Math.max(0, sb.shots.length - 1));
  const shot = sb.shots[i] ?? null;

  const save = useCallback(async () => {
    pending.current = null;
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/storyboard`, { method: "POST", json: { storyboard: latest.current, baseVersionId: base.current } });
      base.current = r.version.id;
      onKept(r.version);
      setSaving("saved");
      setError(null);
    } catch (e) {
      setSaving("idle");
      setError(errorMessage(e));
    }
  }, [artifactId, onKept]);
  const change = useCallback(
    (next: Storyboard) => {
      latest.current = next;
      setSb(next);
      setSaving("saving");
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void save(), 1000);
    },
    [save],
  );
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);

  const edit = (patch: Partial<Shot>) => shot && change({ ...sb, shots: sb.shots.map((s) => (s.id === shot.id ? { ...s, ...patch } : s)) });
  const add = useCallback(() => {
    if (sb.shots.length >= MAX_SHOTS) return setError(`A storyboard holds up to ${MAX_SHOTS} shots.`);
    const j = sb.shots.length ? i + 1 : 0;
    change({ ...sb, shots: [...sb.shots.slice(0, j), blankShot(), ...sb.shots.slice(j)] });
    setAt(j);
    setWriting(true);
    requestAnimationFrame(() => lineField.current?.focus());
  }, [change, i, sb]);
  const move = (by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= sb.shots.length) return;
    const shots = [...sb.shots];
    [shots[i], shots[j]] = [shots[j]!, shots[i]!];
    change({ ...sb, shots });
    setAt(j);
  };
  const remove = () => {
    if (!shot) return;
    change({ ...sb, shots: sb.shots.filter((s) => s.id !== shot.id) });
    setAt(Math.max(0, Math.min(i, sb.shots.length - 2)));
  };

  // The page's header and bottom bar ask; the canvas answers (a handle made once that calls the latest actions).
  const actions = useRef<VideoControls | null>(null);
  useEffect(() => {
    actions.current = {
      write: () => (sb.shots.length ? setWriting((w) => !w) : add()),
      add,
      play: () => {
        if (sb.shots.length) setPlaying(true);
      },
      render: () => setRendering(true),
    };
  });
  useImperativeHandle(controls, () => ({ write: () => actions.current?.write(), add: () => actions.current?.add(), play: () => actions.current?.play(), render: () => actions.current?.render() }), []);

  const runtime = runtimeOf(sb);
  return (
    <div className="p-3 sm:p-4">
      {shot ? (
        <>
          <Frame shot={shot} index={i} url={shot.frame ? (frames[shot.frame] ?? null) : null} className="rounded-2xl shadow-[var(--shadow-card)]" />
          <div className="mt-2 px-1">
            {shot.line ? <p className="whitespace-pre-line font-display text-[16px] leading-relaxed text-ink">{shot.line}</p> : null}
            <p className="mt-1 flex items-center justify-between text-[12px] text-ink-subtle" aria-live="polite">
              <span>
                Shot {i + 1} of {sb.shots.length} · {sb.shots.length} {sb.shots.length === 1 ? "shot" : "shots"}, {clockOf(runtime)}
              </span>
              <span>{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}</span>
            </p>
          </div>
        </>
      ) : (
        <div className="relative isolate flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_20%_10%,#2a2119_0%,#0d0b09_60%)] text-center">
          <p className="font-display text-[22px] italic text-[#f3ebe0]">No shots yet.</p>
          <p className="mt-1 text-[13.5px] text-[#cbbfae]">Add the first — a line of what&rsquo;s seen or said is enough.</p>
        </div>
      )}

      {writing && shot ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-surface-muted/60 p-3">
          <textarea ref={lineField} aria-label="What's seen or said" value={shot.line} maxLength={1000} rows={3} placeholder="What's seen or said in this shot." onChange={(e) => edit({ line: e.target.value })} className="block w-full resize-y rounded-xl border border-border-soft bg-surface px-3 py-2 font-display text-[16px] text-ink outline-none focus:border-accent" />
          <input aria-label="Camera and staging" value={shot.direction} maxLength={500} placeholder="Camera and staging — wide, close, slow push in…" onChange={(e) => edit({ direction: e.target.value })} className="block w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-[13.5px] text-ink-muted outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div role="group" aria-label="How long it holds" className="flex items-center">
              <button type="button" aria-label="Shorter" disabled={shot.seconds <= SHOT_SECONDS.min} onClick={() => edit({ seconds: shot.seconds - 1 })} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-ink disabled:opacity-40">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-10 text-center text-[13.5px] tabular-nums text-ink">{shot.seconds}s</span>
              <button type="button" aria-label="Longer" disabled={shot.seconds >= SHOT_SECONDS.max} onClick={() => edit({ seconds: shot.seconds + 1 })} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-ink disabled:opacity-40">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            <button type="button" onClick={() => setChoosing(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-accent-ink hover:underline">
              <ImagePlus className="size-4" aria-hidden /> {shot.frame ? "Change the frame" : "Choose a frame"}
            </button>
            {shot.frame ? (
              <button type="button" onClick={() => edit({ frame: null })} className="inline-flex min-h-11 items-center rounded-full px-2 text-[13px] text-ink-muted hover:text-ink">
                Remove the frame
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => move(-1)} disabled={i === 0} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] text-ink-muted hover:text-ink disabled:opacity-40">
              <ArrowLeft className="size-4" aria-hidden /> Move earlier
            </button>
            <button type="button" onClick={() => move(1)} disabled={i >= sb.shots.length - 1} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] text-ink-muted hover:text-ink disabled:opacity-40">
              Move later <ArrowRight className="size-4" aria-hidden />
            </button>
            <span className="flex-1" />
            <button type="button" onClick={remove} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] text-danger hover:underline">
              <Trash2 className="size-4" aria-hidden /> Delete shot
            </button>
          </div>
        </div>
      ) : null}

      {sb.shots.length > 1 || writing ? (
        <ol aria-label="Shots" className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
          {sb.shots.map((s, k) => (
            <li key={s.id} className="w-28 shrink-0 snap-start">
              <button type="button" onClick={() => setAt(k)} aria-label={`Shot ${k + 1}, ${s.seconds} seconds: ${s.line.split("\n")[0]?.slice(0, 60) || "no line yet"}`} aria-current={k === i ? "true" : undefined} className={cn("block w-full overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-surface", k === i ? "ring-accent" : "ring-transparent hover:ring-border")}>
                <Frame shot={s} index={k} url={s.frame ? (frames[s.frame] ?? null) : null} small />
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 rounded-2xl bg-[#fdecec] px-3.5 py-2 text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent title="Choose a frame" description="One of your pictures, for this shot.">
          <YourPictures
            busy={false}
            verb="Use"
            onPick={(id, url) => {
              setFrames((f) => ({ ...f, [id]: url }));
              edit({ frame: id });
              setChoosing(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* No video provider is connected: Render says so plainly (CLAUDE.md, invariant 7). */}
      <Dialog open={rendering} onOpenChange={setRendering}>
        <DialogContent title="Render video" description="Video rendering isn't connected.">
          <p className="text-[14px] text-ink-muted">The storyboard, the shot list and the animatic are all here. When a video provider is connected, Render makes a draft from them — nothing is made until then.</p>
        </DialogContent>
      </Dialog>

      {playing ? <Animatic sb={sb} frames={frames} start={i} onClose={(k) => (setPlaying(false), setAt(k))} /> : null}
    </div>
  );
}

/** A shot's frame: the picture, or a painted card with the line until there is one. */
function Frame({ shot, index, url, small = false, className }: { shot: Shot; index: number; url: string | null; small?: boolean; className?: string }) {
  return (
    <div className={cn("@container relative isolate aspect-video w-full overflow-hidden bg-[radial-gradient(120%_90%_at_20%_10%,#2a2119_0%,#0d0b09_60%)]", className)} aria-hidden={small || undefined}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <>
          <KitArt art={KIT.wash.washPeach} sizes="20rem" className="pointer-events-none absolute -right-[15%] -top-[25%] -z-10 h-auto w-[60%] opacity-25" />
          <p className="flex h-full items-center justify-center px-[8cqw] text-center font-display text-[4.2cqw] italic leading-snug text-[#f3ebe0]/85">{shot.line.split("\n")[0] || shot.direction || "A shot"}</p>
        </>
      )}
      <span className="absolute left-[3cqw] top-[3cqw] rounded-full bg-black/45 px-[2cqw] py-[0.6cqw] text-[2.6cqw] font-medium tabular-nums text-white backdrop-blur">
        {index + 1} · {shot.seconds}s
      </span>
    </div>
  );
}

/** Play through: each frame held for its length, its line beneath — an animatic. Escape ends it. */
function Animatic({ sb, frames, start, onClose }: { sb: Storyboard; frames: Record<string, string | null>; start: number; onClose: (at: number) => void }) {
  const [k, setK] = useState(start);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const last = sb.shots.length - 1;
  const shot = sb.shots[k]!;
  const total = runtimeOf(sb);
  const before = sb.shots.slice(0, k).reduce((t, s) => t + s.seconds, 0);
  useEffect(() => root.current?.focus(), []);
  // The clock: a tick each tenth of a second moves the shot on when its length is up.
  const tick = useRef(0);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      tick.current += 0.1;
      if (tick.current < shot.seconds) return setElapsed(tick.current);
      tick.current = 0;
      if (k < last) {
        setK(k + 1);
        setElapsed(0);
      } else {
        setPaused(true);
        setElapsed(shot.seconds);
      }
    }, 100);
    return () => clearInterval(t);
  }, [k, last, paused, shot.seconds]);
  const go = (to: number) => {
    tick.current = 0;
    setK(Math.max(0, Math.min(last, to)));
    setElapsed(0);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(k);
      else if (e.key === "ArrowRight") go(k + 1);
      else if (e.key === "ArrowLeft") go(k - 1);
      else if (e.key === " ") setPaused((p) => !p);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Playing through" className="fixed inset-0 z-[70] flex flex-col bg-black outline-none">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="w-full max-w-[calc((100dvh-12rem)*16/9)]">
          <Frame shot={shot} index={k} url={shot.frame ? (frames[shot.frame] ?? null) : null} />
        </div>
        {shot.line ? <p className="max-w-2xl whitespace-pre-line text-center font-display text-[18px] leading-relaxed text-white/90">{shot.line}</p> : null}
      </div>
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className="h-full bg-white/70" style={{ width: `${total ? ((before + elapsed) / total) * 100 : 0}%` }} />
      </div>
      <div className="flex h-16 items-center justify-center gap-2 text-[13px] text-white/70">
        <button type="button" aria-label="Previous shot" onClick={() => go(k - 1)} disabled={k === 0} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)} className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          {paused ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />}
        </button>
        <button type="button" aria-label="Next shot" onClick={() => go(k + 1)} disabled={k === last} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <span className="ml-2 tabular-nums" aria-live="polite">
          Shot {k + 1} of {sb.shots.length} · {clockOf(before + elapsed)} / {clockOf(total)}
        </span>
        <button type="button" aria-label="Stop playing" onClick={() => onClose(k)} className="ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10">
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
