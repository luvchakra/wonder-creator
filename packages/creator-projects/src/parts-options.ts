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

/** Listen together (step 4): one track of the Room's mix — where it starts (ms, may be negative) and its level. */
export interface MixTrack {
  offsetMs: number;
  /** 1 = as recorded; 0…2. */
  gain: number;
  muted: boolean;
}
export type Mix = Record<string, MixTrack>;
export const MIX_OFFSET_MS = { min: -30_000, max: 600_000 } as const;
export const MIX_GAIN = { min: 0, max: 2 } as const;
const AS_RECORDED: MixTrack = { offsetMs: 0, gain: 1, muted: false };

/** A part's settings in the mix; a part nobody has touched plays from the start, as recorded. */
export function mixTrackOf(mix: Mix, partId: string): MixTrack {
  return { ...AS_RECORDED, ...mix[partId] };
}

/** A part's take on the Song page: what plays, and whose. */
export interface ListenTrack extends PlayAlongTrack {
  people: string[];
}

/** How long the mix lasts: the latest end among the tracks that sound (an unmuted track with a level). */
export function mixLength(tracks: Array<{ partId: string; seconds: number }>, mix: Mix): number {
  let end = 0;
  for (const t of tracks) {
    const m = mixTrackOf(mix, t.partId);
    if (m.muted || m.gain <= 0) continue;
    end = Math.max(end, m.offsetMs / 1000 + t.seconds);
  }
  return Math.max(0, end);
}

/**
 * For a playhead at `at` seconds into the mix: how long until this track sounds (`wait`) and from where in its take it
 * plays (`from`) — or null when it has already finished. A negative offset starts the take part-way in.
 */
export function placeAt(offsetMs: number, seconds: number, at: number): { wait: number; from: number } | null {
  const start = offsetMs / 1000;
  const from = Math.max(0, at - start);
  if (from >= seconds) return null;
  return { wait: Math.max(0, start - at), from };
}

/** "+1.2s", "−0.5s", "from the start" — where a track starts, said plainly. */
export function offsetLabel(offsetMs: number): string {
  if (offsetMs === 0) return "from the start";
  const s = Math.abs(offsetMs) / 1000;
  return `${offsetMs > 0 ? "+" : "−"}${s.toFixed(s < 10 ? 1 : 0)}s`;
}

/** A note left at a moment of the song (step 4b), about the whole song or one part. */
export interface MixNote {
  id: string;
  atMs: number;
  body: string;
  partId: string | null;
  partTitle: string | null;
  author: { id: string; name: string } | null;
  /** The takes as they were when it was left ("Tune v2"). */
  heard: Array<{ partId: string; title: string; versionNumber: number }>;
  resolved: boolean;
  createdAt: string;
  /** The viewer may resolve it (its author, or the Room's owner/admins) and delete it. */
  canResolve: boolean;
}

/** "on Tune v2 · Voice v1" when a note was left on takes that have since moved on; null when it was these ones. */
export function heardEarlier(heard: MixNote["heard"], now: Array<{ partId: string; versionNumber: number }>): string | null {
  const moved = heard.some((h) => {
    const n = now.find((x) => x.partId === h.partId);
    return n && n.versionNumber !== h.versionNumber;
  });
  return moved ? `on ${heard.map((h) => `${h.title} v${h.versionNumber}`).join(" · ")}` : null;
}
