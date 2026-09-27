import { DomainError } from "@wonder/core";
import { chooseSlideVariation } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { serviceClient } from "@/lib/supabase/service";

/** POST /api/v1/carousel-slides/:id/choose — "Use new" or "Keep current" for a regenerated image. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
  const b = z.object({ choice: z.enum(["use", "keep"]) }).parse(await readJson(req));
  await chooseSlideVariation({ db, service: serviceClient(), creatorId }, id, b.choice);
  return { ok: true };
});
