import { createCollection, listCollections } from "@wonder/creator-library";
import { readJson, withApi } from "@/lib/api";

export const GET = withApi(async ({ db }) => ({ collections: await listCollections(db) }));
export const POST = withApi(async ({ db, creatorId, req }) => ({ collection: await createCollection(db, creatorId, await readJson(req)) }));
