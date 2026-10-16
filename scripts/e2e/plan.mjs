#!/usr/bin/env node
// Splits the end-to-end suite into parts balanced by measured time, not file count (docs/testing.md › Nightly).
//
//   node scripts/e2e/plan.mjs [--specs "e2e/a.spec.ts e2e/b.spec.ts"] [--target-minutes 8] [--max-parts 6]
//
// Prints a GitHub Actions matrix: {"include":[{"part":1,"of":4,"files":"e2e/x.spec.ts …","minutes":7.1}, …]}.
// Times come from e2e/timings.json (seconds per spec file, measured on the nightly); a spec with no measurement yet
// counts as the median. Parts are filled slowest file first, each into the part with the least time so far (longest
// processing time first), so a slow file lands in a part of its own when it is long enough to fill one. The number
// of parts grows with the suite: one per `target-minutes` of measured time, at least one, at most `max-parts`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function plan({ files, seconds, targetMinutes = 8, maxParts = 6 }) {
  // The median of every measured spec (not just the ones asked for) stands in for a spec with no measurement yet.
  const known = Object.values(seconds).filter((s) => typeof s === "number").sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 10;
  const timed = files.map((f) => ({ file: f, s: typeof seconds[f] === "number" ? seconds[f] : median })).sort((a, b) => b.s - a.s || a.file.localeCompare(b.file));
  const total = timed.reduce((n, x) => n + x.s, 0);
  const count = Math.max(1, Math.min(maxParts, files.length, Math.ceil(total / (targetMinutes * 60))));
  const parts = Array.from({ length: count }, () => ({ files: [], s: 0 }));
  for (const x of timed) {
    const p = parts.reduce((a, b) => (b.s < a.s ? b : a));
    p.files.push(x.file);
    p.s += x.s;
  }
  return parts
    .filter((p) => p.files.length)
    .sort((a, b) => b.s - a.s)
    .map((p, i, all) => ({ part: i + 1, of: all.length, files: p.files.sort().join(" "), minutes: Math.round((p.s / 60) * 10) / 10 }));
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = readdirSync(path.join(ROOT, "e2e")).filter((f) => f.endsWith(".spec.ts")).map((f) => `e2e/${f}`).sort();
  const asked = (arg("specs", "") ?? "").split(/[\s,]+/).filter(Boolean).map((f) => (f.startsWith("e2e/") ? f : `e2e/${f}`));
  const unknown = asked.filter((f) => !all.includes(f));
  if (unknown.length) {
    console.error(`No such spec file: ${unknown.join(", ")}`);
    process.exit(2);
  }
  const timings = existsSync(path.join(ROOT, "e2e/timings.json")) ? JSON.parse(readFileSync(path.join(ROOT, "e2e/timings.json"), "utf8")).seconds ?? {} : {};
  const include = plan({ files: asked.length ? asked : all, seconds: timings, targetMinutes: Number(arg("target-minutes", 8)), maxParts: Number(arg("max-parts", 6)) });
  for (const p of include) console.error(`part ${p.part}/${p.of}: ~${p.minutes} min, ${p.files.split(" ").length} files`);
  process.stdout.write(JSON.stringify({ include }));
}
