import { DomainError } from "@wonder/core";
import { reorderGeneratedAssets } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/** POST /api/v1/image-generations/:id/order — the creator's order for the set: every visible image id, once. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
    const b = z.object({ assetIds: z.array(z.string().uuid()).min(1).max(20) }).parse(await readJson(req));
    await reorderGeneratedAssets({ db, service: serviceClient(), creatorId }, id, b.assetIds);
    return { ok: true };
  },
  { rateLimit: 60 },
);
