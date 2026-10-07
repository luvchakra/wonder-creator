"use client";
import { ConfirmDialog, cn } from "@wonder/ui";
import { Mic, Pause, Play, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useNow } from "@/components/client-time";
import { clock, useVoice, type CaptureItem } from "@/components/home/my-captures";
import { forget } from "@/components/nav-memory";
import { api, errorMessage } from "@/lib/client";

/**
 * The captures by day, in the viewer's own time zone (so the days only appear once the page is running here; the server
 * can't know where "today" ends). Notes read as notes, voice notes play in place (one at a time), and pictures and videos
 * caught together sit together as frames. Each can be deleted from here (owner, 7 Oct 2026: "allow deleting a capture
 * from the captures page"): a quiet bin on the capture, a question first (it can't be undone), then it's gone from the
 * list — the Material, its file and its Moment with it. The server decides who may delete (RLS); this only asks.
 */
export function CaptureDays({ kind, initial, next: firstNext, empty }: { kind: string | null; initial: CaptureItem[]; next: string | null; empty: React.ReactNode }) {
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(firstNext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const player = useVoice();
  const [asking, setAsking] = useState<CaptureItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const ask = (c: CaptureItem) => {
    setRemoveError(null);
    setAsking(c);
  };

  async function remove() {
    const c = asking;
    if (!c || removing) return;
    setRemoving(true);
    try {
      await api(`/api/v1/materials/${c.id}?confirm=true`, { method: "DELETE" });
      if (player.playing === c.id) player.toggle(c.id, "");
      forget(`/materials/${c.id}`);
      setItems((cur) => cur.filter((x) => x.id !== c.id));
      setAsking(null);
      setSaid(`${NOUN[c.kind][0]} deleted.`);
      // The bin that was pressed is gone; keep the place in the list instead of dropping focus to the page.
      requestAnimationFrame(() => listRef.current?.focus());
    } catch (e) {
      setRemoveError(errorMessage(e));
    } finally {
      setRemoving(false);
    }
  }

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
  const dialog = (
    <ConfirmDialog
      open={!!asking}
      onOpenChange={(o) => !o && setAsking(null)}
      destructive
      busy={removing}
      title={asking ? `Delete this ${NOUN[asking.kind][1]}?` : ""}
      body={removeError ?? "It's removed from your captures and Materials. Creations made from it keep their words but lose this source. This can't be undone."}
      confirmLabel="Delete"
      onConfirm={() => void remove()}
    />
  );
  const status = (
    <p role="status" className="sr-only">
      {said}
    </p>
  );
  if (!items.length && !next) {
    return (
      <>
        {empty}
        {status}
      </>
    );
  }
  return (
    <div ref={listRef} tabIndex={-1} aria-label="Your captures" className="space-y-4 outline-none">
      {dialog}
      {status}
      {days.map((d) => (
        <section key={d.key} aria-label={d.label ?? "Captures"}>
          {d.label ? <h2 className="mb-1.5 px-0.5 font-display text-[17px] text-ink">{d.label}</h2> : null}
          <div className="space-y-2">
            {runs(d.items).map((run) =>
              run.media ? (
                <ul key={run.items[0]!.id} aria-label="Pictures and videos" className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {run.items.map((c) => (
                    <li key={c.id}>
                      <Frame c={c} onDelete={ask} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul key={run.items[0]!.id} className="space-y-2">
                  {run.items.map((c) => (
                    <li key={c.id}>{c.kind === "voice" ? <VoiceRow c={c} player={player} onDelete={ask} /> : <NoteCard c={c} onDelete={ask} />}</li>
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

const NOUN: Record<CaptureItem["kind"], [string, string]> = { note: ["Note", "note"], voice: ["Voice note", "voice note"], photo: ["Picture", "picture"], video: ["Video", "video"] };
const short = (c: CaptureItem) => {
  const t = (c.text ?? c.title).replace(/\s+/g, " ").trim();
  return t.length > 40 ? `${t.slice(0, 39)}…` : t;
};

/** The quiet bin: a small mark inside a 44px target, named for what it deletes. */
function Bin({ c, onDelete, className, onArt }: { c: CaptureItem; onDelete: (c: CaptureItem) => void; className?: string; onArt?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onDelete(c)}
      aria-label={`Delete ${NOUN[c.kind][1]}: ${short(c)}`}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", onArt ? "text-white" : "text-ink-subtle hover:text-danger", className)}
    >
      <span className={cn("inline-flex size-7 items-center justify-center rounded-full", onArt ? "bg-black/45 backdrop-blur-sm" : "hover:bg-surface-muted")}>
        <Trash2 className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}

function NoteCard({ c, onDelete }: { c: CaptureItem; onDelete: (c: CaptureItem) => void }) {
  return (
    <div className="relative flex items-start rounded-2xl border border-border-soft bg-[#fffdf8] shadow-[var(--shadow-card)] hover:border-[#cfd0ff]">
      <Link href={`/materials/${c.id}`} className="min-w-0 flex-1 py-2.5 pl-3.5">
        <span className="line-clamp-6 whitespace-pre-line font-display text-[15px] leading-snug text-ink">{c.text ?? c.title}</span>
        <span className="mt-1 block text-[12px] text-ink-subtle">
          Note · <Time iso={c.createdAt} />
        </span>
      </Link>
      <Bin c={c} onDelete={onDelete} className="mr-0.5 mt-0.5" />
    </div>
  );
}

function VoiceRow({ c, player, onDelete }: { c: CaptureItem; player: ReturnType<typeof useVoice>; onDelete: (c: CaptureItem) => void }) {
  const on = player.playing === c.id;
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border-soft bg-[linear-gradient(135deg,#f3eefb,#fbf6ef)] py-1.5 pl-1.5 pr-0.5 shadow-[var(--shadow-card)]">
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
      <Bin c={c} onDelete={onDelete} />
    </div>
  );
}

function Frame({ c, onDelete }: { c: CaptureItem; onDelete: (c: CaptureItem) => void }) {
  const box = "relative block aspect-square overflow-hidden rounded-xl border border-border-soft shadow-[var(--shadow-card)]";
  return (
    <div className="relative">
      {c.kind === "photo" && c.mediaUrl ? (
        <Link href={`/materials/${c.id}`} aria-label={`Picture, ${c.title}`} className={box}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.mediaUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        </Link>
      ) : (
        <Link href={`/materials/${c.id}`} aria-label={`${c.kind === "video" ? "Video" : "Picture"}, ${c.title}`} className={cn(box, "flex items-center justify-center bg-ink text-white")}>
          <Video className="size-5 opacity-90" aria-hidden />
          <span className="absolute bottom-1.5 left-2 text-[11px] tabular-nums opacity-80">{c.seconds ? clock(c.seconds) : <Time iso={c.createdAt} />}</span>
        </Link>
      )}
      <Bin c={c} onDelete={onDelete} onArt className="absolute right-0 top-0" />
    </div>
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
