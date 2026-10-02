import { actionsFor, ARTIFACT_TYPES, artifactType, getRights, listVersions } from "@wonder/creator-studio";
import { notFound, redirect } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { VisualDirections } from "@/components/visual-directions";
import { requireSession } from "@/lib/session";
import { TransformChooser, type FormatOption } from "./chooser";

export const metadata = { title: "Transform" };

/**
 * Transform Creation (UI redesign §17): one Creation can become many forms. Format cards filtered by the source —
 * the forms that suit it first, every other form after — then a focused configuration and Create. The result is a
 * new Creation with lineage back to the version it came from.
 */
export default async function TransformPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params;
  const { type } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("id, title, artifact_type, creator_id, current_version_id").eq("id", id).maybeSingle();
  if (!a) notFound();
  if (a.creator_id !== creator.id) redirect(`/creations/${id}`);

  const [versions, rights, contributors, edges] = await Promise.all([
    listVersions(db, id),
    getRights(db, id),
    db.from("artifact_contributors").select("role, creators!artifact_contributors_contributor_creator_id_fkey(display_name)").eq("artifact_id", id),
    db.from("lineage_edges").select("source_id", { count: "exact", head: true }).eq("target_type", "artifact").eq("target_id", id).eq("source_type", "material").neq("relationship", "references"),
  ]);
  const source = artifactType(a.artifact_type);
  const suggested: FormatOption[] = actionsFor(a.artifact_type)
    .filter((x) => x.kind === "transform" && x.targetType)
    .map((x) => {
      const t = artifactType(x.targetType!);
      return { type: t.type, label: t.label, action: x.label, sentence: t.description, format: t.format, category: t.category };
    });
  const others: FormatOption[] = ARTIFACT_TYPES.filter((t) => t.type !== a.artifact_type && !suggested.some((s) => s.type === t.type)).map((t) => ({ type: t.type, label: t.label, action: null, sentence: t.description, format: t.format, category: t.category }));

  return (
    <>
      <PaletteScope context={{ page: "transform", permissions: ["edit", "publish", "rights", "collaborate", "invite"], ids: { artifactId: id } }} />
      <TransformChooser
        artifactId={id}
        sourceType={a.artifact_type}
        sourceLabel={source.label}
        initialType={type && ARTIFACT_TYPES.some((t) => t.type === type) ? type : null}
        suggested={suggested}
        others={others}
        source={{
          title: a.title,
          currentVersionId: a.current_version_id,
          versions: versions.map((v) => ({ id: v.id, number: v.version_number, label: v.label })),
          materials: edges.count ?? 0,
          contributors: (contributors.data ?? []).map((c) => `${(c.creators as { display_name: string } | null)?.display_name ?? "Creator"} (${c.role})`),
          rights: rights ? { ownershipKind: rights.ownership_kind, owners: rights.rights_owners.map((o) => o.owner_name), attributionRequired: rights.attribution_required } : null,
        }}
      />
      {/* Before a costly full transformation, cheap preview-tier looks at where it could go (image-generation §33). */}
      <VisualDirections creationId={id} purpose="transform-preview" title="See it first" className="mx-auto mt-6 max-w-3xl" />
    </>
  );
}
