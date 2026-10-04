import { DomainError } from "@wonder/core";
import { attachPartArtifact } from "@wonder/creator-projects";
import { createArtifact, creationPath } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

/**
 * Start a part's Creation: a new Creation of the part's type, owned by the caller (who must be on the part), named
 * for the Room and the part. Everyone else on the part becomes its editor. Opens on the format's own page.
 */
export const POST = withApi<{ id: string; partId: string }>(
  async ({ db, creatorId }, { partId }) => {
    const pid = requireUuid(partId, "Part");
    const { data: part } = await db.from("project_parts").select("id, title, artifact_type, artifact_id, projects(title)").eq("id", pid).maybeSingle();
    if (!part) throw new DomainError("not_found", "That part isn't here.");
    if (part.artifact_id) return { artifactId: part.artifact_id, href: creationPath(part.artifact_id, part.artifact_type) };
    const room = (part.projects as { title: string } | null)?.title ?? "Creative Room";
    const a = await createArtifact(db, creatorId, {
      artifactType: part.artifact_type,
      title: `${room} · ${part.title}`,
      content: "",
      authorKind: "creator",
      provenance: { origin: "typed", details: { part: pid } },
    });
    await attachPartArtifact(db, pid, a.id);
    return { artifactId: a.id, href: creationPath(a.id, a.artifact_type) };
  },
  { rateLimit: 20, reindex: true },
);
