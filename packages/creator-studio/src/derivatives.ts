import { fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { artifactType } from "./artifact-types";

/**
 * Publication derivatives (P1-13): the pieces adapted from a source, each with the version it came from, the
 * destination it was made for, the rights it inherited and where it has been published.
 */
export interface DerivativeView {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  status: string;
  madeFor: string | null;
  sourceVersion: number | null;
  createdAt: string;
  rights: { attributionRequired: boolean; derivativesAllowed: boolean } | null;
  publications: Array<{ id: string; destination: string; status: string; publishedAt: string | null; externalUrl: string | null }>;
}

export async function listDerivatives(db: Db, artifactId: string): Promise<DerivativeView[]> {
  const edges = await db
    .from("lineage_edges")
    .select("target_id")
    .eq("source_type", "artifact")
    .eq("source_id", artifactId)
    .eq("target_type", "artifact")
    .eq("relationship", "adapted_from")
    .limit(200);
  if (edges.error) throw fromDbError(edges.error);
  const ids = [...new Set((edges.data ?? []).map((e) => e.target_id))];
  if (!ids.length) return [];
  const [arts, rights, pubs, versions, versionEdges] = await Promise.all([
    db.from("artifacts").select("id, title, artifact_type, status, made_for, created_at").in("id", ids).neq("status", "archived"),
    db.from("rights_records").select("artifact_id, attribution_required, derivatives_allowed").in("artifact_id", ids),
    db.from("publications").select("id, artifact_id, destination_name, status, published_at, external_url, created_at").in("artifact_id", ids).order("created_at", { ascending: false }).limit(500),
    db.from("artifact_versions").select("id, version_number").eq("artifact_id", artifactId).limit(500),
    // Which version of the source each derivative came from.
    db.from("lineage_edges").select("source_id, target_id").eq("source_type", "artifact_version").eq("target_type", "artifact").in("target_id", ids),
  ]);
  for (const r of [arts, rights, pubs, versions, versionEdges]) if (r.error) throw fromDbError(r.error);
  const sourceVersionOf = new Map((versionEdges.data ?? []).map((e) => [e.target_id, e.source_id]));
  const versionNumber = new Map((versions.data ?? []).map((v) => [v.id, v.version_number]));
  const rightsOf = new Map((rights.data ?? []).map((r) => [r.artifact_id, { attributionRequired: r.attribution_required, derivativesAllowed: r.derivatives_allowed }]));
  return (arts.data ?? [])
    .map((a) => {
      const sourceVersionId = sourceVersionOf.get(a.id);
      return {
        id: a.id,
        title: a.title,
        type: a.artifact_type,
        typeLabel: artifactType(a.artifact_type).label,
        status: a.status,
        madeFor: a.made_for,
        sourceVersion: sourceVersionId ? (versionNumber.get(sourceVersionId) ?? null) : null,
        createdAt: a.created_at,
        rights: rightsOf.get(a.id) ?? null,
        publications: (pubs.data ?? [])
          .filter((p) => p.artifact_id === a.id && p.status !== "cancelled")
          .map((p) => ({ id: p.id, destination: p.destination_name, status: p.status, publishedAt: p.published_at, externalUrl: p.external_url })),
      };
    })
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}
