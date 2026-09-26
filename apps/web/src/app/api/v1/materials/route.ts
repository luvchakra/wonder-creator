import { listMaterials, MATERIAL_FILTERS, materialCounts, signedUrlsFor, type MaterialFilter } from "@wonder/creator-library";
import { withApi } from "@/lib/api";

export const GET = withApi(async ({ db, req }) => {
  const p = req.nextUrl.searchParams;
  const filter = (MATERIAL_FILTERS as readonly string[]).includes(p.get("filter") ?? "") ? (p.get("filter") as MaterialFilter) : "all";
  const [items, counts] = await Promise.all([listMaterials(db, { filter, q: p.get("q")?.slice(0, 200) ?? undefined, limit: 120 }), materialCounts(db)]);
  const urls = await signedUrlsFor(db, items.map((m) => m.storage_object_id));
  return { items: items.map((m) => ({ ...m, previewUrl: m.storage_object_id ? urls[m.storage_object_id] ?? null : null })), counts };
});
