import { resolveConnection } from "@wonder/creator-moments";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

const schema = z.object({ status: z.enum(["opened", "dismissed", "used"]) });

/**
 * PATCH /api/v1/moment-connections/:id `{status}` — the creator opened, used or dismissed a connection CreativeMind
 * found (Phase 05 §5). Dismissed never comes back. Recorded as an outcome for quality, never as engagement (§18).
 */
export const PATCH = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const { status } = schema.parse(await readJson(req));
    await resolveConnection(db, requireUuid(id, "connection"), status);
    track(status === "dismissed" ? "connection_dismissed" : status === "used" ? "connection_used" : "connection_opened", creatorId);
    return { ok: true };
  },
  { feature: "semantic_connections_enabled", rateLimit: 60 },
);
