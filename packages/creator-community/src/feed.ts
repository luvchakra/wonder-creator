import { fromDbError } from "@wonder/core";
import { findCollaborators } from "@wonder/creator-identity";
import { liveCards, type LiveCard } from "@wonder/creator-huddle";
import { listPosts } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { knownCollaborators, peopleById, toConversation, type OpenConversation } from "./conversations";
import { hiddenCreators, openToOf } from "./moderation";
import { HELP_INTENTS, INTENT_FITS, OPEN_TO_LABEL, type CommunityFilter, type OpenTo, type Person } from "./shared";

/**
 * The Community feed (§3, §11): a small, curated mix — never an endless, engagement-ranked stream. Everything is read
 * through the viewer's own access; muted and blocked creators never appear. Order is by time within each kind, mixed in
 * a fixed pattern; nothing is ordered by replies or popularity. Each card may carry one plain-language reason from a
 * deterministic relationship ("You're open to giving feedback", "You have 2 Materials that may help", "You worked with
 * Maya before"). Semantic matching comes in Phase 05.
 */

export type CommunityCard =
  | { kind: "conversation"; conversation: OpenConversation; author: Person; reason: string | null; mayHelp: { count: number; query: string } | null }
  | { kind: "scrapbook"; id: string; body: string; author: Person; createdAt: string; imageUrl: string | null }
  | { kind: "huddle"; huddle: LiveCard }
  | { kind: "creation"; id: string; title: string; artifactType: string; author: Person; coverMaterialId: string | null; updatedAt: string }
  | { kind: "person"; person: Person; bio: string | null; reason: string | null; openTo: OpenTo[] };

const STOP = new Set(["that", "this", "with", "from", "what", "when", "your", "have", "about", "there", "their", "would", "could", "should", "which", "into", "than", "then", "them", "they", "been", "does", "feel", "like", "much", "more", "some", "someone", "isn't", "doesn't"]);
/** A few distinctive words from a title, as an any-of prefix query ("waiting:* | coming:*"). */
export function helpQuery(text: string): string | null {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP.has(w)),
    ),
  ].slice(0, 5);
  return words.length ? words.map((w) => `${w}:*`).join(" | ") : null;
}

/** How many of the viewer's own Materials share distinctive words with a request. */
async function materialsThatMayHelp(db: Db, viewerId: string, text: string): Promise<number> {
  const q = helpQuery(text);
  if (!q) return 0;
  const { count } = await db.from("creative_materials").select("id", { count: "exact", head: true }).eq("creator_id", viewerId).eq("status", "active").textSearch("search", q, { config: "simple" });
  return count ?? 0;
}

export async function listConversations(
  db: Db,
  viewerId: string,
  opts: { help?: boolean; before?: string | null; limit?: number; mine?: boolean; authorId?: string } = {},
): Promise<{ cards: Extract<CommunityCard, { kind: "conversation" }>[]; nextBefore: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 40);
  let q = db.from("open_conversations").select("*").is("removed_at", null).order("created_at", { ascending: false }).limit(limit + 1);
  if (opts.help) q = q.in("intent", HELP_INTENTS as string[]).is("closed_at", null);
  if (opts.mine) q = q.eq("creator_id", viewerId);
  if (opts.authorId) q = q.eq("creator_id", opts.authorId);
  if (opts.before && !Number.isNaN(Date.parse(opts.before))) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const hidden = await hiddenCreators(db, viewerId);
  const rows = (data ?? []).slice(0, limit);
  const visible = rows.filter((r) => !hidden.has(r.creator_id));
  const cards = await withReasons(db, viewerId, visible.map(toConversation));
  return { cards, nextBefore: (data ?? []).length > limit ? rows.at(-1)!.created_at : null };
}

