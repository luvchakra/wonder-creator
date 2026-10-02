import { importCandidate } from "@wonder/creator-sources/server";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { sourcesDeps } from "@/lib/sources";

export const maxDuration = 30;

const schema = z.object({ recordIds: z.array(z.string().uuid()).min(1).max(50), to: z.enum(["materials", "studio"]).default("materials") });

/**
 * POST /api/v1/personal-sources/candidates/:id/import — the deliberate step (spec §10): only the items the creator
 * selected become Materials, private, with provenance. "Bring to Studio" then opens a new Creation with them.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    requireUuid(id);
    const b = schema.parse(await readJson(req));
    const { materialIds } = await importCandidate(sourcesDeps(), db, creatorId, id, b.recordIds);
    return { materialIds, next: b.to === "studio" ? `/create?materials=${materialIds.join(",")}` : "/space?tab=ideas" };
  },
  { feature: "personal_sources_enabled", rateLimit: 20 },
);
