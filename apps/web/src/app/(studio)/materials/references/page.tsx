import { ensureDefaultShelves, listReferences, listShelves, signedUrlsFor } from "@wonder/creator-library";
import { requireSession } from "@/lib/session";
import { ReferenceShelf } from "./shelf";

export const metadata = { title: "Reference Shelf" };

export default async function ReferencesPage({ searchParams }: { searchParams: Promise<{ shelf?: string }> }) {
  const { db, creator } = await requireSession();
  await ensureDefaultShelves(db, creator.id);
  const sp = await searchParams;
  const shelves = await listShelves(db);
  const shelfId = shelves.find((s) => s.id === sp.shelf)?.id ?? null;
  const items = await listReferences(db, { shelfId });
  const urls = await signedUrlsFor(db, items.map((i) => (i.creative_materials as { storage_object_id: string | null } | null)?.storage_object_id));
  return (
    <ReferenceShelf
      shelves={shelves.map((s) => ({ id: s.id, name: s.name, count: s.count }))}
      activeShelf={shelfId}
      items={items.map((i) => {
        const m = i.creative_materials as unknown as { id: string; type: string; title: string | null; text_content: string | null; source_url: string | null; storage_object_id: string | null; metadata: unknown; created_at: string };
        return { id: i.id, note: i.note, tags: i.tags, shelfId: i.shelf_id, material: { ...m, previewUrl: m.storage_object_id ? urls[m.storage_object_id] ?? null : null } };
      })}
    />
  );
}
