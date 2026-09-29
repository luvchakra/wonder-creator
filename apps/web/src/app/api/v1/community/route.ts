import { COMMUNITY_FILTERS, communityFeed, type CommunityFilter } from "@wonder/creator-community";
import { withApi } from "@/lib/api";
import { communityView } from "@/lib/community";

/** GET /api/v1/community?filter=for_you|conversations|help|people&before= — a small curated set, never a ranked stream. */
export const GET = withApi(async ({ db, creatorId, req }) => {
  const p = req.nextUrl.searchParams;
  const f = p.get("filter");
  const filter: CommunityFilter = f && (COMMUNITY_FILTERS as readonly string[]).includes(f) ? (f as CommunityFilter) : "for_you";
  return communityView(db, await communityFeed(db, creatorId, filter, { before: p.get("before") }));
}, { feature: "community_enabled" });
