import { DomainError, fromDbError } from "@wonder/core";
import { liveCards } from "@wonder/creator-huddle";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { createConversation, peopleById, type OpenConversation } from "./conversations";
import type { CommunityPrivacy, ConversationIntent } from "./shared";

/**
 * Communities (docs/communities.md, owner 2 Oct 2026): Orkut-style communities built from what exists. A Community is
 * a Creative Room its owner opens as a community — Public, Unlisted or Private (owner, 3 Oct 2026); its Members are the room's crew (owner and moderators = crew owner and
 * admins); its Topics are Open Conversations linked to the room; Posts are their replies; its Huddles are the Huddles
 * started from its topics. No counts of likes or followers and no ranking: order is by latest activity.
 */

export type CommunityAccess = "owner" | "admin" | "member";

export const communityPrivacySchema = z.enum(["public", "unlisted", "private"]);

export interface CommunityListItem {
  id: string;
  title: string;
  brief: string;
  owner: { id: string; name: string };
  coverMaterialId: string | null;
  /** The community's profile picture (a storage object), when its hosts set one. */
  avatarObjectId: string | null;
  privacy: CommunityPrivacy;
  memberCount: number;
  topicCount: number;
  lastActivityAt: string;
  isMember: boolean;
}

export interface CommunityMember {
  id: string;
  name: string;
  handle: string | null;
  avatarObjectId: string | null;
  access: CommunityAccess;
  roleTitle: string | null;
  joinedAt: string | null;
}

export interface CommunityTopic {
  id: string;
  title: string;
  intent: ConversationIntent;
  author: { id: string; name: string };
  postCount: number;
  lastActivityAt: string;
  closed: boolean;
}

export interface Community {
  id: string;
  title: string;
  brief: string;
  owner: { id: string; name: string };
  coverMaterialId: string | null;
  avatarObjectId: string | null;
  privacy: CommunityPrivacy;
  crewId: string | null;
  memberCount: number;
  isMember: boolean;
  isHost: boolean;
  isOwner: boolean;
  /** The hosts invited the viewer (a Private community's way in); joining accepts. */
  invited: boolean;
}

export interface MyCommunity {
  id: string;
  title: string;
  avatarObjectId: string | null;
  coverMaterialId: string | null;
  privacy: CommunityPrivacy;
  isHost: boolean;
  lastActivityAt: string;
}

/** Public communities the viewer can find, latest activity first; `query` matches title and brief. */
export async function listCommunities(db: Db, opts: { query?: string; limit?: number } = {}): Promise<CommunityListItem[]> {
  const { data, error } = await db.rpc("community_list", { p_query: opts.query?.trim() || undefined, p_limit: opts.limit ?? 30 });
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    brief: r.brief ?? "",
    owner: { id: r.owner_id, name: r.owner_name || "Creator" },
    coverMaterialId: r.cover_material_id,
    avatarObjectId: r.avatar_object_id,
    privacy: r.privacy as CommunityPrivacy,
    memberCount: r.member_count,
    topicCount: r.topic_count,
    lastActivityAt: r.last_activity_at,
    isMember: r.is_member,
  }));
}

/** One community as the viewer may see it; null when it isn't one, it's Private and they aren't in it, or a block. */
export async function getCommunity(db: Db, projectId: string): Promise<Community | null> {
  const { data, error } = await db.rpc("community_card", { p_project: projectId });
  if (error) throw fromDbError(error);
  const r = data?.[0];
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    brief: r.brief ?? "",
    owner: { id: r.owner_id, name: r.owner_name || "Creator" },
    coverMaterialId: r.cover_material_id,
    avatarObjectId: r.avatar_object_id,
    privacy: r.privacy as CommunityPrivacy,
    crewId: r.crew_id,
    memberCount: r.member_count,
    isMember: r.is_member,
    isHost: r.is_host,
    isOwner: r.is_owner,
    invited: r.invited,
  };
}

/** The communities the viewer belongs to (any privacy), latest activity first. */
export async function myCommunities(db: Db, limit = 12): Promise<MyCommunity[]> {
  const { data, error } = await db.rpc("community_mine", { p_limit: limit });
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    avatarObjectId: r.avatar_object_id,
    coverMaterialId: r.cover_material_id,
    privacy: r.privacy as CommunityPrivacy,
    isHost: r.is_host,
    lastActivityAt: r.last_activity_at,
  }));
}

