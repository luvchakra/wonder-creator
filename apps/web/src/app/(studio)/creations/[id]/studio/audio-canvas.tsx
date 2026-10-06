"use client";
import { clockOf, type AudioBed } from "@wonder/creator-studio/audio";
import { Button, Dialog, DialogContent, KIT, KitArt, cn } from "@wonder/ui";
import { Mic, Pause, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PlayAlong, PlayAlongTrack } from "@wonder/creator-projects/parts-options";
import { BackgroundMusicRow } from "./background-music";
import { PlayAlongBar, PlayAlongWords } from "./play-along";
import { clock, uploadRecording, useAudioRecorder } from "@/components/audio/use-recorder";
import { api, errorMessage } from "@/lib/client";

/**
 * The Audio page's recording (creation-pages.md, step 3): the take above the words. Record is the page's primary
 * action; keeping a take makes a new version carrying the words as they are — earlier takes stay as Materials and come
 * back by restoring a version. Transcription follows on its own when the AI provider is live; honest when it isn't.
 */
export interface AudioTakeView {
  materialId: string;
  url: string | null;
  seconds: number;
  transcript: string | null;
  /** Why there's no transcript, when there isn't one (not connected, no speech…), or null while it's still coming. */
  note: string | null;
  done: boolean;
  /** Background music (owner, 6 Oct 2026): what was chosen, and the mix of it with this take — what plays, when there is one. */
  bed: AudioBed | null;
  mix: { url: string | null; seconds: number } | null;
}
export type AudioRequest = { kind: "record"; n: number } | null;

export function AudioPanel({
  artifactId,
  take,
  baseVersionId,
  words,
  request,
  onKept,
  onUseTranscript,
  playAlong = null,
}: {
  /** A part of a Room's work (step 3): the other parts' takes to play, and the words to read while recording. */
  playAlong?: PlayAlong | null;
  artifactId: string;
  take: AudioTakeView | null;
  baseVersionId: string | null;
  words: string;
  request: AudioRequest;
  onKept: (v: { id: string; version_number: number; content: string }) => void;
  onUseTranscript: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seenReq, setSeenReq] = useState(request?.n ?? 0);
  if (request && request.n !== seenReq) {
    setSeenReq(request.n);
    setRecording(true);
  }
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  // With background music, the mix is what plays (and what's downloaded and published); the take alone otherwise.
  const playUrl = take?.mix?.url ?? take?.url ?? null;
  const [d, setD] = useState(take?.mix?.seconds ?? take?.seconds ?? 0);
  const [seenTake, setSeenTake] = useState(playUrl);
  if (playUrl !== seenTake) {
    setSeenTake(playUrl);
    setT(0);
    setD(take?.mix?.seconds ?? take?.seconds ?? 0);
    setPlaying(false);
  }
  // Record over a track: the first other part's take plays while recording (headphones keep it out of the take).
  const track = playAlong?.tracks[0] ?? null;
  const [over, setOver] = useState(true);
  // Offered while the words differ from what was said; the words it replaces stay in the versions once saved.
  const transcriptOffer = !!take?.transcript && words.trim() !== take.transcript.trim();

  return (
    <div className="relative isolate overflow-hidden border-b border-border-soft bg-[linear-gradient(180deg,#f6effa_0%,#fbf7f0_100%)] px-4 py-4 sm:px-8">
      <KitArt art={KIT.wash.washLavender} sizes="20rem" className="pointer-events-none absolute -right-16 -top-20 -z-10 h-auto w-80 opacity-60" />
      {take ? (
        <div className="flex items-center gap-3">
          <audio
            ref={audio}
            src={playUrl ?? undefined}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setD(e.currentTarget.duration)}
          />
          <button
            type="button"
            disabled={!playUrl}
            onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())}
            aria-label={playing ? "Pause the recording" : take.mix ? "Play the recording with its music" : "Play the recording"}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-[var(--shadow-card)] disabled:opacity-50"
          >
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="ml-0.5 size-5" aria-hidden />}
          </button>
          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="sr-only">Position in the recording</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.round(d))}
                value={Math.round(t)}
                onChange={(e) => {
                  if (audio.current) audio.current.currentTime = Number(e.target.value);
                }}
                className="h-11 w-full accent-[var(--color-accent,#6d5dfc)]"
              />
            </label>
            <p className="-mt-1.5 flex justify-between text-[12px] tabular-nums text-ink-muted">
              <span>{clockOf(t)}</span>
              <span>{clockOf(d)}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <Mic className="size-5" aria-hidden />
          </span>
          <p className="text-[13.5px] leading-snug text-ink-muted">
            <span className="block font-display text-[19px] text-ink">Your voice, first</span>
            Record it here; the words — a script, lyrics or the transcript — sit below.
          </p>
        </div>
      )}
      {take ? <BackgroundMusicRow artifactId={artifactId} baseVersionId={baseVersionId} take={{ url: take.url, seconds: take.seconds }} bed={take.bed} mixed={!!take.mix} onSaved={onKept} /> : null}
      {take && !take.transcript ? (
        <p className="mt-2 text-[12.5px] text-ink-subtle" role="status">
          {take.done ? (take.note ?? "No transcript for this take.") : "Transcribing when it can…"}
        </p>
      ) : null}
      {transcriptOffer ? (
        <button type="button" onClick={() => onUseTranscript(take!.transcript!)} className="mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
          {words.trim() ? "Replace the words with the transcript" : "Use the transcript as the words"}
        </button>
      ) : null}
      {playAlong ? (
        <div className="mt-3 space-y-2">
          <PlayAlongBar tracks={playAlong.tracks} />
          {track ? (
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} className="size-4 accent-[var(--color-accent,#6d5dfc)]" />
              Play {track.title} while I record <span className="text-ink-muted">— with headphones</span>
            </label>
          ) : null}
          {playAlong.words ? <PlayAlongWords words={playAlong.words} onUse={onUseTranscript} /> : null}
        </div>
      ) : null}
      <RecordSheet
        open={recording}
        onOpenChange={setRecording}
        artifactId={artifactId}
        baseVersionId={baseVersionId}
        words={words}
        again={!!take}
        onKept={onKept}
        track={track && over ? track : null}
        lyrics={playAlong?.words?.text ?? null}
      />
    </div>
  );
}

