"use client";
import { RelativeTime } from "@/components/client-time";
import { Badge, Button, ConfirmDialog, Dialog, DialogContent, ErrorState, Field, Input, Select, TagInput, Textarea, buttonClasses } from "@wonder/ui";
import { Archive, Download, ExternalLink, FolderPlus, Lock, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { VisualDirections } from "@/components/visual-directions";
import { BackLink } from "@/components/back-link";
import { forget } from "@/components/nav-memory";

// Loaded when "Use in creation" is first pressed, like the Palette's Create.
const NewCreationSheet = dynamic(() => import("@/components/new-creation-sheet").then((m) => m.NewCreationSheet), { ssr: false });

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
  ai_generated: "Created with CreativeMind",
  derived: "Derived",
  import: "Imported",
};

const KIND: Record<string, string> = { idea: "Idea", reference: "Reference", research: "Research", conversation: "Conversation", inspiration: "Inspiration", image: "Photo", sketch: "Sketch", voice: "Voice note", audio: "Audio", video: "Video", note: "Note", text: "Note", document: "Document", pdf: "Document", url: "Link" };

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

/** Extracted metadata worth showing (the rest is internal or already shown under Details). */
const META_LABEL: Record<string, string> = {
  pages: "Pages",
  author: "Author",
  siteName: "Site",
  language: "Language",
};