export async function communityMembers(db: Db, projectId: string): Promise<CommunityMember[]> {
  const { data, error } = await db.rpc("community_members", { p_project: projectId });
  if (error) throw fromDbError(error);
  return (data ?? []).map((m) => ({
    id: m.creator_id,
    name: m.display_name || "Creator",
    handle: m.handle,
    avatarObjectId: m.avatar_object_id,
    access: m.access as CommunityAccess,
    roleTitle: m.role_title,
    joinedAt: m.joined_at,
  }));
}

/** The community's topics the viewer can see (each topic keeps its own visibility), latest activity first. */
export async function communityTopics(db: Db, projectId: string, limit = 50): Promise<CommunityTopic[]> {
  const { data: links, error } = await db.from("open_conversation_links").select("conversation_id").eq("project_id", projectId).eq("kind", "project").limit(500);
  if (error) throw fromDbError(error);
  const ids = [...new Set((links ?? []).map((l) => l.conversation_id))];
  if (!ids.length) return [];
  const { data: convs } = await db
    .from("open_conversations")
    .select("id, title, intent, creator_id, reply_count, last_reply_at, created_at, closed_at, removed_at")
    .in("id", ids)
    .is("removed_at", null);
  const people = await peopleById(db, (convs ?? []).map((c) => c.creator_id));
  return (convs ?? [])
    .map((c) => ({
      id: c.id,
      title: c.title,
      intent: c.intent as ConversationIntent,
      author: { id: c.creator_id, name: people.get(c.creator_id)?.name ?? "A creator" },
      postCount: c.reply_count,
      lastActivityAt: c.last_reply_at ?? c.created_at,
      closed: !!c.closed_at,
    }))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    .slice(0, limit);
}

/** Live Huddles started from the community's topics (Huddles are private by design; only live ones are listed). */
export async function communityHuddles(db: Db, projectId: string): Promise<Array<{ id: string; topic: string | null; people: number; names: string[]; fromTopic: { id: string; title: string } | null }>> {
  const { data: topicLinks } = await db.from("open_conversation_links").select("conversation_id").eq("project_id", projectId).eq("kind", "project").limit(500);
  const convIds = [...new Set((topicLinks ?? []).map((l) => l.conversation_id))];
  if (!convIds.length) return [];
  const { data: huddleLinks } = await db.from("open_conversation_links").select("conversation_id, huddle_id").in("conversation_id", convIds).eq("kind", "huddle");
  const byHuddle = new Map((huddleLinks ?? []).filter((l) => l.huddle_id).map((l) => [l.huddle_id!, l.conversation_id]));
  if (!byHuddle.size) return [];
  const cards = await liveCards(db, { limit: 50 }).catch(() => []);
  const live = cards.filter((h) => byHuddle.has(h.huddleId));
  if (!live.length) return [];
  const { data: convs } = await db.from("open_conversations").select("id, title").in("id", [...new Set(live.map((h) => byHuddle.get(h.huddleId)!))]);
  return live.map((h) => {
    const c = (convs ?? []).find((x) => x.id === byHuddle.get(h.huddleId));
    return { id: h.huddleId, topic: h.topic, people: h.participantCount, names: h.participantNames, fromTopic: c ? { id: c.id, title: c.title } : null };
  });
}

/** Join: open for Public and Unlisted; a Private community only takes people its hosts invited. Returns the crew id. */
export async function joinCommunity(db: Db, projectId: string): Promise<string> {
  const { data, error } = await db.rpc("community_join", { p_project: projectId });
  if (error) {
    if (error.code === "42501") throw new DomainError("forbidden", "The hosts of this community removed you, so you can't join again.");
    throw fromDbError(error, "We couldn't join you to that community.");
  }
  return data as string;
}

export async function leaveCommunity(db: Db, projectId: string): Promise<void> {
  const c = await getCommunity(db, projectId);
  if (!c?.crewId || !c.isMember) throw new DomainError("not_found", "You're not a member of that community.");
  const { error } = await db.rpc("crew_leave", { p_crew: c.crewId });
  if (error) throw error.code === "42501" ? new DomainError("forbidden", "The owner can't leave their own community. Make it private instead.") : fromDbError(error);
}

