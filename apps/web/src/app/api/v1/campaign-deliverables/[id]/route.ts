import { z } from "zod";
import { agreeDeliverable, campaignSubmission, reviewDeliverable, submitDeliverable } from "@wonder/creator-projects";
import { readJson, withApi } from "@/lib/api";

/** GET the submitted Creation (owner or its creator); POST agree · submit · review. Each is checked in the database. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ submission: await campaignSubmission(db, z.string().uuid().parse(id)) }));
export const POST = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    const b = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("agree") }),
        z.object({ action: z.literal("submit"), artifactId: z.string().uuid() }),
        z.object({ action: z.literal("review"), approve: z.boolean(), note: z.string().trim().max(1000).optional() }),
      ])
      .parse(await readJson(req));
    if (b.action === "agree") await agreeDeliverable(db, id);
    else if (b.action === "submit") await submitDeliverable(db, id, b.artifactId);
    else await reviewDeliverable(db, id, b.approve, b.note);
    return { ok: true };
  },
  { rateLimit: 30 },
);
