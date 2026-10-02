import { DomainError } from "@wonder/core";
import { readJson, withApi } from "@/lib/api";
import { cleanProps, isTelemetryEvent, track } from "@/lib/telemetry";

/**
 * POST /api/v1/telemetry `{event, props}` — a named outcome event (allowlisted), logged without content, and only when
 * the creator has turned on usage measures.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const b = (await readJson(req, 2_000)) as { event?: unknown; props?: unknown };
    if (!isTelemetryEvent(b.event)) throw new DomainError("validation", "Unknown event.");
    track(db, b.event, creatorId, cleanProps(b.props));
    return { ok: true };
  },
  { rateLimit: 120 },
);
