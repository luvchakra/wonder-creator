import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The careers pages' states, with WonderJobs mocked (never a real call). */
const TOKEN = `wjst_${"t".repeat(20)}`;
const jobs = vi.fn();
const status = vi.fn();
const admin = vi.fn(async () => false);
vi.mock("@/lib/careers/wonderjobs", () => ({ careersJobs: () => jobs(), careersStatus: (t: string, a: string) => status(t, a), careersJob: vi.fn() }));
vi.mock("./admin-reason", () => ({ viewerIsPlatformAdmin: () => admin() }));

const render = async () => {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(await Page());
};

beforeEach(() => {
  jobs.mockReset();
  status.mockReset();
  admin.mockResolvedValue(false);
});

describe("/careers", () => {
  it("lists only what WonderJobs returns, linking each job to its page", async () => {
    jobs.mockResolvedValue({ ok: true, data: { site: { name: "S", retentionMonths: 12 }, jobs: [{ id: "abc", title: "Sound designer", location: "Goa", workMode: "remote", currency: "INR", description: "", skills: ["Ableton"], company: "W", updatedAt: "x" }] } });
    const html = await render();
    expect(html).toContain("Sound designer");
    expect(html).toContain('href="/careers/abc"');
    expect(html).toContain("Remote");
    expect(html).toContain("Ableton");
  });

  it("says there are no open positions, with no sample jobs", async () => {
    jobs.mockResolvedValue({ ok: true, data: { site: { name: "S", retentionMonths: null }, jobs: [] } });
    const html = await render();
    expect(html).toContain("No open positions right now");
    expect(html).not.toMatch(/href="\/careers\/[^"]+"/);
  });

  it("says it's unavailable when WonderJobs can't be reached, and offers to try again", async () => {
    jobs.mockResolvedValue({ ok: false, kind: "unavailable" });
    const html = await render();
    expect(html).toContain("Careers is unavailable right now");
    expect(html).toContain("Try again");
  });

  it("says it isn't set up; only an administrator sees why", async () => {
    jobs.mockResolvedValue({ ok: false, kind: "not_configured" });
    let html = await render();
    expect(html).toContain("Careers isn&#x27;t set up yet");
    expect(html).not.toContain("career-site key");
    admin.mockResolvedValue(true);
    html = await render();
    expect(html).toContain("No WonderJobs career-site key is saved");
    expect(html).toContain('href="/settings/careers"');
  });
});

describe("/careers/status", () => {
  const renderStatus = async (t?: string) => {
    const { default: Page } = await import("./status/page");
    return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(t ? { t } : {}) }));
  };

  it("is never indexed and never sends its address on as a referrer", async () => {
    const { metadata } = await import("./status/page");
    expect(metadata).toMatchObject({ robots: { index: false, follow: false }, referrer: "no-referrer" });
  });

  it("asks WonderJobs with the token (in a body, through the client) and shows the application", async () => {
    status.mockResolvedValue({ ok: true, data: { status: "reviewing", statusLabel: "In review", jobTitle: "Sound designer", company: "W", appliedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", canWithdraw: true } });
    const html = await renderStatus(TOKEN);
    expect(status).toHaveBeenCalledWith(TOKEN, "view");
    expect(html).toContain("In review");
    expect(html).toContain("Withdraw application");
  });

  it("with a missing or unknown token, points back to the email", async () => {
    expect(await renderStatus()).toContain("We couldn&#x27;t find that application");
    expect(status).not.toHaveBeenCalled();
    status.mockResolvedValue({ ok: false, kind: "not_found" });
    expect(await renderStatus(`wjst_${"u".repeat(20)}`)).toContain("Use the link in your email.");
  });
});
