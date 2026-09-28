import { activeStudioSession } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";

/** GET /api/v1/studio-sessions/active — the Studio the creator was last in (for "Use in Studio" from elsewhere). */
export const GET = withApi(async ({ db, creatorId }) => ({ session: await activeStudioSession(db, creatorId) }));
