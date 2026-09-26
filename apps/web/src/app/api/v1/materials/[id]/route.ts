import { audit, DomainError } from "@wonder/core";
import { deleteMaterial, getMaterial, signedUrlFor, updateMaterial } from "@wonder/creator-library";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const m = await getMaterial(db, requireUuid(id, "material"));
  const url = m.storage_object_id ? await signedUrlFor(db, m.storage_object_id) : null;
  return { material: m, url };
});

export const PATCH = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await updateMaterial(db, creatorId, requireUuid(id, "material"), await readJson(req));
  return { ok: true };
}, { reindex: true });

export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  // Destructive: the client must confirm explicitly.
  if (req.nextUrl.searchParams.get("confirm") !== "true") throw new DomainError("validation", "Please confirm before deleting.");
  const materialId = requireUuid(id, "material");
  await deleteMaterial(db, materialId);
  await audit(db, { action: "material.deleted", objectType: "material", objectId: materialId });
  return { ok: true };
});