type RecordProps = { artifactId: string; baseVersionId: string | null; words: string; again: boolean; onKept: AudioPanelKept; track: PlayAlongTrack | null; lyrics: string | null };
function RecordSheet({ open, onOpenChange, ...rest }: { open: boolean; onOpenChange: (o: boolean) => void } & RecordProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={rest.again ? "Record again" : "Record"}
        description={rest.track ? `Recording over ${rest.track.title} v${rest.track.versionNumber} — it plays from the start.` : rest.again ? "A new take; the earlier one is kept." : "Recording starts now. Stop when you're done."}
        art={KIT.iconChip.waveform}
      >
        {open ? <RecordBody {...rest} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
type AudioPanelKept = (v: { id: string; version_number: number; content: string }) => void;

function RecordBody({ artifactId, baseVersionId, words, onKept, onClose, track, lyrics }: RecordProps & { onClose: () => void }) {
  const router = useRouter();
  const { state, seconds, levelRef, stop } = useAudioRecorder({ fallback: "write the words instead" });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  const clientId = useRef(crypto.randomUUID());
  const recorded = state.phase === "recorded" ? state : null;
  // Recording over a track: it starts with the recording and stops with it.
  const backing = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = backing.current;
    if (!el) return;
    if (state.phase === "recording") {
      el.currentTime = 0;
      void el.play().catch(() => undefined);
    } else el.pause();
  }, [state.phase]);
  const readAlong = (lyrics ?? words).trim();

  async function keep() {
    if (!recorded) return;
    setError(null);
    setProgress(0);
    try {
      const { materialId } = await uploadRecording(recorded, clientId.current, setProgress);
      if (!materialId) throw new Error("We couldn't save the recording. Try again.");
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/audio`, {
        method: "POST",
        json: { materialId, seconds: recorded.seconds, content: words, baseVersionId },
      });
      onKept(r.version);
      onClose();
      router.refresh();
    } catch (e) {
      setProgress(null);
      setError(errorMessage(e));
    }
  }

  if (state.phase === "blocked")
    return (
      <p role="alert" className="text-[14px] text-ink">
        {state.message}
      </p>
    );
  if (recorded)
    return (
      <div className="space-y-3">
        <p className="font-medium text-ink">Take · {clock(recorded.seconds)}</p>
        <audio ref={player} src={recorded.url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} className="hidden" />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => (playing ? player.current?.pause() : void player.current?.play())}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} {playing ? "Pause" : "Listen"}
          </Button>
          <Button className="flex-1" onClick={() => void keep()} loading={progress !== null}>
            {progress !== null ? `Keeping… ${progress}%` : error ? "Try again" : "Keep this take"}
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-4">
      {track ? <audio ref={backing} src={track.url} preload="auto" className="hidden" /> : null}
      <p className="text-center font-display text-[32px] tabular-nums leading-none text-ink">{clock(seconds)}</p>
      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <span ref={levelRef} className="block h-full origin-left scale-x-[0.06] rounded-full bg-accent" />
      </span>
      <p className="sr-only" role="status">
        {state.phase === "recording" ? "Recording" : "Starting the microphone"}
      </p>
      <Button className={cn("w-full")} disabled={state.phase !== "recording"} onClick={stop}>
        <Square className="size-4 fill-current" aria-hidden /> Stop
      </Button>
      {readAlong ? (
        <p aria-label="Words to sing" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-muted px-4 py-3 text-center font-display text-[16px] leading-relaxed text-ink">
          {readAlong}
        </p>
      ) : null}
    </div>
  );
}
