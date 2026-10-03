/**
 * Community + Open Conversations (docs/community.md): vocabulary shared by the server and the browser.
 *
 * Community is an exchange layer over what already exists — Scrapbook, Creations, Huddles, People, Creative Rooms —
 * plus one new thing: the Open Conversation. There are no follower counts, likes, karma or trending scores, and
 * nothing is ordered by popularity.
 */

export const CONVERSATION_INTENTS = ["discuss", "ask", "critique", "share_knowledge", "looking_for", "explore_together"] as const;
export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const INTENT_LABEL: Record<ConversationIntent, string> = {
  discuss: "Discuss",
  ask: "Ask",
  critique: "Critique",
  share_knowledge: "Share knowledge",
  looking_for: "Looking for",
  explore_together: "Explore together",
};
export const INTENT_HINT: Record<ConversationIntent, string> = {
  discuss: "Explore an idea",
  ask: "Seek advice",
  critique: "Ask for constructive feedback",
  share_knowledge: "A technique, process or experience",
  looking_for: "A reference, Material, skill or collaborator",
  explore_together: "Open-ended exploration",
};
/** Intents that ask something of the reader — they show under Help. */
export const HELP_INTENTS: readonly ConversationIntent[] = ["ask", "critique", "looking_for"];

export const CONVERSATION_VISIBILITIES = ["community", "public", "limited"] as const;
export type ConversationVisibility = (typeof CONVERSATION_VISIBILITIES)[number];
export const VISIBILITY_LABEL: Record<ConversationVisibility, string> = { community: "Signed-in creators", public: "Public", limited: "Limited" };
export const VISIBILITY_HINT: Record<ConversationVisibility, string> = {
  community: "Signed-in creators who can see your profile",
  public: "Anyone who can see your profile",
  limited: "Only the people you add",
};

/** "Open to…" on a profile (§9). Chosen by the creator, never inferred. */
export const OPEN_TO = ["feedback", "huddles", "collaborating", "references", "mentoring", "questions"] as const;
export type OpenTo = (typeof OPEN_TO)[number];
export const OPEN_TO_LABEL: Record<OpenTo, string> = {
  feedback: "Giving feedback",
  huddles: "Huddles",
  collaborating: "Collaborating",
  references: "Sharing references",
  mentoring: "Mentoring",
  questions: "Being asked a question",
};
/** Which "Open to…" makes a help request a good fit for the reader. */
export const INTENT_FITS: Partial<Record<ConversationIntent, OpenTo>> = {
  critique: "feedback",
  ask: "questions",
  looking_for: "references",
  explore_together: "collaborating",
};

export const COMMUNITY_FILTERS = ["for_you", "conversations", "help", "people"] as const;
export type CommunityFilter = (typeof COMMUNITY_FILTERS)[number];
export const COMMUNITY_FILTER_LABEL: Record<CommunityFilter, string> = { for_you: "For you", conversations: "Conversations", help: "Help", people: "People" };

export interface Person {
  id: string;
  name: string;
  handle: string | null;
}

/** How a help request reads on a card ("Arjun could use some help", "Priya is looking for"). */
export function helpHeadline(intent: ConversationIntent, name: string): string {
  const first = name.split(" ")[0] || name;
  if (intent === "looking_for") return `${first} is looking for`;
  if (intent === "critique") return `${first} would like feedback`;
  if (intent === "ask") return `${first} could use some help`;
  if (intent === "explore_together") return `${first} wants to explore together`;
  return `${first} started a conversation`;
}

/** "Since you last read this — 8 new replies · 3 new participants" (§13). */
export function catchUpLine(c: { newReplies: number; newParticipants: number }): string | null {
  if (!c.newReplies) return null;
  const parts = [`${c.newReplies} new ${c.newReplies === 1 ? "reply" : "replies"}`];
  if (c.newParticipants) parts.push(`${c.newParticipants} new ${c.newParticipants === 1 ? "participant" : "participants"}`);
  return parts.join(" · ");
}

const PLURAL: Record<string, string> = {
  poem: "poems", lyrics: "lyrics", spoken_word: "spoken-word pieces", essay: "essays", story: "stories", article: "articles", blog_post: "posts",
  short_film: "short films", documentary: "documentaries", reel_concept: "reels", film_treatment: "film treatments",
  carousel: "carousels", photo_essay: "photo essays", art_series: "art series", visual_concept: "visual concepts", poster: "posters", moodboard: "moodboards",
  song_concept: "songs", podcast_concept: "podcasts", narration: "narrations", sound_design: "sound pieces",
};
const INTENT_PHRASE: Partial<Record<ConversationIntent, string>> = {
  critique: "people asking for feedback",
  ask: "questions looking for answers",
  looking_for: "invitations to collaborate",
  explore_together: "invitations to explore together",
};

/**
 * "This week in the community" — one line of what's been happening, with no numbers (owner, 2 Oct 2026). Types are the
 * kinds of public work shared this week, most present first; intents are the open asks; a live Huddle may close it
 * (Home leaves it out — the Huddle has its own place there).
 * Null when nothing happened.
 */
export function weekLine(input: { types: string[]; intents: ConversationIntent[]; liveTopic?: string | null }): string | null {
  const kinds = [...new Set(input.types.map((t) => PLURAL[t]).filter((x): x is string => !!x))].slice(0, 2);
  const parts: string[] = [];
  if (kinds.length) parts.push(`new ${kinds.join(" and ")}`);
  else if (input.types.length) parts.push("new work");
  for (const i of [...new Set(input.intents)]) if (INTENT_PHRASE[i] && parts.length < 3) parts.push(INTENT_PHRASE[i]!);
  if (input.liveTopic) parts.push(`a Huddle live now on ${input.liveTopic.replace(/[.\s]+$/, "")}`);
  if (!parts.length) return null;
  const line = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return line.charAt(0).toUpperCase() + line.slice(1) + ".";
}

/**
 * Who can find and join a community (owner, 3 Oct 2026). Public: listed and searchable, anyone joins. Unlisted: anyone
 * with the link sees and joins it, but it's never listed. Private: members only; people join when its hosts invite them.
 * Whatever the privacy, only members add anything (topics, posts, shared Creations, Huddles) — enforced in the database.
 */
export const COMMUNITY_PRIVACY = ["public", "unlisted", "private"] as const;
export type CommunityPrivacy = (typeof COMMUNITY_PRIVACY)[number];
export const PRIVACY_LABEL: Record<CommunityPrivacy, { label: string; hint: string }> = {
  public: { label: "Public", hint: "Anyone can find it and join" },
  unlisted: { label: "Unlisted", hint: "Only people with the link can find it and join" },
  private: { label: "Private", hint: "Only members see it. People join when invited" },
};
