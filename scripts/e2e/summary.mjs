#!/usr/bin/env node
// Reads one or more Playwright JSON reports and says what happened (docs/testing.md › Nightly):
//
//   node scripts/e2e/summary.mjs [--json out.json] [--timings out.json] report.json [report.json …]
//
// Markdown goes to stdout (for $GITHUB_STEP_SUMMARY): counts of passed / failed / flaky / skipped / not run, then each
// failed, flaky and not-run test by file and title. "Flaky" is a test that failed and then passed on retry: it counts as
// passing for the run, but it is listed so it gets a root cause. "Not run" is a test the part's time budget stopped
// before it started (or interrupted mid-way) — the run ended cleanly, but those tests told us nothing.
// --json writes the counts and lists; --timings writes measured seconds per spec file for e2e/timings.json.
// Exits 0; the Playwright step's own exit code is what fails a part.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const jsonOut = opt("json");
const timingsOut = opt("timings");
const files = args.filter((f) => existsSync(f));

export function summarize(reports) {
  const out = { passed: 0, failed: [], flaky: [], skipped: 0, notRun: [], seconds: {}, missing: 0 };
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const where = `${spec.file ?? file}:${spec.line} › ${spec.title}${t.projectName ? ` [${t.projectName}]` : ""}`;
        const results = t.results ?? [];
        const ran = results.filter((r) => r.status !== "skipped" || (r.duration ?? 0) > 0);
        for (const r of results) out.seconds[`e2e/${spec.file ?? file}`] = (out.seconds[`e2e/${spec.file ?? file}`] ?? 0) + (r.duration ?? 0) / 1000;
        // test.skip / test.fixme are decisions in the code, not time running out.
        const marked = [...(t.annotations ?? []), ...(spec.annotations ?? [])].some((a) => a.type === "skip" || a.type === "fixme");
        if (marked && t.status === "skipped") out.skipped++;
        else if (!results.length || results.every((r) => r.status === "interrupted")) out.notRun.push(where);
        else if (t.status === "flaky") out.flaky.push(where);
        else if (t.status === "unexpected") out.failed.push(where);
        else if (t.status === "skipped" && !ran.length) out.skipped++;
        else out.passed++;
      }
    }
    for (const s of suite.suites ?? []) walk(s, s.file ?? file);
  };
  for (const r of reports) for (const s of r.suites ?? []) walk(s, s.file);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reports = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
  const s = summarize(reports);
  // A part that produced no report at all (it died before Playwright wrote one) is said, not hidden.
  const expected = Number(process.env.E2E_PARTS || 0);
  s.missing = expected ? Math.max(0, expected - files.length) : 0;
  const total = s.passed + s.failed.length + s.flaky.length + s.skipped + s.notRun.length;
  const ok = !s.failed.length && !s.notRun.length && !s.missing;
  const lines = [
    `### End-to-end: ${ok ? (s.flaky.length ? "passed, with flaky tests" : "passed") : "FAILED"}`,
    "",
    "| Passed | Failed | Flaky (passed on retry) | Skipped | Not run (time budget) | Total |",
    "|---:|---:|---:|---:|---:|---:|",
    `| ${s.passed} | ${s.failed.length} | ${s.flaky.length} | ${s.skipped} | ${s.notRun.length} | ${total} |`,
    "",
  ];
  if (s.missing) lines.push(`**${s.missing} part(s) produced no report** — see that job's log.`, "");
  const list = (title, items) => {
    if (!items.length) return;
    lines.push(`**${title}**`, "", ...items.slice(0, 50).map((x) => `- \`${x}\``), ...(items.length > 50 ? [`- … and ${items.length - 50} more`] : []), "");
  };
  list("Failed", s.failed);
  list("Flaky — failed first, passed on retry. Find the root cause; flaky is not one.", s.flaky);
  list("Not run — the part's time budget ended first", s.notRun);
  process.stdout.write(lines.join("\n") + "\n");
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ ok, ...s, seconds: undefined }, null, 2));
  if (timingsOut) writeFileSync(timingsOut, JSON.stringify(Object.fromEntries(Object.entries(s.seconds).sort().map(([k, v]) => [k, Math.round(v * 10) / 10])), null, 2) + "\n");
}
