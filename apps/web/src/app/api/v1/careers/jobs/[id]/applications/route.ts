import { isDomainError } from "@wonder/core";
import { NextResponse } from "next/server";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { handleApplication } from "@/lib/careers/apply";
import { careersApply } from "@/lib/careers/wonderjobs";
import { clientIp } from "@/lib/request-ip";

/**
 * POST /api/v1/careers/jobs/:id/applications — an applicant's application, from this app's own job page (public, no
 * sign-in; cross-site POSTs are refused by withApi). Checked here, then forwarded to WonderJobs, which stores it and
 * emails the applicant and the hiring team. About 10 an hour per address. Nothing is stored or logged here beyond the
 * job id, the status and the time (lib/careers/client.ts).
 */
export const POST = withApi<{ id: string }>(
  async ({ req }, { id }) => {
    const raw = await readJson(req, 20_000);
    const reply = await handleApplication(id, raw, {
      limited: async () => {
        try {
          await checkBudget(`careers:apply:${clientIp(req)}`, 10, 60 * 60_000);
          return false;
        } catch (e) {
          if (isDomainError(e) && e.code === "rate_limited") return true;
          throw e;
        }
      },
      apply: careersApply,
    });
    return NextResponse.json(reply.body, {
      status: reply.status,
      headers: { "cache-control": "no-store", ...(reply.retryAfter ? { "retry-after": String(reply.retryAfter) } : {}) },
    });
  },
  { public: true, rateLimit: 20 },
);
