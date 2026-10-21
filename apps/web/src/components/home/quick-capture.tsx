"use client";
import { Button, ConfirmDialog, Dialog, DialogContent, cn } from "@wonder/ui";
import { Check, Mic, PenLine, Square } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CreationSource } from "@/components/new-creation-sheet";
import { useStripSignal } from "@/components/creative-palette";
import { api, errorMessage } from "@/lib/client";
import { PRIORITY } from "@/lib/context-strip/types";
import { MAX_RECORD_SECONDS, uploadRecording, useAudioRecorder } from "@/components/audio/use-recorder";
import { useDictation } from "@/components/audio/use-dictation";
import { autosaveLine, useAutosave } from "@/lib/use-autosave";
import { NoteEditor } from "./note-editor";
import { VoiceEditor } from "@/components/audio/voice-editor";
import type { Range } from "@/lib/audio-edit";
import { trackClient } from "@/lib/track";
import { CAPTURED_EVENT } from "./my-captures";

// The next screen after catching something is making something from it (start-small.md): the same sheet as Create.
const NewCreationSheet = dynamic(() => import("@/components/new-creation-sheet").then((m) => m.NewCreationSheet), { ssr: false });

/**
 * Quick Capture (docs/phases/02-home-quick-capture.md §6–7, §17): a quick note or a voice note in seconds. Capture
 * first, organise later — no title, Project, tags or DejaVu asked for. Each capture carries an id made on the device,
 * so a retry lands exactly once. Afterwards a quiet line says it's saved; any DejaVu suggestions appear later, only as
 * suggestions. A note written offline is kept on this device and sent when the connection returns.
 */

type Suggestion = { id: string; name: string };
type CaptureStatus = { done: boolean; transcription: "pending" | "done" | "unavailable" | null; momentId: string | null; suggestions: Suggestion[] };
type Pending = { clientId: string; text: string; at: string };

const QUEUE_KEY = "wc.capture.pending";
const readQueue = (): Pending[] => {
  try {
    const v = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((p) => p && typeof p.clientId === "string" && typeof p.text === "string") : [];
  } catch {
    return [];
  }
};
const writeQueue = (q: Pending[]) => {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* storage unavailable: the note stays in memory for this visit */
  }
};
/** A fetch that never reached the server (offline, dropped connection), as opposed to a refusal. */
const unreachable = (e: unknown) => e instanceof TypeError || !navigator.onLine;

type Saved = { kind: "note" | "voice"; materialId: string | null; offline?: boolean; seconds?: number; url?: string | null };

