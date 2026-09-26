import { addReference, listReferences, signedUrlsFor } from "@wonder/creator-library";
import { readJson, withApi } from "@/lib/api";

export const GET = withApi(async ({ db, req }) => {
  const shelf = req.nextUrl.searchParams.get("shelf");
  const items = await listReferences(db, { shelfId: shelf && /^[0-9a-f-]{36}$/i.test(shelf) ? shelf : null });
  const urls = await signedUrlsFor(db, items.map((i) => (i.creative_materials as { storage_object_id: string | null } | null)?.storage_object_id));
  return { items: items.map((i) => ({ ...i, previewUrl: urls[(i.creative_materials as { storage_object_id: string | null } | null)?.storage_object_id ?? ""] ?? null })) };
});
export const POST = withApi(async ({ db, creatorId, req }) => ({ item: await addReference(db, creatorId, await readJson(req)) }));
