import { importRecords } from "@wonder/creator-sources/server";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { sourcesDeps } from "@/lib/sources";

export const maxDuration = 30;

const schema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(50),
  to: z.enum(["materials", "studio"]).default("materials"),
  photoMaterials: z.record(z.string().uuid(), z.string().uuid()).default({}),
});

/** POST /api/v1/personal-sources/records/import — bring in items chosen from a search, exactly like from a candidate. */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const b = schema.parse(await readJson(req));
    const { materialIds } = await importRecords(sourcesDeps(), db, creatorId, b.recordIds, b.photoMaterials);
    return { materialIds, next: b.to === "studio" ? `/create?materials=${materialIds.join(",")}` : "/materials?tab=ideas" };
  },
  { feature: "personal_sources_enabled", rateLimit: 20 },
);
