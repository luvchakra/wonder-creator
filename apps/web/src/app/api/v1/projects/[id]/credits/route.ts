import { DomainError } from "@wonder/core";
import { exportCredits, listContributions } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Credits for the project: plain text (who to credit, and how) or the full ledger as CSV. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const projectId = requireUuid(id, "project");
  const { data: p } = await db.from("projects").select("title").eq("id", projectId).maybeSingle();
  if (!p) throw new DomainError("not_found", "We couldn't find that project.");
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "txt";
  const body = exportCredits(p.title, await listContributions(db, creatorId, { projectId }), format);
  const name = `${p.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "credits"} credits.${format}`;
  return new Response(body, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
});
