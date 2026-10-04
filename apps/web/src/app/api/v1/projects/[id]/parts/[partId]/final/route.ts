import { setPartFinal } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const schema = z.object({ final: z.boolean() });

/** Mark a part final, or put it back into rounds — the people on it, or the Room's owner or admins. */
export const POST = withApi<{ id: string; partId: string }>(async ({ db, req }, { partId }) => {
  const { final } = schema.parse(await readJson(req, 10_000));
  await setPartFinal(db, requireUuid(partId, "Part"), final);
  return { ok: true };
});
