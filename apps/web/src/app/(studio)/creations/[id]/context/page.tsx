import { signedUrlsFor } from "@wonder/creator-library";
import { lineageGraph } from "@wonder/creator-studio";
import { Avatar, cn, chipBase } from "@wonder/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { Lineage, MaterialGrid } from "../context-parts";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Context" };

const SECTIONS = [
  ["materials", "Materials"],
  ["references", "References"],
  ["people", "People"],
  ["related", "Related"],
] as const;
type Section = (typeof SECTIONS)[number][0];

/**
 * The Context view (UI redesign §16): what surrounds a Creation — the Materials it came from (notes and voice included),
 * its references, the people on it and the Creations it's related to. Reached from the Creation, its Palette and its
 * Creative Room; four sections, no permanent inspector.
 */
export default async function ContextPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const section: Section = SECTIONS.some(([k]) => k === tab) ? (tab as Section) : "materials";
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("id, title, creator_id").eq("id", id).maybeSingle();
  if (!a) notFound();

  const [graph, contributors, owner, refEdges] = await Promise.all([
    lineageGraph(db, id),
    db.from("artifact_contributors").select("role, contributor_creator_id, creators!artifact_contributors_contributor_creator_id_fkey(display_name, handle)").eq("artifact_id", id),
    db.from("creators").select("id, display_name, handle").eq("id", a.creator_id).maybeSingle(),
    db.from("lineage_edges").select("source_id, relationship").eq("target_type", "artifact").eq("target_id", id).eq("source_type", "material"),
  ]);
  const materialIds = graph.nodes.filter((n) => n.type === "material").map((n) => n.id);
  const { data: mats } = materialIds.length ? await db.from("creative_materials").select("id, type, title, text_content, storage_object_id, metadata, source_url, created_at").in("id", materialIds) : { data: [] };
  const people = [
    { id: a.creator_id, name: owner.data?.display_name ?? "Creator", handle: owner.data?.handle ?? null, role: "Creator" },
    ...(contributors.data ?? []).map((c) => {
      const p = c.creators as { display_name: string; handle: string | null } | null;
      return { id: c.contributor_creator_id, name: p?.display_name ?? "Creator", handle: p?.handle ?? null, role: c.role };
    }),
  ];
  const [urls, avatars] = await Promise.all([
    signedUrlsFor(
      db,
      (mats ?? []).map((m) => m.storage_object_id),
    ),
    avatarUrls(db, [...new Set(people.map((p) => p.id).filter((x): x is string => !!x))]),
  ]);
  const referenceIds = new Set((refEdges.data ?? []).filter((e) => e.relationship === "references").map((e) => e.source_id));
  const withPreview = (mats ?? []).map((m) => ({ ...m, previewUrl: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null }));
  const createdFrom = withPreview.filter((m) => !referenceIds.has(m.id));
  const references = withPreview.filter((m) => referenceIds.has(m.id));
  const related = graph.nodes.filter((n) => n.type === "artifact" && n.depth !== 0);
  const counts: Record<Section, number | null> = { materials: createdFrom.length, references: references.length, people: people.length, related: related.length };

  return (
    <>
      <PaletteScope context={{ page: "context", permissions: a.creator_id === creator.id ? ["edit", "collaborate"] : [], ids: { artifactId: id } }} />
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href={`/creations/${a.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
          ← {a.title}
        </Link>
        <header>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Context</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Everything around “{a.title}”.</p>
        </header>
        <nav aria-label="Context sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {SECTIONS.map(([k, label]) => (
            <Link
              key={k}
              href={`/creations/${a.id}/context?tab=${k}`}
              aria-current={section === k ? "page" : undefined}
              className={cn(
                chipBase, "border font-medium",
                section === k ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-border-soft bg-surface text-ink hover:bg-accent-softer",
              )}
            >
              {label}
              {counts[k] ? <span className="ml-1.5 text-ink-subtle">{counts[k]}</span> : null}
            </Link>
          ))}
        </nav>

        {section === "materials" ? (
          <section aria-label="Materials">
            <MaterialGrid items={createdFrom} empty="This Creation wasn't made from saved Materials." />
          </section>
        ) : section === "references" ? (
          <section aria-label="References">
            <MaterialGrid items={references} empty="No references yet." />
          </section>
        ) : section === "people" ? (
          <section aria-label="People">
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={`${p.id}-${p.role}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-2">
                  <Avatar name={p.name} src={p.id ? (avatars[p.id] ?? null) : null} size={36} />
                  <div className="min-w-0">
                    {p.handle ? (
                      <Link href={`/creators/${p.handle}`} className="font-medium text-ink hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-ink">{p.name}</p>
                    )}
                    <p className="text-xs capitalize text-ink-subtle">{p.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section aria-label="Related">
            <Lineage nodes={graph.nodes} edges={graph.edges} />
          </section>
        )}
      </div>
    </>
  );
}
