import { DomainError } from "@wonder/core";
import { EXPORT_FORMATS, exportFormatsFor, getArtifact, getVersion, renderExport, type ExportFormat } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

/** Download a version in one of the formats that suit its kind of piece. Owner exports are audited. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId, req, requestId }, { id }) => {
  const a = await getArtifact(db, requireUuid(id, "piece"));
  const vid = req.nextUrl.searchParams.get("version") ?? a.current_version_id;
  if (!vid) throw new DomainError("not_found", "There's nothing to export yet.");
  const v = await getVersion(db, requireUuid(vid, "version"));
  if (v.artifact_id !== a.id) throw new DomainError("not_found", "We couldn't find that version.");
  const allowed = exportFormatsFor(a.artifact_type);
  const asked = (req.nextUrl.searchParams.get("format") ?? allowed[0]) as ExportFormat;
  if (!(asked in EXPORT_FORMATS) || !allowed.includes(asked)) throw new DomainError("validation", "That format isn't available for this kind of piece.");
  const out = renderExport(asked, { title: a.title, artifactType: a.artifact_type, description: a.description, versionNumber: v.version_number, createdAt: v.created_at, content: v.content });
  if (a.creator_id === creatorId) {
    await db.rpc("record_audit_log", { p_action: "artifact.exported", p_object_type: "artifact", p_object_id: a.id, p_metadata: { format: asked, version: v.version_number }, p_request_id: requestId });
  }
  return new Response(out.body, {
    headers: { "content-type": out.contentType, "content-disposition": `attachment; filename="${out.filename}"`, "cache-control": "no-store" },
  });
});
