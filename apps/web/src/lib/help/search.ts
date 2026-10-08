import { HELP_SECTIONS, type HelpSection, type HelpTopic } from "./content";

/**
 * Searching the Help page in the browser. Deliberately plain: lower-case words, a light stem so “recording” finds
 * “record”, every word of the question has to land somewhere in the topic, and a hit in the title or the keywords
 * outweighs a hit in the prose. No network, no model — the topics are a few dozen pieces of our own text.
 */

/** Words that say nothing about which topic is meant. Short on purpose: “how do I record…” still needs “record”. */
const STOP_WORDS = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "if", "in", "is", "it", "my", "of", "on", "or", "the", "to", "what", "where", "why", "with", "you", "your"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Folds plurals and -ing/-ed forms together. Applied the same way to the question and to the topics. */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

const terms = (text: string) => tokenize(text).map(stem);

const TITLE_WEIGHT = 8;
const KEYWORD_WEIGHT = 6;
const SUMMARY_WEIGHT = 3;
const SECTION_WEIGHT = 2;
const BODY_WEIGHT = 1;
const TITLE_COVERAGE_WEIGHT = 10;

function topicFields(topic: HelpTopic, section: HelpSection) {
  return {
    title: new Set(terms(topic.title)),
    section: new Set(terms(section.title)),
    keywords: new Set(topic.keywords.flatMap(terms)),
    summary: new Set(terms(topic.summary)),
    body: new Set(
      terms([...(topic.body ?? []), ...(topic.steps ?? []), ...(topic.notes ?? []), ...(topic.terms ?? []).map((t) => `${t.term} ${t.text}`), ...(topic.links ?? []).map((l) => l.label)].join(" ")),
    ),
  };
}

/**
 * A query term matches a field word exactly, or as the start of a longer word (“mic” → “microphone”), or when the field
 * word is the start of the term (“create” → the stem “creat” of “creating”). Short words only match exactly.
 */
function hit(field: Set<string>, q: string): boolean {
  if (field.has(q)) return true;
  for (const w of field) {
    if (q.length >= 3 && w.startsWith(q)) return true;
    if (w.length >= 4 && q.startsWith(w)) return true;
  }
  return false;
}

export interface HelpHit {
  slug: string;
  score: number;
}

/**
 * The topics a question is about, best first. A topic needs at least one of the question's words; the topics that hold
 * the most of them come first, so a stray word (“add my own key”) doesn't hide the answer, and adding the right words
 * narrows the list. A hit in the title or the keywords outweighs one in the prose, and a title that is just what was
 * asked for ranks first. An empty question (or only filler words) returns nothing — callers show everything instead.
 */
export function searchHelp(query: string, sections: HelpSection[] = HELP_SECTIONS): HelpHit[] {
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const hits: Array<HelpHit & { matched: number }> = [];
  for (const section of sections) {
    for (const topic of section.topics) {
      const f = topicFields(topic, section);
      let score = 0;
      let matched = 0;
      for (const t of q) {
        const s = (hit(f.title, t) ? TITLE_WEIGHT : 0) + (hit(f.section, t) ? SECTION_WEIGHT : 0) + (hit(f.keywords, t) ? KEYWORD_WEIGHT : 0) + (hit(f.summary, t) ? SUMMARY_WEIGHT : 0) + (hit(f.body, t) ? BODY_WEIGHT : 0);
        if (s) matched++;
        score += s;
      }
      if (!matched) continue;
      // How much of the topic's own name the question covers: asking for “huddles” finds Huddles before “A Huddle has no voice”.
      const own = [...new Set(terms(topic.title))];
      score += (own.filter((w) => q.some((t) => hit(new Set([w]), t))).length / own.length) * TITLE_COVERAGE_WEIGHT;
      hits.push({ slug: topic.slug, score, matched });
    }
  }
  const best = Math.max(0, ...hits.map((h) => h.matched));
  return hits
    .filter((h) => h.matched === best)
    .sort((a, b) => b.score - a.score)
    .map(({ slug, score }) => ({ slug, score }));
}
