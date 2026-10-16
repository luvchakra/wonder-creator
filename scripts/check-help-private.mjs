#!/usr/bin/env node
// Fails if any help text that's meant for signed-in creators ends up in a public file of the production build
// (docs/help.md › Who can read it). Everything under .next/static is served to anyone without a session, so a help topic
// that a client component imported would be readable signed out no matter what the /help page checks.
//
//   npm run build && node scripts/check-help-private.mjs
//
// The titles and first steps of every topic except the public ones (lib/help/public.ts) are the needles. They're read
// from the source, so the check follows the content as it changes.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = readFileSync(path.join(ROOT, "apps/web/src/lib/help/content.ts"), "utf8");
const publicSrc = readFileSync(path.join(ROOT, "apps/web/src/lib/help/public.ts"), "utf8");
const publicSlugs = new Set([...(/PUBLIC_HELP_SLUGS = \[([^\]]*)\]/.exec(publicSrc)?.[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));

// Each topic: its slug, title and summary, in source order.
const needles = [];
for (const m of content.matchAll(/slug: "([a-z0-9-]+)",\s*title: "([^"]+)",\s*summary: "([^"]+)"/g)) {
  if (!publicSlugs.has(m[1])) needles.push(m[3]);
}
if (needles.length < 20) {
  console.error(`Expected at least 20 signed-in help topics to look for, found ${needles.length}. Has the content's shape changed?`);
  process.exit(2);
}

const dir = path.join(ROOT, "apps/web/.next/static");
if (!existsSync(dir)) {
  console.error("No production build at apps/web/.next/static — run `npm run build` first.");
  process.exit(2);
}
const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const full = path.join(d, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|css|json|txt|html)$/.test(name)) files.push(full);
  }
};
walk(dir);

// Compiled code may escape non-ASCII characters (’ → ’), so look for both spellings.
const escape = (s) => s.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const leaks = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const n of needles) if (text.includes(n) || text.includes(escape(n))) leaks.push(`${path.relative(ROOT, file)}: “${n}”`);
}
if (leaks.length) {
  console.error(`Help text meant for signed-in creators is in public build files (${leaks.length}):\n${leaks.slice(0, 20).join("\n")}`);
  console.error("A client component is importing lib/help/content.ts. Pass the sections from the server page instead.");
  process.exit(1);
}
console.log(`No signed-in help text in ${files.length} public build files (${needles.length} topics checked).`);
