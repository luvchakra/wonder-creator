import { DomainError } from "@wonder/core";
import { recordPlatformMetrics } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/**
 * POST /api/v1/publications/:id/metrics — a connected destination reports platform numbers for a publication it
 * received (P1-20). No session: the body is signed with the destination's secret, exactly like our publishes to it
 * (`x-wonder-timestamp`, `x-wonder-signature: v1=<hex HMAC-SHA256("timestamp.body")>`).
 * Body: `{ "observedAt"?: ISO time, "metrics": { "views": 1204, "shares": 38 } }`. Like counts are not accepted.
 */
export const POST = withApi<{ id: string }>(
  async ({ req }, { id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "Unknown publication.");
    const body = await req.text();
    if (body.length > 10_000) throw new DomainError("payload_too_large", "That report is too large.");
    return recordPlatformMetrics(serviceClient(), { publicationId: id, timestamp: req.headers.get("x-wonder-timestamp"), signature: req.headers.get("x-wonder-signature"), body });
  },
  { public: true, rateLimit: 60 },
);
