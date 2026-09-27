import { collectionCards, listMaterials, MATERIAL_FILTERS, materialCounts, signedUrlsFor, type MaterialFilter } from "@wonder/creator-library";
import { listArtifacts } from "@wonder/creator-studio";
import { BACKGROUNDS, Badge, EmptyState, PageTitle, buttonClasses, cn } from "@wonder/ui";
import { Layers, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { ArtifactCard, MaterialCard, MaterialWallCard } from "@/components/cards";
import { coverUrls } from "@/lib/covers";
import { requireSession } from "@/lib/session";
import { NewCollectionButton } from "./collections/new-collection";
import { NewPieceButton, SpaceSearch } from "./space-controls";

export const metadata = { title: "Creative Space" };

const TABS = [
  { key: "all", label: "All" },
  { key: "ideas", label: "Ideas & Material" },
  { key: "progress", label: "In Progress" },
  { key: "created", label: "Created" },
  { key: "shared", label: "Shared" },
  { key: "inspirations", label: "Inspirations" },
  { key: "collections", label: "Collections" },
] as const;

const MATERIAL_LABEL: Record<MaterialFilter, string> = { all: "All", ideas: "Ideas", notes: "Notes", images: "Photos", audio: "Audio", video: "Video", documents: "Documents", links: "Links", archived: "Archived" };

export default async function SpacePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string; archived?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "all") as (typeof TABS)[number]["key"];
  const q = sp.q?.slice(0, 200) ?? "";
  const mFilter = ((MATERIAL_FILTERS as readonly string[]).includes(sp.type ?? "") ? sp.type : "all") as MaterialFilter;

  const wantMaterials = tab === "all" || tab === "ideas";
  const wantArtifacts = tab !== "ideas" && tab !== "inspirations" && tab !== "collections";
  const showArchived = sp.archived === "1";
  const [materials, counts, artifacts, refs] = await Promise.all([
    wantMaterials ? listMaterials(db, { filter: tab === "ideas" ? mFilter : "all", q, limit: tab === "all" ? 24 : 120 }) : Promise.resolve([]),
    tab === "ideas" ? materialCounts(db) : Promise.resolve(null),
    wantArtifacts
      ? listArtifacts(db, { creatorId: creator.id, q, status: tab === "progress" ? ["draft", "in_review"] : tab === "created" ? ["final", "published"] : ["draft", "in_review", "final", "published"], limit: 60 })
      : Promise.resolve([]),
    tab === "inspirations" ? db.from("reference_items").select("material_id").limit(200) : Promise.resolve({ data: [] as Array<{ material_id: string }> }),
  ]);
  const allCollections = tab === "collections" ? await collectionCards(db, { includeArchived: showArchived }) : [];
  const collections = q ? allCollections.filter((c) => `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) : allCollections;
  const collectionCovers = await signedUrlsFor(db, collections.map((c) => c.coverObjectId));
  const shownArtifacts = tab === "shared" ? artifacts.filter((a) => a.privacy !== "creator_private") : artifacts;
  const inspirations = tab === "inspirations" ? await listMaterials(db, { ids: (refs.data ?? []).map((r) => r.material_id), q, limit: 120 }) : [];
  const allMaterials = [...materials, ...inspirations];
  const [previews, covers] = await Promise.all([signedUrlsFor(db, allMaterials.map((m) => m.storage_object_id)), coverUrls(db, shownArtifacts)]);

  const items = [
    ...shownArtifacts.map((a) => ({ key: `a${a.id}`, at: a.updated_at, node: <ArtifactCard a={{ ...a, coverUrl: covers[a.id] ?? null }} /> })),
    ...allMaterials.map((m) => ({ key: `m${m.id}`, at: m.created_at, node: <MaterialCard m={{ ...m, previewUrl: m.storage_object_id ? previews[m.storage_object_id] : null }} /> })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), ...(q ? { q } : {}), ...(sp.type ? { type: sp.type } : {}), ...patch } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/space${s ? `?${s}` : ""}`;
  };

  // The Materials wall (UI redesign §9): the creator's visual memory, not a file list.
  if (tab === "ideas") {
    return (
      <div>
        <PageTitle title="Materials" subtitle="Your visual memory — photos, notes, sounds, links and ideas." action={<SpaceSearch initial={q} />} />
        {counts ? (
          <nav aria-label="Material type" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {MATERIAL_FILTERS.map((f) => (
              <Link
                key={f}
                href={href({ type: f === "all" ? undefined : f })}
                aria-current={f === mFilter ? "true" : undefined}
                className={cn("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm", f === mFilter ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-muted hover:border-[#cfd0ff]")}
              >
                {MATERIAL_LABEL[f]} <span className="text-xs opacity-75">{counts[f]}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        {allMaterials.length ? (
          <ul aria-label="Materials" className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-4 [&>li]:break-inside-avoid">
            <li>
              <Link href="/send" className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/60 text-sm text-ink-muted hover:border-accent hover:text-accent-ink">
                <Plus className="size-6" aria-hidden /> Bring Material
              </Link>
            </li>
            {allMaterials.map((m) => (
              <li key={m.id}>
                <MaterialWallCard m={{ ...m, previewUrl: m.storage_object_id ? previews[m.storage_object_id] : null }} />
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
    <div>
      <PageTitle
        title="My Creative Space"
        subtitle="Ideas, materials and creations — all in one place."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/shared" className={buttonClasses({ variant: "ghost" })}>
              Shared with you
            </Link>
            <Link href="/space/references" className={buttonClasses({ variant: "secondary" })}>
              Reference Shelf
            </Link>
            <NewPieceButton />
          </div>
        }
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
                  <Link href={`/space/collections/${c.id}`} className="group block rounded-2xl focus-visible:outline-2">
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
          <li>
            <Link href="/send" className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/60 text-sm text-ink-muted hover:border-accent hover:text-accent-ink">
              <Plus className="size-6" aria-hidden /> Add new material
            </Link>
          </li>
        </ul>
      ) : (
        <EmptyState
          image={BACKGROUNDS.studioDesk}
          title={q ? `Nothing matches “${q}”` : "Nothing here yet"}
          body={q ? "Try another word, or clear the search." : "Bring an idea, photograph, note or voice memo. Everything you bring and make will live here."}
          action={
            <Link href="/send" className={buttonClasses({})}>
              Bring something
            </Link>
          }
        />
      )}
    </div>
  );
}
