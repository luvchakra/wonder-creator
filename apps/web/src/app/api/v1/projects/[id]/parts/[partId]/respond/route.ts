import { respondToPart } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const schema = z.object({ accept: z.boolean() });

/** Accept or decline an invitation to a part. */
export const POST = withApi<{ id: string; partId: string }>(async ({ db, req }, { partId }) => {
  const { accept } = schema.parse(await readJson(req, 10_000));
  await respondToPart(db, requireUuid(partId, "Part"), accept);
  return { ok: true };
});
