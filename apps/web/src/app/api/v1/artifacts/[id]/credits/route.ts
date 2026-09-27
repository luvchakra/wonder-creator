import { DomainError } from "@wonder/core";
import { exportCredits, listContributions } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Credits for a piece (owner and collaborators). */
export const GET = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const artifactId = requireUuid(id, "Creation");
  const { data: a } = await db.from("artifacts").select("title").eq("id", artifactId).maybeSingle();
  if (!a) throw new DomainError("not_found", "We couldn't find that Creation.");
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "txt";
  const body = exportCredits(a.title, await listContributions(db, creatorId, { artifactId }), format);
  return new Response(body, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`credits.${format}`)}`,
      "cache-control": "no-store",
    },
  });
});
