/**
 * Moments + DejaVu (docs/moments-dejavu.md): the vocabulary and the pure helpers, safe to import in the browser.
 *
 * A Moment is a cross-domain reference with a small preview — never the canonical object. A DejaVu is a creator's
 * recurring thread (a person, place, idea, feeling) that connects Moments across time. It is not a Collection
 * (curated on purpose) and not a Project (made on purpose).
 */

export const MOMENT_ENTITY_TYPES = [
  "material",
  "creation",
  "creation_fragment",
  "scrapbook_entry",
  "conversation",
  "conversation_reply",
  "huddle",
  "huddle_moment",
  "person_interaction",
  "collaboration_request",
  "project_activity",
  "creative_room_activity",
  "published_work",
  "quick_text_note",
  "voice_note",
] as const;
export type MomentEntityType = (typeof MOMENT_ENTITY_TYPES)[number];

/** The kinds wired in this phase (each has an adapter); the rest are reserved and refused. */
export const LIVE_MOMENT_TYPES = ["material", "creation", "conversation", "scrapbook_entry"] as const satisfies readonly MomentEntityType[];
export type LiveMomentType = (typeof LIVE_MOMENT_TYPES)[number];
export const isLiveMomentType = (t: string): t is LiveMomentType => (LIVE_MOMENT_TYPES as readonly string[]).includes(t);

export type MomentVisibility = "private" | "shared" | "community" | "public";
export type MomentPreviewKind = "text" | "image" | "audio" | "video" | "mixed";

export interface MomentReference {
  id: string;
  entityType: MomentEntityType;
  entityId: string;
  occurredAt: string;
  visibility: MomentVisibility;
  title: string | null;
  excerpt: string | null;
  previewAssetId: string | null;
  previewKind: MomentPreviewKind | null;
  /** The entity's own kind (a Material's type, a Creation's type) — for labels only. */
  subtype: string | null;
}

export interface DejaVu {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  lastUsedAt: string;
}

/** The type filters on a DejaVu page (§9). Each groups entity kinds and Material subtypes. */
export const MOMENT_FILTERS = ["materials", "notes", "creations", "conversations"] as const;
export type MomentFilter = (typeof MOMENT_FILTERS)[number];
export const MOMENT_FILTER_LABEL: Record<MomentFilter, string> = { materials: "Materials", notes: "Notes", creations: "Creations", conversations: "Conversations" };

/** Material types that read as notes rather than media. */
export const NOTE_MATERIAL_TYPES = ["note", "text", "voice", "idea", "inspiration", "conversation", "research"] as const;
const NOTE_TYPES = new Set<string>(NOTE_MATERIAL_TYPES);
/** Which first-level filter a Moment falls under. */
export function filterOf(m: Pick<MomentReference, "entityType" | "subtype">): MomentFilter {
  if (m.entityType === "creation" || m.entityType === "creation_fragment" || m.entityType === "published_work") return "creations";
  if (m.entityType === "conversation" || m.entityType === "conversation_reply") return "conversations";
  if (m.entityType === "quick_text_note" || m.entityType === "voice_note" || m.entityType === "scrapbook_entry") return "notes";
  if (m.entityType === "material" && m.subtype && NOTE_TYPES.has(m.subtype)) return "notes";
  return "materials";
}

/** "Railways", " railways " and "RAILWAYS" are one thread. Mirrors the database's generated `normalized_name`. */
export function normalizeDejaVuName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** What gets stored as the display name: whitespace tidied, 60 characters at most. */
export function cleanDejaVuName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 60).trim();
}

/**
 * The section a Moment sits under on a DejaVu page, newest first: "Today", "Yesterday", then the month in the current
 * year ("September"), then the year for anything older ("2019").
 */
export function periodOf(occurredAt: string | Date, now: Date = new Date()): string {
  const d = new Date(occurredAt);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleString("en-GB", { month: "long" });
  return String(d.getFullYear());
}

/** Where a Moment opens: its own domain's page (the Moment never replaces it). */
export function momentHref(m: Pick<MomentReference, "entityType" | "entityId">): string | null {
  if (m.entityType === "material") return `/space/materials/${m.entityId}`;
  if (m.entityType === "creation") return `/artifacts/${m.entityId}`;
  if (m.entityType === "conversation") return `/community/conversations/${m.entityId}`;
  if (m.entityType === "scrapbook_entry") return `/scrapbook/${m.entityId}`;
  return null;
}
