/**
 * Parts (docs/creative-room-parts.md): the client-safe vocabulary — kinds, statuses, templates and the shapes the
 * Room page shows. No database access here.
 */
export const PART_KINDS = ["writing", "audio", "image", "video", "other"] as const;
export type PartKind = (typeof PART_KINDS)[number];
export const PART_STATUSES = ["open", "in_rounds", "final"] as const;
export type PartStatus = (typeof PART_STATUSES)[number];
export const PART_STATUS_LABEL: Record<PartStatus, string> = { open: "Open", in_rounds: "In rounds", final: "Final" };
export const PART_KIND_LABEL: Record<PartKind, string> = { writing: "Writing", audio: "Audio", image: "Pictures", video: "Video", other: "Other" };

/** What a part's Creation is when nothing more specific is chosen: the kind's own page. */
export const DEFAULT_ARTIFACT_TYPE: Record<PartKind, string> = { writing: "prose", audio: "song_concept", image: "photo_essay", video: "film_treatment", other: "prose" };

export interface PartTemplatePart {
  title: string;
  kind: PartKind;
  artifactType: string;
}
export const PART_TEMPLATES = {
  song: { label: "Song", hint: "Lyrics · Tune · Voice", parts: [{ title: "Lyrics", kind: "writing", artifactType: "lyrics" }, { title: "Tune", kind: "audio", artifactType: "song_concept" }, { title: "Voice", kind: "audio", artifactType: "song_concept" }] },
  podcast: { label: "Podcast episode", hint: "Script · Host · Edit", parts: [{ title: "Script", kind: "writing", artifactType: "narration" }, { title: "Host", kind: "audio", artifactType: "podcast_concept" }, { title: "Edit", kind: "audio", artifactType: "sound_design" }] },
  illustrated_story: { label: "Illustrated story", hint: "Words · Pictures", parts: [{ title: "Words", kind: "writing", artifactType: "story" }, { title: "Pictures", kind: "image", artifactType: "photo_essay" }] },
} as const satisfies Record<string, { label: string; hint: string; parts: readonly PartTemplatePart[] }>;
export type PartTemplateKey = keyof typeof PART_TEMPLATES;
export const PART_TEMPLATE_KEYS = Object.keys(PART_TEMPLATES) as PartTemplateKey[];

export interface PartPerson {
  id: string;
  name: string;
  handle: string | null;
  status: "invited" | "active";
  /** On this part only — not in the Room's crew. */
  outside: boolean;
}
export interface PartView {
  id: string;
  projectId: string;
  title: string;
  kind: PartKind;
  artifactType: string;
  position: number;
  status: PartStatus;
  artifactId: string | null;
  /** The part's Creation as the viewer may read it; null until started, or when they can't read it. */
  artifact: { id: string; title: string; type: string; versionNumber: number; updatedAt: string } | null;
  people: PartPerson[];
  /** The viewer is on this part. */
  mine: boolean;
  /** The viewer is invited to this part and hasn't answered. */
  invitedMe: boolean;
  finalAt: string | null;
}
export interface PartEventView {
  id: string;
  partId: string;
  partTitle: string;
  kind: string;
  actor: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
  detail: Record<string, unknown>;
  at: string;
}

