import { DomainError } from "@wonder/core";
import { selectGeneratedAsset } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/** POST /api/v1/image-generations/:id/select — mark the chosen concept (§61). */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
    const { assetId } = z.object({ assetId: z.string().uuid() }).parse(await readJson(req));
    await selectGeneratedAsset({ db, service: serviceClient(), creatorId }, id, assetId);
    return { ok: true };
  },
  { rateLimit: 30 },
);
