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
export const VISIBILITY_LABEL: Record<ConversationVisibility, string> = { community: "Community", public: "Public", limited: "Limited" };
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
