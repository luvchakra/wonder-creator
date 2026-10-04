import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { addLineage, createVersion, getArtifact, type ArtifactVersion } from "./artifacts";
import { imageSetOf, imageSetSchema, type ImageSet } from "./image-options";

export * from "./image-options";

/**
 * Saving an Images Creation (creation-pages.md, step 2): every Keep is a new immutable version carrying the pictures and
 * what was done to them. The original Materials are never changed. RLS decides who may version the Creation (the owner,
 * or a collaborator with edit access); here, a picture that wasn't already in it must be the saver's own picture
 * Material, and it gains a lineage edge so publishing, "Used in" and rights see it.
 */
const saveSchema = z.object({
  set: imageSetSchema,
  label: z.string().trim().max(80).optional(),
  baseVersionId: z.string().uuid().nullable().optional(),
});

export async function saveImageSet(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<ArtifactVersion> {
  const input = saveSchema.parse(raw);
  const a = await getArtifact(db, artifactId);
  if (input.baseVersionId !== undefined && (input.baseVersionId ?? null) !== (a.current_version_id ?? null)) {
    throw new DomainError("conflict", "A newer version exists. Refresh to see it before keeping this.");
  }
  const { data: cur } = a.current_version_id ? await db.from("artifact_versions").select("structured_content").eq("id", a.current_version_id).maybeSingle() : { data: null };
  const before = imageSetOf(cur?.structured_content);
  const had = new Set(before.items.map((i) => i.materialId));
  const set: ImageSet = input.set;
  const ids = [...new Set(set.items.map((i) => i.materialId))];
  if (ids.length) {
    const { data: mats } = await db.from("creative_materials").select("id, creator_id, type, storage_object_id").in("id", ids);
    const byId = new Map((mats ?? []).map((m) => [m.id, m]));
    for (const id of ids) {
      const m = byId.get(id);
      if (!m || !(m.type === "image" || m.type === "sketch") || !m.storage_object_id) throw new DomainError("validation", "Only pictures can be used here.");
      if (!had.has(id) && m.creator_id !== creatorId) throw new DomainError("forbidden", "You can add only your own pictures.");
    }
  }
  if (JSON.stringify(before.items) === JSON.stringify(set.items)) throw new DomainError("validation", "There are no changes to keep.");
  for (const id of ids) if (!had.has(id)) await addLineage(db, creatorId, { type: "material", id, relationship: "contains_material" }, { type: "artifact", id: artifactId });
  const added = set.items.length - before.items.length;
  return createVersion(db, artifactId, {
    // The words that travel with the pictures (captions and words on them), for search, export and reading.
    content: set.items.map((i) => [i.caption.trim(), ...i.texts.map((t) => t.text.trim())].filter(Boolean).join("\n")).filter(Boolean).join("\n\n"),
    label: input.label || (added > 0 ? "Added a picture" : "Edited"),
    authorKind: "creator",
    changeSummary: added > 0 ? `${added === 1 ? "A picture" : `${added} pictures`} added on the Images page.` : "Kept on the Images page; the original pictures are unchanged.",
    structuredContent: set as unknown as Record<string, unknown>,
  });
}
