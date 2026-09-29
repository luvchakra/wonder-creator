import { COMMUNITY_SOURCE_TYPES, SOURCE_TYPES, searchBringIn, type SourceType } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/**
 * GET /api/v1/studio-sessions/:id/bring-in?q=&only= — what to bring in, grouped (recent when empty). `only` is one
 * source type, or `community` for conversations, replies and Scrapbook entries together.
 */
export const GET = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const only = req.nextUrl.searchParams.get("only");
    const types: SourceType[] | undefined = only === "community" ? [...COMMUNITY_SOURCE_TYPES] : only && (SOURCE_TYPES as readonly string[]).includes(only) ? [only as SourceType] : undefined;
    return { results: await searchBringIn(db, creatorId, id, q, studioSigner(db), types) };
  },
  { rateLimit: 120 },
);
