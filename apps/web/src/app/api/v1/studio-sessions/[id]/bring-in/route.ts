import { searchBringIn } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** GET /api/v1/studio-sessions/:id/bring-in?q= — Materials, Creations and Collections to bring in, grouped (recent when empty). */
export const GET = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const q = req.nextUrl.searchParams.get("q") ?? "";
    return { results: await searchBringIn(db, creatorId, id, q, studioSigner(db)) };
  },
  { rateLimit: 120 },
);
