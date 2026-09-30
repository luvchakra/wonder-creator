import { listDejaVus } from "@wonder/creator-moments";
import { getCreatorPage } from "@wonder/creator-studio";
import { PaletteScope } from "@/components/creative-palette";
import { loadCreatorPagePreview } from "@/lib/public-pages";
import { requireSession } from "@/lib/session";
import { CreatorPageEditor } from "./editor";

export const metadata = { title: "Your Creator Page" };

/**
 * Your Creator Page (docs/creator-publish.md §16, §39): the curated public home. Only what's chosen here is public —
 * published works you set to Public, the DejaVus and Moments you pick, the sections you turn on, in your order.
 */
export default async function CreatorPageSettingsPage() {
  const { db, creator } = await requireSession();
  const [page, preview, dejavus, { data: works }, { data: posts }] = await Promise.all([
    getCreatorPage(db, creator.id),
    loadCreatorPagePreview().catch(() => null),
    listDejaVus(db).catch(() => []),
    db.from("published_works").select("artifact_id, slug, visibility, featured, unpublished_at, published_revisions!published_works_current_revision_fk(snapshot)").eq("creator_id", creator.id).order("updated_at", { ascending: false }).limit(60),
    db.from("scrapbook_posts").select("id, body, created_at").eq("creator_id", creator.id).eq("visibility", "public").order("created_at", { ascending: false }).limit(30),
  ]);
  return (
    <>
      <PaletteScope context={{ page: "me" }} />
      <CreatorPageEditor
        handle={creator.handle ?? null}
        initial={page}
        preview={preview}
        works={(works ?? []).map((w) => ({
          artifactId: w.artifact_id,
          slug: w.slug,
          visibility: w.visibility,
          featured: w.featured,
          live: !w.unpublished_at,
          title: ((w.published_revisions as unknown as { snapshot: { title?: string } } | null)?.snapshot?.title as string) ?? "Untitled",
        }))}
        dejavus={dejavus.map((d) => ({ id: d.id, name: d.name, count: d.count }))}
        moments={(posts ?? []).filter((p) => p.body.trim()).map((p) => ({ id: p.id, body: p.body, createdAt: p.created_at }))}
      />
    </>
  );
}
