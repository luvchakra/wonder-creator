import { signedUrlsFor } from "@wonder/creator-library";
import { actionsFor, artifactType } from "@wonder/creator-studio";
import { notFound, redirect } from "next/navigation";
import { findingsOf, providerReadiness } from "@wonder/creator-brain";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { Studio } from "./studio";

export const metadata = { title: "Creative Studio" };

export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ action?: string }> }) {
  const { id } = await params;
  const { action } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  if (a.creator_id !== creator.id) redirect(`/artifacts/${id}`);
  const [{ data: version }, { data: edges }, { data: quality }, { data: pending }] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("*").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("lineage_edges").select("source_id, relationship").eq("target_type", "artifact").eq("target_id", id).eq("source_type", "material"),
    db.from("quality_reports").select("*").eq("artifact_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ai_proposals").select("id, payload, created_at").eq("status", "pending").eq("action", "apply_revision").order("created_at", { ascending: false }).limit(10),
  ]);
  const matIds = (edges ?? []).map((e) => e.source_id);
  const { data: mats } = matIds.length
    ? await db.from("creative_materials").select("id, type, title, text_content, storage_object_id, metadata, source_url, created_at").in("id", matIds)
    : { data: [] };
  const urls = await signedUrlsFor(
    db,
    (mats ?? []).map((m) => m.storage_object_id),
  );
  const proposal = (pending ?? []).find((p) => (p.payload as { artifactId?: string }).artifactId === id);
  const def = artifactType(a.artifact_type);
  return (
    <>
      {/* The Creation Palette during active work (palette-spec §9.16). */}
      <PaletteScope context={{ page: "studio", entityType: "creation", permissions: ["edit", "publish", "rights", "collaborate", "invite"], ids: { artifactId: id }, facts: { format: def.format } }} />
      <Studio
        artifact={{ id: a.id, title: a.title, type: a.artifact_type, typeLabel: def.label, format: def.format, status: a.status }}
        version={version ? { id: version.id, number: version.version_number, content: version.content } : null}
        actions={actionsFor(a.artifact_type)}
        initialAction={action ?? null}
        materials={(mats ?? []).map((m) => ({ ...m, previewUrl: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null }))}
        quality={quality ? { reportId: quality.id, versionId: quality.version_id, checks: quality.checks as never, findings: findingsOf(quality) } : null}
        pendingProposal={
          proposal
            ? {
                id: proposal.id,
                preview: String((proposal.payload as { content?: string }).content ?? ""),
                baseVersionId: String((proposal.payload as { baseVersionId?: string }).baseVersionId ?? ""),
                quality: (proposal.payload as { quality?: { reportId: string; keys: string[]; titles: string[] } }).quality,
              }
            : null
        }
        offline={!providerReadiness().live}
      />
    </>
  );
}
