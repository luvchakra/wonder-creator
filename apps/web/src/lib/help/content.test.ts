import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HELP_SECTIONS, allTopics, type HelpTopic } from "./content";
import { searchHelp, stem, tokenize } from "./search";

/**
 * The Help page's content is data, so its mistakes are findable: duplicate anchors, empty topics, links to pages that
 * don't exist, and words the product's copy rules keep out (CLAUDE.md: no internal technology, nothing invented).
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../app");

/** Does a page exist for this path? Route groups "(x)" add nothing to a path; "[x]" matches any one segment. */
function pageExists(pathname: string, dir = APP_DIR, segments = pathname.split("/").filter(Boolean)): boolean {
  if (!segments.length && existsSync(join(dir, "page.tsx"))) return true;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (/^\(.+\)$/.test(name) && pageExists(pathname, full, segments)) return true;
    if (!segments.length) continue;
    if ((name === segments[0] || /^\[[^.\]]+\]$/.test(name)) && pageExists(pathname, full, segments.slice(1))) return true;
  }
  return false;
}

const text = (t: HelpTopic) => [t.title, t.summary, ...(t.body ?? []), ...(t.steps ?? []), ...(t.notes ?? []), ...(t.terms ?? []).flatMap((x) => [x.term, x.text]), ...(t.links ?? []).map((l) => l.label)].join("\n");

