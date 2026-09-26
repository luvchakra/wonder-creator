import { listMaterials, MATERIAL_FILTERS, materialCounts, signedUrlsFor, type MaterialFilter } from "@wonder/creator-library";
import { listArtifacts } from "@wonder/creator-studio";
import { BACKGROUNDS, EmptyState, PageTitle, buttonClasses, cn } from "@wonder/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ArtifactCard, MaterialCard } from "@/components/cards";
import { coverUrls } from "@/lib/covers";
import { requireSession } from "@/lib/session";
import { NewPieceButton, SpaceSearch } from "./space-controls";

export const metadata = { title: "Creative Space" };

const TABS = [
  { key: "all", label: "All" },
  { key: "ideas", label: "Ideas & Material" },
  { key: "progress", label: "In Progress" },
  { key: "created", label: "Created" },
  { key: "shared", label: "Shared" },
  { key: "inspirations", label: "Inspirations" },
] as const;

const MATERIAL_LABEL: Record<MaterialFilter, string> = { all: "All", ideas: "Ideas", notes: "Notes", images: "Images", audio: "Audio", video: "Video", documents: "Documents", links: "Links", archived: "Archived" };

export default async function SpacePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "all") as (typeof TABS)[number]["key"];
  const q = sp.q?.slice(0, 200) ?? "";
  const mFilter = ((MATERIAL_FILTERS as readonly string[]).includes(sp.type ?? "") ? sp.type : "all") as MaterialFilter;

  const wantMaterials = tab === "all" || tab === "ideas";
  const wantArtifacts = tab !== "ideas" && tab !== "inspirations";
  const [materials, counts, artifacts, refs] = await Promise.all([
    wantMaterials ? listMaterials(db, { filter: tab === "ideas" ? mFilter : "all", q, limit: tab === "all" ? 24 : 120 }) : Promise.resolve([]),
    tab === "ideas" ? materialCounts(db) : Promise.resolve(null),
    wantArtifacts
      ? listArtifacts(db, { creatorId: creator.id, q, status: tab === "progress" ? ["draft", "in_review"] : tab === "created" ? ["final", "published"] : ["draft", "in_review", "final", "published"], limit: 60 })
      : Promise.resolve([]),
    tab === "inspirations" ? db.from("reference_items").select("material_id").limit(200) : Promise.resolve({ data: [] as Array<{ material_id: string }> }),
  ]);
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

  return (
    <div>
      <PageTitle
        title="My Creative Space"
        subtitle="Ideas, materials and creations — all in one place."
        action={
          <div className="flex gap-2">
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
      {tab === "ideas" && counts ? (
        <nav aria-label="Material type" className="mb-5 flex flex-wrap gap-2">
          {MATERIAL_FILTERS.map((f) => (
            <Link key={f} href={href({ type: f === "all" ? undefined : f })} aria-current={f === mFilter ? "true" : undefined} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm", f === mFilter ? "border-accent bg-accent-soft text-accent-ink" : "border-border text-ink-muted hover:border-[#cfd0ff]")}>
              {MATERIAL_LABEL[f]} <span className="text-xs opacity-70">{counts[f]}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {items.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((i) => (
            <li key={i.key}>{i.node}</li>
          ))}
          <li>
            <Link href="/" className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/60 text-sm text-ink-muted hover:border-accent hover:text-accent-ink">
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
            <Link href="/" className={buttonClasses({})}>
              Bring something
            </Link>
          }
        />
      )}
    </div>
  );
}
