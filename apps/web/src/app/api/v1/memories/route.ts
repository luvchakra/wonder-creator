import { addMemory, listMemories, memoryInputSchema } from "@wonder/creator-brain";
import { readJson, withApi } from "@/lib/api";

export const GET = withApi(async ({ db }) => ({ memories: await listMemories(db) }));

export const POST = withApi(async ({ db, creatorId, req }) => {
  const m = memoryInputSchema.parse(await readJson(req));
  const memory = await addMemory(db, creatorId, { ...m, sourceKind: "creator", sourceLabel: "Added by you" });
  return { memory };
});
