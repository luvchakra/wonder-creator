import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { descriptionBlocks, jobFacts, jobPostingJsonLd } from "@/lib/careers/format";
import { careersJob } from "@/lib/careers/wonderjobs";
import { CareersNotice } from "../notice";
import { ApplyForm } from "./apply-form";
import { ShareJob } from "./share-job";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = await careersJob((await params).id);
  return r.ok ? { title: `${r.data.job.title} · Careers`, description: `${r.data.job.title} — ${jobFacts(r.data.job).join(" · ")}` } : { title: "Careers", robots: { index: false } };
}

/**
 * /careers/:id (docs/careers.md): one position, its description (plain text from WonderJobs, shown as text, never HTML),
 * Share, and the Apply form, which sends to this app's own server. A closed position says so and leads back to the list.
 */
export default async function CareerJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await careersJob(id);
  const back = (
    <Link href="/careers" className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 px-1 text-[14px] font-medium text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> All positions
    </Link>
  );
  if (!r.ok) {
    return (
      <>
        {back}
        {r.kind === "not_found" ? (
          <CareersNotice title="This position is no longer open" action={{ href: "/careers", label: "See open positions" }} />
        ) : r.kind === "not_configured" ? (
          <CareersNotice title="Careers isn't set up yet" />
        ) : (
          <CareersNotice title="Careers is unavailable right now" body="Please try again later." action={{ href: `/careers/${encodeURIComponent(id)}`, label: "Try again" }} />
        )}
      </>
    );
  }
  const { job, site } = r.data;
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost"}/careers/${encodeURIComponent(job.id)}`;
  return (
    <>
      {back}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingJsonLd(job, url) }} />
      <article aria-labelledby="job-title">
        <header>
          {job.company ? <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink">{job.company}</p> : null}
          <h1 id="job-title" className="mt-2 font-display text-[32px] leading-[1.08] [overflow-wrap:anywhere] [text-wrap:balance] sm:text-[42px]">
            {job.title}
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">{jobFacts(job).join(" · ")}</p>
          {job.skills?.length ? (
            <ul aria-label="Skills" className="mt-3 flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <li key={s} className="rounded-full bg-accent-softer px-2.5 py-1 text-[12.5px] text-accent-ink">
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4">
            <ShareJob title={job.title} url={url} />
          </div>
        </header>
        <div className="mt-6 space-y-3 rounded-3xl border border-white/80 bg-white/75 p-5 text-[15.5px] leading-relaxed text-ink shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm sm:p-6">
          {descriptionBlocks(job.description).map((b, i) =>
            b.kind === "h" ? (
              <h2 key={i} className="pt-1 font-display text-[19px] text-ink">
                {b.text}
              </h2>
            ) : b.kind === "ul" ? (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="whitespace-pre-line [overflow-wrap:anywhere]">
                {b.text}
              </p>
            ),
          )}
        </div>
      </article>
      <section aria-labelledby="apply-title" className="mt-8">
        <h2 id="apply-title" className="font-display text-[26px] leading-tight">
          Apply
        </h2>
        <p className="mt-1 text-[14px] text-ink-muted">Your application goes to {site.name}. You&apos;ll get an email confirming it, with a link to follow it.</p>
        <ApplyForm jobId={job.id} retentionMonths={site.retentionMonths} />
      </section>
    </>
  );
}