async function withReasons(db: Db, viewerId: string, convs: OpenConversation[]) {
  const others = convs.filter((c) => c.creatorId !== viewerId);
  const [people, mine, joined, known] = await Promise.all([
    peopleById(
      db,
      convs.map((c) => c.creatorId),
    ),
    openToOf(db, [viewerId]).then((m) => new Set(m.get(viewerId) ?? [])),
    convs.length
      ? db
          .from("open_conversation_replies")
          .select("conversation_id")
          .eq("creator_id", viewerId)
          .in(
            "conversation_id",
            convs.map((c) => c.id),
          )
          .then(({ data }) => new Set((data ?? []).map((r) => r.conversation_id)))
      : Promise.resolve(new Set<string>()),
    knownCollaborators(
      db,
      viewerId,
      others.map((c) => c.creatorId),
    ),
  ]);
  return Promise.all(
    convs.map(async (c) => {
      const author = people.get(c.creatorId)!;
      let reason: string | null = null;
      let mayHelp: { count: number; query: string } | null = null;
      if (c.creatorId !== viewerId) {
        if (c.intent === "looking_for" || c.intent === "ask") {
          const n = await materialsThatMayHelp(db, viewerId, `${c.title} ${c.body ?? ""}`);
          // "See them" searches the most distinctive word they share.
          if (n) mayHelp = { count: n, query: (helpQuery(`${c.title} ${c.body ?? ""}`) ?? "").split(" | ")[0]!.replace(":*", "") };
        }
        const fit = INTENT_FITS[c.intent];
        if (joined.has(c.id)) reason = "You're in this conversation";
        else if (mayHelp) reason = `You have ${mayHelp.count} ${mayHelp.count === 1 ? "Material" : "Materials"} that may help`;
        else if (known.has(c.creatorId)) reason = `You worked with ${author.name.split(" ")[0]} before`;
        else if (fit && mine.has(fit)) reason = `You're open to ${OPEN_TO_LABEL[fit].toLowerCase()}`;
      }
      return { kind: "conversation" as const, conversation: c, author, reason, mayHelp };
    }),
  );
}

/** Public, finished Creations from others, newest first (not ranked by anything else). */
async function publicCreations(db: Db, viewerId: string, hidden: Set<string>, limit: number): Promise<CommunityCard[]> {
  const { data } = await db
    .from("artifacts")
    .select("id, title, artifact_type, creator_id, cover_material_id, updated_at")
    .eq("privacy", "public")
    .in("status", ["final", "published"])
    .neq("creator_id", viewerId)
    .order("updated_at", { ascending: false })
    .limit(limit * 2);
  const rows = (data ?? []).filter((a) => !hidden.has(a.creator_id)).slice(0, limit);
  const people = await peopleById(
    db,
    rows.map((a) => a.creator_id),
  );
  return rows.map((a) => ({ kind: "creation" as const, id: a.id, title: a.title, artifactType: a.artifact_type, author: people.get(a.creator_id)!, coverMaterialId: a.cover_material_id, updatedAt: a.updated_at }));
}

async function scrapbookCards(db: Db, viewerId: string, hidden: Set<string>, limit: number): Promise<CommunityCard[]> {
  const { posts } = await listPosts(db, viewerId, { scope: "everyone" }, { limit: limit * 2 }).catch(() => ({ posts: [] }));
  return posts
    .filter((p) => !p.mine && !hidden.has(p.author.id))
    .slice(0, limit)
    .map((p) => ({
      kind: "scrapbook" as const,
      id: p.id,
      body: p.body || p.attachments[0]?.title || "",
      author: { id: p.author.id, name: p.author.name, handle: p.author.handle ?? null },
      createdAt: p.createdAt,
      imageUrl: p.attachments.find((a) => a.fileUrl && a.mimeType?.startsWith("image/"))?.fileUrl ?? null,
    }));
}

