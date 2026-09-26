import "server-only";
import { signedUrlsFor } from "@wonder/creator-library";
import type { Db } from "@wonder/db";

/** Signed cover images for artifacts the viewer can read (RLS-scoped material lookup). */
export async function coverUrls(db: Db, artifacts: Array<{ id: string; cover_material_id: string | null }>): Promise<Record<string, string>> {
  const matIds = [...new Set(artifacts.map((a) => a.cover_material_id).filter((x): x is string => !!x))];
  if (!matIds.length) return {};
  const { data } = await db.from("creative_materials").select("id, storage_object_id").in("id", matIds);
  const urls = await signedUrlsFor(db, (data ?? []).map((m) => m.storage_object_id));
  const byMat = new Map((data ?? []).map((m) => [m.id, m.storage_object_id ? urls[m.storage_object_id] : undefined]));
  const out: Record<string, string> = {};
  for (const a of artifacts) {
    const u = a.cover_material_id ? byMat.get(a.cover_material_id) : undefined;
    if (u) out[a.id] = u;
  }
  return out;
}
