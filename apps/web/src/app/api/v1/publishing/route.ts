import { publishingOverview } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";

/** The publishing queue (drafts, scheduled, in progress, failed), history and destinations, across pieces. */
export const GET = withApi(async ({ db }) => {
  const o = await publishingOverview(db);
  return { ...o, destinations: o.destinations.map(({ signing_secret: _secret, ...d }) => d) };
});
