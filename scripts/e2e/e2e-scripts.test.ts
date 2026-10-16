import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM scripts without type declarations
import { plan } from "./plan.mjs";
// @ts-expect-error — plain ESM scripts without type declarations
import { summarize } from "./summary.mjs";

describe("nightly parts (scripts/e2e/plan.mjs)", () => {
  it("balances by measured time, not file count, and gives a long file a part of its own", () => {
    const seconds = { "e2e/long.spec.ts": 480, "e2e/a.spec.ts": 120, "e2e/b.spec.ts": 120, "e2e/c.spec.ts": 120, "e2e/d.spec.ts": 120 };
    const parts = plan({ files: Object.keys(seconds), seconds, targetMinutes: 8 });
    expect(parts).toHaveLength(2);
    expect(parts.map((p: { files: string; minutes: number }) => [p.files, p.minutes])).toEqual([
      ["e2e/long.spec.ts", 8],
      ["e2e/a.spec.ts e2e/b.spec.ts e2e/c.spec.ts e2e/d.spec.ts", 8],
    ]);
  });

  it("counts an unmeasured spec as the median, and runs a short list as one part", () => {
    const parts = plan({ files: ["e2e/new.spec.ts", "e2e/a.spec.ts"], seconds: { "e2e/a.spec.ts": 30, "e2e/b.spec.ts": 50, "e2e/c.spec.ts": 70 } });
    expect(parts).toEqual([{ part: 1, of: 1, files: "e2e/a.spec.ts e2e/new.spec.ts", minutes: 1.3 }]);
  });
});

describe("nightly summary (scripts/e2e/summary.mjs)", () => {
  it("tells passed, failed, flaky, skipped and not run apart", () => {
    const t = (title: string, status: string, results: Array<{ status: string; duration: number }>, annotations: Array<{ type: string }> = []) => ({ title, file: "x.spec.ts", line: 1, tests: [{ projectName: "desktop", status, results, annotations }] });
    const report = {
      suites: [
        {
          file: "x.spec.ts",
          specs: [
            t("ok", "expected", [{ status: "passed", duration: 1000 }]),
            t("retried", "flaky", [{ status: "failed", duration: 500 }, { status: "passed", duration: 500 }]),
            t("broken", "unexpected", [{ status: "failed", duration: 10 }, { status: "failed", duration: 10 }]),
            t("budget", "skipped", []),
            t("cut", "skipped", [{ status: "interrupted", duration: 900 }]),
            t("fixme", "skipped", [], [{ type: "fixme" }]),
          ],
        },
      ],
    };
    const s = summarize([report]);
    expect([s.passed, s.failed.length, s.flaky.length, s.skipped, s.notRun.length]).toEqual([1, 1, 1, 1, 2]);
    expect(s.flaky[0]).toContain("retried");
  });
});
