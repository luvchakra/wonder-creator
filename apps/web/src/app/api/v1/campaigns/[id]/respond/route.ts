import { z } from "zod";
import { respondToCampaign } from "@wonder/creator-projects";
import { readJson, withApi } from "@/lib/api";

/** Accept or decline a brand invitation. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const b = z.object({ accept: z.boolean(), note: z.string().trim().max(1000).optional() }).parse(await readJson(req));
  await respondToCampaign(db, id, b.accept, b.note);
  return { ok: true };
});
