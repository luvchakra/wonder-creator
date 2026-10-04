import { artifactType } from "./artifact-types";
import type { SlideOverlay, ImageTransform } from "./carousel";
import type { ImageEdits } from "./image-options";

/**
 * CreatorPublish (docs/creator-publish.md): the shared words for publishing a Creation to the creator's own public
 * space. Client-safe — no database access. The public page is chosen by how the audience *experiences* the work
 * (Read, View, Swipe, Watch, Listen, Journey), not by file type; each experience offers two or three treatments —
 * publishing treatments, not website themes.
 */

export const EXPERIENCES = ["read", "view", "swipe", "watch", "listen", "journey"] as const;
export type PublicationExperience = (typeof EXPERIENCES)[number];
export const EXPERIENCE_LABEL: Record<PublicationExperience, string> = { read: "Read", view: "View", swipe: "Swipe", watch: "Watch", listen: "Listen", journey: "Journey" };

export const TREATMENTS: Record<PublicationExperience | "poem", Array<{ key: string; label: string }>> = {
  read: [
    { key: "editorial", label: "Editorial" },
    { key: "immersive", label: "Immersive" },
    { key: "minimal", label: "Minimal" },
  ],
  poem: [
    { key: "page", label: "Page" },
    { key: "centered", label: "Centered" },
    { key: "voice", label: "Reading + Voice" },
  ],
  swipe: [
    { key: "classic", label: "Classic" },
    { key: "fullscreen", label: "Full-screen" },
  ],
  view: [
    { key: "gallery", label: "Gallery" },
    { key: "museum", label: "Museum" },
  ],
  journey: [
    { key: "journal", label: "Journal" },
    { key: "cinematic", label: "Cinematic" },
  ],
  watch: [
    { key: "cinema", label: "Cinema" },
    { key: "minimal", label: "Minimal" },
  ],
  listen: [
    { key: "artwork", label: "Artwork" },
    { key: "room", label: "Listening Room" },
  ],
};

export const VISIBILITIES = ["private", "unlisted", "public"] as const;
export type PublicationVisibility = (typeof VISIBILITIES)[number];
export const VISIBILITY_LABEL: Record<PublicationVisibility, string> = { private: "Private", unlisted: "Anyone with the link", public: "Public on my page" };

export type PublicationTheme = "light" | "dark" | "paper" | "cinematic";

/** How the work is experienced publicly (§5). Stored with each published revision. */
export interface PublicationManifest {
  experience: PublicationExperience;
  creationType: string;
  treatment: string;
  theme: PublicationTheme;
  /** Poems keep their line structure in their own renderer. */
  poem?: boolean;
  aspectRatio?: string;
  allowFullscreen?: boolean;
  allowZoom?: boolean;
  hasText?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  hasSequence?: boolean;
  hasTranscript?: boolean;
  durationSeconds?: number;
  itemCount?: number;
  coverObjectId?: string;
  posterObjectId?: string;
  /** "Visual story · 5 slides", "Spoken word · 2:14", "Photo essay · 7 min", "Poem". */
  descriptor: string;
}

/** One authored step of a Journey (photo essay, mixed media). */
export type PublicBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; objectId: string; alt: string }
  | { kind: "audio"; objectId: string; title: string; durationSeconds?: number | null }
  | { kind: "video"; objectId: string; title: string; posterObjectId?: string | null };

/** Exactly what readers see — frozen when published. Storage objects are referenced by id; links are minted per view. */
export interface PublishedSnapshot {
  title: string;
  description: string | null;
  typeLabel: string;
  artifactType: string;
  versionNumber: number | null;
  content: string;
  coverObjectId?: string | null;
  /** Written work: how the words are set — over the cover, over it blurred, or on paper. */
  look?: "cover" | "blur" | "paper";
  /** Written work: the Roman ornament that heads and closes it. */
  ornament?: "line" | "dentil" | "arcade" | "eggdart" | "meander" | "keystone" | "laurel";
  slides?: Array<{ objectId: string | null; text: string; overlay: SlideOverlay; transform: ImageTransform }>;
  images?: Array<{ objectId: string; alt: string }>;
  /** The Images page: each picture as shaped (crop, filter, light, words, frame) and its caption, in order. */
  pictures?: Array<{ objectId: string; caption: string; edits: ImageEdits; words: SlideOverlay }>;
  media?: { kind: "audio" | "video"; objectId: string; title: string; durationSeconds?: number | null; posterObjectId?: string | null; vertical?: boolean };
  /** A creator's reading of a poem: offered, never the page's centre. */
  voice?: { objectId: string; durationSeconds?: number | null } | null;
  blocks?: PublicBlock[];
  transcript?: string | null;
  location?: string | null;
}

/** Deterministic rights as published (never inferred): the creator's record and choices, and credits that must travel. */
export interface PublicRights {
  holder: string | null;
  allowSharing: boolean;
  requireAttribution: boolean;
  allowRemix: boolean;
  commercial: "not_offered" | "on_request" | "open" | null;
  credits: string[];
  aiAssisted: boolean;
}

export interface PublishSettings {
  experience?: PublicationExperience;
  treatment?: string;
  theme?: PublicationTheme;
  coverObjectId?: string | null;
  show?: { description?: boolean; transcript?: boolean; location?: boolean; context?: boolean };
  rights?: { allowSharing?: boolean; requireAttribution?: boolean; allowRemix?: boolean };
  conversationId?: string | null;
}

