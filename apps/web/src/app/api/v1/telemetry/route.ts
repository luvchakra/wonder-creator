import { DomainError } from "@wonder/core";
import { after } from "next/server";
import { readJson, withApi } from "@/lib/api";
import { cleanProps, isTelemetryEvent, trackAsync } from "@/lib/telemetry";

/**
 * POST /api/v1/telemetry `{event, props}` — a named outcome event (allowlisted), logged without content, and only when
 * the creator has turned on usage measures.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const b = (await readJson(req, 2_000)) as { event?: unknown; props?: unknown };
    if (!isTelemetryEvent(b.event)) throw new DomainError("validation", "Unknown event.");
    // The consent check and the log line happen after the answer is sent: the beacon never waits for them.
    const props = cleanProps(b.props);
    const event = b.event;
    after(() => trackAsync(db, event, creatorId, props).catch(() => undefined));
    return { ok: true };
  },
  { rateLimit: 120 },
);
