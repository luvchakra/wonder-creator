import { draftMessage } from "@wonder/creator-brain";
import { z } from "zod";
import { brainDeps } from "@/lib/brain";
import { readJson, withApi } from "@/lib/api";

const body = z
  .object({ crewId: z.string().uuid().nullish(), threadId: z.string().uuid().nullish(), intent: z.string().trim().min(1, "Say what you'd like to say.").max(1000), about: z.string().trim().max(200).nullish() })
  .refine((b) => !!b.crewId !== !!b.threadId, { message: "Choose where the message goes." });

/** CreatorBrain drafts a message for you to review. It's never sent from here. */
export const POST = withApi(
  async ({ db, creatorId, req, requestId }) => {
    const b = body.parse(await readJson(req));
    const where = b.crewId ? ({ kind: "crew", crewId: b.crewId } as const) : ({ kind: "direct", threadId: b.threadId! } as const);
    return draftMessage(await brainDeps(db, creatorId, { correlationId: requestId }), { where, intent: b.intent, about: b.about ?? null });
  },
  { rateLimit: 20 },
);
