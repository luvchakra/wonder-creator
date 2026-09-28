import { slideUsage } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

/** GET /api/v1/studio-sessions/:id/usage — which slides each source is used in (Carousels; derived from what's recorded). */
export const GET = withApi<{ id: string }>(
  async ({ db }, { id }) => {
    assertUuid(id);
    return { usage: await slideUsage(db, id) };
  },
  { rateLimit: 240 },
);
