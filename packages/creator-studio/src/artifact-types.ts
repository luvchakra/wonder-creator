export type ArtifactCategory = "writing" | "visual" | "audio" | "video" | "social";

export interface ArtifactTypeDef {
  type: string;
  label: string;
  category: ArtifactCategory;
  /** What the editor holds: prose, screenplay-formatted text, lyric stanzas, or a structured concept. */
  format: "prose" | "screenplay" | "verse" | "concept" | "list";
  description: string;
}

export const ARTIFACT_TYPES: ArtifactTypeDef[] = [
  // Writing
  { type: "article", label: "Article", category: "writing", format: "prose", description: "A long-form piece with a clear argument" },
  { type: "essay", label: "Essay", category: "writing", format: "prose", description: "A reflective, personal exploration" },
  { type: "story", label: "Story", category: "writing", format: "prose", description: "A narrative with characters and change" },
  { type: "script", label: "Script", category: "writing", format: "screenplay", description: "A script for performance or film" },
  { type: "screenplay", label: "Screenplay", category: "writing", format: "screenplay", description: "Scenes, action and dialogue" },
  { type: "dialogue", label: "Dialogue", category: "writing", format: "screenplay", description: "A conversation between voices" },
  { type: "poem", label: "Poem", category: "writing", format: "verse", description: "A reflective piece in verse" },
  { type: "lyrics", label: "Lyrics", category: "writing", format: "verse", description: "Words written to be sung" },
  { type: "copy", label: "Copy", category: "writing", format: "prose", description: "Short persuasive writing" },
  { type: "newsletter", label: "Newsletter", category: "writing", format: "prose", description: "A letter to your readers" },
  { type: "biography", label: "Biography", category: "writing", format: "prose", description: "A life, told with care" },
  { type: "artist_statement", label: "Artist Statement", category: "writing", format: "prose", description: "What your work is about" },
  { type: "spoken_word", label: "Spoken Word", category: "writing", format: "verse", description: "Poetry written for the voice" },
  { type: "blog_post", label: "Blog Post", category: "writing", format: "prose", description: "A long-form reflection" },
  { type: "prose", label: "Prose", category: "writing", format: "prose", description: "A passage, freely written" },
  { type: "news", label: "News", category: "writing", format: "prose", description: "What happened — the facts first" },
  { type: "review", label: "Review", category: "writing", format: "prose", description: "A considered response to a work" },
  { type: "letter", label: "Letter", category: "writing", format: "prose", description: "Words written to someone" },
  // Visual
  { type: "visual_concept", label: "Visual Concept", category: "visual", format: "concept", description: "Imagery direction for a Creation" },
  { type: "poster", label: "Poster", category: "visual", format: "concept", description: "A poster concept and copy" },
  { type: "album_art", label: "Album Art", category: "visual", format: "concept", description: "Cover art direction" },
  { type: "moodboard", label: "Moodboard", category: "visual", format: "list", description: "Mood, palette and references" },
  { type: "photo_essay", label: "Photo Essay", category: "visual", format: "concept", description: "A visual story with narration" },
  { type: "art_series", label: "Art Series", category: "visual", format: "concept", description: "A connected series of works" },
  { type: "presentation", label: "Presentation", category: "visual", format: "list", description: "A structured deck outline" },
  // Audio
  { type: "podcast_concept", label: "Podcast Concept", category: "audio", format: "concept", description: "An episode or series concept" },
  { type: "narration", label: "Narration", category: "audio", format: "prose", description: "A voice-over script" },
  { type: "song_concept", label: "Song", category: "audio", format: "verse", description: "Lyrics, mood and melody direction" },
  { type: "sound_design", label: "Sound Design", category: "audio", format: "list", description: "A sound palette and cues" },
  // Video
  { type: "short_film", label: "Short Film", category: "video", format: "screenplay", description: "A personal narrative on film" },
  { type: "film_treatment", label: "Film Treatment", category: "video", format: "prose", description: "The story and tone of a film" },
  { type: "storyboard", label: "Storyboard", category: "video", format: "list", description: "Key shots, in order" },
  { type: "shot_list", label: "Shot List", category: "video", format: "list", description: "Every shot you need" },
  { type: "documentary", label: "Documentary", category: "video", format: "prose", description: "A deeper exploration of real life" },
  { type: "trailer", label: "Trailer", category: "video", format: "screenplay", description: "A short, compelling cut" },
  { type: "reel_concept", label: "Reel", category: "video", format: "list", description: "A short vertical video idea" },
  // Social / professional
  { type: "social_post", label: "Social Post", category: "social", format: "prose", description: "A post for your audience" },
  { type: "carousel", label: "Carousel", category: "social", format: "list", description: "A multi-slide story" },
  { type: "social_series", label: "Social Series", category: "social", format: "list", description: "A multi-platform story" },
  { type: "media_kit", label: "Media Kit", category: "social", format: "prose", description: "Who you are, for partners" },
  { type: "proposal", label: "Proposal", category: "social", format: "prose", description: "A project proposal" },
  { type: "pitch_deck", label: "Pitch Deck", category: "social", format: "list", description: "A slide-by-slide pitch" },
  // Publication derivatives (P1-13): platform adaptations kept as real pieces
  { type: "visual_post", label: "Visual Post", category: "social", format: "concept", description: "An image-led post: the visual and its words" },
  { type: "professional_post", label: "Professional Post", category: "social", format: "prose", description: "A post for a professional audience" },
  { type: "video_description", label: "Video Description", category: "social", format: "prose", description: "A description for a video page" },
  { type: "thumbnail_concept", label: "Thumbnail Concept", category: "visual", format: "concept", description: "A thumbnail idea: image, text and contrast" },
];

