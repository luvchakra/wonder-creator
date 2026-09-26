import { getRights, saveRights } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { requirePassword } from "@/lib/step-up";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ rights: await getRights(db, requireUuid(id, "piece")) }));

/**
 * Rights changes are made by the creator directly (CreatorBrain's autonomy for rights is capped). Audited by
 * the database. Transferring ownership is high impact, so it needs the creator's password (step-up).
 */
export const PUT = withApi<{ id: string }>(async ({ db, userId, creatorId, req }, { id }) => {
  const artifactId = requireUuid(id, "piece");
  const body = await readJson(req);
  const { ownershipKind, password } = z.object({ ownershipKind: z.string().optional(), password: z.string().optional() }).parse(body);
  if (ownershipKind === "transferred") {
    const current = await db.from("rights_records").select("ownership_kind").eq("artifact_id", artifactId).maybeSingle();
    if (current.data?.ownership_kind !== "transferred") await requirePassword(db, userId, password, "transfer ownership");
  }
  await saveRights(db, creatorId, artifactId, body);
  return { rights: await getRights(db, artifactId) };
});