/** The owner opens their room as a community, or changes its privacy. A community stays one (it can go Private). */
export async function setCommunityPrivacy(db: Db, projectId: string, privacy: CommunityPrivacy): Promise<void> {
  const { error } = await db.rpc("community_set_privacy", { p_project: projectId, p_privacy: communityPrivacySchema.parse(privacy) });
  if (error) {
    if (error.code === "42501") throw new DomainError("forbidden", "Only the owner can change who can find this community.");
    if (error.code === "P0002") throw new DomainError("not_found", "We couldn't find that room.");
    if (error.code === "22023") throw new DomainError("validation", error.message);
    throw fromDbError(error);
  }
}

/** Whether the viewer may add to a conversation (a topic in a community needs membership). */
export async function canAddToConversation(db: Db, conversationId: string): Promise<boolean> {
  const { data, error } = await db.rpc("open_conversation_can_add", { p_conversation: conversationId });
  if (error) throw fromDbError(error);
  return !!data;
}

/** Of these conversations, the ones that belong to an Unlisted or Private community the viewer isn't in: never listed. */
export async function unlistedForViewer(db: Db, conversationIds: string[]): Promise<Set<string>> {
  if (!conversationIds.length) return new Set();
  const { data, error } = await db.rpc("open_conversations_unlisted_for_me", { p_ids: conversationIds.slice(0, 200) });
  if (error) throw fromDbError(error);
  return new Set((data ?? []) as string[]);
}

export const topicSchema = z.object({
  title: z.string().trim().min(3, "Give the topic a short title.").max(140, "Keep the title under 140 characters."),
  body: z.string().trim().max(5000).optional(),
  intent: z.enum(["discuss", "ask", "critique", "share_knowledge", "looking_for", "explore_together"]).default("discuss"),
});

/** Start a topic in a community: an Open Conversation linked to the room, open to its community. Members only. */
export async function startTopic(db: Db, creatorId: string, projectId: string, raw: unknown): Promise<OpenConversation> {
  const input = topicSchema.parse(raw);
  const c = await getCommunity(db, projectId);
  if (!c) throw new DomainError("not_found", "We couldn't find that community.");
  if (!c.isMember) throw new DomainError("forbidden", "Join the community to start a topic.");
  // The topic's audience is the community's: who can see it follows the community's privacy (enforced in the database).
  const conv = await createConversation(db, creatorId, { ...input, visibility: "public" });
  const { error } = await db.rpc("open_conversation_link", { p_conversation: conv.id, p_kind: "project", p_target: projectId });
  if (error) {
    // Don't leave a stray topic behind if the link was refused.
    await db.from("open_conversations").delete().eq("id", conv.id);
    throw fromDbError(error);
  }
  return conv;
}

/** Hosts take a topic out of the community; the topic stays with its author. */
export async function removeTopic(db: Db, projectId: string, conversationId: string, reason?: string): Promise<void> {
  const { error } = await db.rpc("community_remove_topic", { p_project: projectId, p_conversation: conversationId, p_reason: reason });
  if (error) throw fromDbError(error);
}

/** Communities a topic belongs to that the viewer can see (for the topic page's "In …" line). */
export async function topicCommunities(db: Db, conversationId: string): Promise<Array<{ id: string; title: string; isHost: boolean; isMember: boolean; privacy: CommunityPrivacy; avatarObjectId: string | null }>> {
  const { data } = await db.from("open_conversation_links").select("project_id").eq("conversation_id", conversationId).eq("kind", "project");
  const out: Array<{ id: string; title: string; isHost: boolean; isMember: boolean; privacy: CommunityPrivacy; avatarObjectId: string | null }> = [];
  for (const l of data ?? []) {
    if (!l.project_id) continue;
    const c = await getCommunity(db, l.project_id).catch(() => null);
    if (c) out.push({ id: c.id, title: c.title, isHost: c.isHost, isMember: c.isMember, privacy: c.privacy, avatarObjectId: c.avatarObjectId });
  }
  return out;
}

/** Hosts set (or clear, with null) the community's profile picture: an image they uploaded. */
export async function setCommunityAvatar(db: Db, projectId: string, objectId: string | null): Promise<void> {
  const { error } = await db.rpc("community_set_avatar", { p_project: projectId, p_object: objectId as string });
  if (error) {
    if (error.code === "42501") throw new DomainError("forbidden", "Only the owner and moderators can change the community's picture.");
    if (error.code === "P0002") throw new DomainError("not_found", "We couldn't find that community.");
    throw fromDbError(error);
  }
}
