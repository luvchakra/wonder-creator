import { restoreVersion } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { versionId } = z.object({ versionId: z.string().uuid() }).parse(await readJson(req));
  return { version: await restoreVersion(db, requireUuid(id, "Creation"), versionId) };
}, { reindex: true });
