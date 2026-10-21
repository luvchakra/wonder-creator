import { DomainError } from "@wonder/core";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { failureMessage } from "@/lib/careers/client";
import { careersStatus } from "@/lib/careers/wonderjobs";
import { clientIp } from "@/lib/request-ip";

/**
 * POST /api/v1/careers/status — an applicant's own application, by the token from their email (public; cross-site POSTs
 * refused). The token comes in the body and goes on in the body, never in a URL anyone requests, so it stays out of
 * logs. `withdraw` only when WonderJobs says it can be.
 */
const body = z.object({ token: z.string().trim().min(1).max(200), action: z.enum(["view", "withdraw"]) });

export const POST = withApi(
  async ({ req }) => {
    await checkBudget(`careers:status:${clientIp(req)}`, 30, 60 * 60_000);
    const { token, action } = body.parse(await readJson(req, 2_000));
    const r = await careersStatus(token, action);
    if (r.ok) return { application: r.data };
    if (r.kind === "not_found") throw new DomainError("not_found", "We couldn't find that application. Use the link in your email.");
    if (r.kind === "conflict" || r.kind === "bad_request") throw new DomainError("conflict", r.message);
    if (r.kind === "busy") throw new DomainError("rate_limited", failureMessage(r));
    throw new DomainError("provider_unavailable", "Your application can't be reached right now. Please try again later.");
  },
  { public: true, rateLimit: 20 },
);
