/**
 * The shapes of Help's content (docs/help.md). Types only: the browser may import these, never the content itself —
 * `content.ts` is server-only, so the words reach a browser only through a page that has checked the session.
 */
export interface HelpLink {
  label: string;
  /** A page of this app, with an optional query. Checked against the real routes by `content.test.ts`. */
  href: string;
}

export interface HelpTopic {
  /** The topic's anchor (`/help#slug`) and its key. Unique across the whole page, sections included. */
  slug: string;
  title: string;
  /** One sentence, shown on the closed topic and read by search. */
  summary: string;
  /** Words a person might type that the prose doesn't contain. */
  keywords: string[];
  /** Short paragraphs. */
  body?: string[];
  /** Numbered how-to steps. */
  steps?: string[];
  /** Words with a line each, shown as a list. */
  terms?: Array<{ term: string; text: string }>;
  /** "Good to know". */
  notes?: string[];
  /** "Open" links to the places the topic is about. */
  links?: HelpLink[];
}

export interface HelpSection {
  /** The section's anchor. */
  id: string;
  /** When this section was last checked against the app (YYYY-MM-DD), shown as "Last updated". */
  updated: string;
  title: string;
  blurb: string;
  topics: HelpTopic[];
}
