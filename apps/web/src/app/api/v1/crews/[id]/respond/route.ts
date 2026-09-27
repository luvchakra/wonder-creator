import { respondToCrew } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Accept or decline your invitation. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { accept } = z.object({ accept: z.boolean() }).parse(await readJson(req));
  await respondToCrew(db, requireUuid(id, "crew"), accept);
  return { ok: true };
});
