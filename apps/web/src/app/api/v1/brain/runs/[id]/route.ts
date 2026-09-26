import { getRunProgress } from "@wonder/creator-brain";
import { requireUuid, withApi } from "@/lib/api";

/** A run's stages and outcome (owner only, via RLS). Never includes prompts or model output. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => getRunProgress(db, requireUuid(id, "run")), { rateLimit: 240 });
