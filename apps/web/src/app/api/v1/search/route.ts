import { withApi } from "@/lib/api";
import { parseSearch, unifiedSearch } from "@/lib/search";

/**
 * Unified search (`q`, optional `type` tab, `when`, `kind`, `tag`). Everything runs through the caller's
 * RLS-scoped client; see `unifiedSearch`.
 */
export const GET = withApi(async ({ db, creatorId, req }) => unifiedSearch(db, creatorId!, parseSearch(req.nextUrl.searchParams)), { rateLimit: 60 });
