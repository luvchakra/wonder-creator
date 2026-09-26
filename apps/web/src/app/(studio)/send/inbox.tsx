"use client";
import { relativeTime } from "@wonder/core";
import { Button, Card, Input, Textarea, cn } from "@wonder/ui";
import { Camera, Check, CircleAlert, CloudUpload, FileText, Link2, Loader2, Mic, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { sendToCreator } from "@/lib/send";

interface Item {
  id: string;
  state: string;
  kind: string;
  error: string | null;
  createdAt: string;
  material: { id: string; title: string | null; type: string } | null;
}

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
      const r = await api<{ items: Array<{ id: string; state: string; input_kind: string; error_message: string | null; created_at: string; creative_materials: Item["material"] }> }>("/api/v1/send");
      setItems(r.items.map((i) => ({ id: i.id, state: i.state, kind: i.input_kind, error: i.error_message, createdAt: i.created_at, material: i.creative_materials })));
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
          className={cn("flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors", drag ? "border-accent bg-accent-softer" : "border-[#d9d2c8] bg-surface")}
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
          <input ref={fileRef} type="file" multiple hidden accept="image/*,audio/*,video/*,application/pdf,.txt,.md,.docx" onChange={(e) => e.target.files?.length && send({ files: Array.from(e.target.files) })} />
          <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => e.target.files?.length && send({ files: Array.from(e.target.files), kind: "camera" })} />
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
          <ul className="space-y-2" aria-live="polite">
            {items.map((i) => {
              const step = stepOf(i.state);
              const failed = i.state === "failed" || i.state === "quarantined";
              return (
                <li key={i.id} className="rounded-2xl border border-border-soft bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {i.material ? (
                        <Link href={`/space/materials/${i.material.id}`} className="block truncate font-medium text-ink hover:text-accent-ink">
                          {i.material.title || "Untitled"}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-ink">{i.kind === "url" || i.kind === "youtube" ? "Link" : "File"}</p>
                      )}
                      <p className="text-xs text-ink-subtle">
                        {i.kind} · {relativeTime(i.createdAt)}
                      </p>
                    </div>
                    {failed ? (
                      <CircleAlert className="size-5 shrink-0 text-warning-ink" aria-label={i.state === "quarantined" ? "Held for safety" : "Needs attention"} />
                    ) : step === STEPS.length - 1 || i.state === "understood" ? (
                      <Check className="size-5 shrink-0 text-success-ink" aria-label="Ready" />
                    ) : (
                      <Loader2 className="size-5 shrink-0 text-accent-ink motion-safe:animate-spin" aria-label="Processing" />
                    )}
                  </div>
                  {!failed ? (
                    <ol className="mt-2 flex gap-1" aria-label="Progress">
                      {STEPS.map((s, idx) => (
                        <li key={s.label} className="flex-1">
                          <span className={cn("block h-1.5 rounded-full", idx <= step ? "bg-accent" : "bg-light-gray")} />
                          <span className={cn("mt-1 block text-[11px]", idx === step ? "font-medium text-ink" : "text-ink-subtle")}>{s.label}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1.5 text-sm text-warning-ink">{i.error ?? (i.state === "quarantined" ? "This file was held for safety and wasn't stored." : "Processing didn't finish. Your original is safe.")}</p>
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
