import { DomainError, must } from "@wonder/core";
import { signedUrlFor } from "@wonder/creator-library";
import { requireUuid, withApi } from "@/lib/api";

/** Short-lived signed URL (never a raw storage path). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const m = must(await db.from("creative_materials").select("storage_object_id").eq("id", requireUuid(id, "material")).maybeSingle());
  if (!m.storage_object_id) throw new DomainError("not_found", "This material has no file.");
  const url = await signedUrlFor(db, m.storage_object_id, 300);
  if (!url) throw new DomainError("not_found", "This file isn't available.");
  return { url, expiresIn: 300 };
});
