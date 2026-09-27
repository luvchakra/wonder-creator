import { addToShortlist, listShortlist } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

/** Your private shortlist (general, or for `project`). The people on it aren't told. */
export const GET = withApi(async ({ db, creatorId, req }) => ({ entries: await listShortlist(db, creatorId, req.nextUrl.searchParams.get("project")) }));

export const POST = withApi(async ({ db, creatorId, req }) => ({ id: await addToShortlist(db, creatorId, await readJson(req)) }), { rateLimit: 60 });
