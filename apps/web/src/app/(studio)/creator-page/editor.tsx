"use client";
import { PAGE_SECTION_LABEL, type PageSection } from "@wonder/creator-studio/publish";
import { Button, Input, Switch, Textarea, cn } from "@wonder/ui";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

interface PageState {
  isPublished: boolean;
  headline: string | null;
  intro: string | null;
  sections: Array<{ section: PageSection; enabled: boolean }>;
  publicDejaVuIds: string[];
  publicMomentIds: string[];
  links: Array<{ label: string; url: string }>;
}
interface Work {
  artifactId: string;
  slug: string;
  visibility: string;
  featured: boolean;
  live: boolean;
  title: string;
}

/**
 * The Creator Page editor (docs/creator-publish.md §16): turn sections on and off, put them in order, choose what's
 * featured, which DejaVus and Moments are public, and a few links. Not a website builder — Wonder Creator handles the
 * layout. Nothing appears on the page unless it's chosen here.
 */
export function CreatorPageEditor({ handle, initial, works, dejavus, moments }: { handle: string | null; initial: PageState; works: Work[]; dejavus: Array<{ id: string; name: string; count: number }>; moments: Array<{ id: string; body: string; createdAt: string }> }) {
  const [p, setP] = useState(initial);
  const [featured, setFeatured] = useState(() => new Set(works.filter((w) => w.featured).map((w) => w.artifactId)));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<PageState>) => {
    setSaved(false);
    setP((x) => ({ ...x, ...patch }));
  };
  const move = (i: number, d: -1 | 1) => {
    const s = [...p.sections];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j]!, s[i]!];
    change({ sections: s });
  };
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ page: PageState }>("/api/v1/creator-page", { method: "PATCH", json: { ...p, links: p.links.filter((l) => l.label.trim() && l.url.trim()) } });
      setP(r.page);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function feature(w: Work) {
    const on = !featured.has(w.artifactId);
    setFeatured((s) => {
      const n = new Set(s);
      if (on) n.add(w.artifactId);
      else n.delete(w.artifactId);
      return n;
    });
    try {
      await api(`/api/v1/artifacts/${w.artifactId}/publication`, { method: "PATCH", json: { featured: on } });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const publicWorks = works.filter((w) => w.live && w.visibility === "public");
  const h = (t: string, hint?: string) => (
    <div className="mb-1.5">
      <h2 className="text-[15px] font-semibold text-ink">{t}</h2>
      {hint ? <p className="text-[12.5px] text-ink-subtle">{hint}</p> : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-7 pb-10">
      <header>
        <h1 className="font-display text-[24px] leading-tight text-ink">Your Creator Page</h1>
        <p className="text-[13.5px] text-ink-muted">Your public home. Only what you choose here is shown — never your whole Profile.</p>
      </header>

      <section aria-label="Page" className="rounded-2xl border border-border-soft bg-surface px-3">
        <label className="flex min-h-12 items-center justify-between gap-3 text-[14.5px] text-ink">
          <span>
            Page is public
            {handle ? <span className="block text-[12.5px] text-ink-subtle">/p/{handle}</span> : null}
          </span>
          <Switch checked={p.isPublished} onCheckedChange={(v) => change({ isPublished: v })} label="Page is public" />
        </label>
        {p.isPublished && handle ? (
          <Link href={`/p/${handle}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 pb-1 text-[13px] font-medium text-accent-ink hover:underline">
            See your page <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </section>

      <section aria-label="Introduction" className="space-y-2">
        {h("Introduction")}
        <Input aria-label="Headline" placeholder="Writer · Photographer · Dreamer" value={p.headline ?? ""} maxLength={120} onChange={(e) => change({ headline: e.target.value })} />
        <Textarea aria-label="A few words about you" placeholder="Stories about places, people and the quiet in between." value={p.intro ?? ""} maxLength={1200} rows={3} onChange={(e) => change({ intro: e.target.value })} />
      </section>

      <section aria-label="Sections">
        {h("Sections", "On or off, in the order they appear.")}
        <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
          {p.sections.map((s, i) => (
            <li key={s.section} className="flex min-h-12 items-center gap-1 pl-3 pr-1">
              <span className={cn("flex-1 text-[14px]", s.enabled ? "text-ink" : "text-ink-subtle")}>{PAGE_SECTION_LABEL[s.section]}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${PAGE_SECTION_LABEL[s.section]} up`} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5 disabled:opacity-30">
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === p.sections.length - 1} aria-label={`Move ${PAGE_SECTION_LABEL[s.section]} down`} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5 disabled:opacity-30">
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <Switch checked={s.enabled} onCheckedChange={(v) => change({ sections: p.sections.map((x, k) => (k === i ? { ...x, enabled: v } : x)) })} label={`Show ${PAGE_SECTION_LABEL[s.section]}`} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Featured">
        {h("Featured", "Star up to four of your public works.")}
        {publicWorks.length ? (
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {publicWorks.map((w) => (
              <li key={w.artifactId} className="flex min-h-12 items-center gap-2 pl-3 pr-1">
                <Link href={`/p/${handle}/${w.slug}`} target="_blank" className="min-w-0 flex-1 truncate text-[14px] text-ink hover:underline">
                  {w.title}
                </Link>
                <button
                  type="button"
                  aria-pressed={featured.has(w.artifactId)}
                  aria-label={`Feature ${w.title}`}
                  disabled={!featured.has(w.artifactId) && featured.size >= 4}
                  onClick={() => void feature(w)}
                  className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30"
                >
                  <Star className={cn("size-4", featured.has(w.artifactId) ? "fill-current text-accent" : "text-ink-subtle")} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-ink-muted">Nothing is published publicly yet. Open a Creation and choose Publish.</p>
        )}
      </section>

      <section aria-label="Public DejaVus">
        {h("DejaVu", "A DejaVu page shows only your public works and the Moments you pick below — never private ones.")}
        {dejavus.length ? (
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {dejavus.map((d) => (
              <li key={d.id}>
                <label className="flex min-h-12 items-center justify-between gap-3 px-3 text-[14px] text-ink">
                  {d.name}
                  <Switch checked={p.publicDejaVuIds.includes(d.id)} onCheckedChange={() => change({ publicDejaVuIds: toggleIn(p.publicDejaVuIds, d.id) })} label={`Show ${d.name}`} />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-ink-muted">No DejaVus yet.</p>
        )}
      </section>

      <section aria-label="Public Moments">
        {h("Moments", "Glimpses between bigger works: public Scrapbook entries you choose.")}
        {moments.length ? (
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {moments.map((m) => (
              <li key={m.id}>
                <label className="flex min-h-12 items-center justify-between gap-3 px-3 py-1 text-[14px] text-ink">
                  <span className="line-clamp-2 min-w-0 flex-1">{m.body}</span>
                  <Switch checked={p.publicMomentIds.includes(m.id)} onCheckedChange={() => change({ publicMomentIds: toggleIn(p.publicMomentIds, m.id) })} label="Show this Moment" />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-ink-muted">No public Scrapbook entries yet.</p>
        )}
      </section>

      <section aria-label="Links" className="space-y-2">
        {h("Links")}
        {p.links.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label="Link label" placeholder="Portfolio" value={l.label} onChange={(e) => change({ links: p.links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} className="w-36" />
            <Input aria-label="Link address" placeholder="https://" value={l.url} onChange={(e) => change({ links: p.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} className="min-w-0 flex-1" />
            <button type="button" aria-label="Remove link" onClick={() => change({ links: p.links.filter((_, k) => k !== i) })} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {p.links.length < 8 ? (
          <button type="button" onClick={() => change({ links: [...p.links, { label: "", url: "https://" }] })} className="inline-flex min-h-11 items-center gap-1 text-[13.5px] font-medium text-accent-ink">
            <Plus className="size-4" aria-hidden /> Add a link
          </button>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <p role="status" className="text-[13px] text-success">
            Saved.
          </p>
        ) : null}
        <Button loading={busy} onClick={save}>
          Save page
        </Button>
      </div>
    </div>
  );
}
