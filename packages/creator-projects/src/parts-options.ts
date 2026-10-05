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
  /** What the part's latest version was made with (step 2): the other parts' versions at that moment; null before any. */
  madeWith: MadeWith[] | null;
}
/** One other part as it stood when a version was saved. versionNumber is null when it hadn't been started. */
export interface MadeWith {
  partId: string;
  title: string;
  artifactId: string | null;
  versionId: string | null;
  versionNumber: number | null;
}
/** A part's Creation on its own page: what it was made with and what moved on since (creative-room-parts.md, step 2). */
export interface PartContext {
  part: { id: string; title: string; kind: PartKind };
  project: { id: string; title: string };
  /** This part's latest version — the one the comparison starts from; null before any version. */
  since: { versionId: string; number: number } | null;
  others: Array<{
    partId: string;
    title: string;
    kind: PartKind;
    artifactId: string | null;
    artifactType: string | null;
    /** Where that part is now. */
    current: { versionId: string; number: number } | null;
    /** The version this part's latest version was made with. */
    madeWith: { versionId: string; number: number } | null;
    /** It has a newer version than the one this part was made with. */
    movedOn: boolean;
    /** Words someone else is writing: a suggestion can be sent (a proposal its people decide on). */
    canSuggest: boolean;
  }>;
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

/** Play-along (step 3): another part's kept take, ready to play on this part's page. */
export interface PlayAlongTrack {
  partId: string;
  title: string;
  versionNumber: number;
  url: string;
  seconds: number;
}
/** What a part's page can play and read alongside: the other parts' takes, and the words of a writing part. */
export interface PlayAlong {
  tracks: PlayAlongTrack[];
  words: { partId: string; title: string; versionNumber: number; text: string } | null;
}
