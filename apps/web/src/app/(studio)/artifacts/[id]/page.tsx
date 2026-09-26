import { signedUrlsFor } from "@wonder/creator-library";
import { artifactType, getRights, lineageGraph, listVersions, RIGHTS_DISCLAIMER } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { requireSession } from "@/lib/session";
import { ArtifactView } from "./view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireSession();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("artifacts").select("title").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.title ?? "Artifact" };
}

export default async function ArtifactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: artifact } = await db.from("artifacts").select("*").eq("id", id).maybeSingle();
  if (!artifact) notFound();
  const isOwner = artifact.creator_id === creator.id;

  const [versions, graph, rights, contributors, quality, owner] = await Promise.all([
    listVersions(db, id),
    lineageGraph(db, id),
    getRights(db, id),
    db.from("artifact_contributors").select("role, contributor_creator_id, creators!artifact_contributors_contributor_creator_id_fkey(display_name, handle)").eq("artifact_id", id),
    db.from("quality_reports").select("*").eq("artifact_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("creators").select("id, display_name, handle").eq("id", artifact.creator_id).maybeSingle(),
  ]);

  const materialIds = graph.nodes.filter((n) => n.type === "material").map((n) => n.id);
  const { data: mats } = materialIds.length ? await db.from("creative_materials").select("id, type, title, text_content, storage_object_id, metadata, source_url, created_at").in("id", materialIds) : { data: [] };
  const [matUrls, covers, avatars] = await Promise.all([signedUrlsFor(db, (mats ?? []).map((m) => m.storage_object_id)), coverUrls(db, [artifact]), avatarUrls(db, [artifact.creator_id])]);
  const refEdges = await db.from("lineage_edges").select("source_id, relationship").eq("target_type", "artifact").eq("target_id", id).eq("source_type", "material");
  const referenceIds = new Set((refEdges.data ?? []).filter((e) => e.relationship === "references").map((e) => e.source_id));

  return (
    <ArtifactView
      initialTab={tab}
      artifact={artifact}
      typeLabel={artifactType(artifact.artifact_type).label}
      isOwner={isOwner}
      owner={{ name: owner.data?.display_name ?? "Creator", handle: owner.data?.handle ?? null, avatarUrl: avatars[artifact.creator_id] ?? null }}
      coverUrl={covers[artifact.id] ?? null}
      versions={versions}
      graph={graph}
      materials={(mats ?? []).map((m) => ({ ...m, previewUrl: m.storage_object_id ? matUrls[m.storage_object_id] ?? null : null, isReference: referenceIds.has(m.id) }))}
      rights={rights}
      rightsDisclaimer={RIGHTS_DISCLAIMER}
      contributors={(contributors.data ?? []).map((c) => ({ role: c.role, name: (c.creators as { display_name: string } | null)?.display_name ?? "Creator", handle: (c.creators as { handle: string | null } | null)?.handle ?? null }))}
      quality={quality.data ? { checks: quality.data.checks as never, suggestions: quality.data.suggestions as never, createdAt: quality.data.created_at } : null}
    />
  );
}
