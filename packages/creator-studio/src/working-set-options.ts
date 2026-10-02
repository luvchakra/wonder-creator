import { canInsert, type RightsState } from "@wonder/creator-library/source-rights";

/**
 * CreativeStudio Working Set (docs/ui-redesign/creative-studio-working-set.md): the words and shapes shared by the
 * server and the Studio UI. Client-safe — no database access here.
 */

export { RIGHTS_LABEL, RIGHTS_HINT, canInsert, type RightsState } from "@wonder/creator-library/source-rights";

export const SOURCE_STATES = ["pinned", "in_use", "available"] as const;
export type SourceState = (typeof SOURCE_STATES)[number];
export const STATE_LABEL: Record<SourceState, string> = { pinned: "Pinned", in_use: "In use", available: "Available" };

/** How a source is used in the piece (studio_sources.usage_intent). */
export const USAGE_INTENTS = ["content", "style", "structure", "mood", "reference", "fact", "quote", "visual", "sound", "constraint"] as const;
export type UsageIntent = (typeof USAGE_INTENTS)[number];
/** Short words for a chosen use, shown on the source's row. */
export const USAGE_LABEL: Record<UsageIntent, string> = {
  content: "Its words",
  style: "Its look and tone",
  structure: "Its shape",
  mood: "Its mood",
  reference: "For reference",
  fact: "Its facts",
  quote: "A part of it",
  visual: "The picture itself",
  sound: "The recording",
  constraint: "Feedback to apply",
};

export const SOURCE_ROLES = ["story", "visual", "mood", "reference", "fact", "voice", "style", "constraint", "character", "structure", "sound", "quote", "feedback", "creative_direction"] as const;
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
  feedback: "Feedback",
  creative_direction: "Creative direction",
};

export const SOURCE_TYPES = ["material", "creation", "collection", "comment", "huddle_moment", "conversation", "conversation_reply", "scrapbook_entry"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
/** Things from Community (Phase 04 §6–7): someone's Open Conversation, a reply in one, a Scrapbook entry. */
export const COMMUNITY_SOURCE_TYPES: readonly SourceType[] = ["conversation", "conversation_reply", "scrapbook_entry"];
export const isCommunitySource = (t: SourceType) => COMMUNITY_SOURCE_TYPES.includes(t);

/** A usable piece of a source (§19–21, §42). */
export interface Fragment {
  kind: "text_range" | "audio_range" | "video_range" | "section";
  /** Seconds for audio/video, character offsets for text. */
  start?: number;
  end?: number;
  label?: string;
  /** The words themselves (a quote, a passage) — what CreativeMind and the creator see. */
  text?: string;
}

/** A Working Set row, resolved for the viewer (details only while they can still open the source, §70). */
export interface WorkingSource {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  state: SourceState;
  roles: SourceRole[];
  fragment: Fragment | null;
  addedAt: string;
  available: boolean;
  title: string;
  /** "Photo", "Voice note", "Poem · Creation", "Collection · 6"… */
  kind: string;
  /** Material type or Creation type, for the row's icon. */
  mediaType: string | null;
  href: string | null;
  thumbnailUrl: string | null;
  /** How the creator chose to use it ("Use this"), and their own words when no option fit. */
  usageIntent?: UsageIntent | null;
  usageNote?: string | null;
  /** Brought in within the last half hour and not used yet: shows "New". */
  fresh?: boolean;
  /** What may be done with it (Phase 04 §8) — recorded facts only, never inferred. */
  rights: RightsState;
  /** The credit kept with it ("By Maya · CC BY 4.0 · Openverse"), when there is one. */
  attribution?: string | null;
  /** Who made it, for someone else's Community words ("Maya · Open Conversation"). */
  author?: string | null;
  /** When the thing itself was made (a reply's date), for provenance. */
  createdAt?: string | null;
}

export interface StudioIntent {
  goal?: string;
  format?: string;
  mood?: string[];
  style?: string[];
  preserve?: string[];
  avoid?: string[];
}

export interface WorkingSetView {
  sessionId: string;
  artifactId: string;
  outputMode: string;
  intent: StudioIntent;
  /** The autosaved canvas draft, if it differs from the current version (§44–46). */
  draft: { text: string; baseVersionId: string | null; savedAt: string } | null;
  sources: WorkingSource[];
  /** The source row opened last on the Working Table (it opens again next time; none when all were closed). */
  lastOpenedSourceId: string | null;
  /** The DejaVu being explored here (§5): its Moments are available to bring in; none were imported. */
  dejavu: { id: string; name: string; count: number } | null;
}

export const OUTPUT_MODES = [
  {
    key: "writing",
    label: "Writing",
    hint: "Article, story, poem",
    types: [
      "article",
      "essay",
      "story",
      "poem",
      "lyrics",
      "spoken_word",
      "blog_post",
      "script",
      "screenplay",
      "dialogue",
      "copy",
      "newsletter",
      "biography",
      "artist_statement",
      "narration",
      "film_treatment",
      "documentary",
      "social_post",
      "professional_post",
      "video_description",
      "media_kit",
      "proposal",
    ],
  },
  { key: "carousel", label: "Carousel", hint: "Social media", types: ["carousel", "social_series"] },
  { key: "image", label: "Images", hint: "Visual series", types: ["visual_concept", "poster", "album_art", "moodboard", "photo_essay", "art_series", "visual_post", "thumbnail_concept"] },
  { key: "video", label: "Video", hint: "Reel, short film", types: ["short_film", "storyboard", "shot_list", "trailer", "reel_concept"] },
  { key: "audio", label: "Audio", hint: "Voice, podcast, song", types: ["podcast_concept", "song_concept", "sound_design"] },
  { key: "presentation", label: "Presentation", hint: "Deck, proposal", types: ["presentation", "pitch_deck"] },
] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number]["key"];