export function MaterialDetail({
  m,
  dejavu,
  url,
  file,
  intake,
  usedIn,
  collections,
  inCollections,
  similar,
  canGenerate = false,
}: {
  /** The creator's own Material: offer visual directions made from it. */
  canGenerate?: boolean;
  m: {
    id: string;
    type: string;
    title: string | null;
    description: string | null;
    sourceNote: string | null;
    text: string | null;
    extracted: string | null;
    sourceUrl: string | null;
    metadata: Record<string, unknown>;
    understanding: {
      summary?: string;
      themes?: string[];
      moods?: string[];
    } | null;
    status: string;
    processing: string;
    security: string;
    createdAt: string;
    tags: string[];
    provenance: {
      origin: string;
      original_filename: string | null;
      sha256: string | null;
      received_at: string;
      source_url: string | null;
    } | null;
  };
  url: string | null;
  file: {
    mime_type: string;
    size_bytes: number;
    original_filename: string | null;
    sha256: string;
  } | null;
  intake: { id: string; state: string; error_message: string | null } | null;
  /** DejaVu chips (docs/moments-dejavu.md §10). */
  dejavu?: React.ReactNode;
  usedIn: Array<{ id: string; title: string; artifact_type: string }>;
  collections: Array<{ id: string; name: string }>;
  inCollections: string[];
  similar: Array<{
    id: string;
    title: string | null;
    type: string;
    thumb: string | null;
  }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(m.title ?? "");
  const [text, setText] = useState(m.text ?? "");
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState(m.description ?? "");
  const [sourceNote, setSourceNote] = useState(m.sourceNote ?? "");
  const [collection, setCollection] = useState(collections.find((c) => !inCollections.includes(c.id))?.id ?? "");
  const [tags, setTags] = useState(m.tags);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const yt = typeof m.metadata.youtubeId === "string" ? (m.metadata.youtubeId as string) : null;
  const editableText = ["idea", "note", "text", "research", "inspiration"].includes(m.type);
  const downloadable = !!file && m.security === "clean";
  const hasPreview = !!url && ["image", "sketch", "audio", "voice", "video", "pdf", "document"].includes(m.type);
  const member = collections.filter((c) => inCollections.includes(c.id));
  const addable = collections.filter((c) => !inCollections.includes(c.id));
  const extractedMeta = Object.fromEntries(
    Object.entries(m.metadata)
      .filter(([k, v]) => k in META_LABEL && (typeof v === "string" || typeof v === "number") && String(v).length <= 200)
      .map(([k, v]) => [META_LABEL[k], String(v)]),
  );
  const themes = [...(m.understanding?.themes ?? []), ...(m.understanding?.moods ?? [])];
  // The Material itself, as large as it reads well: the picture, the recording, the film, the document or the link.
  const preview =
    (m.type === "image" || m.type === "sketch") && url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={m.understanding?.summary ?? m.title ?? "Image"} className="max-h-[72vh] w-full object-contain lg:max-h-[58vh]" />
    ) : (m.type === "audio" || m.type === "voice") && url ? (
      <div className="bg-surface p-5">
        <audio controls src={url} className="w-full">
          Your browser can&apos;t play this audio.
        </audio>
      </div>
    ) : m.type === "video" && url ? (
      <video controls src={url} className="max-h-[72vh] w-full bg-navy">
        Your browser can&apos;t play this video.
      </video>
    ) : (m.type === "pdf" || m.type === "document") && url ? (
      <div className="flex items-center justify-between gap-3 bg-surface p-5">
        <p className="text-ink-muted">{file?.original_filename ?? "Document"}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Open <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
    ) : yt ? (
      <iframe
        className="aspect-video w-full"
        src={`https://www.youtube-nocookie.com/embed/${yt}`}
        title={m.title ?? "YouTube video"}
        allow="accelerometer; encrypted-media; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    ) : m.type === "url" && m.sourceUrl ? (
      <div className="bg-surface p-5">
        <p className="text-[13px] text-ink-subtle">{(m.metadata.siteName as string) ?? new URL(m.sourceUrl).hostname}</p>
        {m.metadata.description ? <p className="mt-1 text-[14px] text-ink-muted">{m.metadata.description as string}</p> : null}
        <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-accent-ink hover:underline">
          Visit link <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
    ) : file && !hasPreview ? (
      <p className="bg-surface p-5 text-[14px] text-ink-muted" role="note">
        {m.security === "clean"
          ? "There's no preview for this kind of file here. Download the original from Details to open it."
          : m.security === "quarantined"
            ? "This file is held for safety, so it can't be previewed or downloaded."
            : "The preview appears once the safety check finishes. Your original is saved."}
      </p>
    ) : null;

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

  // Details (owner, 4 Oct 2026: "don't show so many things, keep it simple"): the page is the Material, its name and one
  // way to use it; everything else — what it is, where it came from, collections, where it's used — opens on request.
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const open = () => {
      if (window.location.hash === "#details" || window.location.hash === "#collections") {
        setDetails(true);
        history.replaceState(history.state, "", window.location.pathname + window.location.search);
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  const kind = KIND[m.type] ?? "Material";
  // Where it came from, when that matters for credit (someone else's words, CreativeMind, the web); plain uploads and
  // typed notes say nothing.
  const origin = m.provenance?.origin ?? "";
  const notableOrigin = ["huddle", "conversation", "ai_generated", "url", "youtube", "derived", "import"].includes(origin) ? ORIGIN[origin] : null;
  const textDirty = editableText && text !== (m.text ?? "");

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <BackLink home="/materials?tab=ideas" homeLabel="Materials" />
      {preview ? <div className="overflow-hidden rounded-3xl bg-[#f3efe9] shadow-[var(--shadow-card)]">{preview}</div> : null}

      <header className="space-y-0.5 px-1">
        <h1 className="font-display text-[24px] leading-tight text-ink [overflow-wrap:anywhere]">{m.title?.trim() || `Untitled ${kind.toLowerCase()}`}</h1>
        <p className="text-[13px] text-ink-muted">
          {kind}
          {notableOrigin ? ` · ${notableOrigin}` : ""} · <RelativeTime iso={m.createdAt} />
          {usedIn.length ? ` · in ${usedIn.length} Creation${usedIn.length === 1 ? "" : "s"}` : ""}
          {m.status === "archived" ? " · Archived" : ""}
        </p>
      </header>

      {editableText ? (
        <Textarea id="m-text" aria-label="Text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-40 font-display text-[17px]" />
      ) : m.extracted ? (
        <details id="transcript" open={Boolean(m.metadata.transcription)} className="scroll-mt-20 rounded-2xl bg-surface-muted px-4 py-3">
          <summary className="cursor-pointer text-[14px] font-medium text-ink">{m.metadata.transcription ? "Transcript" : "Extracted text"}</summary>
          {m.metadata.transcription ? <p className="mt-2 text-[12px] text-ink-muted">Transcribed automatically by CreativeMind. It may contain mistakes.</p> : null}
          <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[14px] text-ink-muted">{m.extracted}</p>
        </details>
      ) : null}

      {intake?.state === "failed" ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-[14px] text-warning-ink">
          <span className="flex-1">{intake.error_message ?? "Processing didn't finish. Your original is safe."}</span>
          <Button size="sm" variant="secondary" loading={busy === "retry"} onClick={() => run("retry", () => api(`/api/v1/send/${intake.id}/retry`, { method: "POST" }), "Processed.")}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
        </div>
      ) : null}

      {/* One primary action; Details for the rest. Save appears only when the words changed. */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {textDirty ? (
          <Button loading={busy === "text"} onClick={() => run("text", () => api(`/api/v1/materials/${m.id}`, { method: "PATCH", json: { textContent: text } }), "Saved.")}>
            Save
          </Button>
        ) : (
          <Button aria-haspopup="dialog" onClick={() => setCreating(true)}>
            <Sparkles className="size-4" aria-hidden /> Use in creation
          </Button>
        )}
        <Button variant="secondary" aria-haspopup="dialog" onClick={() => setDetails(true)}>
          Details
        </Button>
      </div>
      {msg && !details ? (
        <p role="status" className="px-1 text-[13px] text-success-ink">
          {msg}
        </p>
      ) : null}
      {error && !details ? <ErrorState title="That didn't work" body={error} /> : null}

      {/* Make a new Creation, starting from this Material: its words (a note's text, a transcript) are the first draft. */}
      {creating ? <NewCreationSheet open onOpenChange={setCreating} from={{ materialId: m.id, text: editableText ? text : (m.extracted ?? "") }} /> : null}

      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent title="Details" description={`${kind} · private to you`}>
          <div className="space-y-5">
            <section aria-label="About it" className="space-y-3">
              <Field label="Title" htmlFor="m-title">
                <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </Field>
              <Field label="Description" htmlFor="m-description" hint="What this is and why you kept it.">
                <Textarea id="m-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="min-h-20" />
              </Field>
              <Field label="Source & rights note" htmlFor="m-source-note" hint="Where it came from, who made it, any permissions.">
                <Input id="m-source-note" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} maxLength={1000} />
              </Field>
              <Field label="Tags" htmlFor="m-tags">
                <TagInput id="m-tags" value={tags} onChange={setTags} placeholder="Add a tag…" max={20} />
              </Field>
              <div className="flex items-center gap-3">
                <Button
                  loading={busy === "save"}
                  onClick={() => run("save", () => api(`/api/v1/materials/${m.id}`, { method: "PATCH", json: { title, tags, description, sourceNote, ...(editableText ? { textContent: text } : {}) } }), "Saved.")}
                >
                  Save changes
                </Button>
                {msg ? (
                  <p role="status" className="text-[13px] text-success-ink">
                    {msg}
                  </p>
                ) : null}
              </div>
              {error ? <ErrorState title="That didn't work" body={error} /> : null}
            </section>

            {m.understanding?.summary || dejavu ? (
              <section aria-label="What CreativeMind understood" className="space-y-2 border-t border-border-soft pt-4">
                {m.understanding?.summary ? (
                  <>
                    <h3 className="text-[13px] font-semibold text-ink">What CreativeMind understood</h3>
                    <p className="text-[14px] text-ink-muted">{m.understanding.summary}</p>
                    {themes.length ? (
                      <p className="flex flex-wrap gap-1.5">
                        {themes.slice(0, 6).map((t) => (
                          <Badge key={t} tone="accent">
                            {t}
                          </Badge>
                        ))}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {dejavu}
              </section>
            ) : null}

            <section id="collections" aria-labelledby="m-collections" className="space-y-2 border-t border-border-soft pt-4">
              <h3 id="m-collections" className="text-[13px] font-semibold text-ink">
                Collections
              </h3>
              {member.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="In collections">
                  {member.map((c) => (
                    <li key={c.id}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted py-1 pl-3 pr-1 text-[13px] text-ink">
                        {c.name}
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-full text-ink-subtle hover:bg-black/[0.06] hover:text-ink"
                          aria-label={`Remove from ${c.name}`}
                          disabled={busy === `rm:${c.id}`}
                          onClick={() => run(`rm:${c.id}`, () => api(`/api/v1/collections/${c.id}/items`, { method: "DELETE", json: { materialId: m.id } }), `Removed from ${c.name}.`)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">Not in a collection yet.</p>
              )}
              {addable.length ? (
                <div className="flex gap-2">
                  <label htmlFor="collection" className="sr-only">
                    Collection
                  </label>
                  <Select id="collection" value={collection} onChange={(e) => setCollection(e.target.value)}>
                    {addable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    loading={busy === "collect"}
                    disabled={!collection}
                    onClick={() => {
                      const name = addable.find((c) => c.id === collection)?.name ?? "the collection";
                      return run("collect", () => api(`/api/v1/collections/${collection}/items`, { method: "POST", json: { materialId: m.id } }), `Added to ${name}.`);
                    }}
                  >
                    <FolderPlus className="size-4" aria-hidden /> Add<span className="sr-only"> to collection</span>
                  </Button>
                </div>
              ) : collections.length ? null : (
                <Link href="/materials?tab=collections" className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
                  Create a collection
                </Link>
              )}
            </section>

            <section aria-labelledby="m-used" className="space-y-1 border-t border-border-soft pt-4">
              <h3 id="m-used" className="text-[13px] font-semibold text-ink">
                Used in
              </h3>
              {usedIn.length ? (
                <ul className="space-y-0.5">
                  {usedIn.map((a) => (
                    <li key={a.id}>
                      <Link href={`/creations/${a.id}`} className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent-ink hover:underline">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">Not used in a Creation yet.</p>
              )}
            </section>

            <details className="group border-t border-border-soft pt-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-ink">About the file</summary>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-ink-subtle">Status</dt>
                <dd className="text-ink">{STATE[m.processing] ?? m.processing}</dd>
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
                {Object.entries(extractedMeta).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-subtle">{k}</dt>
                    <dd className="break-words text-ink">{v}</dd>
                  </div>
                ))}
                <dt className="text-ink-subtle">Owner</dt>
                <dd className="text-ink">You</dd>
                <dt className="text-ink-subtle">Visibility</dt>
                <dd className="inline-flex items-center gap-1 text-ink">
                  <Lock className="size-3.5" aria-hidden /> Private to you
                </dd>
              </dl>
              {!m.understanding?.summary ? (
                <p className="mt-2 text-[13px] text-ink-muted">
                  {typeof m.metadata.processingNote === "string" ? m.metadata.processingNote : m.processing === "ready" ? "Saved and ready to use in creation." : "Still processing — your original is safe."}
                </p>
              ) : null}
            </details>

            {similar.length ? (
              <details className="border-t border-border-soft pt-4">
                <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-ink">Similar material</summary>
                <ul className="mt-1 grid grid-cols-3 gap-2">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <Link href={`/materials/${s.id}`} className="block overflow-hidden rounded-xl border border-border-soft hover:border-accent">
                        {s.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.thumb} alt="" className="aspect-square w-full bg-[#f3efe9] object-cover" />
                        ) : null}
                        <span className="block truncate px-2 py-1.5 text-[12px] text-ink">{s.title || `Untitled ${s.type}`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {/* Generated only when asked (image-generation §30). */}
            {canGenerate ? <VisualDirections materialIds={[m.id]} purpose="explore" title="Ways this could look" className="border-t border-border-soft pt-3" /> : null}

            <div className="flex flex-wrap gap-1 border-t border-border-soft pt-3">
              {downloadable ? (
                <a href={`/api/v1/materials/${m.id}/download`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                  <Download className="size-4" aria-hidden /> Download original
                </a>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                loading={busy === "archive"}
                onClick={() => run("archive", () => api(`/api/v1/materials/${m.id}`, { method: "PATCH", json: { status: m.status === "archived" ? "active" : "archived" } }))}
              >
                <Archive className="size-4" aria-hidden /> {m.status === "archived" ? "Unarchive" : "Archive"}
              </Button>
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        busy={busy === "delete"}
        title="Delete this material permanently?"
        body={
          usedIn.length
            ? `It's part of the lineage of ${usedIn.length} Creation${usedIn.length === 1 ? "" : "s"}; they'll keep their text but lose this source. This can't be undone.`
            : "The original file and its details will be removed. This can't be undone. Archiving keeps it out of the way instead."
        }
        confirmLabel="Delete permanently"
        onConfirm={() =>
          run("delete", async () => {
            await api(`/api/v1/materials/${m.id}?confirm=true`, { method: "DELETE" });
            forget(`/materials/${m.id}`);
            router.replace("/materials?tab=ideas");
          })
        }
      />
    </div>
  );
}
