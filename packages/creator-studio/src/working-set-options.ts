/**
 * CreativeStudio Working Set (docs/ui-redesign/creative-studio-working-set.md): the words and shapes shared by the
 * server and the Studio UI. Client-safe — no database access here.
 */

export const SOURCE_STATES = ["pinned", "in_use", "available"] as const;
export type SourceState = (typeof SOURCE_STATES)[number];
export const STATE_LABEL: Record<SourceState, string> = { pinned: "Pinned", in_use: "In use", available: "Available" };

export const SOURCE_ROLES = ["story", "visual", "mood", "reference", "fact", "voice", "style", "constraint", "character", "structure", "sound", "quote"] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];
export const ROLE_LABEL: Record<SourceRole, string> = {
  story: "Story",
  visual: "Visual",
  mood: "Mood",
  reference: "Reference",
  fact: "Fact",
  voice: "Voice",
  style: "Style",
  constraint: "Constraint",
  character: "Character",
  structure: "Structure",
  sound: "Sound",
  quote: "Quote",
};

export const SOURCE_TYPES = ["material", "creation", "collection"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** A Working Set row, resolved for the viewer (details only while they can still open the source, §70). */
export interface WorkingSource {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  state: SourceState;
  roles: SourceRole[];
  addedAt: string;
  available: boolean;
  title: string;
  /** "Photo", "Voice note", "Poem · Creation", "Collection · 6"… */
  kind: string;
  /** Material type or Creation type, for the row's icon. */
  mediaType: string | null;
  href: string | null;
  thumbnailUrl: string | null;
}

export interface WorkingSetView {
  sessionId: string;
  artifactId: string;
  outputMode: string;
  sources: WorkingSource[];
}

/** One "Bring in" search result. */
export interface BringInResult {
  sourceType: SourceType;
  sourceId: string;
  title: string;
  kind: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  inSet: boolean;
}

/** Sections in the order the spec gives (§56): Pinned, In use, Available — empty ones aren't shown. */
export function groupSources(sources: WorkingSource[]): Array<{ state: SourceState; sources: WorkingSource[] }> {
  return SOURCE_STATES.map((state) => ({ state, sources: sources.filter((s) => s.state === state) })).filter((g) => g.sources.length);
}

/** "4 sources" · "4 sources · 1 pinned" · "2 still unused" — the Studio's quiet summary (§45, §65). */
export function workingSetSummary(sources: Pick<WorkingSource, "state">[]): string {
  if (!sources.length) return "No sources yet";
  const n = sources.length;
  const pinned = sources.filter((s) => s.state === "pinned").length;
  const base = `${n} ${n === 1 ? "source" : "sources"}`;
  return pinned ? `${base} · ${pinned} pinned` : base;
}
