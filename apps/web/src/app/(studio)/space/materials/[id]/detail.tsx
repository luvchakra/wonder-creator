"use client";
import { relativeTime } from "@wonder/core";
import { Badge, Button, ConfirmDialog, ErrorState, Field, Input, Select, TagInput, Textarea, buttonClasses } from "@wonder/ui";
import { Archive, BookmarkPlus, ExternalLink, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

const ORIGIN: Record<string, string> = {
  upload: "Uploaded",
  camera: "Taken with camera",
  voice_recording: "Voice recording",
  paste: "Pasted",
  typed: "Written here",
  url: "From a link",
  youtube: "From YouTube",
  huddle: "Preserved from a Huddle",
  conversation: "From a conversation",
  ai_generated: "Created with CreatorBrain",
  derived: "Derived",
  import: "Imported",
};

const STATE: Record<string, string> = {
  received: "Received",
  validating: "Checking",
  security_review: "Security check",
  extracting: "Extracting",
  normalizing: "Organizing",
  understood: "Understood",
  ready: "Ready",
  failed: "Needs attention",
  quarantined: "Held for safety",
};

export function MaterialDetail({
  m,
  url,
  file,
  intake,
  shelves,
  usedIn,
}: {
  m: {
    id: string;
    type: string;
    title: string | null;
    text: string | null;
    extracted: string | null;
    sourceUrl: string | null;
    metadata: Record<string, unknown>;
    understanding: { summary?: string; themes?: string[]; moods?: string[] } | null;
    status: string;
    processing: string;
    security: string;
    createdAt: string;
    tags: string[];
    provenance: { origin: string; original_filename: string | null; sha256: string | null; received_at: string; source_url: string | null } | null;
  };
  url: string | null;
  file: { mime_type: string; size_bytes: number; original_filename: string | null; sha256: string } | null;
  intake: { id: string; state: string; error_message: string | null } | null;
  shelves: Array<{ id: string; name: string }>;
  usedIn: Array<{ id: string; title: string; artifact_type: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(m.title ?? "");
  const [text, setText] = useState(m.text ?? "");
  const [tags, setTags] = useState(m.tags);
  const [shelf, setShelf] = useState(shelves[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const yt = typeof m.metadata.youtubeId === "string" ? (m.metadata.youtubeId as string) : null;
  const editableText = ["idea", "note", "text", "research", "inspiration"].includes(m.type);

  async function run(key: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4">
        <Link href="/space?tab=ideas" className="text-sm text-accent-ink hover:underline">
          ← Creative Space
        </Link>
        <div className="overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
          {(m.type === "image" || m.type === "sketch") && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={m.understanding?.summary ?? m.title ?? "Image"} className="max-h-[70vh] w-full object-contain bg-[#f3efe9]" />
          ) : null}
          {(m.type === "audio" || m.type === "voice") && url ? (
            <div className="p-6">
              <audio controls src={url} className="w-full">
                Your browser can&apos;t play this audio.
              </audio>
            </div>
          ) : null}
          {m.type === "video" && url ? (
            <video controls src={url} className="max-h-[70vh] w-full bg-navy">
              Your browser can&apos;t play this video.
            </video>
          ) : null}
          {(m.type === "pdf" || m.type === "document") && url ? (
            <div className="flex items-center justify-between gap-3 p-6">
              <p className="text-ink-muted">{file?.original_filename ?? "Document"}</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Open <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          ) : null}
          {yt ? (
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              title={m.title ?? "YouTube video"}
              allow="accelerometer; encrypted-media; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : null}
          {m.type === "url" && !yt && m.sourceUrl ? (
            <div className="p-6">
              <p className="text-sm text-ink-subtle">{(m.metadata.siteName as string) ?? new URL(m.sourceUrl).hostname}</p>
              <p className="mt-1 text-ink-muted">{(m.metadata.description as string) ?? ""}</p>
              <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                Visit link <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          ) : null}
          <div className="space-y-4 p-5 sm:p-6">
            <Field label="Title" htmlFor="m-title">
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </Field>
            {editableText ? (
              <Field label="Text" htmlFor="m-text">
                <Textarea id="m-text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-40 font-display text-[17px]" />
              </Field>
            ) : m.extracted ? (
              <details className="rounded-2xl bg-surface-muted p-4">
                <summary className="cursor-pointer text-sm font-medium text-ink">Extracted text</summary>
                <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm text-ink-muted">{m.extracted}</p>
              </details>
            ) : null}
            <Field label="Tags" htmlFor="m-tags">
              <TagInput id="m-tags" value={tags} onChange={setTags} placeholder="Add a tag…" max={20} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy === "save"} onClick={() => run("save", () => api(`/api/v1/materials/${m.id}`, { method: "PATCH", json: { title, tags, ...(editableText ? { textContent: text } : {}) } }), "Saved.")}>
                Save changes
              </Button>
              <Link href={`/create?material=${m.id}`} className={buttonClasses({ variant: "soft" })}>
                <Sparkles className="size-4" aria-hidden /> Create from this
              </Link>
            </div>
            {msg ? (
              <p role="status" className="text-sm text-success-ink">
                {msg}
              </p>
            ) : null}
            {error ? <ErrorState title="That didn't work" body={error} /> : null}
          </div>
        </div>
      </section>

      <aside className="space-y-4 lg:pt-8">
        <section className="rounded-2xl border border-border-soft bg-surface p-5">
          <h2 className="font-semibold text-ink">What CreatorBrain understood</h2>
          {m.understanding?.summary ? (
            <>
              <p className="mt-2 text-[15px] text-ink-muted">{m.understanding.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...(m.understanding.themes ?? []), ...(m.understanding.moods ?? [])].map((t) => (
                  <Badge key={t} tone="accent">
                    {t}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">{typeof m.metadata.processingNote === "string" ? m.metadata.processingNote : m.processing === "ready" ? "Saved and ready to use in creation." : "Still processing — your original is safe."}</p>
          )}
        </section>

        <section className="rounded-2xl border border-border-soft bg-surface p-5">
          <h2 className="font-semibold text-ink">Status & provenance</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-subtle">Status</dt>
            <dd className="text-ink">
              {STATE[m.processing] ?? m.processing}
              {m.status === "archived" ? " · Archived" : ""}
            </dd>
            <dt className="text-ink-subtle">Source</dt>
            <dd className="text-ink">{ORIGIN[m.provenance?.origin ?? ""] ?? "—"}</dd>
            {file?.original_filename ? (
              <>
                <dt className="text-ink-subtle">File</dt>
                <dd className="break-all text-ink">{file.original_filename}</dd>
              </>
            ) : null}
            {file ? (
              <>
                <dt className="text-ink-subtle">Size</dt>
                <dd className="text-ink">
                  {(file.size_bytes / 1024 / 1024).toFixed(file.size_bytes > 1024 * 1024 ? 1 : 2)} MB · {file.mime_type}
                </dd>
                <dt className="text-ink-subtle">Fingerprint</dt>
                <dd className="font-mono text-xs text-ink-muted" title={file.sha256}>
                  {file.sha256.slice(0, 16)}…
                </dd>
              </>
            ) : null}
            {m.provenance?.source_url ? (
              <>
                <dt className="text-ink-subtle">Link</dt>
                <dd className="break-all text-ink">{m.provenance.source_url}</dd>
              </>
            ) : null}
            <dt className="text-ink-subtle">Added</dt>
            <dd className="text-ink">{relativeTime(m.createdAt)}</dd>
          </dl>
          {intake?.state === "failed" ? (
            <div className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">
              <p>{intake.error_message ?? "Processing didn't finish. Your original is safe."}</p>
              <Button size="sm" variant="secondary" className="mt-2" loading={busy === "retry"} onClick={() => run("retry", () => api(`/api/v1/send/${intake.id}/retry`, { method: "POST" }), "Processed.")}>
                <RotateCcw className="size-4" aria-hidden /> Try again
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border-soft bg-surface p-5">
          <h2 className="font-semibold text-ink">Reference Shelf</h2>
          <div className="mt-3 flex gap-2">
            <label htmlFor="shelf" className="sr-only">
              Shelf
            </label>
            <Select id="shelf" value={shelf} onChange={(e) => setShelf(e.target.value)}>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" loading={busy === "ref"} onClick={() => run("ref", () => api("/api/v1/references/items", { method: "POST", json: { materialId: m.id, shelfId: shelf || null } }), "Added to your Reference Shelf.")}>
              <BookmarkPlus className="size-4" aria-hidden /> Add
            </Button>
          </div>
        </section>

        {usedIn.length ? (
          <section className="rounded-2xl border border-border-soft bg-surface p-5">
            <h2 className="font-semibold text-ink">Used in</h2>
            <ul className="mt-2 space-y-1">
              {usedIn.map((a) => (
                <li key={a.id}>
                  <Link href={`/artifacts/${a.id}`} className="text-[15px] font-medium text-accent-ink hover:underline">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" loading={busy === "archive"} onClick={() => run("archive", () => api(`/api/v1/materials/${m.id}`, { method: "PATCH", json: { status: m.status === "archived" ? "active" : "archived" } }))}>
            <Archive className="size-4" aria-hidden /> {m.status === "archived" ? "Unarchive" : "Archive"}
          </Button>
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      </aside>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        busy={busy === "delete"}
        title="Delete this material permanently?"
        body={usedIn.length ? `It's part of the lineage of ${usedIn.length} piece${usedIn.length === 1 ? "" : "s"}; they'll keep their text but lose this source. This can't be undone.` : "The original file and its details will be removed. This can't be undone. Archiving keeps it out of the way instead."}
        confirmLabel="Delete permanently"
        onConfirm={() =>
          run("delete", async () => {
            await api(`/api/v1/materials/${m.id}?confirm=true`, { method: "DELETE" });
            router.replace("/space?tab=ideas");
          })
        }
      />
    </div>
  );
}