/** The output mode a Creation type belongs to. */
export function outputModeOf(artifactType: string): OutputMode {
  return OUTPUT_MODES.find((m) => (m.types as readonly string[]).includes(artifactType))?.key ?? "writing";
}

/** The Creation type a mode switch makes — the mode's first, most general type. */
export const MODE_DEFAULT_TYPE: Record<OutputMode, string> = {
  writing: "story",
  carousel: "carousel",
  image: "photo_essay",
  video: "short_film",
  audio: "podcast_concept",
  presentation: "presentation",
};

/** One creative direction for a set of sources (§16–17). */
export interface Direction {
  key: string;
  title: string;
  hint: string;
  artifactType: string;
}

/**
 * Directions that follow from what's on the table — from the sources' roles, deterministically (§17 leaves the one-line
 * idea to CreativeMind; these are the honest options underneath it, live model or not).
 */
export function directionsFor(sources: Array<Pick<WorkingSource, "roles" | "sourceType" | "mediaType">>): Direction[] {
  const roles = new Set(sources.flatMap((s) => s.roles));
  const visuals = sources.filter((s) => s.roles.includes("visual")).length;
  const out: Direction[] = [];
  if (roles.has("voice") && visuals) out.push({ key: "spoken", title: "Visual spoken-word piece", hint: "Combine the story, photos and words with voice.", artifactType: "spoken_word" });
  if (visuals >= 2 && roles.has("story")) out.push({ key: "essay", title: "Photo essay", hint: "Turn this into a narrative photo essay.", artifactType: "photo_essay" });
  if (visuals >= 1) out.push({ key: "carousel", title: "Carousel", hint: "A short visual story for social media.", artifactType: "carousel" });
  if (roles.has("story") || roles.has("quote")) out.push({ key: "film", title: "Short film concept", hint: "A 1–2 minute film idea.", artifactType: "short_film" });
  if (roles.has("mood") || roles.has("sound")) out.push({ key: "song", title: "Song concept", hint: "Lyrics and a feeling to score.", artifactType: "song_concept" });
  if (!out.length || roles.has("story")) out.push({ key: "poem", title: "Poem", hint: "The heart of it in a few stanzas.", artifactType: "poem" });
  return out.slice(0, 4);
}

/** "2 sources still unused" — a quiet, deterministic nudge (§32); null when there's nothing to say. */
export function unusedNudge(sources: Array<Pick<WorkingSource, "state" | "title" | "available">>): { count: number; text: string } | null {
  const unused = sources.filter((s) => s.state === "available" && s.available);
  if (!unused.length) return null;
  if (unused.length === 1) return { count: 1, text: `You haven't used “${unused[0]!.title}” yet.` };
  return { count: unused.length, text: `${unused.length} sources are still unused.` };
}

/** One "Bring in" search result. */
export const BRING_IN_KINDS = [
  { key: "material", label: "Materials", hint: "Photos, videos, docs…" },
  { key: "creation", label: "My Creations", hint: "Reuse and remix" },
  { key: "capture", label: "Capture", hint: "Photo, video, voice" },
  { key: "link", label: "Link / YouTube", hint: "URLs and web" },
  { key: "collection", label: "Collection", hint: "Saved references" },
  { key: "huddle_moment", label: "Huddle moment", hint: "Ideas and discussions" },
  { key: "comment", label: "Person / Comment", hint: "Use feedback" },
  { key: "dejavu", label: "DejaVu", hint: "Moments you connected" },
  { key: "community", label: "Pulse", hint: "Conversations, replies" },
  { key: "external", label: "Royalty-free images", hint: "Openverse, Pixabay…" },
  { key: "browse", label: "Browse", hint: "Explore and discover" },
] as const;

