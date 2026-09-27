import { listDerivatives } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

/** Pieces adapted from this one: source version, destination made for, inherited rights and publications. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ derivatives: await listDerivatives(db, requireUuid(id, "Creation")) }));
