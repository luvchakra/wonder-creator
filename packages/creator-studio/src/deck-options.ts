import { z } from "zod";

/**
 * The Presentation page (creation-pages.md, step 4): a deck is slides — a title, the words on it and speaker notes —
 * set in one of the named palettes. Client-safe: no database access here. A presentation written before the page
 * existed (an outline in plain text) opens as slides: each heading starts one.
 */
export const DECK_THEMES = ["paper", "cinematic", "gradient"] as const;
export type DeckTheme = (typeof DECK_THEMES)[number];
export const DECK_THEME_LABEL: Record<DeckTheme, string> = { paper: "Editorial Paper", cinematic: "Cinematic Dark", gradient: "Soft Gradient" };
export const MAX_SLIDES = 60;

export interface DeckSlide {
  id: string;
  title: string;
  body: string;
  notes: string;
  /** A picture Material of the creator's on the slide: beside the words, or filling the slide when there are none. */
  image?: string | null;
}
export interface Deck {
  kind: "deck";
  theme: DeckTheme;
  slides: DeckSlide[];
}

const slideSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/i),
  title: z.string().max(200),
  body: z.string().max(2000),
  notes: z.string().max(4000),
  image: z.string().uuid().nullable().optional(),
});
export const deckSchema = z.object({
  kind: z.literal("deck"),
  theme: z.enum(DECK_THEMES),
  slides: z.array(slideSchema).max(MAX_SLIDES),
});

let counter = 0;
/** A slide id: short, unique within a deck, stable across saves. */
export function slideId(): string {
  counter = (counter + 1) % 1_000_000;
  return `s${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const blankSlide = (title = ""): DeckSlide => ({ id: slideId(), title, body: "", notes: "", image: null });

/**
 * The deck a version holds; for a version without one, the deck its words outline — every Markdown heading, "Slide N"
 * line or `---` rule starts a slide, its first line the title and the rest the words. Never throws.
 */
export function deckOf(structured: unknown, content = ""): Deck {
  const parsed = deckSchema.safeParse(structured);
  if (parsed.success) return { ...parsed.data, slides: parsed.data.slides.map((x) => ({ ...x, image: x.image ?? null })) };
  const theme = (structured as { theme?: unknown } | null)?.theme;
  return { kind: "deck", theme: DECK_THEMES.includes(theme as DeckTheme) ? (theme as DeckTheme) : "paper", slides: outlineSlides(content) };
}

function outlineSlides(content: string): DeckSlide[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const slides: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^#{1,3}\s+(.*)$/.exec(line) ?? /^\**\s*slide\s+\d+\s*[:.\-–—]?\s*\**\s*(.*)$/i.exec(line);
    if (heading || /^-{3,}$/.test(line.trim())) {
      if (current) slides.push(current);
      current = { title: heading ? (heading[1] ?? "").replace(/\*+/g, "").trim() : "", body: [] };
      continue;
    }
    if (!current) {
      if (!line.trim()) continue;
      current = { title: line.trim(), body: [] };
      continue;
    }
    if (!current.title && line.trim() && !current.body.length) current.title = line.trim();
    else current.body.push(line);
  }
  if (current) slides.push(current);
  return slides
    .map((s) => ({ ...blankSlide(s.title.slice(0, 200)), body: s.body.join("\n").trim().slice(0, 2000) }))
    .filter((s) => s.title || s.body)
    .slice(0, MAX_SLIDES);
}

/** The deck's words, for search, export and the read view: a heading per slide, then its words (notes stay private). */
export function deckText(deck: Deck): string {
  return deck.slides
    .map((s, i) => [`## ${s.title.trim() || `Slide ${i + 1}`}`, s.body.trim()].filter(Boolean).join("\n\n"))
    .join("\n\n");
}
