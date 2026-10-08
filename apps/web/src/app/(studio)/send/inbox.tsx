"use client";
import { RelativeTime } from "@/components/client-time";
import { Button, Card, Input, Textarea, cn } from "@wonder/ui";
import { Camera, Check, CircleAlert, CloudUpload, FileText, Link2, Loader2, Mic, PenLine, ShieldAlert, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import type { IntakeView } from "@/lib/intake-view";
import { sendToCreator } from "@/lib/send";

type Item = IntakeView;

/** Plain words for how it came in. */
const KIND_LABEL: Record<string, string> = {
  camera: "Photo",
  image: "Image",
  voice: "Voice note",
  audio: "Audio",
  video: "Video",
  text: "Note",
  url: "Link",
  youtube: "YouTube",
  document: "Document",
  pdf: "PDF",
  file: "File",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
/** Camera and share-sheet names ("1000159585", "IMG_2041", "file_00000000a448…") say nothing; the preview does. */
const machineName = (t: string) => /^\d{5,}$/.test(t) || /^(img|pxl|dsc|dcim|photo|image|file|screenshot)[_ -]?[0-9a-f_ -]{4,}$/i.test(t);

const STEPS = [
  { label: "Ingest", states: ["received", "validating"] },
  { label: "Check", states: ["security_review"] },
  { label: "Extract", states: ["extracting", "normalizing"] },
  { label: "Understand", states: ["understood"] },
  { label: "Ready", states: ["ready"] },
];
const stepOf = (s: string) => STEPS.findIndex((x) => x.states.includes(s));

export function SendInbox({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Array<{ name: string; message: string }>>([]);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ items: Item[] }>("/api/v1/send");
      setItems(r.items);
    } catch {
      /* keep last known state */
    }
  }, []);

  const inFlight = items.some((i) => !["ready", "failed", "quarantined", "understood"].includes(i.state));
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [inFlight, refresh]);

  async function send(input: Parameters<typeof sendToCreator>[0]) {
    setBusy(true);
    setError(null);
    try {
      const r = await sendToCreator(input);
      setRejected(r.rejected);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1.1fr_1fr]">
      <section className="min-w-0 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const files = Array.from(e.dataTransfer.files);
            if (files.length) void send({ files });
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            drag ? "border-accent bg-accent-softer" : "border-[#d9d2c8] bg-surface",
          )}
        >
          <CloudUpload className="size-10 text-accent-ink" aria-hidden />
          <p className="mt-3 font-medium text-ink">Drop files here, or choose them</p>
          <p className="mt-1 text-sm text-ink-muted">Images, videos, audio, PDFs, documents</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileRef.current?.click()} loading={busy}>
              <FileText className="size-4" aria-hidden /> Upload files
            </Button>
            <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" aria-hidden /> Camera
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept="image/*,audio/*,video/*,application/pdf,.txt,.md,.docx"
            onChange={(e) => e.target.files?.length && send({ files: Array.from(e.target.files) })}
          />
          <input ref={cameraRef} type="file" hidden accept="image/*" onChange={(e) => e.target.files?.length && send({ files: Array.from(e.target.files), kind: "camera" })} />
        </div>

        <Card className="p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (link.trim()) void send({ urls: link.split(/\s+/).filter(Boolean) }).then(() => setLink(""));
            }}
          >
            <label htmlFor="send-link" className="sr-only">
              Paste links
            </label>
            <Input id="send-link" className="min-w-0" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste one or more links (web, YouTube, PDF)" />
            <Button type="submit" variant="secondary" disabled={!link.trim() || busy}>
              <Link2 className="size-4" aria-hidden /> Add
            </Button>
          </form>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send({ text }).then(() => setText(""));
            }}
          >
            <label htmlFor="send-text" className="sr-only">
              Write or paste text
            </label>
            <Textarea id="send-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write or paste a note, a memory, a lyric fragment…" />
            <div className="flex justify-between">
              <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent-ink">
                <Mic className="size-4" aria-hidden /> Record a voice note from Home
              </Link>
              <Button type="submit" size="sm" disabled={!text.trim() || busy}>
                Save note
              </Button>
            </div>
          </form>
        </Card>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {rejected.length ? (
          <ul className="space-y-1 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning-ink" role="alert">
            {rejected.map((r) => (
              <li key={r.name} className="flex gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">{r.name}</span> — {r.message}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Recent sends" className="min-w-0">
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent sends</h2>
        {items.length ? (
          // One surface, compact rows (density spec): what it is at a glance, and progress only while it's moving.
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface px-3" aria-live="polite">
            {items.map((i) => {
              const step = stepOf(i.state);
              const failed = i.state === "failed" || i.state === "quarantined";
              const ready = !failed && (step === STEPS.length - 1 || i.state === "understood");
              const title = i.material?.title && !machineName(i.material.title) ? i.material.title : i.material ? kindLabel(i.kind) : i.kind === "url" || i.kind === "youtube" ? "Link" : "File";
              const meta = i.preview.domain && (i.kind === "url" || i.kind === "youtube") ? i.preview.domain : null;
              return (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <SendPreview item={i} />
                  <div className="min-w-0 flex-1">
                    {i.material ? (
                      <Link href={`/materials/${i.material.id}`} className="block truncate text-[14px] font-medium text-ink hover:text-accent-ink">
                        {title}
                      </Link>
                    ) : (
                      <p className="truncate text-[14px] font-medium text-ink">{title}</p>
                    )}
                    <p className="truncate text-xs text-ink-subtle">
                      {kindLabel(i.kind)} · <RelativeTime iso={i.createdAt} />
                      {meta ? ` · ${meta}` : ""}
                    </p>
                    {i.preview.snippet && !failed ? <p className="mt-0.5 line-clamp-1 text-[12.5px] italic text-ink-muted">{i.preview.snippet}</p> : null}
                    {failed ? (
                      <p className="mt-0.5 text-[12.5px] text-warning-ink">
                        {i.error ?? (i.state === "quarantined" ? "This file was held for safety and wasn't stored." : "Processing didn't finish. Your original is safe.")}
                      </p>
                    ) : !ready ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          role="progressbar"
                          aria-label="Progress"
                          aria-valuemin={0}
                          aria-valuemax={STEPS.length - 1}
                          aria-valuenow={Math.max(step, 0)}
                          aria-valuetext={STEPS[Math.max(step, 0)]!.label}
                          className="flex h-1 max-w-40 flex-1 gap-0.5"
                        >
                          {STEPS.map((x, idx) => (
                            <span key={x.label} className={cn("h-1 flex-1 rounded-full", idx <= step ? "bg-accent" : "bg-light-gray")} />
                          ))}
                        </span>
                        <span className="text-[11.5px] text-ink-subtle">{STEPS[Math.max(step, 0)]!.label}…</span>
                      </div>
                    ) : null}
                  </div>
                  {failed ? (
                    <CircleAlert className="size-5 shrink-0 text-warning-ink" aria-label={i.state === "quarantined" ? "Held for safety" : "Needs attention"} />
                  ) : ready ? (
                    <Check className="size-4 shrink-0 text-success-ink" aria-label="Ready" />
                  ) : (
                    <Loader2 className="size-4 shrink-0 text-accent-ink motion-safe:animate-spin" aria-label="Processing" />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-ink-muted">Nothing sent yet. Everything you bring in will show its progress here.</p>
        )}
      </section>
    </div>
  );
}

/** A 48px look at the item itself: the photo, the note's paper, a voice or video mark, a link. */
function SendPreview({ item }: { item: Item }) {
  const box = "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl";
  const type = item.material?.type ?? item.kind;
  if (item.preview.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.preview.imageUrl} alt="" loading="lazy" decoding="async" className={cn(box, "border border-border-soft object-cover")} />;
  }
  if (["text", "note", "idea"].includes(type)) {
    return (
      <span aria-hidden className={cn(box, "items-start justify-start bg-[#f8f1e7] p-1.5")}>
        <span className="line-clamp-3 font-display text-[9.5px] italic leading-[1.15] text-ink-muted">{item.preview.snippet ?? item.material?.title ?? ""}</span>
      </span>
    );
  }
  const Icon =
    type === "voice" || type === "audio"
      ? Mic
      : type === "video"
        ? Video
        : type === "url" || type === "youtube" || type === "link" || type === "reference"
          ? Link2
          : type === "camera" || type === "image"
            ? Camera
            : item.material
              ? FileText
              : PenLine;
  return (
    <span aria-hidden className={cn(box, "bg-accent-softer text-accent-ink")}>
      <Icon className="size-5" />
    </span>
  );
}
