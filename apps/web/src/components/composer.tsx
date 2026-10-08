"use client";
import { Button, IconButton, cn } from "@wonder/ui";
import { ArrowRight, Camera, FileText, Link2, Mic, MicOff, Paperclip, PenLine, Square, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface ComposerPayload {
  message: string;
  files: File[];
  urls: string[];
  voiceNotes: File[];
  photos: File[];
  inputMode: "text" | "voice";
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getSpeech(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * The universal composer: one surface for thoughts, voice, files, links and photos.
 * It never asks the creator to choose an "artifact type" first.
 */
export function Composer({
  onSubmit,
  busy,
  placeholder = "Share a thought, idea, file, link or just start talking…",
  compact,
  autoFocus,
  className,
  prompt,
  seed,
}: {
  onSubmit: (p: ComposerPayload) => Promise<void> | void;
  busy?: boolean;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
  prompt?: string;
  /** Text to put in the composer from outside (e.g. a tapped example). A new `key` replaces the text again. */
  seed?: { text: string; key: number } | null;
}) {
  const [text, setText] = useState(prompt ?? "");
  // A new seed replaces the text (adjusting state while rendering, not in an effect).
  const [seenSeed, setSeenSeed] = useState(seed?.key ?? null);
  if (seed && seed.key !== seenSeed) {
    setSeenSeed(seed.key);
    setText(seed.text);
  }
  const [files, setFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const uid = useId();
  const ids = { text: `composer-text-${uid}`, files: `composer-files-${uid}`, camera: `composer-camera-${uid}` };
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  useEffect(
    () => () => {
      recRef.current?.stop();
      mediaRef.current?.stop();
    },
    [],
  );
  // After a seed lands, focus the text with the cursor at the end so the creator can keep typing or just send.
  useEffect(() => {
    if (!seed) return;
    const el = document.getElementById(ids.text) as HTMLTextAreaElement | null;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [seed, ids.text]);

  const canSend = !busy && (text.trim() || files.length || photos.length || voiceNotes.length || urls.length);

  async function submit() {
    if (!canSend) return;
    const payload: ComposerPayload = { message: text.trim(), files, urls, voiceNotes, photos, inputMode: voiceUsed ? "voice" : "text" };
    await onSubmit(payload);
    setText("");
    setFiles([]);
    setPhotos([]);
    setVoiceNotes([]);
    setUrls([]);
    setVoiceUsed(false);
  }

  function toggleDictation() {
    const Speech = getSpeech();
    if (!Speech) {
      setNotice("Live dictation isn't available in this browser. You can record a voice note instead.");
      return;
    }
    if (dictating) {
      recRef.current?.stop();
      return;
    }
    const rec = new Speech();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    const base = text ? `${text.trimEnd()} ` : "";
    let finalText = "";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      setText(base + finalText.trim());
    };
    rec.onend = () => setDictating(false);
    rec.onerror = (e) => {
      setDictating(false);
      if (e.error === "not-allowed") setNotice("Microphone access was blocked. You can allow it in your browser settings.");
    };
    recRef.current = rec;
    rec.start();
    setDictating(true);
    setVoiceUsed(true);
    setNotice("Listening… (your browser turns speech into text)");
  }

  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const f = new File(chunks, `Voice note ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.${ext}`, { type });
        setVoiceNotes((v) => [...v, f]);
        setRecording(false);
        setNotice(null);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setNotice("Recording a voice note… press stop when you're done.");
    } catch {
      setNotice("We couldn't access your microphone. Check your browser permissions.");
    }
  }

  function addLink() {
    const v = (linkDraft ?? "").trim();
    if (!v) return setLinkDraft(null);
    try {
      const u = new URL(v.startsWith("http") ? v : `https://${v}`);
      setUrls((x) => [...new Set([...x, u.toString()])].slice(0, 20));
      setLinkDraft(null);
    } catch {
      setNotice("That doesn't look like a link.");
    }
  }

  const chips = [
    ...files.map((f, i) => ({ key: `f${i}`, label: f.name, icon: <FileText className="size-3.5" aria-hidden />, remove: () => setFiles((x) => x.filter((_, j) => j !== i)) })),
    ...photos.map((f, i) => ({ key: `p${i}`, label: f.name || "Photo", icon: <Camera className="size-3.5" aria-hidden />, remove: () => setPhotos((x) => x.filter((_, j) => j !== i)) })),
    ...voiceNotes.map((f, i) => ({ key: `v${i}`, label: f.name, icon: <Mic className="size-3.5" aria-hidden />, remove: () => setVoiceNotes((x) => x.filter((_, j) => j !== i)) })),
    ...urls.map((u, i) => ({ key: `u${i}`, label: u.replace(/^https?:\/\//, ""), icon: <Link2 className="size-3.5" aria-hidden />, remove: () => setUrls((x) => x.filter((_, j) => j !== i)) })),
  ];

  const actions = [
    { key: "write", label: "Write", icon: PenLine, active: false },
    { key: "talk", label: dictating ? "Stop" : "Talk", icon: dictating ? MicOff : Mic, active: dictating },
    { key: "files", label: "Add files", icon: Paperclip, active: false },
    { key: "link", label: "Add link", icon: Link2, active: false },
    { key: "photo", label: "Take a photo", icon: Camera, active: false },
  ] as const;

  function handleAction(key: (typeof actions)[number]["key"]) {
    if (key === "write") document.getElementById(ids.text)?.focus();
    else if (key === "talk") toggleDictation();
    else if (key === "files") document.getElementById(ids.files)?.click();
    else if (key === "link") setLinkDraft(linkDraft === null ? "" : null);
    else document.getElementById(ids.camera)?.click();
  }

  return (
    <div className={cn("rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]", className)}>
      <label htmlFor={ids.text} className="sr-only">
        What are you thinking about?
      </label>
      <textarea
        id={ids.text}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files ?? []);
          if (pasted.length) {
            e.preventDefault();
            setFiles((f) => [...f, ...pasted].slice(0, 12));
          }
        }}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        className="block w-full resize-none rounded-t-3xl bg-transparent px-5 pt-4 text-[16px] leading-relaxed text-ink placeholder:text-ink-subtle/80 focus:outline-none"
      />
      {chips.length ? (
        <ul className="flex flex-wrap gap-2 px-4 pb-1" aria-label="Attachments">
          {chips.map((c) => (
            <li key={c.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-softer py-1 pl-3 pr-1 text-sm text-ink-muted">
              {c.icon}
              <span className="max-w-[16rem] truncate">{c.label}</span>
              <button type="button" onClick={c.remove} aria-label={`Remove ${c.label}`} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {linkDraft !== null ? (
        <div className="flex gap-2 px-4 pb-2">
          <input
            autoFocus
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="Paste a link (web page, YouTube, PDF…)"
            aria-label="Link"
            className="h-10 min-w-0 flex-1 rounded-full border border-border px-4 text-sm focus:border-accent focus:outline-none"
          />
          <Button size="sm" variant="soft" onClick={addLink}>
            Add
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p className="px-5 pb-1 text-sm text-ink-muted" role="status">
          {notice}
        </p>
      ) : null}
      <div className="flex items-center gap-1 px-2 pb-2 pt-1 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => handleAction(a.key)}
              aria-pressed={a.active}
              className={cn(
                "flex min-h-11 shrink-0 flex-col items-center justify-center rounded-2xl px-2.5 text-[11px] text-ink-muted hover:bg-surface-muted sm:min-w-16",
                a.active && "bg-accent-soft text-accent-ink",
              )}
            >
              <a.icon className="size-[18px]" aria-hidden />
              <span className={cn(compact && "sr-only sm:not-sr-only")}>{a.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={toggleRecording}
            aria-pressed={recording}
            className={cn(
              "flex min-h-11 shrink-0 flex-col items-center justify-center rounded-2xl px-2.5 text-[11px] text-ink-muted hover:bg-surface-muted sm:min-w-16",
              recording && "bg-danger-soft text-danger",
            )}
          >
            {recording ? <Square className="size-[18px]" aria-hidden /> : <Mic className="size-[18px]" aria-hidden />}
            <span className={cn(compact && "sr-only sm:not-sr-only")}>{recording ? "Stop note" : "Voice note"}</span>
          </button>
        </div>
        <IconButton label="Send" onClick={() => void submit()} disabled={!canSend} className={cn("size-12 bg-accent text-white hover:bg-accent-ink disabled:bg-accent/40")}>
          {busy ? <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
        </IconButton>
      </div>
      <input
        id={ids.files}
        type="file"
        multiple
        hidden
        accept="image/*,audio/*,video/*,application/pdf,.txt,.md,.docx"
        onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 12))}
      />
      <input id={ids.camera} type="file" hidden accept="image/*" onChange={(e) => setPhotos((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 12))} />
    </div>
  );
}