/** Follows a saved capture quietly until it has settled (transcribed or not) and any suggestions are in. */
function useCaptureStatus(materialId: string | null) {
  const [status, setStatus] = useState<{ id: string; s: CaptureStatus } | null>(null);
  useEffect(() => {
    if (!materialId) return;
    let live = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api<CaptureStatus>(`/api/v1/capture/${materialId}`);
        if (!live) return;
        setStatus({ id: materialId, s });
        if (s.done && (tries > 2 || s.suggestions.length)) return;
      } catch {
        /* the saved line stays; nothing to add */
      }
      if (live && ++tries < 12) timer = setTimeout(tick, 2500);
    };
    timer = setTimeout(tick, 1200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [materialId]);
  const current = status && status.id === materialId ? status.s : null;
  const drop = (id: string) => setStatus((cur) => (cur ? { ...cur, s: { ...cur.s, suggestions: cur.s.suggestions.filter((x) => x.id !== id) } } : cur));
  return { status: current, drop };
}

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"text" | "voice">("text");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [synced, setSynced] = useState(0);
  const strip = useStripSignal();
  const router = useRouter();

  // Send notes kept on this device while offline, oldest first; each keeps its id, so nothing lands twice.
  const flush = useCallback(async () => {
    const queue = readQueue();
    if (!queue.length || !navigator.onLine) return;
    let sent = 0;
    for (const p of queue) {
      try {
        await api("/api/v1/capture", { method: "POST", json: { kind: "note", clientId: p.clientId, text: p.text } });
        writeQueue(readQueue().filter((x) => x.clientId !== p.clientId));
        sent++;
      } catch (e) {
        if (unreachable(e)) break;
        // Refused for good (empty, too long): don't retry forever.
        writeQueue(readQueue().filter((x) => x.clientId !== p.clientId));
      }
    }
    if (!readQueue().length) strip("capture", null);
    if (sent) {
      setSynced(sent);
      window.dispatchEvent(new Event(CAPTURED_EVENT));
      // The "saved on this device" line has done its job.
      setSaved((cur) => (cur?.offline ? null : cur));
    }
  }, [strip]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (readQueue().length && !navigator.onLine) strip("capture", { text: "Offline · saved locally", tone: "warning", priority: PRIORITY.offline });
      void flush();
    }, 0);
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", online);
    };
  }, [flush, strip]);

  const { status } = useCaptureStatus(saved?.materialId ?? null);
  // "Make something": the sheet opens with what was just caught — its words as the first draft, the Material as source.
  const [making, setMaking] = useState<CreationSource | null>(null);
  const [makeBusy, setMakeBusy] = useState(false);
  async function makeFrom(materialId: string) {
    if (makeBusy) return;
    setMakeBusy(true);
    try {
      const r = await api<{ material: { text_content: string | null; extracted_text: string | null } }>(`/api/v1/materials/${materialId}`);
      setOpen(false);
      setMaking({ materialId, text: (r.material.text_content ?? r.material.extracted_text ?? "").trim() });
    } catch (e) {
      strip("capture", { text: errorMessage(e), tone: "warning", priority: PRIORITY.offline });
    } finally {
      setMakeBusy(false);
    }
  }
  const begin = (which: "text" | "voice") => {
    setTab(which);
    setOpen(true);
    trackClient(which === "text" ? "quick_note_started" : "voice_note_started");
  };
  // Notes and voice notes save themselves while the sheet is open, so it stays on what's being made.
  const onSaved = (r: Saved) => {
    setSaved((old) => {
      if (old?.url && old.url !== r.url) URL.revokeObjectURL(old.url);
      return r;
    });
    if (r.offline) strip("capture", { text: "Offline · saved locally", tone: "warning", priority: PRIORITY.offline });
    else window.dispatchEvent(new Event(CAPTURED_EVENT));
  };

  const savedLine = saved
    ? saved.offline
      ? "Note saved on this device. It'll sync when you're back online."
      : saved.kind === "voice" && status?.transcription === "unavailable"
        ? "Voice note saved · Transcription unavailable"
        : saved.kind === "voice"
          ? "Voice note saved"
          : "Note saved"
    : synced
      ? `${synced === 1 ? "Your offline note is" : `${synced} offline notes are`} saved now.`
      : null;

  return (
    <section aria-label="Quick Capture">
      {/* Two ways to catch something, in the greeting's top-right corner over the flowers (owner, 21 Oct 2026): words and
          voice. Pictures and videos come in through Bring in. Positioned against the header, outside the text's flow. */}
      <div className="absolute right-0 top-0 flex gap-2">
        {(
          [
            { key: "text", label: "Quick note", short: "Note", Icon: PenLine },
            { key: "voice", label: "Voice note", short: "Voice", Icon: Mic },
          ] as const
        ).map(({ key, label, short, Icon }) => (
          <button key={key} type="button" onClick={() => begin(key)} aria-haspopup="dialog" aria-label={label} className="group flex w-12 flex-col items-center gap-1">
            <span className="inline-flex size-12 items-center justify-center rounded-full border border-white/80 bg-surface/85 text-accent shadow-[var(--shadow-card)] backdrop-blur-sm transition-transform duration-150 group-hover:bg-surface group-active:scale-95 motion-reduce:transition-none">
              <Icon className="size-5" aria-hidden />
            </span>
            <span aria-hidden className="text-[11.5px] font-medium text-ink-muted">
              {short}
            </span>
          </button>
        ))}
      </div>
      {/* After the sheet closes, a quiet line says it's safe — and offers the next step (the Material itself is in My captures). */}
      <p role="status" className="mt-1 text-[13px] text-ink-muted empty:mt-0">
        {!open && savedLine ? (
          <span className="flex items-center gap-1.5">
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            <span className="min-w-0 flex-1">{savedLine}</span>
            {saved?.materialId ? (
              <button type="button" aria-haspopup="dialog" disabled={makeBusy} onClick={() => void makeFrom(saved.materialId!)} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline disabled:opacity-60">
                Make something
              </button>
            ) : null}
          </span>
        ) : null}
      </p>
      {making ? <NewCreationSheet open onOpenChange={(o) => !o && setMaking(null)} from={making} /> : null}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          // Closing after a capture: its last words are on their way. Home reads itself again a moment later, so its own
          // card moves on (from "begin" to "make something from it", start-small.md).
          if (!o && saved && !saved.offline)
            setTimeout(() => {
              window.dispatchEvent(new Event(CAPTURED_EVENT));
              router.refresh();
            }, 1200);
        }}
      >
        <DialogContent full title={tab === "text" ? "Quick note" : "Voice note"}>
          {!open ? null : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {tab === "text" ? (
                <NoteBody key="text" onSaved={(r) => onSaved({ kind: "note", ...r })} />
              ) : (
                <VoiceBody
                  key="voice"
                  onDiscarded={() => {
                    setOpen(false);
                    setSaved(null);
                    window.dispatchEvent(new Event(CAPTURED_EVENT));
                  }}
                  onWriteInstead={() => setTab("text")} onSaved={(r) => onSaved({ kind: "voice", ...r })} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------- Quick note */

function NoteBody({ onSaved }: { onSaved: (r: { materialId: string | null; offline?: boolean }) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One id per note, made when it's first saved, so a retry is the same note; the Material it becomes follows.
  const clientId = useRef<string>(crypto.randomUUID());
  const materialId = useRef<string | null>(null);
  // Type, or tap the mic and say it: the browser's dictation writes into the same note.
  const dictation = useDictation(setText);
  // No Save button (owner, 21 Oct 2026): the first words make the note, every later change updates it, and leaving the
  // screen sends whatever is left. A note written offline is kept on this device and sent when the connection returns.
  const auto = useAutosave({
    value: text,
    saved: "",
    delayMs: 1000,
    send: async (v) => {
      const body = v.trim();
      if (!body) return;
      setError(null);
      if (materialId.current) {
        await api(`/api/v1/materials/${materialId.current}`, { method: "PATCH", json: { textContent: v } }).catch((e) => (setError(errorMessage(e)), Promise.reject(e)));
        return;
      }
      if (!navigator.onLine) {
        writeQueue([...readQueue().filter((p) => p.clientId !== clientId.current), { clientId: clientId.current, text: body, at: new Date().toISOString() }]);
        onSaved({ materialId: null, offline: true });
        return;
      }
      try {
        const r = await api<{ materialId: string | null }>("/api/v1/capture", { method: "POST", json: { kind: "note", clientId: clientId.current, text: v } });
        materialId.current = r.materialId;
        onSaved({ materialId: r.materialId });
      } catch (e) {
        if (unreachable(e)) {
          writeQueue([...readQueue().filter((p) => p.clientId !== clientId.current), { clientId: clientId.current, text: body, at: new Date().toISOString() }]);
          onSaved({ materialId: null, offline: true });
          return;
        }
        setError(errorMessage(e));
        throw e;
      }
    },
    leave: (v) =>
      materialId.current
        ? { url: `/api/v1/materials/${materialId.current}`, method: "PATCH", json: { textContent: v } }
        : { url: "/api/v1/capture", method: "POST", json: { kind: "note", clientId: clientId.current, text: v } },
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col" onBlur={() => void auto.flush()}>
      <NoteEditor
        value={text}
        label="Quick note"
        placeholder={dictation.listening ? "Listening…" : "Type, or tap the mic and say it…"}
        onChange={(md) => {
          // Typing takes over from dictation, so what's typed is never written over.
          if (dictation.listening) dictation.stop();
          setText(md);
        }}
        dictation={{ listening: dictation.listening, onToggle: () => dictation.toggle(text) }}
      />
      {dictation.notice ? (
        <p role="status" className="text-[13px] text-ink-muted">
          {dictation.notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p role="status" aria-live="polite" className="h-4 text-[12.5px] text-ink-subtle">
          {autosaveLine(auto.state)}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------- Voice note */

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const MAX_SECONDS = MAX_RECORD_SECONDS;

function VoiceBody({ onSaved, onWriteInstead, onDiscarded }: { onSaved: (r: { materialId: string | null; seconds: number; url: string }) => void; onWriteInstead: () => void; onDiscarded: () => void }) {
  // Recording starts as soon as the sheet opens (§6.2); the recorder is shared with the Audio page.
  const { state, seconds, levelRef: level, stop } = useAudioRecorder({ maxSeconds: MAX_SECONDS });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef<string>(crypto.randomUUID());

  const recorded = state.phase === "recorded" ? state : null;
  // The recording's address is handed to the saved panel for playback; otherwise it's released.
  const kept = useRef(false);
  useEffect(() => {
    if (!recorded) return;
    return () => {
      if (!kept.current) URL.revokeObjectURL(recorded.url);
    };
  }, [recorded]);

  // No Save button (owner, 21 Oct 2026): the recording is saved as soon as it stops (with progress, so a slow connection
  // shows movement), and edits — trims and cuts, which never change the recording — save themselves after that.
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Range[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const save = useCallback(() => {
    if (!recorded) return;
    setError(null);
    setProgress(0);
    uploadRecording(recorded, clientId.current, setProgress)
      .then((r) => {
        kept.current = true;
        setMaterialId(r.materialId);
        onSaved({ materialId: r.materialId, seconds: recorded.seconds, url: recorded.url });
      })
      .catch((e) => setError(errorMessage(e)));
  }, [recorded, onSaved]);
  const started = useRef(false);
  useEffect(() => {
    if (!recorded || started.current) return;
    started.current = true;
    save();
  }, [recorded, save]);
  const edits = useAutosave({
    value: edit,
    saved: null,
    enabled: !!materialId,
    send: (v) => api(`/api/v1/materials/${materialId}`, { method: "PATCH", json: { audioEdit: v ? { keep: v } : null } }),
    leave: (v) => ({ url: `/api/v1/materials/${materialId}`, method: "PATCH", json: { audioEdit: v ? { keep: v } : null } }),
  });

  if (state.phase === "blocked")
    return (
      <div className="space-y-3">
        <p role="alert" className="text-[14px] text-ink">
          {state.message}
        </p>
        <Button className="w-full" variant="secondary" onClick={onWriteInstead}>
          <PenLine className="size-4" aria-hidden /> Write a quick note
        </Button>
      </div>
    );

  if (recorded)
    return (
      <div className="flex flex-1 flex-col justify-center">
        <VoiceEditor
          src={recorded.url}
          type={recorded.blob.type}
          onChange={setEdit}
          onDelete={() => setConfirmDelete(true)}
          status={progress !== null ? `Saving… ${progress}%` : error ? undefined : autosaveLine(materialId ? (edits.state === "idle" ? "saved" : edits.state) : "idle")}
        />
        {error ? (
          <div role="alert" className="mt-2 flex items-center justify-center gap-2 text-[13px] text-danger">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={save}>
              Try again
            </Button>
          </div>
        ) : null}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          destructive
          busy={deleting}
          title="Delete this voice note?"
          body="The recording is removed for good. This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            setDeleting(true);
            try {
              if (materialId) await api(`/api/v1/materials/${materialId}?confirm=true`, { method: "DELETE" });
              setConfirmDelete(false);
              onDiscarded();
            } catch (e) {
              setError(errorMessage(e));
              setConfirmDelete(false);
            } finally {
              setDeleting(false);
            }
          }}
        />
      </div>
    );

  return (
    <div className="flex flex-1 flex-col justify-center space-y-4">
      <p className="text-center font-display text-[32px] tabular-nums leading-none text-ink" aria-live="off">
        {clock(seconds)}
      </p>
      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <span ref={level} className="block h-full origin-left scale-x-[0.06] rounded-full bg-accent" />
      </span>
      <p className="sr-only" role="status">
        {state.phase === "recording" ? "Recording" : "Starting the microphone"}
      </p>
      <Button
        type="button"
        className={cn("w-full")}
        disabled={state.phase !== "recording"}
        onClick={stop}
      >
        <Square className="size-4 fill-current" aria-hidden /> Stop
      </Button>
    </div>
  );
}
