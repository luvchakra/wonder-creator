import type { CareerJob, CareerSite } from "./client";

/** How a job and the consent read on the page (shared by the server pages and the apply form). */
const WORK_MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const JOB_TYPE: Record<string, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship", temporary: "Temporary", freelance: "Freelance" };

export const workModeLabel = (m: string) => WORK_MODE[m] ?? null;
export const jobTypeLabel = (t: string | undefined) => (t ? (JOB_TYPE[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())) : null);

export function salaryRange(j: Pick<CareerJob, "salaryMin" | "salaryMax" | "currency">): string | null {
  const has = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!has(j.salaryMin) && !has(j.salaryMax)) return null;
  let f: Intl.NumberFormat;
  try {
    f = new Intl.NumberFormat(j.currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency: j.currency || "INR", maximumFractionDigits: 0 });
  } catch {
    f = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  }
  if (has(j.salaryMin) && has(j.salaryMax)) return `${f.format(j.salaryMin)}–${f.format(j.salaryMax)}`;
  return has(j.salaryMin) ? `From ${f.format(j.salaryMin)}` : `Up to ${f.format(j.salaryMax!)}`;
}

/** One line of facts under a job's title: place · work mode · type · pay (when given). */
export function jobFacts(j: CareerJob): string[] {
  return [j.location, workModeLabel(j.workMode), jobTypeLabel(j.jobType), salaryRange(j)].filter((x): x is string => !!x && !!x.trim());
}

/**
 * The consent line. The retention period comes from WonderJobs; when it doesn't give one, the sentence leaves the period
 * out rather than inventing it.
 */
export function consentText(retentionMonths: CareerSite["retentionMonths"], org = "Wonder Creator"): string {
  const base = `I agree that ${org} stores my application to consider me for this and similar roles`;
  return retentionMonths ? `${base}, and deletes it ${retentionMonths} month${retentionMonths === 1 ? "" : "s"} after its last update.` : `${base}.`;
}

/** A job's plain-text description as paragraphs and lists (rendered as text, never HTML: it is untrusted). */
export type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] } | { kind: "h"; text: string };
export function descriptionBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of (text ?? "").replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines[0]!.endsWith(":") && lines[0]!.length < 80 && lines.length > 1) out.push({ kind: "h", text: lines.shift()!.slice(0, -1) });
    const bullets = lines.every((l) => /^[-•*]\s+/.test(l));
    if (bullets) out.push({ kind: "ul", items: lines.map((l) => l.replace(/^[-•*]\s+/, "")) });
    else out.push({ kind: "p", text: lines.join("\n") });
  }
  return out;
}

/** schema.org JobPosting for a job page (the only script on it; text is JSON-escaped, `<` included). */
export function jobPostingJsonLd(j: CareerJob, url: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description: j.description,
    datePosted: j.updatedAt,
    employmentType: j.jobType ? j.jobType.toUpperCase() : undefined,
    hiringOrganization: { "@type": "Organization", name: j.company || "Wonder Creator" },
    jobLocationType: j.workMode === "remote" ? "TELECOMMUTE" : undefined,
    jobLocation: j.location ? { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: j.location } } : undefined,
    skills: j.skills?.length ? j.skills.join(", ") : undefined,
    baseSalary:
      typeof j.salaryMin === "number" || typeof j.salaryMax === "number"
        ? { "@type": "MonetaryAmount", currency: j.currency || "INR", value: { "@type": "QuantitativeValue", minValue: j.salaryMin, maxValue: j.salaryMax, unitText: "YEAR" } }
        : undefined,
    url,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
