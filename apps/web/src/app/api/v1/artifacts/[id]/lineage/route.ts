import { lineageGraph } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => lineageGraph(db, requireUuid(id, "piece")));
