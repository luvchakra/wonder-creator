"use client";
import { cn } from "@wonder/ui";
import { Mic, Pause, Play, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/components/client-time";
import { clock, useVoice, type CaptureItem } from "@/components/home/my-captures";
import { api, errorMessage } from "@/lib/client";

/**
 * The captures by day, in the viewer's own time zone (so the days only appear once the page is running here; the server
 * can't know where "today" ends). Notes read as notes, voice notes play in place (one at a time), and pictures and videos
 * caught together sit together as frames.
 */
export function CaptureDays({ kind, initial, next: firstNext }: { kind: string | null; initial: CaptureItem[]; next: string | null }) {
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(firstNext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const player = useVoice();

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ items: CaptureItem[]; next: string | null }>(`/api/v1/captures?limit=30&before=${encodeURIComponent(next)}${kind ? `&kind=${kind}` : ""}`);
      setItems((cur) => [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]);
      setNext(r.next);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const days = now ? byDay(items, now) : [{ key: "all", label: null, items }];
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d.key} aria-label={d.label ?? "Captures"}>
          {d.label ? <h2 className="mb-1.5 px-0.5 font-display text-[17px] text-ink">{d.label}</h2> : null}
          <div className="space-y-2">
            {runs(d.items).map((run) =>
              run.media ? (
                <ul key={run.items[0]!.id} aria-label="Pictures and videos" className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {run.items.map((c) => (
                    <li key={c.id}>
                      <Frame c={c} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul key={run.items[0]!.id} className="space-y-2">
                  {run.items.map((c) => (
                    <li key={c.id}>{c.kind === "voice" ? <VoiceRow c={c} player={player} /> : <NoteCard c={c} />}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}
      {next ? (
        <div className="flex flex-col items-center gap-1 pt-1">
          <button type="button" onClick={more} disabled={busy} className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-medium text-accent-ink hover:bg-accent-soft disabled:opacity-60">
            {busy ? "Loading…" : "Show earlier"}
          </button>
          {error ? (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function NoteCard({ c }: { c: CaptureItem }) {
  return (
    <Link href={`/materials/${c.id}`} className="block rounded-2xl border border-border-soft bg-[#fffdf8] px-3.5 py-2.5 shadow-[var(--shadow-card)] hover:border-[#cfd0ff]">
      <span className="line-clamp-6 whitespace-pre-line font-display text-[15px] leading-snug text-ink">{c.text ?? c.title}</span>
      <span className="mt-1 block text-[12px] text-ink-subtle">
        Note · <Time iso={c.createdAt} />
      </span>
    </Link>
  );
}

function VoiceRow({ c, player }: { c: CaptureItem; player: ReturnType<typeof useVoice> }) {
  const on = player.playing === c.id;
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border-soft bg-[linear-gradient(135deg,#f3eefb,#fbf6ef)] py-1.5 pl-1.5 pr-3 shadow-[var(--shadow-card)]">
      <button
        type="button"
        disabled={!c.mediaUrl}
        onClick={() => player.toggle(c.id, c.mediaUrl!)}
        aria-label={on ? "Pause the voice note" : `Play the voice note${c.seconds ? `, ${clock(c.seconds)}` : ""}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50"
      >
        {on ? <Pause className="size-4" aria-hidden /> : <Play className="ml-0.5 size-4" aria-hidden />}
      </button>
      <Link href={`/materials/${c.id}`} className="min-w-0 flex-1 py-1">
        <span className="line-clamp-2 font-display text-[14.5px] italic leading-snug text-ink">{c.text ?? c.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
          <Mic className="size-3 text-accent" aria-hidden /> {c.seconds ? clock(c.seconds) : "Voice note"} · <Time iso={c.createdAt} />
        </span>
      </Link>
    </div>
  );
}

function Frame({ c }: { c: CaptureItem }) {
  const box = "relative block aspect-square overflow-hidden rounded-xl border border-border-soft shadow-[var(--shadow-card)]";
  if (c.kind === "photo" && c.mediaUrl) {
    return (
      <Link href={`/materials/${c.id}`} aria-label={`Picture, ${c.title}`} className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.mediaUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      </Link>
    );
  }
  return (
    <Link href={`/materials/${c.id}`} aria-label={`${c.kind === "video" ? "Video" : "Picture"}, ${c.title}`} className={cn(box, "flex items-center justify-center bg-ink text-white")}>
      <Video className="size-5 opacity-90" aria-hidden />
      <span className="absolute bottom-1.5 left-2 text-[11px] tabular-nums opacity-80">{c.seconds ? clock(c.seconds) : <Time iso={c.createdAt} />}</span>
    </Link>
  );
}

function Time({ iso }: { iso: string }) {
  const now = useNow();
  return <time dateTime={iso}>{now ? time(iso) : ""}</time>;
}

/** Local calendar days, newest first: "Today", "Yesterday", then "Monday 5 October" (with the year when it isn't this one). */
function byDay(items: CaptureItem[], now: Date) {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = key(now);
  const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const out: { key: string; label: string; items: CaptureItem[] }[] = [];
  for (const c of items) {
    const d = new Date(c.createdAt);
    const k = key(d);
    let day = out[out.length - 1];
    if (!day || day.key !== k) {
      const label =
        k === today ? "Today" : k === yesterday ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
      day = { key: k, label, items: [] };
      out.push(day);
    }
    day.items.push(c);
  }
  return out;
}

/** Consecutive pictures and videos sit together as frames; notes and voice notes stay rows. */
function runs(items: CaptureItem[]) {
  const out: { media: boolean; items: CaptureItem[] }[] = [];
  for (const c of items) {
    const media = c.kind === "photo" || c.kind === "video";
    const last = out[out.length - 1];
    if (last && last.media === media) last.items.push(c);
    else out.push({ media, items: [c] });
  }
  return out;
}
