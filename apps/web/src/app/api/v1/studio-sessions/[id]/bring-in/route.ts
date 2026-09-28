import { SOURCE_TYPES, searchBringIn, type SourceType } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** GET /api/v1/studio-sessions/:id/bring-in?q= — Materials, Creations and Collections to bring in, grouped (recent when empty). */
export const GET = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const only = req.nextUrl.searchParams.get("only");
    return { results: await searchBringIn(db, creatorId, id, q, studioSigner(db), only && (SOURCE_TYPES as readonly string[]).includes(only) ? [only as SourceType] : undefined) };
  },
  { rateLimit: 120 },
);
