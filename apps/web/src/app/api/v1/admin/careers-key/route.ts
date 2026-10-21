import { DomainError } from "@wonder/core";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { careersKeyView, clearCareersKey, saveCareersKey } from "@/lib/careers/wonderjobs";

/**
 * The WonderJobs career-site key (platform administrators only; anyone else is told there's nothing here). The key goes
 * in and is never sent back: reads return a mask (wjcs_••••••••abcd). Saves and clears are audited in the database with
 * the last four characters only.
 */
export const GET = withApi(async ({ db }) => {
  await requirePlatformAdmin(db);
  return careersKeyView();
});

const saveBody = z.object({ key: z.string().trim().min(1, "Paste the career-site key.").max(220) });

export const POST = withApi(
  async ({ db, creatorId, req }) => {
    await requirePlatformAdmin(db);
    const { key } = saveBody.parse(await readJson(req, 2_000));
    const r = await saveCareersKey(creatorId, key);
    if (!r.ok) throw new DomainError("validation", r.message);
    return careersKeyView();
  },
  { rateLimit: 10 },
);

export const DELETE = withApi(
  async ({ db, creatorId }) => {
    await requirePlatformAdmin(db);
    const r = await clearCareersKey(creatorId);
    if (!r.ok) throw new DomainError("provider_unavailable", "The key couldn't be cleared. Please try again.");
    return careersKeyView();
  },
  { rateLimit: 10 },
);
