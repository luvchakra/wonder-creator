import { DomainError } from "@wonder/core";
import { exportFilename, exportMarkdown, getArtifact, getVersion } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const a = await getArtifact(db, requireUuid(id, "piece"));
  const vid = req.nextUrl.searchParams.get("version") ?? a.current_version_id;
  if (!vid) throw new DomainError("not_found", "There's nothing to export yet.");
  const v = await getVersion(db, requireUuid(vid, "version"));
  if (v.artifact_id !== a.id) throw new DomainError("not_found", "We couldn't find that version.");
  const format = req.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const body = format === "md" ? exportMarkdown(a, v) : `${a.title}\n\n${v.content}\n`;
  return new Response(body, {
    headers: {
      "content-type": format === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(a.title, format)}"`,
      "cache-control": "no-store",
    },
  });
});
