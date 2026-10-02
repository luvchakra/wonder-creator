import { signedUrlsFor } from "@wonder/creator-library";
import { artifactType } from "@wonder/creator-studio/types";
import { BACKGROUNDS, EmptyState, Input, LiveBadge, PageTitle, buttonClasses, cn, KIT, chipBase } from "@wonder/ui";
import { BookMarked, Layers, MessageCircle, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { MaterialCard } from "@/components/cards";
import { EMPTY_RESULTS, isSearchable, MATERIAL_KINDS, parseSearch, SEARCH_WHEN, topTags, unifiedSearch, type SearchTab, type SearchWhen } from "@/lib/search";
import { requireSession } from "@/lib/session";
import { PaletteScope } from "@/components/creative-palette";
import { ExploreNav } from "@/components/explore-nav";

export const metadata = { title: "Search" };

const TAB_LABEL: Record<SearchTab, string> = {
  all: "All",
  material: "Material",
  creations: "Creations",
  collections: "Collections",
  references: "References",
  conversations: "Conversations",
  creators: "Creators",
  huddles: "Huddles",
};
const WHEN_LABEL: Record<SearchWhen, string> = { any: "Any time", day: "Past day", week: "Past week", month: "Past month", year: "Past year" };
const KIND_LABEL: Record<string, string> = { images: "Images", audio: "Audio", video: "Video", documents: "Documents", notes: "Notes", links: "Links" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const s = parseSearch({ get: (k) => sp[k] ?? null });
  const searchable = isSearchable(s);
  const [res, tags] = await Promise.all([searchable ? unifiedSearch(db, creator.id, s) : Promise.resolve(EMPTY_RESULTS), topTags(db, creator.id)]);
  const previews = await signedUrlsFor(db, res.materials.map((m) => m.storage_object_id));
  const total = Object.values(res).reduce((n, list) => n + list.length, 0);
  const materialFilters = s.tab === "all" || s.tab === "material" || s.tab === "references";

  /** Same search with some filters changed; everything else carries over. */
  const href = (patch: Partial<Record<"q" | "type" | "when" | "kind" | "tag", string | null>>) => {
    const next: Record<string, string | null> = { q: s.q || null, type: s.tab === "all" ? null : s.tab, when: s.when === "any" ? null : s.when, kind: s.kind, tag: s.tag, ...patch };
    const p = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    return `/explore${p.size ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn(chipBase, "gap-1.5 border", active ? "border-accent bg-accent-soft text-accent-ink" : "border-border text-ink-muted hover:border-[#cfd0ff]");
  const askIds = res.materials.filter((m) => !m.related).slice(0, 12).map((m) => m.id);

  return (
    <>
      <PaletteScope context={{ page: "search", strip: searchable ? { count: [total, "result", "results"] } : undefined }} />
      <div>
        <ExploreNav current={s.tab === "material" ? "materials" : "ideas"} />
        <PageTitle art={KIT.painted.blossomSprig} title="Search" subtitle="Your material, creations, collections and conversations — and creators and Huddles you can see." />

        <form action="/explore" role="search" className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <label htmlFor="search-q" className="sr-only">
            Search
          </label>
          <Input id="search-q" name="q" type="search" defaultValue={s.q} placeholder="Search your creative world…" className="pl-10" autoFocus={!s.q} />
          {s.tab !== "all" ? <input type="hidden" name="type" value={s.tab} /> : null}
          {s.when !== "any" ? <input type="hidden" name="when" value={s.when} /> : null}
          {s.kind ? <input type="hidden" name="kind" value={s.kind} /> : null}
          {s.tag ? <input type="hidden" name="tag" value={s.tag} /> : null}
        </form>

        <nav aria-label="Search in" className="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {(Object.keys(TAB_LABEL) as SearchTab[]).map((t) => (
            <Link
              key={t}
              href={href({ type: t === "all" ? null : t })}
              aria-current={t === s.tab ? "page" : undefined}
              className={cn(chipBase, t === s.tab ? "bg-accent font-medium text-white" : "text-ink-muted hover:bg-black/[0.04]")}
            >
              {TAB_LABEL[t]}
            </Link>
          ))}
        </nav>

        {s.tab === "creators" ? (
          <p className="mt-3 text-sm text-ink-muted">
            Looking for someone to work with?{" "}
            <Link href="/people" className="font-medium text-accent-ink hover:underline">
              Find collaborators by discipline, skills and who you know
            </Link>
          </p>
        ) : null}

        <div className="mt-3 space-y-2">
          <nav aria-label="When" className="flex flex-wrap gap-2">
            {(Object.keys(SEARCH_WHEN) as SearchWhen[]).map((w) => (
              <Link key={w} href={href({ when: w === "any" ? null : w })} aria-current={w === s.when ? "true" : undefined} className={chip(w === s.when)}>
                {WHEN_LABEL[w]}
              </Link>
            ))}
          </nav>
          {materialFilters ? (
            <nav aria-label="Kind of material" className="flex flex-wrap gap-2">
              {Object.keys(MATERIAL_KINDS).map((k) => (
                <Link key={k} href={href({ kind: s.kind === k ? null : k })} aria-current={s.kind === k ? "true" : undefined} className={chip(s.kind === k)}>
                  {KIND_LABEL[k]}
                </Link>
              ))}
            </nav>
          ) : null}
          {materialFilters && tags.length ? (
            <nav aria-label="Tags" className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Link key={t} href={href({ tag: s.tag === t ? null : t })} aria-current={s.tag === t ? "true" : undefined} className={chip(s.tag === t)}>
                  #{t}
                </Link>
              ))}
            </nav>
          ) : null}
          {s.kind || s.tag ? <p className="text-sm text-ink-subtle">Kind and tag filters narrow the search to your material and references.</p> : null}
        </div>

        <div className="mt-6">
          {!searchable ? (
            <EmptyState image={BACKGROUNDS.studioDesk} title="Search your creative world" body="Type at least two letters, or pick a tag. Only what you're allowed to see ever shows up here." />
          ) : total === 0 ? (
            <EmptyState
              image={BACKGROUNDS.studioDesk}
              title={s.q ? `Nothing found for “${s.q}”` : "Nothing found"}
              body="Try another word, a wider time range, or fewer filters."
              action={
                <Link href={href({ when: null, kind: null, tag: null, type: null })} className={buttonClasses({ variant: "secondary" })}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <div className="space-y-8">
              {res.materials.length ? (
                <section aria-labelledby="r-material">
                  <GroupHeader id="r-material" title="Your material" more={s.tab === "all" ? href({ type: "material" }) : null}>
                    {askIds.length ? (
                      <Link
                        href={`/create?materials=${askIds.join(",")}&prompt=${encodeURIComponent(s.q ? `What connects these pieces about “${s.q.slice(0, 60)}”?` : "What connects these pieces?")}`}
                        prefetch={false}
                        className={buttonClasses({ variant: "soft", size: "sm" })}
                      >
                        <MessageCircle className="size-4" aria-hidden /> Ask CreativeMind about these
                      </Link>
                    ) : null}
                  </GroupHeader>
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {res.materials.map((m) => (
                      <li key={m.id}>
                        <MaterialCard m={{ ...m, previewUrl: m.storage_object_id ? (previews[m.storage_object_id] ?? null) : null }} />
                        {m.related ? <p className="mt-0.5 px-0.5 text-xs text-accent-ink">Related in meaning</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <ResultList
                id="r-creations"
                title="Creations"
                more={s.tab === "all" ? href({ type: "creations" }) : null}
                items={res.artifacts.map((a) => ({
                  key: a.id,
                  href: `/creations/${a.id}`,
                  label: a.title,
                  sub: [artifactType(a.artifact_type).label, a.creator_id === creator.id ? "Yours" : "By another creator", a.related ? "Related in meaning" : null].filter(Boolean).join(" · "),
                  icon: <Sparkles className="size-4" aria-hidden />,
                }))}
              />
              <ResultList
                id="r-collections"
                title="Collections"
                more={s.tab === "all" ? href({ type: "collections" }) : null}
                items={res.collections.map((c) => ({ key: c.id, href: `/materials/collections/${c.id}`, label: c.name, sub: c.description ?? "Collection", icon: <Layers className="size-4" aria-hidden /> }))}
              />
              <ResultList
                id="r-references"
                title="References"
                more={s.tab === "all" ? href({ type: "references" }) : null}
                items={res.references.map((r) => ({ key: r.id, href: `/materials/${r.materialId}`, label: r.title || "Untitled reference", sub: [r.shelf ? `On ${r.shelf}` : "Reference Shelf", r.note].filter(Boolean).join(" · "), icon: <BookMarked className="size-4" aria-hidden /> }))}
              />
              <ResultList
                id="r-conversations"
                title="Conversations"
                more={s.tab === "all" ? href({ type: "conversations" }) : null}
                items={res.conversations.map((c) => ({ key: c.id, href: `/create?c=${c.conversationId}`, label: c.title, sub: c.snippet, icon: <MessageCircle className="size-4" aria-hidden /> }))}
              />
              <ResultList
                id="r-creators"
                title="Creators"
                more={s.tab === "all" ? href({ type: "creators" }) : null}
                items={res.creators.map((c) => ({ key: c.id, href: `/creators/${c.handle}`, label: c.display_name, sub: `@${c.handle}`, icon: <UserRound className="size-4" aria-hidden /> }))}
              />
              <ResultList
                id="r-huddles"
                title="Live Huddles"
                more={null}
                items={res.huddles.map((h) => ({ key: h.huddleId, href: `/huddles/${h.huddleId}`, label: h.topic || h.participantNames.join(" · "), sub: h.participantNames.join(", "), icon: <LiveBadge /> }))}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function GroupHeader({ id, title, more, children }: { id: string; title: string; more: string | null; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {more ? (
          <Link href={more} className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
            See all
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ResultList({ id, title, more, items }: { id: string; title: string; more: string | null; items: Array<{ key: string; href: string; label: string; sub?: string; icon: React.ReactNode }> }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id}>
      <GroupHeader id={id} title={title} more={more} />
      <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-muted">
              <span className="shrink-0 text-ink-subtle">{i.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] text-ink">{i.label}</span>
                {i.sub ? <span className="block truncate text-sm text-ink-subtle">{i.sub}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

