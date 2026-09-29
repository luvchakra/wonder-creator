"use client";
import {
  EXPERIENCE_LABEL,
  TREATMENTS,
  VISIBILITY_LABEL,
  type PublicationExperience,
  type PublicationManifest,
  type PublicationVisibility,
  type PublishSettings,
} from "@wonder/creator-studio/publish";
import { Button, Dialog, DialogContent, Input, KIT, Menu, MenuContent, MenuItem, MenuTrigger, Switch, cn } from "@wonder/ui";
import { Check, Copy, ExternalLink, Globe, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";

interface Publication {
  workId: string;
  slug: string;
  visibility: PublicationVisibility;
  featured: boolean;
  settings: PublishSettings;
  unpublished: boolean;
  revision: { number: number; publishedAt: string; versionNumber: number | null; manifest: PublicationManifest } | null;
  newerVersions: number;
}
interface State {
  publication: Publication | null;
  suggestedSlug: string;
  experiences: PublicationExperience[];
  preview: PublicationManifest;
  covers: Array<{ objectId: string; url: string }>;
  handle: string | null;
  stats: { views: number; completions: number; shares: number } | null;
}

/**
 * CreatorPublish inside a Creation (docs/creator-publish.md §23, §26–27): publish into the creator's own space, then
 * share the link anywhere. Shows where it lives, whether the working Creation has moved on since ("Changes since
 * publishing"), and a quiet week of numbers for the creator only. Web design details are never asked for: the
 * experience is inferred, with two or three treatments to choose from.
 */
export function PublishOnPage({ artifactId, title }: { artifactId: string; title: string }) {
  const [s, setS] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");
  const load = useCallback(async () => {
    try {
      setS(await api<State>(`/api/v1/artifacts/${artifactId}/publication`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [artifactId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  if (!s) return <section aria-label="On your page" className="h-24 rounded-2xl bg-surface-muted/60 motion-safe:animate-pulse" />;
  const p = s.publication;
  const live = p && !p.unpublished && p.revision;
  const path = p && s.handle ? `/p/${s.handle}/${p.slug}` : null;
  const url = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <section aria-label="On your page" className="rounded-2xl border border-border-soft bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <Globe className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">On your page</h2>
          {live ? (
            <>
              <p className="text-[13px] text-ink-muted">
                {VISIBILITY_LABEL[p.visibility]} · {EXPERIENCE_LABEL[p.revision!.manifest.experience]} · published version {p.revision!.number}
                {p.revision!.versionNumber ? ` (from v${p.revision!.versionNumber})` : ""}
              </p>
              {path ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
                  <a href={path} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1 font-medium text-accent-ink hover:underline">
                    {path} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(url ?? path).catch(() => undefined);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex min-h-11 items-center gap-1 text-ink-muted hover:text-ink"
                  >
                    {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy link"}
                  </button>
                </p>
              ) : null}
              {s.stats ? (
                <p className="text-[12.5px] text-ink-subtle">
                  This week · {s.stats.views} {s.stats.views === 1 ? "view" : "views"} · {s.stats.completions} finished · {s.stats.shares} shared
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">{p?.unpublished ? "Taken down. Publish again to bring it back at the same address." : "Publish into your own space, then share the link anywhere."}</p>
          )}
        </div>
        {live ? (
          <Menu>
            <MenuTrigger asChild>
              <button type="button" aria-label="More for the published version" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setOpen(true)}>Publish settings</MenuItem>
              <MenuItem destructive onSelect={() => void run("unpublish", () => api(`/api/v1/artifacts/${artifactId}/publication`, { method: "DELETE" }))}>
                Unpublish
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
      </div>

      {live && p.newerVersions > 0 ? (
        <div role="status" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-accent-softer/70 px-3 py-2 text-[13px] text-ink">
          <span className="flex-1">
            <span className="font-medium">Changes since publishing</span> · {p.newerVersions} newer {p.newerVersions === 1 ? "version" : "versions"}. Your page still shows the published one.
          </span>
          <Button size="sm" loading={busy === "update"} onClick={() => run("update", () => api(`/api/v1/artifacts/${artifactId}/publication`, { method: "POST", json: { visibility: p.visibility } }))}>
            Update published version
          </Button>
        </div>
      ) : null}

      {live && !p.settings.conversationId ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("conversation", () => api(`/api/v1/artifacts/${artifactId}/publication/conversation`, { method: "POST", json: { question } }).then(() => setQuestion("")));
          }}
        >
          <label htmlFor="pub-q" className="sr-only">
            Open a conversation about this
          </label>
          <Input id="pub-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Open a conversation: What does this bring back for you?" className="min-w-0 flex-1" maxLength={140} />
          <Button size="sm" variant="secondary" type="submit" disabled={question.trim().length < 3} loading={busy === "conversation"}>
            Open
          </Button>
        </form>
      ) : live && p.settings.conversationId ? (
        <p className="mt-1 text-[12.5px] text-ink-subtle">
          A conversation about this is open on the page.{" "}
          <button type="button" onClick={() => void run("unlink", () => api(`/api/v1/artifacts/${artifactId}/publication/conversation`, { method: "DELETE" }))} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
            Remove it from the page
          </button>
        </p>
      ) : null}

      {!live ? (
        <div className="mt-2">
          <Button onClick={() => setOpen(true)}>Publish…</Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={live ? "Publish settings" : `Publish ${title}`} description="Choose how this work appears. You can change it any time." art={KIT.painted.leafSprigSage} wide>
          {open ? (
            <PublishSheet
              state={s}
              onDone={async (body, update) => {
                await run("publish", () => api(`/api/v1/artifacts/${artifactId}/publication`, { method: update ? "PATCH" : "POST", json: body }));
                setOpen(false);
              }}
              busy={busy === "publish"}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PublishSheet({ state, onDone, busy }: { state: State; onDone: (body: Record<string, unknown>, updateOnly: boolean) => Promise<void>; busy: boolean }) {
  const p = state.publication;
  const live = !!(p && !p.unpublished && p.revision);
  const [visibility, setVisibility] = useState<PublicationVisibility>(p?.visibility ?? "public");
  const [slug, setSlug] = useState(p?.slug ?? state.suggestedSlug);
  const [featured, setFeatured] = useState(p?.featured ?? false);
  const [settings, setSettings] = useState<PublishSettings>(p?.settings ?? {});
  const experience = settings.experience ?? state.preview.experience;
  const treatments = TREATMENTS[experience === "read" && state.preview.poem ? "poem" : experience];
  const treatment = settings.treatment && treatments.some((t) => t.key === settings.treatment) ? settings.treatment : treatments[0]!.key;
  const set = (patch: PublishSettings) => setSettings((x) => ({ ...x, ...patch }));
  const cover = settings.coverObjectId ?? state.covers[0]?.objectId ?? null;
  const toggle = (label: string, on: boolean, change: (v: boolean) => void) => (
    <label className="flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink">
      {label}
      <Switch checked={on} onCheckedChange={change} label={label} />
    </label>
  );
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Visibility</legend>
        <div role="radiogroup" aria-label="Visibility" className="mt-1 space-y-0.5">
          {(Object.keys(VISIBILITY_LABEL) as PublicationVisibility[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className="flex min-h-11 w-full items-center gap-2.5 text-left text-[14px]">
              <span aria-hidden className={cn("inline-flex size-4 items-center justify-center rounded-full border", visibility === v ? "border-accent" : "border-border")}>
                {visibility === v ? <span className="size-2 rounded-full bg-accent" /> : null}
              </span>
              {VISIBILITY_LABEL[v]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="pub-slug" className="text-sm font-medium text-ink">
          Public address
        </label>
        <div className="flex items-center gap-1 rounded-xl border border-border-soft bg-surface pl-3 text-[14px]">
          <span className="shrink-0 text-ink-subtle">/p/{state.handle ?? "you"}/</span>
          <input id="pub-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 80))} className="h-11 min-w-0 flex-1 bg-transparent outline-none" />
        </div>
        {live && slug !== p?.slug ? <p className="text-[12.5px] text-warning-ink">Changing the address breaks links you&apos;ve already shared.</p> : null}
      </div>

      {state.covers.length > 1 ? (
        <div>
          <p className="text-sm font-medium text-ink">Cover</p>
          <div role="radiogroup" aria-label="Cover" className="mt-1 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {state.covers.map((c) => (
              <button key={c.objectId} type="button" role="radio" aria-checked={cover === c.objectId} aria-label="Use this cover" onClick={() => set({ coverObjectId: c.objectId })} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="" className={cn("size-16 rounded-lg object-cover", cover === c.objectId ? "ring-2 ring-accent ring-offset-2" : "opacity-80")} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state.experiences.length > 1 ? (
        <div>
          <p className="text-sm font-medium text-ink">Primary experience</p>
          <div role="radiogroup" aria-label="Primary experience" className="mt-1 flex flex-wrap gap-1.5">
            {state.experiences.map((e) => (
              <button key={e} type="button" role="radio" aria-checked={experience === e} onClick={() => set({ experience: e, treatment: undefined })} className="inline-flex min-h-11 items-center">
                <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium", experience === e ? "bg-accent text-white" : "bg-surface-muted text-ink-muted")}>{EXPERIENCE_LABEL[e]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ink-muted">Experience: {EXPERIENCE_LABEL[experience]}</p>
      )}
      <div>
        <p className="text-sm font-medium text-ink">Treatment</p>
        <div role="radiogroup" aria-label="Treatment" className="mt-1 flex flex-wrap gap-1.5">
          {treatments.map((t) => (
            <button key={t.key} type="button" role="radio" aria-checked={treatment === t.key} onClick={() => set({ treatment: t.key })} className="inline-flex min-h-11 items-center">
              <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px]", treatment === t.key ? "bg-accent-soft font-medium text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted")}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border-soft rounded-2xl border border-border-soft px-3">
        {toggle("Show the description", settings.show?.description !== false, (v) => set({ show: { ...settings.show, description: v } }))}
        {toggle("Show the transcript or lyrics", settings.show?.transcript !== false, (v) => set({ show: { ...settings.show, transcript: v } }))}
        {toggle("Feature it on my page", featured, setFeatured)}
      </div>
      <div className="divide-y divide-border-soft rounded-2xl border border-border-soft px-3">
        <p className="py-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">Rights &amp; attribution</p>
        {toggle("Allow sharing", settings.rights?.allowSharing !== false, (v) => set({ rights: { ...settings.rights, allowSharing: v } }))}
        {toggle("Require attribution", settings.rights?.requireAttribution !== false, (v) => set({ rights: { ...settings.rights, requireAttribution: v } }))}
        {toggle("Allow remixing, with credit", !!settings.rights?.allowRemix, (v) => set({ rights: { ...settings.rights, allowRemix: v } }))}
        <p className="py-2 text-[12px] text-ink-subtle">Remixing is offered only if your rights record for this Creation allows derivatives. Public doesn&apos;t mean free to reuse.</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {live ? (
          <Button variant="secondary" loading={busy} onClick={() => onDone({ visibility, slug, featured, settings: { ...settings, experience, treatment } }, true)}>
            Save settings
          </Button>
        ) : null}
        <Button loading={busy} onClick={() => onDone({ visibility, slug, featured, settings: { ...settings, experience, treatment } }, false)}>
          {live ? "Publish update" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
