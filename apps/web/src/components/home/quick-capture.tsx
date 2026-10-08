"use client";
import { Button, Dialog, DialogContent, KIT, KitSparklesIcon, Textarea, cn } from "@wonder/ui";
import type { DejaVu } from "@wonder/creator-moments/shared";
import { ArrowRight, Camera, Check, Images, Mic, PenLine, Play, Pause, Plus, Square, Video, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CreationSource } from "@/components/new-creation-sheet";
import { useStripSignal } from "@/components/creative-palette";
import { AddDejaVuSheet } from "@/components/dejavu/dejavu-chips";
import { api, errorMessage } from "@/lib/client";
import { PRIORITY } from "@/lib/context-strip/types";
import { sendToCreator } from "@/lib/send";
import { MAX_RECORD_SECONDS, uploadRecording, useAudioRecorder } from "@/components/audio/use-recorder";
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

type Saved = { kind: "note" | "voice" | "photo" | "video"; materialId: string | null; offline?: boolean; seconds?: number; url?: string | null; count?: number; skipped?: number };

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
  const [savedInSheet, setSavedInSheet] = useState(false);
  const [synced, setSynced] = useState(0);
  const strip = useStripSignal();

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
    setSavedInSheet(false);
    setOpen(true);
    trackClient(which === "text" ? "quick_note_started" : "voice_note_started");
  };
  const onSaved = (r: Saved) => {
    setSaved((old) => {
      if (old?.url && old.url !== r.url) URL.revokeObjectURL(old.url);
      return r;
    });
    setSavedInSheet(true);
    if (r.offline) strip("capture", { text: "Offline · saved locally", tone: "warning", priority: PRIORITY.offline });
    else window.dispatchEvent(new Event(CAPTURED_EVENT));
  };

  // Quick Pic and Video Note (owner, 7 Oct 2026: "allow users to choose from the gallery"): the phone's own chooser —
  // the camera, or pictures and videos already taken — in one tap. No `capture` attribute: with it the browser skips the
  // chooser and asks for the camera's "take a photo for an app" mode, which phones keep to a few modes (the full camera
  // app, with all its lenses and modes, can't hand a picture back to a web page; shooting with it and choosing from the
  // gallery here can). Files arrive untouched and each goes straight to a Material (through CreatorSend, which checks
  // the bytes and sends big files browser → storage directly). Several can be chosen from the gallery at once.
  const picRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const camPicRef = useRef<HTMLInputElement>(null);
  const camVideoRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<{ kind: "photo" | "video"; error?: string } | null>(null);
  // Quick Pic / Video Note (owner, 8 Oct 2026: "should have camera option as well, full fledged camera"): a small sheet
  // with two ways — the camera, or the gallery. On Android the camera is the phone's own camera app (every lens and
  // mode), which a page can open but which can't hand the shot back: so the sheet waits, and when the creator returns
  // it leads with "Choose what you just took". Elsewhere (iPhone, desktop) "the camera" is the system's camera sheet.
  const [mediaSheet, setMediaSheet] = useState<{ kind: "photo" | "video"; back: boolean } | null>(null);
  const awaitingCamera = useRef(false);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && awaitingCamera.current) {
        awaitingCamera.current = false;
        setMediaSheet((s) => (s ? { ...s, back: true } : s));
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  function openCamera(kind: "photo" | "video") {
    if (/android/i.test(navigator.userAgent)) {
      awaitingCamera.current = true;
      // The camera app itself (not the cut-down "take a photo for an app" mode); the picture lands in the gallery.
      window.location.assign(kind === "photo" ? "intent:#Intent;action=android.media.action.STILL_IMAGE_CAMERA;end" : "intent:#Intent;action=android.media.action.VIDEO_CAMERA;end");
      return;
    }
    setMediaSheet(null);
    (kind === "photo" ? camPicRef : camVideoRef).current?.click();
  }
  function openGallery(kind: "photo" | "video") {
    setMediaSheet(null);
    (kind === "photo" ? picRef : videoRef).current?.click();
  }
  function start(key: "text" | "voice" | "photo" | "video") {
    if (key === "text" || key === "voice") begin(key);
    else setMediaSheet({ kind: key, back: false });
  }
  async function captureMedia(kind: "photo" | "video", list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, 10);
    if (!files.length) return;
    setMediaSheet(null);
    const limit = (kind === "video" ? 100 : 20) * 1024 * 1024;
    const fits = files.filter((f) => f.size <= limit);
    if (!fits.length) {
      setMedia({ kind, error: kind === "video" ? "That video is too long to save here — keep it under about two minutes." : "That picture is too large to save." });
      return;
    }
    setSaved(null);
    setMedia({ kind });
    try {
      const r = await sendToCreator({ files: fits, kind: "camera" });
      if (!r.accepted.length) throw new Error(r.rejected[0]?.message ?? "We couldn't save it.");
      trackClient(kind === "photo" ? "quick_pic_saved" : "video_note_saved");
      setMedia(null);
      window.dispatchEvent(new Event(CAPTURED_EVENT));
      setSaved({ kind, materialId: r.accepted.length === 1 ? (r.accepted[0]?.materialId ?? null) : null, count: r.accepted.length, skipped: files.length - r.accepted.length });
    } catch (e) {
      setMedia({ kind, error: `${errorMessage(e)} Try again.` });
    }
  }

  const savedLine = saved
    ? saved.offline
      ? "Note saved on this device. It'll sync when you're back online."
      : saved.kind === "photo" || saved.kind === "video"
        ? `${(saved.count ?? 1) > 1 ? `${saved.count} ${saved.kind === "photo" ? "pictures" : "videos"} saved to Materials` : saved.kind === "photo" ? "Picture saved" : "Video saved"}${saved.skipped ? ` · ${saved.skipped} too large to save` : ""}`
          : saved.kind === "voice" && status?.transcription === "unavailable"
        ? "Voice note saved · Transcription unavailable"
        : saved.kind === "voice"
          ? "Voice note saved"
          : "Note saved"
    : synced
      ? `${synced === 1 ? "Your offline note is" : `${synced} offline notes are`} saved now.`
      : null;

  return (
    <section aria-label="Quick Capture" className="space-y-1">
      {/* Four ways to catch something, one tap each: words, voice, a picture, a short video. */}
      <div className="grid grid-cols-4 gap-1.5">
        {(
          [
            { key: "text", label: "Quick note", Icon: PenLine },
            { key: "voice", label: "Voice note", Icon: Mic },
            { key: "photo", label: "Quick Pic", Icon: Camera },
            { key: "video", label: "Video Note", Icon: Video },
          ] as const
        ).map(({ key, label, Icon }) => {
          const busy = media?.kind === key && !media.error;
          return (
            <button key={key} type="button" onClick={() => start(key)} disabled={busy} aria-haspopup="dialog" className="group min-h-11">
              <span className="flex h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-border-soft bg-surface/90 text-[12.5px] font-medium text-ink shadow-[var(--shadow-card)] transition-transform duration-150 group-hover:bg-surface group-active:scale-95 group-disabled:opacity-60 motion-reduce:transition-none">
                <Icon className={cn("size-[18px] text-accent", busy && "animate-pulse motion-reduce:animate-none")} aria-hidden />
                {label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Gallery (several at once) and, where the phone has no camera app to open, the system's camera sheet. */}
      <input ref={picRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Choose a picture" onChange={(e) => (void captureMedia("photo", e.target.files), (e.target.value = ""))} />
      <input ref={videoRef} type="file" accept="video/*" multiple className="sr-only" tabIndex={-1} aria-label="Choose a video" onChange={(e) => (void captureMedia("video", e.target.files), (e.target.value = ""))} />
      <input ref={camPicRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take a picture" onChange={(e) => (void captureMedia("photo", e.target.files), (e.target.value = ""))} />
      <input ref={camVideoRef} type="file" accept="video/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Record a video" onChange={(e) => (void captureMedia("video", e.target.files), (e.target.value = ""))} />
      <Dialog open={!!mediaSheet} onOpenChange={(o) => !o && setMediaSheet(null)}>
        <DialogContent title={mediaSheet?.kind === "video" ? "Video Note" : "Quick Pic"} art={mediaSheet?.kind === "video" ? KIT.iconChip.video : KIT.iconChip.camera}>
          {mediaSheet ? (
            <div className="space-y-2">
              {mediaSheet.back ? (
                <p role="status" className="px-1 text-[13.5px] text-ink-muted">
                  Back from the camera? Choose what you just took.
                </p>
              ) : null}
              {(mediaSheet.back ? (["gallery", "camera"] as const) : (["camera", "gallery"] as const)).map((way) => {
                const camera = way === "camera";
                const Icon = camera ? Camera : Images;
                return (
                  <button
                    key={way}
                    type="button"
                    onClick={() => (camera ? openCamera(mediaSheet.kind) : openGallery(mediaSheet.kind))}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3 text-left hover:border-accent/50 hover:bg-accent-softer"
                  >
                    <Icon className="size-5 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-ink">{camera ? "Open the camera" : mediaSheet.back ? (mediaSheet.kind === "video" ? "Choose the video you just took" : "Choose the picture you just took") : "Choose from gallery"}</span>
                      <span className="block text-[12px] text-ink-subtle">{camera ? (mediaSheet.kind === "video" ? "Record with the phone\u2019s camera, then come back and choose it" : "Shoot with the phone\u2019s camera, then come back and choose it") : "Pictures and videos already on your phone"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {media ? (
        <p role={media.error ? "alert" : "status"} className={cn("px-1 text-[13px]", media.error ? "text-danger" : "text-ink-muted")}>
          {media.error ?? (media.kind === "photo" ? "Saving your picture…" : "Saving your video…")}
        </p>
      ) : null}
      {/* After the sheet closes, a quiet line says it's safe — and offers the next step (the Material itself is in My captures, just below). */}
      <p role="status" className="px-1 text-[13px] text-ink-muted">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Quick Capture" art={KIT.iconChip.pencil}>
          {!open ? null : savedInSheet && saved ? (
            <SavedPanel saved={saved} line={savedLine ?? ""} busy={makeBusy} onDone={() => setOpen(false)} onMake={saved.materialId ? () => void makeFrom(saved.materialId!) : null} />
          ) : (
            <div className="space-y-3">
              <div role="tablist" aria-label="Capture" className="grid grid-cols-2 gap-1 rounded-full bg-surface-muted p-1">
                {(["text", "voice"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={cn("inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[14px] font-medium", tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink")}
                  >
                    {k === "text" ? <PenLine className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
                    {k === "text" ? "Text" : "Voice"}
                  </button>
                ))}
              </div>
              {tab === "text" ? (
                <NoteBody key="text" onCancel={() => setOpen(false)} onSaved={(r) => onSaved({ kind: "note", ...r })} />
              ) : (
                <VoiceBody key="voice" onWriteInstead={() => setTab("text")} onSaved={(r) => onSaved({ kind: "voice", ...r })} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Saved: a quiet confirmation, then — only if they arrive — DejaVu suggestions to accept or ignore, and "+ Add". */
function SavedPanel({ saved, line, busy, onDone, onMake }: { saved: Saved; line: string; busy: boolean; onDone: () => void; onMake: (() => void) | null }) {
  const { status, drop } = useCaptureStatus(saved.materialId);
  const [attached, setAttached] = useState<DejaVu[]>([]);
  const [momentId, setMomentId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const moment = momentId ?? status?.momentId ?? null;
  async function resolve(s: Suggestion, accept: boolean) {
    if (!moment) return;
    try {
      const r = await api<{ dejavu?: DejaVu }>(`/api/v1/moments/${moment}/dejavu-suggestions/${s.id}/${accept ? "accept" : "dismiss"}`, { method: "POST" });
      if (r.dejavu) setAttached((a) => (a.some((d) => d.id === r.dejavu!.id) ? a : [...a, r.dejavu!]));
      drop(s.id);
    } catch {
      /* it stays offered */
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-2xl bg-surface-muted/70 px-3 py-2">
        <Check className="size-5 shrink-0 text-success" aria-hidden />
        <p className="min-w-0 flex-1 text-[14px] text-ink" role="status">
          {line}
          {saved.kind === "voice" && saved.seconds ? <span className="block text-[12.5px] text-ink-muted">{clock(saved.seconds)}</span> : null}
        </p>
        {saved.url ? (
          <>
            <audio ref={audio} src={saved.url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
            <button type="button" onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())} aria-label={playing ? "Pause" : "Play"} className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-black/5">
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            </button>
          </>
        ) : null}
      </div>

      {saved.materialId ? (
        <section aria-labelledby="suggested-dv" className="space-y-1">
          <h3 id="suggested-dv" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            {status?.suggestions.length ? "Suggested DejaVu" : "DejaVu"}
          </h3>
          <div className="flex flex-wrap items-center gap-x-1.5">
            {attached.map((d) => (
              <span key={d.id} className="inline-flex min-h-11 items-center">
                <span className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-[13px] font-medium text-white">
                  <Check className="size-3.5" aria-hidden /> {d.name}
                </span>
              </span>
            ))}
            {(status?.suggestions ?? []).map((s) => (
              <span key={s.id} className="inline-flex min-h-11 items-center">
                <span className="inline-flex h-8 items-center overflow-hidden rounded-full border border-border-soft bg-surface text-[13px] font-medium text-ink">
                  <button type="button" onClick={() => resolve(s, true)} aria-label={`Add to ${s.name}`} className="h-full px-3 hover:bg-accent-softer">
                    {s.name}
                  </button>
                  <button type="button" onClick={() => resolve(s, false)} aria-label={`Not ${s.name}`} className="h-full border-l border-border-soft px-2 text-ink-subtle hover:bg-surface-muted">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              </span>
            ))}
            <button type="button" onClick={() => setAdding(true)} aria-haspopup="dialog" className="inline-flex min-h-11 items-center">
              <span className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-accent-ink hover:bg-accent-softer">
                <Plus className="size-4" aria-hidden /> Add
              </span>
            </button>
          </div>
          <AddDejaVuSheet
            open={adding}
            onOpenChange={setAdding}
            entityType="material"
            entityId={saved.materialId}
            momentId={moment}
            attached={attached}
            onChanged={(next) => {
              setMomentId(next.momentId);
              setAttached(next.dejavus);
            }}
          />
        </section>
      ) : null}

      {/* The next step is making something from this (start-small.md); Done just closes. Capturing another is one tap away on Home. */}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
        {onMake ? (
          <Button type="button" loading={busy} aria-haspopup="dialog" onClick={onMake}>
            <KitSparklesIcon size={16} /> Make something
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------- Quick note */

function NoteBody({ onCancel, onSaved }: { onCancel: () => void; onSaved: (r: { materialId: string | null; offline?: boolean }) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per note, made when it's first saved, so a retry is the same note.
  const clientId = useRef<string | null>(null);
  async function save() {
    const body = text.trim();
    if (!body || busy) return;
    clientId.current ??= crypto.randomUUID();
    const keepLocally = () => {
      writeQueue([...readQueue().filter((p) => p.clientId !== clientId.current), { clientId: clientId.current!, text: body, at: new Date().toISOString() }]);
      onSaved({ materialId: null, offline: true });
    };
    if (!navigator.onLine) return keepLocally();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ materialId: string | null }>("/api/v1/capture", { method: "POST", json: { kind: "note", clientId: clientId.current, text: body } });
      onSaved({ materialId: r.materialId });
    } catch (e) {
      if (unreachable(e)) keepLocally();
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor="quick-note" className="sr-only">
        Quick note
      </label>
      <Textarea
        id="quick-note"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void save();
          }
        }}
        placeholder="Anything — a line, an idea, something you noticed…"
        className="min-h-36 font-display text-[16px]"
        maxLength={200000}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-[12px] tabular-nums text-ink-subtle" aria-hidden>
          {text.length || ""}
        </span>
        <Button type="submit" loading={busy} disabled={!text.trim()}>
          Save note <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------------------------------- Voice note */

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const MAX_SECONDS = MAX_RECORD_SECONDS;

function VoiceBody({ onSaved, onWriteInstead }: { onSaved: (r: { materialId: string | null; seconds: number; url: string }) => void; onWriteInstead: () => void }) {
  // Recording starts as soon as the sheet opens (§6.2); the recorder is shared with the Audio page.
  const { state, seconds, levelRef: level, stop } = useAudioRecorder({ maxSeconds: MAX_SECONDS });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
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

  // Upload with progress, so a slow connection shows movement; the recording stays here until it's saved.
  function save() {
    if (!recorded) return;
    setError(null);
    setProgress(0);
    uploadRecording(recorded, clientId.current, setProgress)
      .then((r) => {
        kept.current = true;
        onSaved({ materialId: r.materialId, seconds: recorded.seconds, url: recorded.url });
      })
      .catch((e) => setError(errorMessage(e)));
  }

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
      <div className="space-y-3">
        <p className="font-medium text-ink">Voice note · {clock(recorded.seconds)}</p>
        <audio ref={player} src={recorded.url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} className="hidden" />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => (playing ? player.current?.pause() : void player.current?.play())} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} {playing ? "Pause" : "Play"}
          </Button>
          <Button type="button" className="flex-1" onClick={save} loading={progress !== null}>
            {progress !== null ? `Saving… ${progress}%` : error ? "Try again" : "Save"}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
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
