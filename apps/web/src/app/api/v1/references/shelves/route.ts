import { createShelf, ensureDefaultShelves, listShelves } from "@wonder/creator-library";
import { readJson, withApi } from "@/lib/api";

export const GET = withApi(async ({ db, creatorId }) => {
  await ensureDefaultShelves(db, creatorId);
  return { shelves: await listShelves(db) };
});
export const POST = withApi(async ({ db, creatorId, req }) => ({ shelf: await createShelf(db, creatorId, await readJson(req)) }));