const WRITING_POEM = new Set(["poem", "lyrics", "spoken_word"]);
const VIEW_TYPES = new Set(["visual_concept", "poster", "album_art", "visual_post", "thumbnail_concept", "moodboard", "art_series", "photo_essay"]);
const JOURNEY_TYPES = new Set(["documentary", "film_treatment"]);
const WATCH_TYPES = new Set(["short_film", "trailer", "reel_concept"]);
const LISTEN_TYPES = new Set(["podcast_concept", "song_concept", "sound_design", "spoken_word", "narration"]);

export const isPoem = (type: string) => WRITING_POEM.has(type);

/** The experiences a snapshot can honestly support; the first is the one inferred from its type (§27: change only when several fit). */
export function experiencesFor(type: string, s: Pick<PublishedSnapshot, "content" | "slides" | "images" | "media" | "blocks">): PublicationExperience[] {
  const hasText = !!s.content.trim();
  const out: PublicationExperience[] = [];
  const add = (e: PublicationExperience, ok: boolean) => ok && !out.includes(e) && out.push(e);
  // The type decides first…
  if (type === "carousel" || type === "social_series") add("swipe", !!s.slides?.length);
  if (WATCH_TYPES.has(type)) add("watch", s.media?.kind === "video");
  if (LISTEN_TYPES.has(type)) add("listen", s.media?.kind === "audio");
  if (JOURNEY_TYPES.has(type)) add("journey", !!s.blocks?.length);
  if (VIEW_TYPES.has(type)) add("view", !!s.images?.length);
  // …then whatever else the work can honestly be.
  add("read", hasText);
  add("swipe", !!s.slides?.length);
  add("journey", (s.blocks?.length ?? 0) >= 2);
  add("view", !!s.images?.length);
  add("watch", s.media?.kind === "video");
  add("listen", s.media?.kind === "audio");
  return out.length ? out : ["read"];
}

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** "Visual story · 5 slides", "Short film · 4:32", "Photo essay · 7 min", "Poem" (§17). */
export function descriptorFor(type: string, experience: PublicationExperience, s: PublishedSnapshot): string {
  const label = artifactType(type).label;
  if (experience === "swipe") return `Visual story · ${s.slides?.length ?? 0} ${s.slides?.length === 1 ? "slide" : "slides"}`;
  if ((experience === "watch" || experience === "listen") && s.media?.durationSeconds) return `${label} · ${clock(s.media.durationSeconds)}`;
  if (experience === "journey" || (experience === "read" && !isPoem(type))) {
    const words = [s.content, ...(s.blocks ?? []).map((b) => (b.kind === "text" ? b.text : ""))].join(" ").split(/\s+/).filter(Boolean).length;
    const min = Math.max(1, Math.round(words / 220 + (s.blocks?.filter((b) => b.kind !== "text").length ?? 0) * 0.2));
    return words > 60 ? `${label} · ${min} min` : label;
  }
  if (experience === "view" && (s.images?.length ?? 0) > 1) return `${label} · ${s.images!.length} images`;
  return label;
}

/** The manifest for a snapshot and the creator's settings. Deterministic. */
export function manifestFor(type: string, s: PublishedSnapshot, settings: PublishSettings, aspectRatio?: string): PublicationManifest {
  const allowed = experiencesFor(type, s);
  const experience = settings.experience && allowed.includes(settings.experience) ? settings.experience : allowed[0]!;
  const poem = experience === "read" && isPoem(type);
  const treatments = TREATMENTS[poem ? "poem" : experience];
  const treatment = treatments.some((t) => t.key === settings.treatment) ? settings.treatment! : treatments[0]!.key;
  const immersive = experience === "watch" || experience === "listen" || (experience === "journey" && treatment === "cinematic");
  return {
    experience,
    creationType: type,
    treatment,
    theme: settings.theme ?? (immersive ? "cinematic" : poem || experience === "read" ? "paper" : "light"),
    poem,
    aspectRatio,
    allowFullscreen: experience === "view" || experience === "swipe" || experience === "watch",
    allowZoom: experience === "view",
    hasText: !!s.content.trim(),
    hasAudio: s.media?.kind === "audio" || !!s.voice || !!s.blocks?.some((b) => b.kind === "audio"),
    hasVideo: s.media?.kind === "video" || !!s.blocks?.some((b) => b.kind === "video"),
    hasSequence: !!s.slides?.length || (s.blocks?.length ?? 0) > 1,
    hasTranscript: !!s.transcript,
    durationSeconds: s.media?.durationSeconds ?? undefined,
    itemCount: s.slides?.length ?? s.images?.length ?? undefined,
    coverObjectId: s.coverObjectId ?? s.slides?.find((x) => x.objectId)?.objectId ?? s.images?.[0]?.objectId ?? undefined,
    posterObjectId: s.media?.posterObjectId ?? undefined,
    descriptor: descriptorFor(type, experience, s),
  };
}

/** A URL-safe slug from a title (Latin letters kept; other scripts fall back to "work"). */
export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "work";
}

/** Creator Page sections (§16): a fixed set, reorderable, each on or off. Never a website builder. */
export const PAGE_SECTIONS = ["featured", "creations", "dejavu", "moments", "conversations", "about", "open_to", "links"] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];
export const PAGE_SECTION_LABEL: Record<PageSection, string> = {
  featured: "Featured",
  creations: "Creations",
  dejavu: "DejaVu",
  moments: "Moments",
  conversations: "Open Conversations",
  about: "About",
  open_to: "Open to",
  links: "Links",
};
