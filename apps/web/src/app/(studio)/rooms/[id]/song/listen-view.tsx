"use client";
import { MIX_GAIN, mixTrackOf, offsetLabel, type ListenTrack, type Mix, type MixTrack, type PartKind, type PartStatus } from "@wonder/creator-projects/parts-options";
import { clockOf } from "@wonder/creator-studio/audio";
import { Button, KIT, KitArt, buttonClasses, cn } from "@wonder/ui";
import { Download, Minus, Pause, Play, Plus, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackLink } from "@/components/back-link";
import { useMix } from "@/components/audio/use-mix";
import { api, errorMessage } from "@/lib/client";

/**
 * Listen together (creative-room-parts.md, step 4) — the Room's parts heard as one. One primary action (Play); the
 * download is the one secondary. The people making the work set each take's start and level here; it saves as they
 * go and changes nobody's part. Everyone else listens.
 */
interface PartLine {
  id: string;
  title: string;
  kind: PartKind;
  status: PartStatus;
  versionNumber: number | null;
  href: string | null;
}

const STEP_MS = 100;
const DOT: Record<PartStatus, string> = { open: "border-2 border-border bg-transparent", in_rounds: "bg-accent", final: "bg-success-ink" };

export function ListenView({
  project,
  parts,
  tracks,
  mix: initial,
  words,
  making,
}: {
  project: { id: string; title: string };
  parts: PartLine[];
  tracks: ListenTrack[];
  mix: Mix;
  words: { partId: string; title: string; versionNumber: number; text: string } | null;
  making: boolean;
}) {
  const [mix, setMix] = useState<Mix>(initial);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const player = useMix(tracks, mix);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave: the latest settings, a moment after the last change.
  function change(partId: string, patch: Partial<MixTrack>) {
    const next = { ...mix, [partId]: { ...mixTrackOf(mix, partId), ...patch } };
    setMix(next);
    setSaved("saving");
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      api(`/api/v1/projects/${project.id}/mix`, { method: "PUT", json: next }).then(
        () => (setSaved("saved"), setError(null)),
        (e) => (setSaved("idle"), setError(errorMessage(e))),
      );
    }, 500);
  }
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);

  async function download() {
    setRendering(true);
    setError(null);
    try {
      const blob = await player.render();
      if (!blob) throw new Error("There's nothing to mix yet.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Mix"}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRendering(false);
    }
  }

  const finals = parts.filter((p) => p.status === "final").length;
  const takenParts = new Set(tracks.map((t) => t.partId));
  const waiting = parts.filter((p) => p.kind === "audio" && !takenParts.has(p.id));
  const myOpenPart = parts.find((p) => p.href && !takenParts.has(p.id) && p.kind === "audio");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-24 pt-2 sm:px-6">
      <BackLink home={`/rooms/${project.id}`} homeLabel={project.title} />

      {/* The work, heard: the hero (expressive surface). */}
      <section aria-labelledby="listen-title" className="relative isolate overflow-hidden rounded-[28px] border border-border-soft bg-[linear-gradient(160deg,#ece7ff_0%,#fbf4ee_58%,#fff4ea_100%)] px-5 pb-5 pt-6 shadow-[var(--shadow-card)] sm:px-7 sm:pt-8">
        <KitArt art={KIT.wash.washLavender} sizes="22rem" className="pointer-events-none absolute -right-16 -top-20 -z-10 h-auto w-[22rem] opacity-70" />
        <KitArt art={KIT.wash.washPeach} sizes="16rem" className="pointer-events-none absolute -bottom-24 -left-16 -z-10 h-auto w-64 opacity-50" />
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Listen together</p>
        <h1 id="listen-title" className="mt-1 font-display text-[30px] leading-[1.12] text-ink sm:text-[40px]">
          {project.title}
        </h1>
        {/* Where it stands, in one line: every part, its version and whether its people call it final. */}
        <ul aria-label="Where it stands" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
          {parts.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", DOT[p.status])} />
              {p.title}
              {p.versionNumber ? ` v${p.versionNumber}` : " — not started"}
              {p.status === "final" ? " · final" : ""}
            </li>
          ))}
          <li className="text-ink-subtle">{finals ? `${finals} of ${parts.length} final` : "nothing final yet"}</li>
        </ul>

        {tracks.length ? (
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (player.playing ? player.pause() : void player.play())}
                aria-label={player.playing ? "Pause" : `Play ${project.title}`}
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_24px_-10px_rgba(80,60,200,0.7)] transition-transform hover:bg-accent-ink active:scale-95 motion-reduce:transition-none"
              >
                {player.playing ? <Pause className="size-6" aria-hidden /> : <Play className="ml-0.5 size-6" aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <input
                  type="range"
                  aria-label="Position"
                  min={0}
                  max={Math.max(1, player.duration)}
                  step={0.1}
                  value={Math.min(player.at, player.duration)}
                  onChange={(e) => player.seek(Number(e.target.value))}
                  className="h-11 w-full accent-[var(--color-accent)]"
                />
                <p className="-mt-1 flex justify-between text-[12px] tabular-nums text-ink-muted">
                  <span>{clockOf(player.at)}</span>
                  <span role="status">{player.status === "loading" ? "Getting the takes…" : player.status === "error" ? "Couldn't load the takes — try Play again." : clockOf(player.duration)}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" loading={rendering} onClick={() => void download()}>
                <Download className="size-4" aria-hidden />
                {rendering ? "Mixing…" : "Download the mix"}
              </Button>
              <span className="text-[12px] text-ink-subtle">A WAV of what you hear, made on this device.</span>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="font-display text-[17px] italic text-ink">Nothing to hear yet.</p>
            <p className="mt-1 text-[13.5px] text-ink-muted">When a part keeps a take, it plays here with the others.</p>
            {myOpenPart?.href ? (
              <Link href={myOpenPart.href} className={cn(buttonClasses(), "mt-3")}>
                Open {myOpenPart.title}
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-3.5 py-2 text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      {tracks.length ? (
        <section aria-labelledby="takes-title" className="rounded-3xl border border-border-soft bg-surface/90 px-4 py-3 shadow-[var(--shadow-card)]">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="takes-title" className="shrink-0 font-display text-[17px] text-ink">
              The takes
            </h2>
            <p aria-live="polite" className="text-[12px] text-ink-subtle">
              {making ? (saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : "Changes save as you go") : "Set by the people making it"}
            </p>
          </div>
          <ul className="mt-1 divide-y divide-border-soft">
            {tracks.map((t) => {
              const m = mixTrackOf(mix, t.partId);
              return (
                <li key={t.partId} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-[14px] font-medium text-ink">
                      {t.title} <span className="font-normal text-ink-muted">· v{t.versionNumber}{t.people.length ? ` · ${t.people.join(", ")}` : ""}</span>
                    </p>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-muted">{clockOf(t.seconds)}</span>
                  </div>
                  {making ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        aria-pressed={m.muted}
                        aria-label={m.muted ? `Unmute ${t.title}` : `Mute ${t.title}`}
                        onClick={() => change(t.partId, { muted: !m.muted })}
                        className={cn("inline-flex size-11 items-center justify-center rounded-full", m.muted ? "text-danger" : "text-ink-muted hover:text-ink")}
                      >
                        {m.muted ? <VolumeX className="size-[18px]" aria-hidden /> : <Volume2 className="size-[18px]" aria-hidden />}
                      </button>
                      <label className="flex min-w-[9rem] flex-1 items-center gap-2 text-[12px] text-ink-muted">
                        <span className="sr-only">{t.title} level</span>
                        <input
                          type="range"
                          min={MIX_GAIN.min * 100}
                          max={MIX_GAIN.max * 100}
                          step={5}
                          value={Math.round(m.gain * 100)}
                          onChange={(e) => change(t.partId, { gain: Number(e.target.value) / 100 })}
                          className="h-11 w-full accent-[var(--color-accent)]"
                        />
                        <span className="w-10 shrink-0 text-right tabular-nums">{Math.round(m.gain * 100)}%</span>
                      </label>
                      <div role="group" aria-label={`Where ${t.title} starts`} className="flex items-center">
                        <button type="button" aria-label={`Start ${t.title} earlier`} onClick={() => change(t.partId, { offsetMs: m.offsetMs - STEP_MS })} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-ink">
                          <Minus className="size-4" aria-hidden />
                        </button>
                        <span className="w-[5.5rem] text-center text-[12.5px] tabular-nums text-ink">{offsetLabel(m.offsetMs)}</span>
                        <button type="button" aria-label={`Start ${t.title} later`} onClick={() => change(t.partId, { offsetMs: m.offsetMs + STEP_MS })} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-ink">
                          <Plus className="size-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {m.muted ? "Muted" : `Level ${Math.round(m.gain * 100)}%`} · starts {offsetLabel(m.offsetMs)}
                    </p>
                  )}
                </li>
              );
            })}
            {waiting.map((p) => (
              <li key={p.id} className="py-2.5 text-[13.5px] text-ink-muted">
                {p.title} — no take kept yet
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {words ? (
        <section aria-labelledby="words-title" className="relative isolate overflow-hidden rounded-3xl border border-border-soft bg-[#fffaf3] px-5 py-4 shadow-[var(--shadow-card)]">
          <KitArt art={KIT.painted.lavenderSprig} sizes="8rem" className="pointer-events-none absolute -right-4 -top-3 -z-10 h-auto w-28 opacity-50" />
          <h2 id="words-title" className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {words.title} · v{words.versionNumber}
          </h2>
          <p className="mt-2 whitespace-pre-wrap font-display text-[17px] leading-[1.75] text-ink">{words.text}</p>
        </section>
      ) : null}
    </div>
  );
}
