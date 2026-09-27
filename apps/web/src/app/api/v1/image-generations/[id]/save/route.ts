import { DomainError } from "@wonder/core";
import { saveGeneratedAsset } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/**
 * POST /api/v1/image-generations/:id/save — keep a generated image as a Creative Material with its provenance and
 * lineage (docs/image-generation.md §64); `useInCreation` also adds it to the source Creation's references.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
    const b = z.object({ assetId: z.string().uuid(), useInCreation: z.boolean().optional() }).parse(await readJson(req));
    return saveGeneratedAsset({ db, service: serviceClient(), creatorId }, id, b.assetId, { useInCreation: b.useInCreation });
  },
  { rateLimit: 30 },
);