async function peopleCards(db: Db, viewerId: string, hidden: Set<string>, limit: number): Promise<CommunityCard[]> {
  const found = await findCollaborators(db, { terms: [], networkOnly: false }).catch(() => []);
  // People you already know first (crews, Huddles, pieces, follows), then the rest — never by follower counts.
  const rows = found
    .filter((p) => p.id !== viewerId && !hidden.has(p.id))
    .sort((a, b) => Number(b.known) - Number(a.known))
    .slice(0, limit);
  const open = await openToOf(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((p) => {
    const s = p.signals;
    return {
      kind: "person" as const,
      person: { id: p.id, name: p.name, handle: p.handle },
      bio: p.bio,
      openTo: open.get(p.id) ?? [],
      reason: s.workedTogether ? "You worked together before" : s.sharedCrews ? "In a crew with you" : s.metInHuddles ? "You met in a Huddle" : s.iFollow ? "You follow them" : (open.get(p.id)?.length ?? 0) ? "Open to working with others" : null,
    };
  });
}

/** One of the four views (§3). Small by design: "Show more" pages Conversations and Help; For you is one screen. */
export async function communityFeed(db: Db, viewerId: string, filter: CommunityFilter, opts: { before?: string | null } = {}): Promise<{ cards: CommunityCard[]; nextBefore: string | null }> {
  const hidden = await hiddenCreators(db, viewerId);
  const huddles = async (n: number): Promise<CommunityCard[]> =>
    (await liveCards(db, { limit: n + 2 }).catch(() => []))
      .filter((h) => !h.participantIds.some((id) => hidden.has(id)))
      .slice(0, n)
      .map((h) => ({ kind: "huddle" as const, huddle: h }));
  if (filter === "people") return { cards: await peopleCards(db, viewerId, hidden, 20), nextBefore: null };
  if (filter === "help") return listConversations(db, viewerId, { help: true, before: opts.before });
  if (filter === "conversations") {
    const [live, convs] = await Promise.all([opts.before ? Promise.resolve([]) : huddles(2), listConversations(db, viewerId, { before: opts.before })]);
    return { cards: [...live, ...convs.cards], nextBefore: convs.nextBefore };
  }
  // For you: a fixed mix — conversations, a thought, a live Huddle, help, a Creation, people.
  const [convs, help, scrap, live, creations, people] = await Promise.all([
    listConversations(db, viewerId, { limit: 6 }),
    listConversations(db, viewerId, { help: true, limit: 4 }),
    scrapbookCards(db, viewerId, hidden, 3),
    huddles(1),
    publicCreations(db, viewerId, hidden, 2),
    peopleCards(db, viewerId, hidden, 2),
  ]);
  const seen = new Set<string>();
  const conv = convs.cards.filter((c) => !seen.has(c.conversation.id) && seen.add(c.conversation.id));
  const asks = help.cards.filter((c) => c.conversation.creatorId !== viewerId && !seen.has(c.conversation.id) && seen.add(c.conversation.id));
  const pattern: CommunityCard[][] = [conv.slice(0, 2), scrap.slice(0, 1), live, asks.slice(0, 2), creations.slice(0, 1), conv.slice(2, 4), scrap.slice(1, 2), asks.slice(2), creations.slice(1), people, conv.slice(4), scrap.slice(2)];
  return { cards: pattern.flat(), nextBefore: null };
}

/* --------------------------------------------------------------------------------------------- Home (§12) */

export interface HomeCommunitySignals {
  /** Replies to a question the viewer asked, since they last read it. */
  question: { id: string; title: string; newReplies: number; newParticipants: number; since: string | null } | null;
  /** Someone the viewer could help, with why. */
  help: Array<{ id: string; title: string; name: string; authorId: string; headlineIntent: OpenConversation["intent"]; reason: string | null }>;
  /** A conversation worth hearing, with why (never "popular"). */
  hearing: { id: string; title: string; replyCount: number; participantCount: number; reason: string } | null;
}

export async function homeCommunitySignals(db: Db, viewerId: string): Promise<HomeCommunitySignals> {
  const hidden = await hiddenCreators(db, viewerId);
  // Your question: your open conversations with others' replies since you last read them.
  const { data: own } = await db
    .from("open_conversations")
    .select("id, title, last_reply_at, created_at")
    .eq("creator_id", viewerId)
    .is("removed_at", null)
    .not("last_reply_at", "is", null)
    .order("last_reply_at", { ascending: false })
    .limit(5);
  let question: HomeCommunitySignals["question"] = null;
  if (own?.length) {
    const { data: reads } = await db
      .from("open_conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("creator_id", viewerId)
      .in(
        "conversation_id",
        own.map((o) => o.id),
      );
    const readAt = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));
    for (const o of own) {
      const since = readAt.get(o.id) ?? o.created_at;
      if (o.last_reply_at! <= since) continue;
      const { data: fresh } = await db.from("open_conversation_replies").select("creator_id").eq("conversation_id", o.id).neq("creator_id", viewerId).gt("created_at", since).is("deleted_at", null).is("removed_at", null);
      const n = (fresh ?? []).filter((r) => !hidden.has(r.creator_id));
      if (n.length) {
        question = { id: o.id, title: o.title, newReplies: n.length, newParticipants: new Set(n.map((r) => r.creator_id)).size, since: readAt.get(o.id) ?? null };
        break;
      }
    }
  }
  // You could help: others' open requests that fit you, which you haven't answered.
  const { cards } = await listConversations(db, viewerId, { help: true, limit: 12 });
  const fresh = cards.filter((c) => c.conversation.creatorId !== viewerId && c.reason && c.reason !== "You're in this conversation" && Date.parse(c.conversation.createdAt) > Date.now() - 14 * 86_400_000);
  const help = fresh.slice(0, 2).map((c) => ({ id: c.conversation.id, title: c.conversation.title, name: c.author.name, authorId: c.author.id, headlineIntent: c.conversation.intent, reason: c.reason }));
  // Worth hearing: a conversation you joined with new replies, else one from someone you've worked with.
  const recent = (await listConversations(db, viewerId, { limit: 20 })).cards.filter((c) => c.conversation.creatorId !== viewerId && !help.some((h) => h.id === c.conversation.id));
  const pick =
    recent.find((c) => c.reason === "You're in this conversation" && c.conversation.lastReplyAt && Date.parse(c.conversation.lastReplyAt) > Date.now() - 3 * 86_400_000) ??
    recent.find((c) => c.reason?.startsWith("You worked with"));
  const hearing = pick
    ? { id: pick.conversation.id, title: pick.conversation.title, replyCount: pick.conversation.replyCount, participantCount: pick.conversation.participantCount, reason: pick.reason === "You're in this conversation" ? "New replies in a conversation you joined" : pick.reason! }
    : null;
  return { question, help, hearing };
}

