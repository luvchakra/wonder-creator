import { addLicense } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ license: await addLicense(db, creatorId, requireUuid(id, "piece"), await readJson(req)) }));
