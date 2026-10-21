import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { jobFacts } from "@/lib/careers/format";
import { careersJobs } from "@/lib/careers/wonderjobs";
import { viewerIsPlatformAdmin } from "./admin-reason";
import { CareersNotice } from "./notice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Careers", description: "Open positions at Wonder Creator." };

/**
 * /careers (owner, 21 Oct 2026; docs/careers.md): the open jobs WonderJobs links to this site, each opening its own page.
 * Never sample jobs: with none open it says so; unconfigured or unreachable, it says that (administrators see why).
 */
export default async function CareersPage() {
  const r = await careersJobs();
  // Only when something is wrong: an administrator sees why.
  const admin = !r.ok && (r.kind === "not_configured" || r.kind === "unauthorized") ? await viewerIsPlatformAdmin() : false;
  return (
    <>
      <header className="mb-7">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink">Careers</p>
        <h1 className="mt-3 font-display text-[36px] leading-[1.05] tracking-[-0.01em] [text-wrap:balance] sm:text-[48px]">Make things with us</h1>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-muted">The positions open right now. Each one says where, how and what it involves, and how to apply.</p>
      </header>
      {r.ok ? (
        r.data.jobs.length ? (
          <ul aria-label="Open positions" className="space-y-3">
            {r.data.jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/careers/${encodeURIComponent(j.id)}`}
                  className="group block rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-offset-4"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-display text-[22px] leading-snug text-ink [overflow-wrap:anywhere]">{j.title}</span>
                      <span className="mt-1 block text-[14px] text-ink-muted">{jobFacts(j).join(" · ")}</span>
                    </span>
                    <ArrowRight className="mt-2 size-5 shrink-0 text-accent transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </span>
                  {j.skills?.length ? (
                    <span className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">
                      {j.skills.slice(0, 12).map((s) => (
                        <span key={s} className="rounded-full bg-accent-softer px-2.5 py-1 text-[12.5px] text-accent-ink">
                          {s}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <CareersNotice title="No open positions right now" body="Check back soon." />
        )
      ) : r.kind === "not_configured" || r.kind === "unauthorized" ? (
        <NotSetUp reason={r.kind} admin={admin} />
      ) : (
        <CareersNotice title="Careers is unavailable right now" body="Please try again later." action={{ href: "/careers", label: "Try again" }} />
      )}
    </>
  );
}

function NotSetUp({ reason, admin }: { reason: "not_configured" | "unauthorized"; admin: boolean }) {
  if (reason === "unauthorized" && !admin) return <CareersNotice title="Careers is unavailable right now" body="Please try again later." action={{ href: "/careers", label: "Try again" }} />;
  return (
    <CareersNotice
      title="Careers isn't set up yet"
      body={
        admin ? (
          <p>
            {reason === "not_configured" ? "No WonderJobs career-site key is saved." : "WonderJobs refused the saved career-site key: it may have been revoked."} Add one in{" "}
            <Link href="/settings/careers" className="font-medium text-accent-ink underline underline-offset-2">
              Settings › Careers
            </Link>
            .
          </p>
        ) : undefined
      }
    />
  );
}
