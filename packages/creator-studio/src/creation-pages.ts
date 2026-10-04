import { outputModeOf, type OutputMode } from "./working-set-options";

/**
 * Creation pages (docs/ui-redesign/creation-pages.md): each format opens a page built for it. Client-safe — no
 * database access. Formats without their own page yet keep the general Creative Studio.
 */

const PAGE: Partial<Record<OutputMode, string>> = { writing: "write" };

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

/** A Creation's presentation choices (artifacts.presentation). Unknown keys are ignored. */
export interface CreationPresentation {
  look?: CreationLook;
}

/** The look to show: the chosen one, or paper when there's no cover to set the words over. */
export function lookOf(presentation: unknown, hasCover: boolean): CreationLook {
  const look = (presentation as CreationPresentation | null)?.look;
  if (!hasCover) return "paper";
  return look && (LOOKS as readonly string[]).includes(look) ? look : "cover";
}

/** The kinds of writing offered while a page is still empty — each sets the page (prose, verse, screenplay). */
export const WRITING_KINDS = [
  { type: "story", label: "Passage" },
  { type: "poem", label: "Poem" },
  { type: "screenplay", label: "Screenplay" },
] as const;
