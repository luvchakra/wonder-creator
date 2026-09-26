import { listMaterials, signedUrlsFor } from "@wonder/creator-library";
import { PageTitle } from "@wonder/ui";
import { requireSession } from "@/lib/session";
import { Discover } from "./discover";

export const metadata = { title: "Creative Discovery" };

export default async function DiscoverPage() {
  const { db } = await requireSession();
  const materials = await listMaterials(db, { limit: 24 });
  const urls = await signedUrlsFor(db, materials.map((m) => m.storage_object_id));
  return (
    <div>
      <PageTitle title="Here are some directions you can explore" subtitle="Based on your materials, interests and creative style. Pick what you'd like CreatorBrain to consider." />
      <Discover materials={materials.map((m) => ({ ...m, previewUrl: m.storage_object_id ? urls[m.storage_object_id] ?? null : null }))} />
    </div>
  );
}
