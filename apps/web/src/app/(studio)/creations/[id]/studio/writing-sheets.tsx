"use client";
import { EXPORT_FORMATS, exportFormatsFor } from "@wonder/creator-studio/exports";
import { LOOK_LABEL, LOOKS, ORNAMENT_KEYS, WRITING_KINDS, writingStyleOf, type CreationLook, type OrnamentKey } from "@wonder/creator-studio/pages";
import { artifactType } from "@wonder/creator-studio/types";
import { Button, Dialog, DialogContent, KIT, KitArt, ORNAMENT_LABEL, Ornament, Segmented, Switch, buttonClasses, cn } from "@wonder/ui";
import Link from "next/link";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { VisualDirections } from "@/components/visual-directions";
import { api, errorMessage } from "@/lib/client";

/**
 * The Writing page's sheets (creation-pages.md §Writing): Cover (a picture of the creator's, or one CreativeMind makes
 * from the work, and how the words are set), Publish as link (the creator's own public page for it), and Export.
 */

type Picture = { id: string; title: string | null; previewUrl: string | null };

export function CoverSheet({
  open,
  onOpenChange,
  artifactId,
  coverUrl,
  look,
  onLook,
  ornament,
  onOrnament,
  onCover,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artifactId: string;
  coverUrl: string | null;
  look: CreationLook;
  onLook: (l: CreationLook) => void;
  ornament: OrnamentKey;
  onOrnament: (o: OrnamentKey) => void;
  onCover: (materialId: string | null) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Cover" description="A picture behind the words — or none, on paper." art={KIT.iconChip.image}>
        {open ? <CoverBody artifactId={artifactId} coverUrl={coverUrl} look={look} onLook={onLook} ornament={ornament} onOrnament={onOrnament} onCover={onCover} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CoverBody({
  artifactId,
  coverUrl,
  look,
  onLook,
  ornament,
  onOrnament,
  onCover,
}: {
  artifactId: string;
  coverUrl: string | null;
  look: CreationLook;
  onLook: (l: CreationLook) => void;
  ornament: OrnamentKey;
  onOrnament: (o: OrnamentKey) => void;
  onCover: (materialId: string | null) => Promise<void>;
}) {
  const [pictures, setPictures] = useState<Picture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  useEffect(() => {
    let live = true;
    api<{ items: Picture[] }>("/api/v1/materials?filter=images")
      .then((r) => live && setPictures(r.items.filter((m) => m.previewUrl).slice(0, 24)))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  async function choose(id: string | null) {
    setBusy(id ?? "none");
    setError(null);
    try {
      await onCover(id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">How the words are set</p>
        <Segmented
          label="How the words are set"
          value={look}
          onChange={onLook}
          options={LOOKS.filter((l) => l === "paper" || coverUrl).map((l) => ({ value: l, label: LOOK_LABEL[l] }))}
        />
      </div>

      {/* Header and footer of the piece: an ornament after Roman architecture (owner, 4 Oct 2026). */}
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Ornament · heads and closes the piece</p>
        <div role="radiogroup" aria-label="Ornament" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {ORNAMENT_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={ornament === k}
              onClick={() => onOrnament(k)}
              className={cn("flex min-h-12 flex-col justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left", ornament === k ? "border-accent bg-accent-softer" : "border-border-soft hover:border-accent/50")}
            >
              <Ornament kind={k} className="text-ink/45" />
              <span className="text-[12px] font-medium text-ink">{ORNAMENT_LABEL[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <section aria-labelledby="cover-pictures">
        <div className="mb-1.5 flex min-h-9 items-center justify-between gap-2">
          <h3 id="cover-pictures" className="text-[13.5px] font-semibold text-ink">
            Your pictures
          </h3>
          {coverUrl ? (
            <button type="button" onClick={() => void choose(null)} disabled={!!busy} className="inline-flex min-h-11 items-center text-[13px] font-medium text-ink-muted hover:text-ink">
              {busy === "none" ? "Removing…" : "No cover"}
            </button>
          ) : null}
        </div>
        {!pictures && !error ? <p className="text-[13px] text-ink-subtle">Looking for your pictures…</p> : null}
        {pictures && !pictures.length ? <p className="text-[13px] text-ink-muted">No pictures yet. A Quick Pic from Home, or a picture brought in, will show here.</p> : null}
        {pictures?.length ? (
          <ul className="grid grid-cols-4 gap-1.5" aria-label="Pictures">
            {pictures.map((p) => {
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void choose(p.id)}
                    aria-label={`Use ${p.title?.trim() || "this picture"} as the cover`}
                    className="relative block aspect-square w-full overflow-hidden rounded-xl bg-cream-deep focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.previewUrl!} alt="" loading="lazy" className="size-full object-cover" />
                    {busy === p.id ? <span className="absolute inset-0 bg-surface/60 motion-safe:animate-pulse" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section aria-label="Made by CreativeMind" className="border-t border-border-soft pt-3">
        {making ? (
          <VisualDirections creationId={artifactId} purpose="explore" title="Made from your words" useLabel="Use as cover" onUse={(id) => choose(id)} />
        ) : (
          <button type="button" onClick={() => setMaking(true)} className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-border-soft p-2.5 text-left hover:border-accent/50 hover:bg-accent-softer">
            <KitArt art={KIT.iconChip.sparkles} sizes="2rem" className="size-8 shrink-0" />
            <span>
              <span className="block text-[13.5px] font-medium text-ink">Let CreativeMind make one</span>
              <span className="block text-[12px] text-ink-subtle">From what you&apos;ve written — kept until it changes</span>
            </span>
          </button>
        )}
      </section>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Publication = {
  slug: string;
  visibility: "private" | "unlisted" | "public";
  unpublished: boolean;
  revision: { number: number; versionNumber: number | null } | null;
  newerVersions: number;
};

/**
 * Publish as link: the work on a page of its own at /p/<handle>/<slug> — the cover, the paper, the creator's name, no
 * counts. Anyone with the link can read it; it shows on the Creator Page only if the creator says so (off by default).
 * It publishes the latest saved version, frozen; writing carries on here.
 */
export function PublishLinkSheet({ open, onOpenChange, artifactId, unsaved, onSaveFirst }: { open: boolean; onOpenChange: (o: boolean) => void; artifactId: string; unsaved: boolean; onSaveFirst: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Publish as link" description="Its own page, ready to share. Only what you publish is seen." art={KIT.mark.starGold}>
        {open ? <PublishBody artifactId={artifactId} unsaved={unsaved} onSaveFirst={onSaveFirst} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PublishBody({ artifactId, unsaved, onSaveFirst }: { artifactId: string; unsaved: boolean; onSaveFirst: () => void }) {
  const [state, setState] = useState<{ publication: Publication | null; suggestedSlug: string; handle: string | null } | null>(null);
  const [onPage, setOnPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    api<{ publication: Publication | null; suggestedSlug: string; handle: string | null }>(`/api/v1/artifacts/${artifactId}/publication`)
      .then((r) => {
        if (!live) return;
        setState(r);
        setOnPage(r.publication?.visibility === "public");
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [artifactId]);

  const p = state?.publication;
  const live = !!p && !p.unpublished && p.visibility !== "private";
  const path = state?.handle ? `/p/${state.handle}/${p?.slug ?? state.suggestedSlug}` : null;
  const url = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setState(await api(`/api/v1/artifacts/${artifactId}/publication`));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const publish = () => run("publish", () => api(`/api/v1/artifacts/${artifactId}/publication`, { method: "POST", json: { visibility: onPage ? "public" : "unlisted" } }));
  const place = (v: boolean) => {
    setOnPage(v);
    if (live) void run("place", () => api(`/api/v1/artifacts/${artifactId}/publication`, { method: "PATCH", json: { visibility: v ? "public" : "unlisted" } }));
  };

  if (!state) return error ? <p role="alert" className="text-sm text-danger">{error}</p> : <p className="text-[13px] text-ink-subtle">Opening…</p>;
  if (!state.handle)
    return (
      <p className="text-[13.5px] text-ink-muted">
        Choose your handle on your Profile first — it&apos;s part of the link.{" "}
        <Link href="/me" className="inline-flex min-h-11 items-center font-medium text-accent-ink underline-offset-2 hover:underline">
          Open Profile
        </Link>
      </p>
    );
  return (
    <div className="space-y-3">
      {unsaved ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-[13px] text-warning-ink">
          <span className="min-w-0 flex-1">You have unsaved words. A link shows the latest saved version.</span>
          <Button size="sm" variant="secondary" onClick={onSaveFirst}>
            Save a version
          </Button>
        </div>
      ) : null}

      {live && url ? (
        <div className="rounded-2xl border border-border-soft p-3">
          <p className="text-[12px] font-medium text-success-ink">
            Published{p!.revision?.versionNumber ? ` · v${p!.revision.versionNumber}` : ""}
            {p!.newerVersions ? <span className="text-ink-muted"> · {p!.newerVersions} newer {p!.newerVersions === 1 ? "version" : "versions"} here</span> : null}
          </p>
          <p className="mt-0.5 break-all text-[13.5px] text-ink">{url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(url).then(() => setCopied(true));
              }}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={path!} target="_blank" rel="noreferrer" className={buttonClasses({ size: "sm", variant: "secondary" })}>
              <ExternalLink className="size-4" aria-hidden /> Open
            </a>
          </div>
        </div>
      ) : (
        <p className="text-[13.5px] text-ink-muted">
          It will live at <span className="break-all font-medium text-ink">{url}</span> — the cover, the words on paper and your name. No counts.
        </p>
      )}

      <label className="flex min-h-11 items-center justify-between gap-3 text-[13.5px] text-ink">
        <span>
          Show on my Creator Page
          <span className="block text-[12px] text-ink-subtle">Off: only people with the link can read it.</span>
        </span>
        <Switch checked={onPage} onCheckedChange={place} disabled={busy !== null} label="Show on my Creator Page" />
      </label>

      {live ? (
        <div className="flex flex-wrap items-center gap-2">
          {p!.newerVersions ? (
            <Button className="flex-1" loading={busy === "publish"} disabled={busy !== null} onClick={publish}>
              Publish the latest version
            </Button>
          ) : null}
          <Button variant="ghost" loading={busy === "down"} disabled={busy !== null} onClick={() => run("down", () => api(`/api/v1/artifacts/${artifactId}/publication`, { method: "DELETE" }))}>
            Take it down
          </Button>
        </div>
      ) : (
        <Button className="w-full" loading={busy === "publish"} disabled={busy !== null} onClick={publish}>
          Publish as link
        </Button>
      )}
      <p className="text-[12px] text-ink-subtle">
        Rights stay as you set them.{" "}
        <Link href={`/creations/${artifactId}/publish`} className="inline-flex min-h-11 items-center font-medium text-accent-ink underline-offset-2 hover:underline">
          More publishing choices
        </Link>
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Export the latest saved version in the formats that suit it (Markdown, text, web page, Fountain for scripts). */
export function ExportSheet({ open, onOpenChange, artifactId, type, unsaved }: { open: boolean; onOpenChange: (o: boolean) => void; artifactId: string; type: string; unsaved: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Export" description={unsaved ? "The latest saved version — save first to include what's new." : "The latest saved version."} art={KIT.iconChip.file}>
        <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
          {exportFormatsFor(type).map((f) => (
            <li key={f}>
              <a href={`/api/v1/artifacts/${artifactId}/export?format=${f}`} download className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-black/[0.02]">
                <Download className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{EXPORT_FORMATS[f].label}</span>
                  <span className="block truncate text-[12px] text-ink-subtle">{EXPORT_FORMATS[f].note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Each kind's name in the face its page is set in — the choice previews the page. */
const KIND_FACE: Record<string, string> = {
  verse: "font-display italic",
  essay: "font-display",
  feature: "font-display",
  news: "font-display font-bold",
  fiction: "font-display italic",
  letter: "font-display italic",
  script: "font-mono text-[14px] uppercase",
};

/** The kind of writing: a poem, prose, an essay, an article, news… The words stay; the page is set to suit the kind. */
export function KindSheet({ open, onOpenChange, current, busy, onChoose }: { open: boolean; onOpenChange: (o: boolean) => void; current: string; busy: string | null; onChoose: (type: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Kind of writing" description="Your words stay as they are; the page is set to suit them." art={KIT.iconChip.type}>
        <ul className="grid grid-cols-2 gap-1.5" aria-label="Kinds">
          {WRITING_KINDS.map((k) => {
            const on = k.type === current;
            return (
              <li key={k.type}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!!busy}
                  onClick={() => onChoose(k.type)}
                  className={cn("flex min-h-14 w-full flex-col justify-center rounded-2xl border px-3 py-2 text-left disabled:opacity-60", on ? "border-accent bg-accent-softer" : "border-border-soft hover:border-accent/50 hover:bg-accent-softer")}
                >
                  <span className={cn("text-[17px] leading-tight text-ink", KIND_FACE[writingStyleOf(k.type)])}>{busy === k.type ? "…" : k.label}</span>
                  <span className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-subtle">{artifactType(k.type).description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
