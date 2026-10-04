import { isSceneBreak, type WritingStyle } from "./creation-pages";

/**
 * The Writing page's craft view (owner, 4 Oct 2026: "less about AI, more about supporting the writing type"): plain
 * counts a writer of that kind looks at — a poet at lines and stanzas, a reporter at the headline and the lede, a
 * screenwriter at scenes and runtime. Deterministic, local, nothing sent anywhere. Client-safe.
 */
export interface CraftFact {
  label: string;
  value: string;
  /** A short, neutral note on a convention of the form (never a score). */
  note?: string;
}
export interface CraftView {
  title: string;
  facts: CraftFact[];
  /** Verse: each line with its syllables (Latin script) or words (other scripts). */
  lines?: Array<{ text: string; count: number; unit: "syllables" | "words" }> | null;
}

export const CRAFT_LABEL: Record<WritingStyle, { label: string; hint: string }> = {
  verse: { label: "Lines & stanzas", hint: "Line by line — syllables, stanzas, the shape of it" },
  essay: { label: "Length & reading time", hint: "Words, paragraphs, minutes to read" },
  feature: { label: "Length & reading time", hint: "Words, paragraphs, minutes to read" },
  fiction: { label: "Scenes & length", hint: "Scenes, words, minutes to read" },
  news: { label: "Headline & lede", hint: "The headline's length, the first paragraph, the rest" },
  letter: { label: "Length & reading time", hint: "Words, paragraphs, minutes to read" },
  script: { label: "Scenes & runtime", hint: "Scene headings, pages, about a minute a page" },
};

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const paragraphsOf = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const minutes = (n: number) => (n === 0 ? "—" : n < 200 ? "under a minute" : `${Math.round(n / 200)} min`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** English-leaning syllable estimate for Latin-script words; good enough to see a line's weight, not to scan metre. */
export function syllablesOf(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

const latin = (s: string) => {
  const letters = s.match(/\p{L}/gu) ?? [];
  return letters.length > 0 && letters.filter((c) => /[a-z]/i.test(c)).length / letters.length > 0.8;
};

export function craftOf(style: WritingStyle, title: string, text: string): CraftView {
  const t = text.replace(/\r\n/g, "\n").trim();
  const total = words(t);
  const paras = paragraphsOf(t);
  const head = CRAFT_LABEL[style].label;

  if (style === "verse") {
    const stanzas = paras.filter((p) => !isSceneBreak(p));
    const lineTexts = stanzas.flatMap((s) => s.split("\n").map((l) => l.trim()).filter(Boolean));
    const syl = latin(t);
    const lines = lineTexts.map((l) => ({ text: l, count: syl ? l.split(/\s+/).reduce((n, w) => n + syllablesOf(w), 0) : words(l), unit: syl ? ("syllables" as const) : ("words" as const) }));
    const perStanza = stanzas.map((s) => s.split("\n").filter((l) => l.trim()).length);
    const even = perStanza.length > 1 && perStanza.every((n) => n === perStanza[0]);
    const shape = even ? `${plural(perStanza.length, "stanza")} of ${perStanza[0]} lines` : perStanza.length ? perStanza.join(" · ") : "—";
    const facts: CraftFact[] = [
      { label: "Lines", value: String(lines.length), note: lines.length === 14 ? "Fourteen lines — a sonnet's length." : undefined },
      { label: "Stanzas", value: shape, note: even && perStanza[0] === 4 ? "Quatrains." : even && perStanza[0] === 2 ? "Couplets." : even && perStanza[0] === 3 ? "Tercets." : undefined },
      { label: "Words", value: String(total) },
    ];
    return { title: head, facts, lines };
  }

  if (style === "news") {
    const lede = paras[0] ?? "";
    const ledeWords = words(lede);
    const headLen = title.trim().length;
    return {
      title: head,
      facts: [
        { label: "Headline", value: headLen ? `${headLen} characters · ${plural(words(title), "word")}` : "No headline yet", note: headLen > 70 ? "Most headlines are under 70 characters." : undefined },
        { label: "Lede", value: lede ? plural(ledeWords, "word") : "—", note: ledeWords > 35 ? "A lede is often 35 words or fewer: who, what, when, where." : undefined },
        { label: "Paragraphs", value: String(paras.length) },
        { label: "Words", value: `${total} · ${minutes(total)}` },
      ],
    };
  }

  if (style === "script") {
    const lines = t.split("\n");
    const scenes = lines.filter((l) => /^\s*(INT|EXT|INT\.\/EXT|I\/E)[.\s]/i.test(l)).length;
    const pages = Math.max(lines.length ? 1 : 0, Math.round(lines.length / 55));
    return {
      title: head,
      facts: [
        { label: "Scenes", value: scenes ? String(scenes) : "No scene headings yet", note: scenes ? undefined : "A scene starts with INT. or EXT." },
        { label: "Pages", value: `about ${pages}`, note: "Screenplay pages run about 55 lines." },
        { label: "Runtime", value: pages ? `about ${pages} min` : "—", note: "Roughly a minute a page." },
        { label: "Words", value: String(total) },
      ],
    };
  }

  const scenes = paras.filter(isSceneBreak).length + (paras.length ? 1 : 0);
  const sentences = t.split(/(?<=[.!?।])\s+/).filter((s) => words(s) > 0);
  const longest = sentences.reduce((m, s) => Math.max(m, words(s)), 0);
  const facts: CraftFact[] = [
    { label: "Words", value: String(total) },
    { label: "Reading time", value: minutes(total) },
    { label: "Paragraphs", value: String(paras.filter((p) => !isSceneBreak(p)).length) },
  ];
  if (style === "fiction") facts.splice(1, 0, { label: "Scenes", value: String(scenes), note: scenes > 1 ? undefined : "A line with *** or ⁂ starts a new scene." });
  else facts.push({ label: "Longest sentence", value: longest ? plural(longest, "word") : "—" });
  return { title: head, facts };
}
