import { entityDejaVus } from "@wonder/creator-moments";
import { signedUrlsFor } from "@wonder/creator-library";
import { artifactType, getRights, lineageGraph, listLicenseRequests, listVersions, RIGHTS_DISCLAIMER } from "@wonder/creator-studio";
import { notFound, redirect } from "next/navigation";
import { ContextBack } from "@/components/context-back";
import { DejaVuChips } from "@/components/dejavu/dejavu-chips";
import { PaletteScope } from "@/components/creative-palette";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { requireSession } from "@/lib/session";
import { ArtifactView } from "./view";
import { CarouselComposer } from "./carousel/composer";
import { carouselView } from "@wonder/creator-brain";
import { serviceClient } from "@/lib/supabase/service";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireSession();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("artifacts").select("title").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.title ?? "Creation" };
}

export default async function ArtifactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; details?: string; from?: string }> }) {
  const { id } = await params;
  const { tab, details, from } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Lineage and references moved to the Context view (UI redesign §16); old links keep working.
  if (tab === "lineage" || tab === "references") redirect(`/artifacts/${id}/context?tab=${tab === "lineage" ? "related" : "references"}`);
  const { db, creator } = await requireSession();
  const { data: artifact } = await db.from("artifacts").select("*").eq("id", id).maybeSingle();
  if (!artifact) notFound();
  const isOwner = artifact.creator_id === creator.id;

  // The owner works on a Carousel in the Creative Studio canvas (owner, 28 Sep 2026: the old overview is gone);
  // About/Materials/Versions/Rights/People stay in Details. Collaborators, who don't have the owner's Studio, keep the
  // Composer (carousel-composer.md §9).
  if (artifact.artifact_type === "carousel" && !tab && !details && isOwner) redirect(`/artifacts/${id}/studio`);
  if (artifact.artifact_type === "carousel" && !tab && !details) {
    const [view, versions, graph] = await Promise.all([carouselView({ db, service: serviceClient(), creatorId: creator.id }, id), listVersions(db, id), lineageGraph(db, id)]);
    const current = versions.find((v) => v.id === artifact.current_version_id) ?? versions[0];
    const status =
      artifact.status === "draft"
        ? "In progress"
        : artifact.status === "in_review"
          ? "In review"
          : artifact.status === "final"
            ? "Completed"
            : artifact.status === "published"
              ? "Published"
              : "Archived";
    const privacy = artifact.privacy === "public" ? "Public" : artifact.privacy === "creator_private" ? "Private" : "Shared";
    const source = graph.nodes.find((n) => n.depth < 0 && n.type === "artifact");
    const lifecycle = artifact.status === "archived" ? "archived" : artifact.status === "published" ? "published" : artifact.status === "final" ? "finished" : "in-progress";
    return (
      <>
        <PaletteScope
          context={{
            page: "creation",
            entityType: "creation",
            lifecycle,
            permissions: isOwner ? ["edit", "publish", "rights", "collaborate", "invite"] : view.canEdit ? ["collaborate"] : [],
            ids: { artifactId: id },
            strip: { version: current?.version_number, count: view.slides.length ? [view.slides.length, "slide", "slides"] : undefined },
          }}
        />
        <CarouselComposer artifactId={id} title={artifact.title} meta={`Carousel · v${current?.version_number ?? 1} · ${status} · ${privacy}`} source={source?.title ?? null} initial={view} />
      </>
    );
  }

  const [versions, graph, rights, contributors, quality, owner, dejavus] = await Promise.all([
    listVersions(db, id),
    lineageGraph(db, id),
    getRights(db, id),
    db.from("artifact_contributors").select("role, contributor_creator_id, creators!artifact_contributors_contributor_creator_id_fkey(display_name, handle)").eq("artifact_id", id),
    db.from("quality_reports").select("*").eq("artifact_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("creators").select("id, display_name, handle").eq("id", artifact.creator_id).maybeSingle(),
    entityDejaVus(db, "creation", id).catch(() => ({ momentId: null, dejavus: [] })),
  ]);

  const materialIds = graph.nodes.filter((n) => n.type === "material").map((n) => n.id);
  const { data: mats } = materialIds.length
    ? await db.from("creative_materials").select("id, type, title, text_content, storage_object_id, metadata, source_url, created_at").in("id", materialIds)
    : { data: [] };
  const [matUrls, covers, avatars] = await Promise.all([
    signedUrlsFor(
      db,
      (mats ?? []).map((m) => m.storage_object_id),
    ),
    coverUrls(db, [artifact]),
    avatarUrls(db, [artifact.creator_id]),
  ]);
  const refEdges = await db.from("lineage_edges").select("source_id, relationship").eq("target_type", "artifact").eq("target_id", id).eq("source_type", "material");
  const referenceIds = new Set((refEdges.data ?? []).filter((e) => e.relationship === "references").map((e) => e.source_id));

  // The Palette follows this Creation's lifecycle and what the viewer may do with it (palette-spec §7, §11).
  const current = versions.find((v) => v.id === artifact.current_version_id) ?? versions[0];
  const lifecycle =
    artifact.status === "archived"
      ? "archived"
      : artifact.status === "published"
        ? "published"
        : artifact.status === "final"
          ? "finished"
          : artifact.status === "in_review"
            ? "review"
            : current?.content?.trim()
              ? "in-progress"
              : "idea";
  const collaborator = (contributors.data ?? []).some((c) => c.contributor_creator_id === creator.id);
  const permissions: Array<"edit" | "publish" | "rights" | "collaborate" | "invite"> = isOwner ? ["edit", "publish", "rights", "collaborate", "invite"] : collaborator ? ["collaborate"] : [];
  return (
    <>
      <ContextBack db={db} from={from} />
      <PaletteScope
        context={{
          page: "creation",
          entityType: "creation",
          lifecycle,
          permissions,
          ids: { artifactId: id },
          strip: { version: current?.version_number, visibility: artifact.privacy as "private" | "shared" | "public" },
        }}
      />
      <ArtifactView
        dejavu={<DejaVuChips entityType="creation" entityId={id} initial={dejavus} />}
        initialTab={tab}
        artifact={artifact}
        typeLabel={artifactType(artifact.artifact_type).label}
        isOwner={isOwner}
        canCollaborate={isOwner || (contributors.data ?? []).some((c) => c.contributor_creator_id === creator.id)}
        owner={{ name: owner.data?.display_name ?? "Creator", handle: owner.data?.handle ?? null, avatarUrl: avatars[artifact.creator_id] ?? null }}
        coverUrl={covers[artifact.id] ?? null}
        versions={versions}
        graph={graph}
        materials={(mats ?? []).map((m) => ({ ...m, previewUrl: m.storage_object_id ? (matUrls[m.storage_object_id] ?? null) : null, isReference: referenceIds.has(m.id) }))}
        rights={rights}
        licenseRequests={await listLicenseRequests(db, id).catch(() => [])}
        commercialStance={await db
          .rpc("commercial_stance", { p_artifact: id })
          .then(({ data }) => (data?.[0] ? { commercialUse: data[0].commercial_use, commercialChannels: data[0].commercial_channels } : null))}
        rightsDisclaimer={RIGHTS_DISCLAIMER}
        contributors={(contributors.data ?? []).map((c) => ({
          role: c.role,
          name: (c.creators as { display_name: string } | null)?.display_name ?? "Creator",
          handle: (c.creators as { handle: string | null } | null)?.handle ?? null,
        }))}
        quality={quality.data ? { checks: quality.data.checks as never, suggestions: quality.data.suggestions as never, createdAt: quality.data.created_at } : null}
      />
    </>
  );
}
