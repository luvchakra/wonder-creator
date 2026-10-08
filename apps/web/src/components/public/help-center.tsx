"use client";
import { KIT, KitArt, buttonClasses, cn } from "@wonder/ui";
import { ArrowRight, ChevronDown, Compass, LifeBuoy, Mail, PenLine, Scale, Search, Send, ShieldCheck, Sparkles, Users, Wand2, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type HelpSection, type HelpTopic } from "@/lib/help/content";
import { searchHelp } from "@/lib/help/search";

/**
 * The Help page (docs/help.md): a search box, the sections as chips, and every topic as a closed card that opens in
 * place. It renders in full on the server, so the words are there without scripts; the browser adds search, and opens
 * the topic a link such as /help#own-key points at. Motion is one chevron turning, and nothing at all when the
 * visitor has asked for reduced motion.
 */

const SECTION_ICON: Record<string, LucideIcon> = {
  "getting-started": Compass,
  capturing: PenLine,
  creating: Wand2,
  ai: Sparkles,
  publishing: Send,
  together: Users,
  rights: Scale,
  privacy: ShieldCheck,
  troubleshooting: LifeBuoy,
  contact: Mail,
};

const card = "rounded-[1.4rem] border border-white/80 bg-white/75 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm";

export function HelpCenter({ sections }: { sections: HelpSection[] }) {
  const [query, setQuery] = useState("");
  /** What the visitor chose to open or close; a topic they haven't touched follows the search. */
  const [chosen, setChosen] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  const bySlug = useMemo(() => new Map(sections.flatMap((s) => s.topics.map((t) => [t.slug, { topic: t, section: s }] as const))), [sections]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchHelp(query, sections).map((h) => bySlug.get(h.slug)!) : []), [searching, query, sections, bySlug]);

  // A link to a topic (/help#own-key) opens it. Sections are plain anchors and need nothing.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && bySlug.has(id)) setChosen((c) => new Map(c).set(id, true));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [bySlug]);

  const isOpen = (slug: string) => chosen.get(slug) ?? (searching && results.length <= 3);
  const toggle = (slug: string, open: boolean) => setChosen((c) => (c.get(slug) === open ? c : new Map(c).set(slug, open)));

  const status = !searching ? "" : results.length ? `${results.length} ${results.length === 1 ? "topic matches" : "topics match"} “${query.trim()}”.` : `No topic matches “${query.trim()}”.`;

  return (
    <>
      <section aria-labelledby="help-title" className="relative">
        <KitArt art={KIT.wash.washLavender} priority className="pointer-events-none absolute -right-28 -top-16 -z-10 w-[28rem] max-w-none opacity-60" />
        <KitArt art={KIT.painted.lavenderSprig} sizes="10rem" className="pointer-events-none absolute -right-20 -top-4 -z-10 hidden w-24 opacity-90 lg:block" />
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink">Help</p>
        <h1 id="help-title" className="mt-4 font-display text-[42px] leading-[1.04] tracking-[-0.02em] [text-wrap:balance] sm:text-[56px]">
          A little <em className="text-brand-gradient pr-1 italic">help</em> along the way.
        </h1>
        <p className="mt-4 max-w-[34rem] text-[17px] leading-relaxed text-ink-muted">Short guides to what’s in Wonder Creator, and what to try when something isn’t working.</p>

        <form role="search" aria-label="Help" onSubmit={(e) => e.preventDefault()} className="mt-7 max-w-xl">
          <label htmlFor="help-search" className="sr-only">
            Search help
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" />
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setChosen(new Map());
              }}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search — try “voice note”"
              className="h-12 w-full rounded-full border border-border-soft bg-white/90 pl-11 pr-12 text-[15px] text-ink shadow-[0_10px_30px_-22px_rgb(76_60_120/0.5)] placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden"
            />
            {searching ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setChosen(new Map());
                  document.getElementById("help-search")?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </form>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-ink-muted">
          {status}
        </p>
      </section>

      {searching ? (
        <section aria-label="Search results" className="mt-6">
          {results.length ? (
            <ul className="space-y-3">
              {results.map(({ topic, section }) => (
                <li key={topic.slug}>
                  <TopicCard topic={topic} kicker={section.title} open={isOpen(topic.slug)} onToggle={(o) => toggle(topic.slug, o)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className={cn(card, "p-6 text-[15px] leading-relaxed text-ink-muted")}>
              <p className="font-display text-[22px] text-ink">Nothing matches that yet.</p>
              <p className="mt-1">Try a simpler word, or clear the search to browse every section. If it’s something we haven’t covered, tell us below.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          <nav aria-label="Help sections" className="mt-4">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {sections.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a href={`#${s.id}`} className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-accent">
                    <span className="inline-flex h-9 items-center rounded-full border border-white bg-white/80 px-3.5 text-[13.5px] font-medium text-ink shadow-sm hover:bg-white">{s.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-8 space-y-14">
            {sections.map((s) => {
              const Icon = SECTION_ICON[s.id] ?? Compass;
              return (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-6">
                  <div className="flex items-center gap-4">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 id={`${s.id}-title`} className="font-display text-[28px] leading-tight text-ink sm:text-[34px]">
                        {s.title}
                      </h2>
                      <p className="text-[15px] leading-snug text-ink-muted">{s.blurb}</p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {s.topics.map((t) => (
                      <li key={t.slug}>
                        <TopicCard topic={t} open={isOpen(t.slug)} onToggle={(o) => toggle(t.slug, o)} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      <section aria-labelledby="still-stuck" className={cn(card, "mt-14 p-6 sm:p-8")}>
        <h2 id="still-stuck" className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">
          Still need a hand?
        </h2>
        <p className="mt-2 max-w-[34rem] text-[15px] leading-relaxed text-ink-muted">Tell us what you were doing, what you expected and what you saw. We’ll reply to the email you give.</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/contact" className={cn(buttonClasses({ size: "lg" }), "px-6")}>
            Send us a message <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/legal/privacy" className="inline-flex min-h-11 items-center text-[15px] font-medium text-ink-muted hover:text-ink hover:underline">
            Privacy notice
          </Link>
          <Link href="/legal/security" className="inline-flex min-h-11 items-center text-[15px] font-medium text-ink-muted hover:text-ink hover:underline">
            Security
          </Link>
        </div>
      </section>
    </>
  );
}

/** One topic: closed to its title and one line, open to the steps. A native disclosure, so it works from the keyboard and without scripts. */
function TopicCard({ topic, kicker, open, onToggle }: { topic: HelpTopic; kicker?: string; open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <details id={topic.slug} open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className={cn(card, "group scroll-mt-6")}>
      <summary className="flex min-h-14 cursor-pointer list-none items-start gap-3 rounded-[1.4rem] px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-accent sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          {kicker ? <span className="block text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{kicker}</span> : null}
          <h3 className="font-display text-[19px] leading-snug text-ink sm:text-[21px]">{topic.title}</h3>
          <span className="mt-0.5 block text-[14px] leading-snug text-ink-muted">{topic.summary}</span>
        </span>
        <ChevronDown aria-hidden className="mt-1 size-5 shrink-0 text-ink-subtle motion-safe:transition-transform motion-safe:duration-150 group-open:rotate-180" />
      </summary>
      <div className="border-t border-border-soft/70 px-4 pb-5 pt-4 text-[15px] leading-relaxed text-ink-muted sm:px-5">
        {topic.body?.map((p) => (
          <p key={p} className="mb-3 last:mb-0">
            {p}
          </p>
        ))}
        {topic.steps?.length ? (
          <ol role="list" className="space-y-3">
            {topic.steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold tabular-nums text-accent-ink">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{s}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {topic.terms?.length ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {topic.terms.map((t) => (
              <div key={t.term}>
                <dt className="font-medium text-ink">{t.term}</dt>
                <dd>{t.text}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {topic.notes?.length ? (
          <div className="mt-4 rounded-2xl bg-surface-muted/70 px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Good to know</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-[14px]">
              {topic.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {topic.links?.length ? (
          <ul aria-label="Related pages" className="mt-3 flex flex-wrap gap-x-4">
            {topic.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center gap-1 font-medium text-accent-ink underline-offset-4 hover:underline">
                  {l.label} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
