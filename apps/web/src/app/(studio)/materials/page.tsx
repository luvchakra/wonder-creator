import { collectionCards, listMaterials, MATERIAL_FILTERS, materialCounts, signedUrlsFor, type MaterialFilter } from "@wonder/creator-library";
import { listArtifacts } from "@wonder/creator-studio";
import { BACKGROUNDS, Badge, EmptyState, PageTitle, buttonClasses, cn, KIT, chipBase } from "@wonder/ui";
import { Layers, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { ArtifactCard, MaterialCard, MaterialWallCard } from "@/components/cards";
import { coverUrls } from "@/lib/covers";
import { requireSession } from "@/lib/session";
import { NewCollectionButton } from "./collections/new-collection";
import { SpaceSearch } from "./space-controls";
import { PaletteScope } from "@/components/creative-palette";
import { HoldToDelete } from "@/components/hold-to-delete";

export const metadata = { title: "Creative Space" };

const TABS = [
  { key: "all", label: "All" },
  { key: "ideas", label: "Ideas & Material" },
  { key: "progress", label: "In Progress" },
  { key: "created", label: "Created" },
  { key: "shared", label: "Shared" },
  { key: "collections", label: "Collections" },
] as const;

const NOUN: Record<MaterialFilter, [string, string]> = {
  all: ["material", "materials"],
  ideas: ["idea", "ideas"],
  notes: ["note", "notes"],
  images: ["photo", "photos"],
  audio: ["sound", "sounds"],
  video: ["video", "videos"],
  documents: ["document", "documents"],
  links: ["link", "links"],
  archived: ["archived", "archived"],
};
const MATERIAL_LABEL: Record<MaterialFilter, string> = { all: "All", ideas: "Ideas", notes: "Notes", images: "Photos", audio: "Audio", video: "Video", documents: "Documents", links: "Links", archived: "Archived" };

export default async function SpacePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string; archived?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "all") as (typeof TABS)[number]["key"];
  const q = sp.q?.slice(0, 200) ?? "";
  const mFilter = ((MATERIAL_FILTERS as readonly string[]).includes(sp.type ?? "") ? sp.type : "all") as MaterialFilter;

  const wantMaterials = tab === "all" || tab === "ideas";
  const wantArtifacts = tab !== "ideas" && tab !== "collections";
  const showArchived = sp.archived === "1";
  const [materials, counts, artifacts] = await Promise.all([
    wantMaterials ? listMaterials(db, { filter: tab === "ideas" ? mFilter : "all", q, limit: tab === "all" ? 24 : 120 }) : Promise.resolve([]),
    tab === "ideas" ? materialCounts(db) : Promise.resolve(null),
    wantArtifacts
      ? listArtifacts(db, { creatorId: creator.id, q, status: tab === "progress" ? ["draft", "in_review"] : tab === "created" ? ["final", "published"] : ["draft", "in_review", "final", "published"], limit: 60 })
      : Promise.resolve([]),
  ]);
  const allCollections = tab === "collections" ? await collectionCards(db, { includeArchived: showArchived }) : [];
  const collections = q ? allCollections.filter((c) => `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) : allCollections;
  const collectionCovers = await signedUrlsFor(db, collections.map((c) => c.coverObjectId));
  const shownArtifacts = tab === "shared" ? artifacts.filter((a) => a.privacy !== "creator_private") : artifacts;
  const [previews, covers] = await Promise.all([signedUrlsFor(db, materials.map((m) => m.storage_object_id)), coverUrls(db, shownArtifacts)]);

  const items = [
    // Press and hold a card to delete it (owner, 4 Oct 2026); a tap still opens it.
    ...shownArtifacts.map((a) => ({
      key: `a${a.id}`,
      at: a.updated_at,
      node: (
        <HoldToDelete kind="creation" id={a.id} title={a.title}>
          <ArtifactCard a={{ ...a, coverUrl: covers[a.id] ?? null }} />
        </HoldToDelete>
      ),
    })),
    ...materials.map((m) => ({
      key: `m${m.id}`,
      at: m.created_at,
      node: (
        <HoldToDelete kind="material" id={m.id} title={m.title ?? ""}>
          <MaterialCard m={{ ...m, previewUrl: m.storage_object_id ? previews[m.storage_object_id] : null }} />
        </HoldToDelete>
      ),
    })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), ...(q ? { q } : {}), ...(sp.type ? { type: sp.type } : {}), ...patch } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/materials${s ? `?${s}` : ""}`;
  };

  // The Materials wall (UI redesign §9): the creator's visual memory, not a file list.
  if (tab === "ideas") {
    return (
      <div>
        <PaletteScope context={{ page: "materials", strip: counts && !q ? { count: [counts[mFilter], ...NOUN[mFilter]] } : undefined }} />
        <PageTitle art={KIT.painted.lavenderSprig} title="Materials" subtitle="Your visual memory — photos, notes, sounds, links and ideas." action={<SpaceSearch initial={q} />} />
        {counts ? (
          <nav aria-label="Material type" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {MATERIAL_FILTERS.map((f) => (
              <Link
                key={f}
                href={href({ type: f === "all" ? undefined : f })}
                aria-current={f === mFilter ? "true" : undefined}
                className={cn(chipBase, "gap-1.5 border", f === mFilter ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-muted hover:border-[#cfd0ff]")}
              >
                {MATERIAL_LABEL[f]} <span className="text-xs opacity-75">{counts[f]}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        {materials.length ? (
          <ul aria-label="Materials" className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-4 [&>li]:break-inside-avoid">
            <li>
              <Link href="/send" className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface/60 text-[13px] text-ink-muted hover:border-accent hover:text-accent-ink">
                <Plus className="size-5" aria-hidden /> Bring Material
              </Link>
            </li>
            {materials.map((m) => (
              <li key={m.id}>
                <HoldToDelete kind="material" id={m.id} title={m.title ?? ""}>
                  <MaterialWallCard m={{ ...m, previewUrl: m.storage_object_id ? previews[m.storage_object_id] : null }} />
                </HoldToDelete>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            image={BACKGROUNDS.studioDesk}
            title={q ? `Nothing matches “${q}”` : "No Materials yet"}
            body={q ? "Try another word, or clear the search." : "Photographs, notes, voice memos, links — whatever inspires you. Bring something in and it will live here."}
            action={
              <Link href="/send" className={buttonClasses({})}>
                Bring Material
              </Link>
            }
          />
        )}
      </div>
    );
  }

  return (
    <>
      <PaletteScope context={{ page: "spaces", facts: { activeCreationId: shownArtifacts.find((a) => a.status === "draft" || a.status === "in_review")?.id ?? null } }} />
      <div>
        <PageTitle
          art={KIT.painted.flowerBranch}
          title="My Creative Space"
          subtitle="Ideas, materials and creations — all in one place."
        />
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Filter" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={href({ tab: t.key === "all" ? undefined : t.key, type: undefined })}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm", t.key === tab ? "bg-accent font-medium text-white" : "text-ink-muted hover:bg-black/[0.04]")}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <SpaceSearch initial={q} />
        </div>
        {tab === "shared" ? (
          // What others shared with you has its own page; its title is the link (Fewer buttons, owner 4 Oct 2026).
          <Link href="/shared" className="mb-4 inline-flex min-h-11 items-center gap-1 font-display text-[17px] text-ink hover:underline">
            Shared with you <span aria-hidden>›</span>
          </Link>
        ) : null}
        {tab === "collections" ? (
          <section aria-label="Collections">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Link href={href({ archived: showArchived ? undefined : "1" })} className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
                {showArchived ? "Hide archived collections" : "Show archived collections"}
              </Link>
              <NewCollectionButton existing={allCollections.map((c) => c.name)} />
            </div>
            {collections.length ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {collections.map((c) => (
                  <li key={c.id}>
                    <Link href={`/materials/collections/${c.id}`} className="group block rounded-2xl focus-visible:outline-2">
                      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)] transition-shadow group-hover:shadow-[var(--shadow-lift)]">
                        {c.coverObjectId && collectionCovers[c.coverObjectId] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={collectionCovers[c.coverObjectId]} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-accent-softer text-accent-ink">
                            <Layers className="size-8" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="mt-2 px-0.5">
                        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{c.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                          {c.count} item{c.count === 1 ? "" : "s"} · <Lock className="size-3" aria-hidden /> Private
                          {c.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                image={BACKGROUNDS.studioDesk}
                title={q ? `No collection matches “${q}”` : "No collections yet"}
                body={q ? "Try another word, or clear the search." : "Collections group material without moving it — film references, a visual style, locations, people. One piece can live in several."}
              />
            )}
          </section>
        ) : items.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((i) => (
              <li key={i.key}>{i.node}</li>
            ))}
          </ul>
        ) : (
          <EmptyState
            image={BACKGROUNDS.studioDesk}
            title={q ? `Nothing matches “${q}”` : tab === "shared" ? "Nothing shared yet" : "Nothing here yet"}
            body={q ? "Try another word, or clear the search." : tab === "shared" ? "Share a Creation with someone and it will show here." : "Bring an idea, photograph, note or voice memo. Everything you bring and make will live here."}
            action={
              tab === "shared" ? undefined : (
                <Link href="/send" className={buttonClasses({})}>
                  Bring something
                </Link>
              )
            }
          />
        )}
      </div>
    </>
  );
}