/**
 * Platform adaptations of a piece (P1-13). Each makes a new derivative piece — with lineage to the source version,
 * inherited rights and its own approval before publishing — marked as made for that destination.
 */
export interface PublicationDerivativePreset {
  key: string;
  label: string;
  madeFor: string;
  targetType: string;
  instruction: string;
  /** Which source categories it suits. */
  from: ArtifactCategory[];
}

export const PUBLICATION_DERIVATIVES: PublicationDerivativePreset[] = [
  { key: "trailer", label: "Trailer", madeFor: "Trailer", targetType: "trailer", from: ["video", "writing"], instruction: "Cut a 60–90 second trailer from this: the hook, the turn, and a closing line. Don't reveal the ending." },
  { key: "instagram_carousel", label: "Instagram carousel", madeFor: "Instagram", targetType: "carousel", from: ["video", "writing", "visual", "audio"], instruction: "Turn this into an Instagram carousel of 5 to 8 slides: one idea per slide, a strong first slide, and a short closing slide." },
  { key: "visual_post", label: "Visual post", madeFor: "Instagram", targetType: "visual_post", from: ["writing", "audio"], instruction: "Make a visual post from this: the image to create and a short caption in the creator's voice." },
  { key: "linkedin_post", label: "LinkedIn post", madeFor: "LinkedIn", targetType: "professional_post", from: ["writing", "video", "visual", "audio", "social"], instruction: "Adapt this into a LinkedIn post: a clear first line, what it is and why it matters, and no hashtag walls." },
  { key: "youtube_description", label: "YouTube description", madeFor: "YouTube", targetType: "video_description", from: ["video", "audio", "writing"], instruction: "Write a YouTube description for this: a two-line summary first, then context and credits. No clickbait." },
  { key: "thumbnail", label: "Thumbnail concept", madeFor: "YouTube", targetType: "thumbnail_concept", from: ["video", "audio", "writing"], instruction: "Propose a thumbnail concept for this: the image, at most five words of text, and why it reads at small sizes." },
];

export function publicationDerivativesFor(type: string): PublicationDerivativePreset[] {
  const category = artifactType(type).category;
  return PUBLICATION_DERIVATIVES.filter((p) => p.from.includes(category) && p.targetType !== type);
}

const BY_TYPE = new Map(ARTIFACT_TYPES.map((t) => [t.type, t]));

export function artifactType(type: string): ArtifactTypeDef {
  return BY_TYPE.get(type) ?? { type, label: humanize(type), category: "writing", format: "prose", description: "" };
}

