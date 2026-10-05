import { outputModeOf, type OutputMode } from "./working-set-options";

/**
 * Creation pages (docs/ui-redesign/creation-pages.md): each format opens a page built for it. Client-safe — no
 * database access. Formats without their own page yet keep the general Creative Studio.
 */

const PAGE: Partial<Record<OutputMode, string>> = { writing: "write", image: "image", audio: "audio", presentation: "deck", video: "video" };

/** Where a Creation is worked on: its format's own page, else the Creative Studio. */
export function creationPath(id: string, artifactType: string): string {
  return `/creations/${id}/${PAGE[outputModeOf(artifactType)] ?? "studio"}`;
}

/** True when the format has its own page (the Studio route forwards there). */
export const hasOwnPage = (artifactType: string) => !!PAGE[outputModeOf(artifactType)];

/** How written work is set: the words over the cover, over the cover softly blurred, or on paper. */
export const LOOKS = ["cover", "blur", "paper"] as const;
export type CreationLook = (typeof LOOKS)[number];
export const LOOK_LABEL: Record<CreationLook, string> = { cover: "Over the cover", blur: "Blurred behind", paper: "Paper" };

/**
 * The ornament that heads and closes a written Creation (owner, 4 Oct 2026: separators "inspired from roman
 * architecture… for writing creations only"). Keys match `ORNAMENTS` in @wonder/ui, which draws them.
 */
export const ORNAMENT_KEYS = ["line", "dentil", "arcade", "eggdart", "meander", "keystone", "laurel"] as const;
export type OrnamentKey = (typeof ORNAMENT_KEYS)[number];
export const DEFAULT_WRITING_ORNAMENT: OrnamentKey = "keystone";

/** A Creation's presentation choices (artifacts.presentation). Unknown keys are ignored. */
export interface CreationPresentation {
  look?: CreationLook;
  ornament?: OrnamentKey;
}

export function ornamentOf(presentation: unknown): OrnamentKey {
  const o = (presentation as CreationPresentation | null)?.ornament;
  return o && (ORNAMENT_KEYS as readonly string[]).includes(o) ? o : DEFAULT_WRITING_ORNAMENT;
}

/** The look to show: the chosen one, or paper when there's no cover to set the words over. */
export function lookOf(presentation: unknown, hasCover: boolean): CreationLook {
  const look = (presentation as CreationPresentation | null)?.look;
  if (!hasCover) return "paper";
  return look && (LOOKS as readonly string[]).includes(look) ? look : "cover";
}

/** The kinds of writing a page can be — changeable any time; the words stay, the page is set to suit them. */
export const WRITING_KINDS = [
  { type: "poem", label: "Poem" },
  { type: "prose", label: "Prose" },
  { type: "essay", label: "Essay" },
  { type: "article", label: "Article" },
  { type: "news", label: "News" },
  { type: "story", label: "Story" },
  { type: "review", label: "Review" },
  { type: "letter", label: "Letter" },
  { type: "lyrics", label: "Lyrics" },
  { type: "spoken_word", label: "Spoken word" },
  { type: "screenplay", label: "Screenplay" },
  { type: "blog_post", label: "Blog post" },
] as const;

/**
 * How a kind of writing is set on the page, after the publications that set it best:
 * - verse — a poetry journal: centred lines, generous leading, stanzas kept;
 * - essay — a literary review: a drop cap, book paragraphs (indented, no gaps);
 * - feature — a magazine feature: the first paragraph as a standfirst, a byline, airy paragraphs;
 * - news — a newspaper: a bold headline, a dateline, the lead paragraph strong, a plain reading face;
 * - fiction — a fiction page: the opening words in capitals, indented paragraphs, ⁂ between scenes;
 * - letter — a letter: the date at the right, the greeting and sign-off set apart;
 * - script — a screenplay's mono page.
 */
export type WritingStyle = "verse" | "essay" | "feature" | "news" | "fiction" | "letter" | "script";

const STYLE: Record<string, WritingStyle> = {
  poem: "verse",
  lyrics: "verse",
  spoken_word: "verse",
  essay: "essay",
  review: "essay",
  artist_statement: "essay",
  biography: "essay",
  news: "news",
  story: "fiction",
  prose: "fiction",
  narration: "fiction",
  film_treatment: "fiction",
  documentary: "fiction",
  letter: "letter",
  screenplay: "script",
  script: "script",
  dialogue: "script",
};

export function writingStyleOf(artifactType: string): WritingStyle {
  return STYLE[artifactType] ?? "feature";
}

/** A paragraph that marks a scene break (***, * * *, #, ⁂, —). */
export const isSceneBreak = (p: string) => /^\s*(\*\s*\*\s*\*|#|⁂|—|~)\s*$/.test(p);
