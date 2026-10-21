import type { Metadata } from "next";
import { careersStatus } from "@/lib/careers/wonderjobs";
import { CAREERS_STATUS_METADATA } from "@/lib/careers/status-meta";
import { CareersNotice } from "../notice";
import { StatusCard } from "./status-card";

export const dynamic = "force-dynamic";
// Never indexed, and the token in this address is never sent on as a referrer (next.config.ts sends the header too).
export const metadata: Metadata = CAREERS_STATUS_METADATA;

/**
 * /careers/status?t=… (docs/careers.md › Status): the link in an applicant's email. This server sends the token to
 * WonderJobs in a request body (never in a URL it requests) and shows the answer; Withdraw is offered when allowed.
 */
export default async function CareersStatusPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw.trim() : "";
  const r = token ? await careersStatus(token, "view") : null;
  if (!r || (!r.ok && r.kind === "not_found")) return <CareersNotice title="We couldn't find that application" body="Use the link in your email." action={{ href: "/careers", label: "See open positions" }} />;
  if (!r.ok) return <CareersNotice title="Your application can't be reached right now" body="Please try again later." />;
  return <StatusCard token={token} initial={r.data} />;
}