describe("help content", () => {
  const topics = allTopics();

  it("has sections in reading order, each with a title, a blurb and topics", () => {
    expect(HELP_SECTIONS.length).toBeGreaterThanOrEqual(8);
    for (const s of HELP_SECTIONS) {
      expect(s.title.length, s.id).toBeGreaterThan(2);
      expect(s.blurb.length, s.id).toBeGreaterThan(10);
      expect(s.topics.length, `${s.id} has no topics`).toBeGreaterThan(0);
    }
  });

  it("covers what Wonder Creator does today", () => {
    const ids = HELP_SECTIONS.map((s) => s.id);
    for (const id of ["getting-started", "capturing", "creating", "ai", "publishing", "together", "rights", "privacy", "troubleshooting", "contact"]) expect(ids, id).toContain(id);
    const slugs = topics.map((t) => t.topic.slug);
    for (const slug of ["first-five-minutes", "quick-capture", "bring-in", "working-table", "carousel", "versions", "you-decide", "own-key", "publish-a-page", "creator-page", "huddles", "licenses", "your-data", "checklist", "contact-us"]) expect(slugs, slug).toContain(slug);
  });

  it("gives every section and topic a unique, linkable anchor", () => {
    const anchors = [...HELP_SECTIONS.map((s) => s.id), ...topics.map((t) => t.topic.slug)];
    expect(new Set(anchors).size, `duplicate anchors: ${anchors.filter((a, i) => anchors.indexOf(a) !== i).join(", ")}`).toBe(anchors.length);
    for (const a of anchors) expect(a).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has no empty topics", () => {
    for (const { topic } of topics) {
      expect(topic.title.length, topic.slug).toBeGreaterThan(3);
      expect(topic.summary.length, `${topic.slug} summary`).toBeGreaterThan(20);
      expect(topic.keywords.length, `${topic.slug} keywords`).toBeGreaterThan(2);
      expect((topic.body?.length ?? 0) + (topic.steps?.length ?? 0) + (topic.terms?.length ?? 0), `${topic.slug} has nothing to read`).toBeGreaterThan(0);
      for (const line of [...(topic.body ?? []), ...(topic.steps ?? []), ...(topic.notes ?? [])]) expect(line.trim().length, `${topic.slug} has an empty line`).toBeGreaterThan(8);
      for (const t of topic.terms ?? []) expect(t.term.length * t.text.length, `${topic.slug} ${t.term}`).toBeGreaterThan(0);
    }
  });

  it("has no repeated lines or terms within a topic (they're React keys)", () => {
    for (const { topic } of topics) {
      for (const [name, list] of [["body", topic.body], ["steps", topic.steps], ["notes", topic.notes], ["terms", topic.terms?.map((t) => t.term)], ["links", topic.links?.map((l) => l.href)]] as const) {
        expect(new Set(list ?? []).size, `${topic.slug} repeats a line in ${name}`).toBe((list ?? []).length);
      }
    }
  });

  it("links only to pages that exist in this app", () => {
    let count = 0;
    for (const { topic } of topics) {
      for (const link of topic.links ?? []) {
        count++;
        expect(link.label.length, `${topic.slug} link label`).toBeGreaterThan(2);
        expect(link.href, `${topic.slug}: ${link.label}`).toMatch(/^\/[a-z0-9\-/]*(\?[a-z0-9=&_-]+)?$/i);
        const path = link.href.split("?")[0]!;
        expect(pageExists(path), `${topic.slug} links to ${link.href}, which has no page`).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(20);
  });

  it("gives every public destination a real page", () => {
    for (const path of ["/", "/help", "/contact", "/legal/privacy", "/legal/security", "/sign-in", "/settings/audit", "/materials", "/dejavu"]) expect(pageExists(path), path).toBe(true);
    expect(pageExists("/definitely/not/a/page")).toBe(false);
  });

  it("keeps the product's copy rules: no internal technology, no email addresses, no promised reply times", () => {
    const all = topics.map(({ topic }) => text(topic)).join("\n");
    // Technology, vendors and counts of what's behind the product don't belong in user-facing copy.
    expect(all).not.toMatch(/supabase|postgres|database|vercel|next\.?js|react|livekit|vault|pgvector|virustotal|smtp|stripe|razorpay|row.level|\brls\b|\bapi\b|\bsql\b|\bjwt\b|\bserver\b/i);
    expect(all).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(all).not.toMatch(/within \d+ (hours?|days?|minutes?)|24\/7|guarantee|instant(ly)? reply|always available/i);
  });

  it("says plainly what depends on a service being connected", () => {
    const all = topics.map(({ topic }) => text(topic)).join("\n");
    for (const phrase of ["Image generation isn’t connected", "Video rendering isn’t connected", "Licence payments", "Not connected"]) expect(all, phrase).toContain(phrase);
    expect(all).toMatch(/legal advice/i);
  });

  it("keeps Wonder Creator's calm: nothing counted, ranked or trending", () => {
    const all = topics.map(({ topic }) => text(topic)).join("\n");
    expect(all).toMatch(/no likes/i);
    expect(all).not.toMatch(/\b(viral|leaderboard|top creators|go viral|followers? count)\b/i);
  });
});

describe("tokenize and stem", () => {
  it("drops filler words and folds plurals and -ing", () => {
    expect(tokenize("How do I record my voice?")).toEqual(["record", "voice"]);
    expect(stem("recording")).toBe(stem("record"));
    expect(stem("versions")).toBe(stem("version"));
    expect(stem("stories")).toBe("story");
  });
});

describe("searchHelp", () => {
  const first = (q: string) => searchHelp(q)[0]?.slug;
  const slugs = (q: string) => searchHelp(q).map((h) => h.slug);

  it("finds the topic a real question is about", () => {
    const cases: Array<[string, string]> = [
      ["record a voice note", "quick-capture"],
      ["add my own api key", "own-key"],
      ["bring your own key", "own-key"],
      ["publish a link", "publish-a-page"],
      ["delete my account", "your-data"],
      ["microphone not working", "microphone"],
      ["license fee", "license-fees"],
      ["how many images in a carousel", "carousel"],
      ["restore an old version", "versions"],
      ["start a huddle", "huddles"],
      ["forgot password", "signing-in"],
      ["held for safety", "files-wont-bring-in"],
      ["use together", "working-table"],
      ["creator page style", "creator-page"],
    ];
    for (const [query, slug] of cases) expect(slugs(query), `"${query}" should reach ${slug}`).toContain(slug);
  });

  it("ranks the topic named for the question above one that merely mentions it", () => {
    expect(first("carousel")).toBe("carousel");
    expect(first("huddles")).toBe("huddles");
    expect(first("versions")).toBe("versions");
    expect(first("working table")).toBe("working-table");
  });

  it("narrows as words are added, and matches the start of a longer word", () => {
    expect(slugs("voice note record").length).toBeLessThanOrEqual(slugs("voice").length);
    expect(slugs("mic")).toContain("microphone");
  });

  it("returns nothing for filler, nonsense or an empty question", () => {
    expect(searchHelp("")).toEqual([]);
    expect(searchHelp("   ")).toEqual([]);
    expect(searchHelp("how do i")).toEqual([]);
    expect(searchHelp("zzzqqxx")).toEqual([]);
  });
});