export interface BringInResult {
  sourceType: SourceType;
  sourceId: string;
  title: string;
  kind: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  inSet: boolean;
  rights?: RightsState;
}

/** Sections in the order the spec gives (§56): Pinned, In use, Available — empty ones aren't shown. */
export function groupSources(sources: WorkingSource[]): Array<{ state: SourceState; sources: WorkingSource[] }> {
  return SOURCE_STATES.map((state) => ({ state, sources: sources.filter((s) => s.state === state) })).filter((g) => g.sources.length);
}

/** "5 sources · 3 in use" — the Studio's quiet summary (§7, §45, §65). */
export function workingSetSummary(sources: Pick<WorkingSource, "state">[]): string {
  if (!sources.length) return "No sources yet";
  const n = sources.length;
  const inUse = sources.filter((s) => s.state !== "available").length;
  return `${n} ${n === 1 ? "source" : "sources"}${inUse ? ` · ${inUse} in use` : ""}`;
}

export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Sentences of a transcript or note, as candidate fragments (§21) — a plain split, nothing invented. */
export function suggestFragments(text: string, max = 5): Array<Fragment & { text: string }> {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 12 && t.length <= 200);
  const seen = new Set<string>();
  const out: Array<Fragment & { text: string }> = [];
  let offset = 0;
  for (const t of parts) {
    const at = text.indexOf(t, offset);
    if (at >= 0) offset = at + t.length;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({ kind: "text_range", start: at >= 0 ? at : undefined, end: at >= 0 ? at + t.length : undefined, text: t });
    if (out.length >= max) break;
  }
  return out;
}

/** One way to use a source, offered by "Use this". `part` = pick a passage or moment first (Fragments). */
export interface UsageOption {
  key: string;
  intent: UsageIntent;
  label: string;
  hint: string;
  part?: boolean;
}

const IMAGE_TYPES = new Set(["image", "sketch", "photo", "photo_essay"]);
const SOUND_TYPES = new Set(["voice", "audio"]);
const DOC_TYPES = new Set(["pdf", "document", "research", "url", "reference", "link"]);

/**
 * "How do you want to use this?" — 3–4 plain options from what the source is and what the Creation is becoming
 * (owner, 28 Sep 2026). Deterministic: no model, nothing invented. The sheet always adds "Something else…".
 */
