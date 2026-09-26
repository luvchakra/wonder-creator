import { getCollection, signedUrlsFor } from "@wonder/creator-library";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CollectionDetail } from "./detail";

export const metadata = { title: "Collection" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const data = await getCollection(db, id).catch(() => null);
  if (!data) notFound();
  const previews = await signedUrlsFor(
    db,
    data.items.map((m) => m.storage_object_id),
  );
  const c = data.collection;
  return (
    <CollectionDetail
      c={{ id: c.id, name: c.name, description: c.description, status: c.status, coverMaterialId: c.cover_material_id }}
      items={data.items.map((m) => ({ ...m, previewUrl: m.storage_object_id ? (previews[m.storage_object_id] ?? null) : null }))}
    />
  );
}
