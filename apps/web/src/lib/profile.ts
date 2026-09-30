import "server-only";
import { artifactType, profileShelf, readingMinutes } from "@wonder/creator-studio/types";
import type { Db } from "@wonder/db";
import type { ProfileCreation } from "@/components/profile/creations";
import { coverUrls } from "./covers";

/**
 * A Profile's Creations (profile board, 30 Sep 2026). Your own Profile shows everything you own; others see only public,
 * finished work — the viewer's own access (RLS) decides every read here, including the excerpts and slide counts.
 */
export async function profileCreations(db: Db, creatorId: string, isMe: boolean, limit = 48): Promise<ProfileCreation[]> {
  let q = db
    .from("artifacts")
    .select("id, title, description, artifact_type, status, cover_material_id, privacy, featured_on_profile, current_version_id")
    .eq("creator_id", creatorId)
    .neq("status", "archived")
    .order("featured_on_profile", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!isMe) q = q.eq("privacy", "public").in("status", ["final", "published"]);
  const { data } = await q;
  const rows = data ?? [];
  if (!rows.length) return [];
  const writing = rows.filter((a) => profileShelf(a.artifact_type) === "writing" && a.current_version_id);
  const carousels = rows.filter((a) => a.artifact_type === "carousel").map((a) => a.id);
  const [covers, versions, slides] = await Promise.all([
    coverUrls(db, rows),
    writing.length
      ? db
          .from("artifact_versions")
          .select("id, content")
          .in(
            "id",
            writing.map((a) => a.current_version_id!),
          )
          .then(({ data: v }) => new Map((v ?? []).map((x) => [x.id, x.content])))
      : Promise.resolve(new Map<string, string>()),
    carousels.length
      ? db
          .from("carousel_slides")
          .select("artifact_id")
          .in("artifact_id", carousels)
          .then(({ data: s }) => {
            const n = new Map<string, number>();
            for (const r of s ?? []) n.set(r.artifact_id, (n.get(r.artifact_id) ?? 0) + 1);
            return n;
          })
      : Promise.resolve(new Map<string, number>()),
  ]);
  return rows.map((a) => {
    const shelf = profileShelf(a.artifact_type);
    const content = a.current_version_id ? versions.get(a.current_version_id) : undefined;
    const mins = shelf === "writing" ? readingMinutes(content) : null;
    const count = slides.get(a.id);
    return {
      id: a.id,
      title: a.title,
      type: a.artifact_type,
      typeLabel: artifactType(a.artifact_type).label,
      shelf,
      coverUrl: covers[a.id] ?? null,
      excerpt: content ? content.slice(0, 280) : null,
      description: a.description,
      meta: count ? `${count} ${count === 1 ? "slide" : "slides"}` : mins ? `${mins} min read` : null,
      isPrivate: a.privacy !== "public",
      featured: a.featured_on_profile,
    };
  });
}