export function usageOptionsFor(s: Pick<WorkingSource, "sourceType" | "mediaType" | "fragment"> & { rights?: RightsState }, creationType: string): UsageOption[] {
  const mode = outputModeOf(creationType);
  const visualOut = mode === "carousel" || mode === "image" || mode === "video" || mode === "presentation";
  const t = s.mediaType ?? "";
  // Someone else's Community words steer; they aren't copied in (Phase 04 §8).
  if (isCommunitySource(s.sourceType) && s.rights && !canInsert(s.rights)) {
    return [
      { key: "direction", intent: "constraint", label: "Use as creative direction", hint: "Let it steer how you shape the piece" },
      { key: "mood", intent: "mood", label: "Take its mood", hint: "The feeling, not the words" },
      { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  if (s.rights && !canInsert(s.rights) && IMAGE_TYPES.has(t)) {
    return [
      { key: "style", intent: "style", label: "Use as visual reference", hint: "Light, colour and texture for the visuals" },
      { key: "mood", intent: "mood", label: "Take its mood", hint: "The feeling, not the picture" },
      { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  if (s.sourceType === "comment") {
    return [
      { key: "apply", intent: "constraint", label: "Apply this feedback", hint: "Keep it in mind as you shape the piece" },
      { key: "idea", intent: "content", label: "Take the idea in it", hint: "Build on what it suggests" },
      { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  if (s.sourceType === "collection") {
    return [
      { key: "mood", intent: "mood", label: "Set the mood from it", hint: "Its overall feeling" },
      { key: "style", intent: "style", label: "Take its look", hint: "Colours, textures, style" },
      { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  if (IMAGE_TYPES.has(t)) {
    return [
      mode === "carousel"
        ? { key: "slide", intent: "visual", label: "Use it as a slide image", hint: "The picture itself, on a slide" }
        : visualOut
          ? { key: "visual", intent: "visual", label: "Use the picture itself", hint: "As it is, in the piece" }
          : { key: "describe", intent: "content", label: "Write from what's in it", hint: "What it shows becomes words" },
      { key: "style", intent: "style", label: "Take its look", hint: "Light, colour and texture for the visuals" },
      { key: "mood", intent: "mood", label: "Take its mood", hint: "The feeling, not the picture" },
      { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  if (SOUND_TYPES.has(t)) {
    return [
      { key: "words", intent: "content", label: mode === "carousel" ? "Put its words on this slide" : "Use its words", hint: "What's said, as text" },
      { key: "moment", intent: "quote", label: "Use one moment of it", hint: "Pick where it starts and ends", part: true },
      { key: "mood", intent: "mood", label: "Take its mood", hint: "The feeling in the voice" },
      mode === "audio" || mode === "video"
        ? { key: "sound", intent: "sound", label: "Use the recording itself", hint: "The sound, in the piece" }
        : { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  if (DOC_TYPES.has(t)) {
    return [
      { key: "facts", intent: "fact", label: "Use its facts", hint: "Details and specifics to get right" },
      { key: "quote", intent: "quote", label: "Quote a passage", hint: "Pick the part to use", part: true },
      { key: "ref", intent: "reference", label: "Keep it for reference", hint: "Nearby, not steering anything" },
    ];
  }
  // Words: a note, an idea, a previous Creation, a Huddle moment.
  return [
    { key: "words", intent: "content", label: mode === "carousel" ? "Put its words on this slide" : "Use its words", hint: "As the text of this piece" },
    { key: "part", intent: "quote", label: "Use only a part", hint: "A line or passage you choose", part: true },
    { key: "structure", intent: "structure", label: "Follow its shape", hint: "Its order, sections or rhythm" },
    { key: "tone", intent: "style", label: "Take its tone and voice", hint: "How it sounds, not what it says" },
  ];
}

/** A one-tap way to use a source in the Creation, shown under its row (owner board, 29 Sep 2026; Phase 04 §11). */
export type MaterialAction =
  | "new_slide"
  | "slide_image"
  | "cover"
  | "slide_words"
  | "split_slides"
  | "refine_slide"
  | "draft_words"
  | "refine_draft"
  | "part"
  | "direction"
  | "visual_ref"
  | "pin";
export interface MaterialActionOption {
  action: MaterialAction;
  label: string;
}

/** Actions that place the source itself into the output — allowed only when its rights permit (§8). */
export const INSERTING_ACTIONS: readonly MaterialAction[] = ["new_slide", "slide_image", "cover", "slide_words", "split_slides", "draft_words", "part"];

/**
 * Up to three context-based buttons for a source on the table, generated from what it is × what the Creation is ×
 * what its rights allow (Phase 04 §11) — never a global list. Carousels get slide actions, written pieces draft
 * actions. Anything that would copy the source into the piece is offered only when its rights permit; otherwise the
 * source can still steer (refine with it, use it as direction or visual reference). Deterministic; each one does
 * exactly what it says (the Studio's apply endpoint, which checks the rights again).
 */
export function materialActionsFor(s: Pick<WorkingSource, "sourceType" | "mediaType" | "available" | "fragment" | "rights" | "state">, creationType: string): MaterialActionOption[] {
  if (!s.available || s.rights === "restricted") return [];
  const carousel = outputModeOf(creationType) === "carousel";
  const insert = canInsert(s.rights);
  const t = s.mediaType ?? "";
  const pin: MaterialActionOption[] = s.state === "pinned" ? [] : [{ action: "pin", label: "Pin as constraint" }];
  const photo = s.sourceType === "material" && (t === "image" || t === "sketch");
  if (photo) {
    if (!insert) return [{ action: "visual_ref", label: "Use as visual reference" }, ...pin.map((p) => ({ ...p, label: "Pin visual" }))];
    return carousel
      ? [
          { action: "new_slide", label: "Add as new slide" },
          { action: "slide_image", label: "Replace slide image" },
          { action: "cover", label: "Set as cover" },
        ]
      : [{ action: "cover", label: "Set as cover" }, { action: "visual_ref", label: "Use as visual reference" }];
  }
  if (s.sourceType === "collection") return [];
  if (s.sourceType === "comment") return [carousel ? { action: "refine_slide", label: "Apply to slide text" } : { action: "refine_draft", label: "Apply feedback" }];
  const refine: MaterialActionOption = carousel ? { action: "refine_slide", label: "Refine slide with this" } : { action: "refine_draft", label: "Rework draft with it" };
  // Someone else's words (Community, a shared Creation, a link with no licence): they steer, they aren't copied in.
  if (!insert) return [{ action: "direction", label: "Use as creative direction" }, refine, ...pin];
  // Words: a note, voice (its transcript), a document, a Creation, a Huddle moment, your own Community words, or a fragment of one.
  return carousel
    ? [
        { action: "slide_words", label: "Use on slide" },
        ...(s.fragment ? [] : [{ action: "split_slides" as const, label: "Split into slides" }]),
        { action: "refine_slide", label: "Refine slide text" },
      ]
    : [{ action: "draft_words", label: "Add to draft" }, { action: "refine_draft", label: "Rework draft with it" }, ...(s.fragment ? [] : [{ action: "part" as const, label: "Use a part…" }])];
}