export function isKnownArtifactType(type: string): boolean {
  return BY_TYPE.has(type);
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map loose creator language ("a film", "some lyrics") to a known type. */
export function inferArtifactType(text: string): string | null {
  return inferAllArtifactTypes(text)[0] ?? null;
}

/** Every artifact type mentioned, in rule priority order ("the poem … make lyrics" → lyrics, poem). */
export function inferAllArtifactTypes(text: string): string[] {
  const t = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\bscreenplay\b/, "screenplay"],
    [/\bshort film\b|\bfilm script\b|\bfilm\b/, "short_film"],
    [/\bdocumentary\b/, "documentary"],
    [/\bstoryboard\b/, "storyboard"],
    [/\bshot list\b/, "shot_list"],
    [/\btrailer\b/, "trailer"],
    [/\breel\b/, "reel_concept"],
    [/\bspoken[- ]word\b/, "spoken_word"],
    [/\blyrics?\b/, "lyrics"],
    [/\bsong\b/, "song_concept"],
    [/\bpoem|poetry|verse\b/, "poem"],
    [/\bphoto essay\b/, "photo_essay"],
    [/\bblog\b/, "blog_post"],
    [/\bessay\b/, "essay"],
    [/\barticle\b/, "article"],
    [/\bstory\b/, "story"],
    [/\bscript\b/, "script"],
    [/\bdialogue\b/, "dialogue"],
    [/\bnewsletter\b/, "newsletter"],
    [/\bbiography\b/, "biography"],
    [/\bartist statement\b/, "artist_statement"],
    [/\bpodcast\b/, "podcast_concept"],
    [/\bnarration|voice[- ]?over\b/, "narration"],
    [/\bposter\b/, "poster"],
    [/\balbum (art|cover)\b/, "album_art"],
    [/\bmood ?board\b/, "moodboard"],
    [/\bvisual (concept|treatment|style)\b/, "visual_concept"],
    [/\btreatment\b/, "film_treatment"],
    [/\bart series\b/, "art_series"],
    [/\bpresentation|slides\b/, "presentation"],
    [/\bpitch deck\b/, "pitch_deck"],
    [/\bproposal\b/, "proposal"],
    [/\bmedia kit\b/, "media_kit"],
    [/\bcarousel\b/, "carousel"],
    [/\b(instagram|social) (post|caption)\b|\bsocial post\b/, "social_post"],
    [/\bsocial series\b/, "social_series"],
  ];
  const out: string[] = [];
  for (const [re, type] of rules) if (re.test(t) && !out.includes(type)) out.push(type);
  return out;
}

/** Contextual CreatorBrain actions for an artifact: only what's relevant, never twenty buttons. */
export interface StudioAction {
  key: string;
  label: string;
  hint: string;
  kind: "refine" | "transform";
  targetType?: string;
}

export function actionsFor(type: string): StudioAction[] {
  const def = artifactType(type);
  const common: StudioAction[] = [
    { key: "improve", label: "Improve this", hint: "Tighten and deepen it", kind: "refine" },
    { key: "shorter", label: "Make it shorter", hint: "Keep what matters", kind: "refine" },
    { key: "tone", label: "Change tone", hint: "Warmer, bolder, more playful…", kind: "refine" },
  ];
  switch (def.format) {
    case "screenplay":
      return [
        { key: "improve", label: "Improve this scene", hint: "Make it more emotional", kind: "refine" },
        { key: "add_scene", label: "Add a scene", hint: "A flashback or a turn", kind: "refine" },
        { key: "opening", label: "Suggest a better opening line", hint: "Based on your writing style", kind: "refine" },
        { key: "storyboard", label: "Create a storyboard", hint: "Generate key shots", kind: "transform", targetType: "storyboard" },
        { key: "music", label: "Add music direction", hint: "Mood and cues", kind: "transform", targetType: "sound_design" },
      ];
    case "verse":
      return [
        ...common,
        def.type === "lyrics" || def.type === "song_concept"
          ? { key: "spoken", label: "Turn into spoken word", hint: "For the voice", kind: "transform", targetType: "spoken_word" }
          : { key: "lyrics", label: "Turn into lyrics", hint: "Make it singable", kind: "transform", targetType: "lyrics" },
        { key: "visual", label: "Create visual concepts", hint: "Imagery for this Creation", kind: "transform", targetType: "visual_concept" },
      ];
    case "prose":
      return [
        ...common,
        { key: "film", label: "Adapt into a short film", hint: "A script from this", kind: "transform", targetType: "short_film" },
        { key: "social", label: "Create a social post", hint: "Share the essence", kind: "transform", targetType: "social_post" },
      ];
    case "concept":
    case "list":
      return [
        ...common,
        { key: "story", label: "Turn into a story", hint: "Narrative from this", kind: "transform", targetType: "story" },
        { key: "carousel", label: "Create a carousel", hint: "Slides to share", kind: "transform", targetType: "carousel" },
      ];
  }
}

/** The Profile's Creations filters (profile board, 30 Sep 2026): All · Visual · Audio · Writing · Video · Series. */
export const PROFILE_SHELVES = [
  { value: "all", label: "All" },
  { value: "visual", label: "Visual" },
  { value: "audio", label: "Audio" },
  { value: "writing", label: "Writing" },
  { value: "video", label: "Video" },
  { value: "series", label: "Series" },
] as const;
export type ProfileShelf = Exclude<(typeof PROFILE_SHELVES)[number]["value"], "all">;

const SERIES_TYPES = new Set(["carousel", "social_series", "art_series", "photo_essay"]);

/** Which Creations filter a piece sits under. Multi-part visual stories are Series; other social pieces read as Writing. */
export function profileShelf(type: string): ProfileShelf {
  if (SERIES_TYPES.has(type)) return "series";
  const category = artifactType(type).category;
  return category === "social" ? "writing" : category;
}

/** A quiet reading-time estimate for writing ("1 min read"); null for empty text. */
export function readingMinutes(text: string | null | undefined): number | null {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / 220)) : null;
}