/* ----------------------------------------------------------------------------------- Home: from the community */

type CreationCard = Extract<CommunityCard, { kind: "creation" }>;
type ScrapbookCard = Extract<CommunityCard, { kind: "scrapbook" }>;
type ConversationCard = Extract<CommunityCard, { kind: "conversation" }>;
type PersonCard = Extract<CommunityCard, { kind: "person" }>;

/**
 * "From the community" on Home (owner, 1 Oct 2026: "home page seems quite empty… show meaningful info from the
 * community"). A small, fixed glance — never a feed: at most one live Huddle, a few new public Creations, one Scrapbook
 * thought, one open ask and one person. People the viewer follows or has worked with come first, then the newest; each
 * item says why it's here when there's a real reason. Nothing is ranked by replies, likes or popularity, and muted or
 * blocked creators never appear (the same rules as the Community page).
 */
export interface HomeCommunityGlance {
  live: LiveCard | null;
  /** `excerpt`: the opening words of text work (read with the viewer's own access), shown instead of a picture. */
  creations: Array<CreationCard & { reason: string | null; excerpt: string | null }>;
  thought: (ScrapbookCard & { reason: string | null }) | null;
  ask: ConversationCard | null;
  person: PersonCard | null;
}

export async function homeCommunityGlance(db: Db, viewerId: string, opts: { excludeConversations?: string[] } = {}): Promise<HomeCommunityGlance> {
  const hidden = await hiddenCreators(db, viewerId);
  const exclude = new Set(opts.excludeConversations ?? []);
  const [live, creations, thoughts, asks, people, follows] = await Promise.all([
    liveCards(db, { limit: 3 })
      .then((l) => l.find((h) => !h.participantIds.some((id) => hidden.has(id)) && !h.participantIds.includes(viewerId)) ?? null)
      .catch(() => null),
    publicCreations(db, viewerId, hidden, 10) as Promise<CreationCard[]>,
    scrapbookCards(db, viewerId, hidden, 8) as Promise<ScrapbookCard[]>,
    listConversations(db, viewerId, { help: true, limit: 8 }).catch(() => ({ cards: [] as ConversationCard[] })),
    peopleCards(db, viewerId, hidden, 3) as Promise<PersonCard[]>,
    db
      .from("creator_follows")
      .select("followed_creator_id")
      .eq("follower_creator_id", viewerId)
      .limit(500)
      .then(({ data }) => new Set((data ?? []).map((r) => r.followed_creator_id))),
  ]);
  const authors = [...new Set([...creations.map((c) => c.author.id), ...thoughts.map((t) => t.author.id)])];
  const known = await knownCollaborators(db, viewerId, authors).catch(() => new Set<string>());
  const first = (n: string) => n.split(" ")[0] || n;
  const why = (p: Person) => (known.has(p.id) ? `You've worked with ${first(p.name)}` : follows.has(p.id) ? `You follow ${first(p.name)}` : null);
  const close = (p: Person) => (known.has(p.id) || follows.has(p.id) ? 1 : 0);
  // Stable: people you know first, newest within each group (the inputs are already newest-first).
  const byCloseness = <T extends { author: Person }>(xs: T[]) => xs.map((x, i) => ({ x, i })).sort((a, b) => close(b.x.author) - close(a.x.author) || a.i - b.i).map(({ x }) => x);

  const picked = byCloseness(creations).slice(0, 4);
  const excerpts = new Map<string, string>();
  if (picked.length) {
    const { data: cur } = await db.from("artifacts").select("id, current_version_id").in("id", picked.map((c) => c.id));
    const vids = (cur ?? []).map((r) => r.current_version_id).filter((x): x is string => !!x);
    const { data: vs } = vids.length ? await db.from("artifact_versions").select("id, artifact_id, content").in("id", vids) : { data: [] };
    for (const v of vs ?? []) if (v.content?.trim()) excerpts.set(v.artifact_id, v.content.trim().slice(0, 200));
  }
  const thought = byCloseness(thoughts).find((t) => t.body.trim() || t.imageUrl) ?? null;
  const ask = asks.cards.find((c) => c.conversation.creatorId !== viewerId && !exclude.has(c.conversation.id) && !c.conversation.closedAt) ?? null;
  return {
    live,
    creations: picked.map((c) => ({ ...c, reason: why(c.author), excerpt: excerpts.get(c.id) ?? null })),
    thought: thought ? { ...thought, reason: why(thought.author) } : null,
    ask,
    person: people.find((p) => !follows.has(p.person.id)) ?? null,
  };
}
