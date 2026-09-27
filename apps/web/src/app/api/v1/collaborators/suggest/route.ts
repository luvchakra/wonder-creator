import { suggestCollaborators } from "@wonder/creator-brain";
import { z } from "zod";
import { brainDeps } from "@/lib/brain";
import { readJson, withApi } from "@/lib/api";

const body = z.object({ ask: z.string().trim().min(1, "Say who you're looking for.").max(500), projectId: z.string().uuid().nullish() });

/** "Find three cinematographers in my network who fit this project." Suggestions only; nobody is contacted. */
export const POST = withApi(
  async ({ db, creatorId, req, requestId }) => {
    const b = body.parse(await readJson(req));
    return suggestCollaborators(await brainDeps(db, creatorId, { correlationId: requestId }), { ask: b.ask, projectId: b.projectId ?? null });
  },
  { rateLimit: 10 },
);
