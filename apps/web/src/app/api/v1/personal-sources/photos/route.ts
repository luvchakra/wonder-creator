import { DomainError, fromDbError } from "@wonder/core";
import { indexPhotos, PHOTO_BATCH } from "@wonder/creator-sources/server";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

const schema = z.object({
  photos: z
    .array(
      z.object({
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        takenAt: z.string().max(40).nullable(),
        width: z.number().int().positive().max(100_000).nullable().optional(),
        height: z.number().int().positive().max(100_000).nullable().optional(),
        thumb: z.string().max(16_000),
      }),
    )
    .min(1)
    .max(PHOTO_BATCH),
});

/**
 * POST /api/v1/personal-sources/photos — photos the creator selected on their device (spec §5): metadata, a SHA-256
 * and a tiny thumbnail each, never the original. Connects Photos on first use. At most 25 per request and 500 an hour.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const { photos } = schema.parse(await readJson(req, 600_000));
    await checkBudget(`sources:photos:${creatorId}`, 20);
    let { data: conn } = await db.from("source_connections").select("id").eq("provider", "phone_photos").maybeSingle();
    if (!conn) {
      const ins = await db.from("source_connections").insert({ creator_id: creatorId, provider: "phone_photos" }).select("id").single();
      if (ins.error && ins.error.code !== "23505") throw fromDbError(ins.error);
      conn = ins.data ?? (await db.from("source_connections").select("id").eq("provider", "phone_photos").single()).data;
    }
    if (!conn) throw new DomainError("internal", "We couldn't connect Photos.");
    return indexPhotos(serviceClient(), creatorId, conn.id, photos);
  },
  { feature: "personal_sources_enabled", rateLimit: 30 },
);
