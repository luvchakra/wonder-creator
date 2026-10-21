import { describe, expect, it } from "vitest";
import { consentText, descriptionBlocks, jobFacts, jobPostingJsonLd } from "./format";
import type { CareerJob } from "./client";

const job: CareerJob = { id: "j1", title: "Designer", location: "Pune", workMode: "hybrid", jobType: "full_time", salaryMin: 1000000, salaryMax: 1500000, currency: "INR", description: "About:\nWe make things.\n\n- one\n- two", skills: ["Figma"], company: "W", updatedAt: "2026-10-01T00:00:00Z" };

describe("careers formatting", () => {
  it("states the retention period only when WonderJobs gives one", () => {
    expect(consentText(12)).toBe("I agree that Wonder Creator stores my application to consider me for this and similar roles, and deletes it 12 months after its last update.");
    expect(consentText(1)).toMatch(/deletes it 1 month after/);
    expect(consentText(null)).toBe("I agree that Wonder Creator stores my application to consider me for this and similar roles.");
  });

  it("lists place, mode, type and pay", () => {
    const f = jobFacts(job);
    expect(f.slice(0, 3)).toEqual(["Pune", "Hybrid", "Full-time"]);
    expect(f[3]).toMatch(/10,00,000.*15,00,000/);
    expect(jobFacts({ ...job, salaryMin: undefined, salaryMax: undefined, jobType: undefined })).toEqual(["Pune", "Hybrid"]);
  });

  it("reads a description as text blocks, never markup", () => {
    expect(descriptionBlocks(job.description)).toEqual([{ kind: "h", text: "About" }, { kind: "p", text: "We make things." }, { kind: "ul", items: ["one", "two"] }]);
    expect(descriptionBlocks("<script>alert(1)</script>")).toEqual([{ kind: "p", text: "<script>alert(1)</script>" }]);
  });

  it("escapes the JSON-LD so it can't close its script", () => {
    const ld = jobPostingJsonLd({ ...job, title: "</script><script>x" }, "https://x.example/careers/j1");
    expect(ld).not.toContain("</script>");
    expect(JSON.parse(ld)).toMatchObject({ "@type": "JobPosting", title: "</script><script>x", hiringOrganization: { name: "W" } });
  });
});
