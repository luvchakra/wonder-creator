import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Valuable logic (prompts, governance, the service client, payments, server config) must never ride to the browser.
 * Every file that starts with "use client" is checked: it may not import these modules (docs/security.md › Automated
 * access). `server-only` makes the build fail for the ones that carry it; this covers the packages that can't.
 */
const FORBIDDEN = [
  /@wonder\/creator-brain(?!\/types)/,
  /@wonder\/core\/server/,
  /@wonder\/creator-payments["']/, // only ./money (formatting) is browser-safe
  /@wonder\/creator-send/,
  /@wonder\/creator-sources\/server/,
  /@\/lib\/supabase\/(service|server)/,
  /@\/lib\/(session|features|payments|sources|api)["']/,
  /@\/lib\/help\/content/,
  /@\/lib\/careers\/wonderjobs/,
  /@\/lib\/platform-admin/,
  /livekit-server-sdk/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("client components stay on the client side of the line", () => {
  const files = walk("apps/web/src").filter((f) => /^\s*(["'])use client\1/.test(readFileSync(f, "utf8").slice(0, 200).trimStart()));
  it("finds the client components", () => expect(files.length).toBeGreaterThan(50));
  for (const re of FORBIDDEN) {
    it(`none imports ${re}`, () => {
      const bad = files.filter((f) => readFileSync(f, "utf8").split("\n").some((l) => /^\s*(import|export)\b.*from\b/.test(l) && !/^\s*import type\b/.test(l) && re.test(l)));
      expect(bad).toEqual([]);
    });
  }
});
