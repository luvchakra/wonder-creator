import { withApi } from "@/lib/api";
import { scheduleDiscovery } from "@/lib/home/discover";
import { buildHomePayload } from "@/lib/home/payload";

/**
 * GET /api/v1/home — Home as structured slots (phase 02 §14): mode, the Context Line, Continue, Quick Capture and the
 * optional modules that earned a place. Every priority rule is applied on the server; clients only render.
 */
export const GET = withApi(async ({ db, creatorId }) => {
  const home = await buildHomePayload(db, creatorId);
  scheduleDiscovery(db, creatorId);
  return home;
});
