import "server-only";
import { log } from "@wonder/core";
import { helpHeadline, homeCommunityGlance, homeCommunitySignals, knownCollaborators, myCommunities, type CommunityPrivacy, type HomeCommunityGlance } from "@wonder/creator-community";
import { liveCards } from "@wonder/creator-huddle";
import { listPosts, signedUrlsFor } from "@wonder/creator-library";
import { currentConnection, filterOf, momentHref } from "@wonder/creator-moments";
import { artifactType } from "@wonder/creator-studio/types";
import type { Db } from "@wonder/db";
import { listProjects, listSharedItems, myActiveParts } from "@wonder/creator-projects";
import { avatarUrls } from "../avatars";
import { communityAvatars } from "../communities";
import { coverUrls } from "../covers";
import { flags } from "../features";
import { agoPhrase, pickSpark, splitHomeItems, SPARK_MIN_AGE_DAYS, type HomeItem } from "../home-sections";
import { listNotificationsForHome } from "../notifications";
import { homeContextLine, homeMode, pickContinue, selectSlots, summarizeAway, type AwayItem, type HomeCandidateKind, type HomeMode, type HomeSlot, type HomeSummary } from "./ranking";

/**
 * Home's payload (docs/phases/02-home-quick-capture.md §14): structured slots, never raw feed rows, with every
 * priority rule applied here so the client only renders. Each slot is loaded on its own and simply left out if it
 * fails — Home never waits on CreativeMind and never shows an empty module. If the whole thing fails, Home falls back
 * to Continue, Quick Capture and recent Creations (§17).
 */

const DAY = 86_400_000;

export interface HomeContinueItem {
  id: string;
  title: string;
  typeLabel: string;
  playable: boolean;
  version: number | null;
  coverUrl: string | null;
  updatedAt: string;
  /** Why it's worth continuing, in plain words. Never a number or a score. */
  hint: { kind: "unsaved" | "generating" | "comments" | "edited"; text: string | null };
  sources: { total: number; unused: number } | null;
}

/** One thin Continue row on Home: a Creation in progress, most recently edited first. */
export interface HomeInProgressItem {
  id: string;
  title: string;
  typeLabel: string;
  updatedAt: string;
  coverUrl: string | null;
  /** "Unsaved changes", "Visuals are being created", "2 new comments", or null. Never a score. */
  hint: string | null;
  /** Where the row goes when it isn't the Creation's own page (a part not started yet opens its Room). */
  href?: string;
}

export interface HomeStart {
  text: string;
  href: string;
}

export interface HomeConnectionCard {
  text: string;
  href: string;
  /** A CreativeMind suggestion the creator can accept or ignore (never attached on its own). */
  suggestion?: { momentId: string; suggestionId: string; name: string } | null;
  /** A found connection (Phase 05 §5): can be dismissed, and says why it's here. */
  connectionId?: string;
  why?: string[];
}

export interface HomeDejaVuCard {
  id: string;
  name: string;
  newCount: number;
  olderCount: number;
}

export interface HomeMomentCard {
  materialId: string;
  text: string;
  imageUrl: string | null;
}

export type HomeCommunityCard =
  | { kind: "conversation"; conversationId: string; title: string; replyCount: number; participantCount: number; reason: string }
  | { kind: "huddle"; huddleId: string; topic: string; participantName: string; participantId: string | null; participantCount: number; startedAt: string }
  | { kind: "post"; postId: string; body: string; authorName: string; authorId: string; createdAt: string; imageUrl: string | null };

export interface HomeHelpCard {
  items: Array<HomeItem & { reason?: string | null }>;
}

/** Replies to a question the creator asked in Community (Phase 03 §12). */
export interface HomeQuestionCard {
  conversationId: string;
  title: string;
  newReplies: number;
  newParticipants: number;
}

export interface HomePayload {
  mode: HomeMode | "fallback";
  contextLine: string;
  lastVisit: string | null;
  continue?: HomeContinueItem;
  /** Continue rows (owner, 3 Oct 2026): the last three edited Creations in progress, then "All my creations". */
  inProgress?: HomeInProgressItem[];
  start?: HomeStart;
  /** A brand-new creator with nothing yet: Home shows its calm beginning. */
  beginning?: { hasMaterials: boolean };
  quickCapture: { textEnabled: boolean; voiceEnabled: boolean };
  whileAway?: HomeSummary;
  worldConnecting?: HomeConnectionCard;
  dejavu?: HomeDejaVuCard;
  spark?: HomeMomentCard;
  worthHearing?: HomeCommunityCard;
  couldHelp?: HomeHelpCard;
  yourQuestion?: HomeQuestionCard;
  /** From the community: a small fixed glance (never a feed), with signed covers for its Creations. */
  community?: HomeCommunityGlance & { covers: Record<string, string> };
  /** Communities on Home (owner, 3 Oct 2026): the ones the creator belongs to, latest activity first, with pictures. */
  communities?: { mine: Array<{ id: string; title: string; picture: string | null; privacy: CommunityPrivacy; isHost: boolean }> };
  /** New in the creator's Creative Rooms: work their room-mates shared lately (newest first, at most three). */
  rooms?: Array<{ projectId: string; projectTitle: string; itemId: string; title: string; kind: string; by: { id: string; name: string }; at: string }>;
  /** Fallback only: a few recent Creations to get back to. */
  recent?: Array<{ id: string; title: string; typeLabel: string }>;
  avatars: Record<string, string>;
  generatedAt: string;
}

const safe = async <T>(what: string, p: Promise<T> | (() => Promise<T>)): Promise<T | null> => {
  try {
    return await (typeof p === "function" ? p() : p);
  } catch (e) {
    log("warn", "home.slot_failed", { slot: what, message: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
    return null;
  }
};

const UPDATE_CANDIDATE: Record<string, HomeCandidateKind> = {
  shared_with_you: "collaborator_response",
  proposal_decided: "active_work_change",
  collaborator_added: "collaborator_response",
  license_response: "collaborator_response",
  message: "collaborator_response",
};
const DECISION_KINDS = new Set(["proposal", "proposal_review", "license_request", "rights_claim"]);

export async function buildHomePayload(db: Db, creatorId: string, now = Date.now()): Promise<HomePayload> {
  // Rollout (Phase 05 §19): without orchestration, Home is its calm fallback — Continue, Quick Capture, recent work.
  if (!flags().home_orchestration_enabled) return fallback(db, creatorId, now);
  try {
    return await build(db, creatorId, now);
  } catch (e) {
    log("warn", "home.aggregation_failed", { message: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
    return fallback(db, creatorId, now);
  }
}

async function build(db: Db, creatorId: string, now: number): Promise<HomePayload> {
  const visit = await db.rpc("mark_home_visit");
  const lastVisit = (visit.data as string | null) ?? null;
  const since = lastVisit ?? new Date(now - 3 * DAY).toISOString();

  // Everything that doesn't depend on the creator's own works starts now, in parallel with them (each is its own
  // round trip to the database; started one after another they were most of Home's wait).
  const f = flags();
  const connectedP = Promise.all([
    f.semantic_connections_enabled ? safe("semantic-connection", () => foundConnection(db, now)) : null,
    f.dejavu_enabled ? safe("connections", () => connections(db, lastVisit, now)) : null,
    safe("spark", () => sparkCard(db, creatorId, now)),
  ]);
  const communityP = f.community_enabled && f.community_home_cards_enabled ? safe("community", () => homeCommunitySignals(db, creatorId)) : null;
  const myPartsP = safe("parts", myActiveParts(db, creatorId, 4));
  const roomsP = safe("rooms", async () => {
    const projects = (await listProjects(db, { status: "open", viewerId: creatorId })).slice(0, 6);
    const recent = now - 14 * 86_400_000;
    const lists = await Promise.all(
      projects.map(async (p) =>
        (await listSharedItems(db, p.id).catch(() => []))
          .filter((i) => !i.mine && Date.parse(i.sharedAt) > recent)
          .map((i) => ({ projectId: p.id, projectTitle: p.title, itemId: i.itemId, title: i.title, kind: i.kind, by: i.sharedBy, at: i.sharedAt })),
      ),
    );
    return lists
      .flat()
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 3);
  });
  const communitiesP = f.communities_enabled
    ? safe("communities", async () => {
        const mine = await myCommunities(db, 12);
        const pictures = await communityAvatars(mine.map((c) => c.avatarObjectId));
        return { mine: mine.map((c) => ({ id: c.id, title: c.title, privacy: c.privacy, isHost: c.isHost, picture: c.avatarObjectId ? (pictures[c.avatarObjectId] ?? null) : null })) };
      })
    : null;

  const { data: works, error } = await db
    .from("artifacts")
    .select("id, title, artifact_type, status, updated_at, cover_material_id, current_version_id")
    .eq("creator_id", creatorId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const workIds = (works ?? []).map((w) => w.id);

  const [sessions, generating, comments, notifications, visuals, failedPubs, live, feed, materialCount] = await Promise.all([
    safe("sessions", async () => (workIds.length ? (await db.from("studio_sessions").select("id, artifact_id, draft, draft_saved_at").in("artifact_id", workIds)).data ?? [] : [])),
    safe("generating", async () => (workIds.length ? (await db.from("image_generations").select("artifact_id").in("artifact_id", workIds).in("status", ["queued", "processing"])).data ?? [] : [])),
    safe("comments", async () =>
      workIds.length
        ? ((
            await db
              .from("artifact_comments")
              .select("id, artifact_id, created_at, creator_id, creators!artifact_comments_creator_id_fkey(display_name)")
              .in("artifact_id", workIds)
              .neq("creator_id", creatorId)
              .gt("created_at", since)
              .order("created_at", { ascending: false })
              .limit(20)
          ).data ?? [])
        : [],
    ),
    safe("notifications", listNotificationsForHome(db, creatorId)),
    safe("visuals", async () =>
      (
        await db
          .from("image_generations")
          .select("id, artifact_id, completed_at, artifacts(title)")
          .eq("creator_id", creatorId)
          .in("status", ["complete", "partial"])
          .not("artifact_id", "is", null)
          .gt("completed_at", since)
          .order("completed_at", { ascending: false })
          .limit(5)
      ).data ?? [],
    ),
    safe("publications", async () => (await db.from("publications").select("id, artifact_id, title, destination_name, updated_at").eq("creator_id", creatorId).eq("status", "failed").gt("updated_at", since).limit(5)).data ?? []),
    safe("live", liveCards(db, { limit: 1 })),
    safe("feed", listPosts(db, creatorId, { scope: "following", creatorId }, { limit: 8 })),
    safe("materials", async () => (await db.from("creative_materials").select("id", { count: "exact", head: true }).eq("creator_id", creatorId)).count ?? 0),
  ]);
  const community = communityP ? await communityP : null;

  /* ------------------------------------------------------------------ Continue */
  const titleOf = new Map((works ?? []).map((w) => [w.id, w.title]));
  const commentsByWork = new Map<string, number>();
  for (const c of comments ?? []) commentsByWork.set(c.artifact_id, (commentsByWork.get(c.artifact_id) ?? 0) + 1);
  const sessionOf = new Map((sessions ?? []).map((s) => [s.artifact_id, s]));
  const busy = new Set((generating ?? []).map((g) => g.artifact_id));
  const pick = pickContinue(
    (works ?? []).map((w) => {
      const s = sessionOf.get(w.id);
      return {
        ...w,
        updatedAt: w.updated_at,
        unsavedDraft: !!(s?.draft && s.draft_saved_at && s.draft_saved_at > w.updated_at),
        generating: busy.has(w.id),
        newComments: commentsByWork.get(w.id) ?? 0,
      };
    }),
    now,
  );
  let cont: HomeContinueItem | undefined;
  if (pick) {
    const type = artifactType(pick.artifact_type);
    const session = sessionOf.get(pick.id);
    const [covers, version, sources] = await Promise.all([
      safe("cover", coverUrls(db, [pick])),
      pick.current_version_id ? safe("version", async () => (await db.from("artifact_versions").select("version_number").eq("id", pick.current_version_id!).maybeSingle()).data?.version_number ?? null) : null,
      session ? safe("sources", async () => (await db.from("studio_sources").select("state").eq("session_id", session.id)).data ?? []) : null,
    ]);
    const n = pick.newComments;
    cont = {
      id: pick.id,
      title: pick.title,
      typeLabel: type.label,
      playable: type.category === "audio" || type.category === "video",
      version: version ?? null,
      coverUrl: covers?.[pick.id] ?? null,
      updatedAt: pick.updated_at,
      hint: pick.unsavedDraft
        ? { kind: "unsaved", text: "Your draft has unsaved changes" }
        : pick.generating
          ? { kind: "generating", text: "Visuals are being created" }
          : n
            ? { kind: "comments", text: `${n} new ${n === 1 ? "comment" : "comments"}` }
            : { kind: "edited", text: null },
      sources: sources?.length ? { total: sources.length, unused: sources.filter((s) => s.state === "available").length } : null,
    };
  }

  // Continue rows (owner, 3 Oct 2026): the last three edited Creations still in progress (draft or in review).
  const inProgressRows = (works ?? []).filter((w) => w.status === "draft" || w.status === "in_review").slice(0, 3);
  const rowCovers = inProgressRows.length ? ((await safe("row_covers", coverUrls(db, inProgressRows))) ?? {}) : {};
  const inProgress: HomeInProgressItem[] = inProgressRows.map((w) => {
    const s = sessionOf.get(w.id);
    const n = commentsByWork.get(w.id) ?? 0;
    return {
      id: w.id,
      title: w.title,
      typeLabel: artifactType(w.artifact_type).label,
      updatedAt: w.updated_at,
      coverUrl: rowCovers[w.id] ?? null,
      hint: s?.draft && s.draft_saved_at && s.draft_saved_at > w.updated_at ? "Unsaved changes" : busy.has(w.id) ? "Visuals are being created" : n ? `${n} new ${n === 1 ? "comment" : "comments"}` : null,
    };
  });

  // Parts the creator is on in a Creative Room (owner, 6 Oct 2026: an accepted tune request should show on Home): a part's
  // Creation joins Continue even when a room-mate started it; a part nobody has started opens its Room.
  const myParts = (await myPartsP) ?? [];
  const partRows = myParts.flatMap((p): Array<HomeInProgressItem & { sort: string }> =>
    p.artifact
      ? inProgressRows.some((w) => w.id === p.artifact!.id)
        ? []
        : [{ id: p.artifact.id, title: p.artifact.title, typeLabel: artifactType(p.artifact.type).label, updatedAt: p.artifact.updatedAt, coverUrl: null, hint: `Your part in ${p.projectTitle}`, sort: p.artifact.updatedAt > p.joinedAt ? p.artifact.updatedAt : p.joinedAt }]
      : [{ id: `part:${p.partId}`, title: `${p.partTitle} · ${p.projectTitle}`, typeLabel: "Your part", updatedAt: p.joinedAt, coverUrl: null, hint: "Not started yet", href: `/rooms/${p.projectId}`, sort: p.joinedAt }],
  );
  if (partRows.length) {
    const merged = [...inProgress.map((w) => ({ ...w, sort: w.updatedAt })), ...partRows].sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 3);
    inProgress.splice(0, inProgress.length, ...merged.map(({ sort: _sort, ...row }) => row));
  }

  /* ------------------------------------------------------------------ While you were away */
  const { away, asks } = splitHomeItems(notifications ?? [], lastVisit, now);
  const awayItems: AwayItem[] = [
    ...away.map((i) => ({ id: i.id, kind: i.kind, candidate: UPDATE_CANDIDATE[i.kind] ?? ("general_activity" as const), title: i.title, href: i.href, at: i.at })),
    ...(comments ?? []).map((c) => ({
      id: `comment:${c.id}`,
      kind: "comment",
      candidate: (c.artifact_id === pick?.id ? "active_work_change" : "collaborator_response") as HomeCandidateKind,
      title: `${(c.creators as { display_name: string } | null)?.display_name ?? "Someone"} commented on “${titleOf.get(c.artifact_id) ?? "your Creation"}”`,
      href: `/creations/${c.artifact_id}?tab=about#comments`,
      at: c.created_at,
    })),
    ...(visuals ?? []).map((g) => ({
      id: `visuals:${g.id}`,
      kind: "visuals_ready",
      candidate: "completed_output" as const,
      title: `Visuals for “${(g.artifacts as { title: string } | null)?.title ?? "your Creation"}” are ready`,
      href: `/creations/${g.artifact_id}`,
      at: g.completed_at!,
    })),
    ...(failedPubs ?? []).map((p) => ({ id: `publish:${p.id}`, kind: "publish_failed", candidate: "requires_decision" as const, title: `Publishing “${p.title}” to ${p.destination_name} failed`, href: "/publishing", at: p.updated_at })),
  ];
  const whileAway = summarizeAway(awayItems) ?? undefined;
  const singleReady = awayItems.length === 1 && awayItems[0]!.kind === "visuals_ready" ? "Your visuals are ready" : null;

  /* ------------------------------------------------------------------ Connections, DejaVu, spark */
  const [found, links, spark] = await connectedP;
  // CreativeMind's found connection leads "Your world is connecting"; the deterministic one stands in when there's none.
  if (found && links) links.connection = found;

  /* ------------------------------------------------------------------ Community (Phase 03 plugs in here) */
  const huddle = live?.[0] ?? null;
  const post = feed?.posts.find((p) => !p.mine) ?? null;
  // A conversation with a reason to hear it comes first; then a live Huddle; then a thought from someone followed.
  const worthHearing: HomeCommunityCard | undefined = community?.hearing
    ? { kind: "conversation", conversationId: community.hearing.id, title: community.hearing.title, replyCount: community.hearing.replyCount, participantCount: community.hearing.participantCount, reason: community.hearing.reason }
    : huddle
    ? {
        kind: "huddle",
        huddleId: huddle.huddleId,
        topic: huddle.topic ?? `${huddle.participantNames[0] ?? "A creator"}'s Huddle`,
        participantName: huddle.participantNames[0] ?? "Creator",
        participantId: huddle.participantIds[0] ?? null,
        participantCount: huddle.participantCount,
        startedAt: huddle.startedAt,
      }
    : post
      ? {
          kind: "post",
          postId: post.id,
          body: post.body || post.attachments[0]?.title || "A new fragment",
          authorName: post.author.name,
          authorId: post.author.id,
          createdAt: post.createdAt,
          imageUrl: post.attachments.find((a) => a.fileUrl && a.mimeType?.startsWith("image/"))?.fileUrl ?? null,
        }
      : undefined;
  const helpItems: HomeHelpCard["items"] = [
    ...asks,
    ...(community?.help ?? []).map((h) => ({
      id: `community:${h.id}`,
      kind: "community_help",
      title: `${helpHeadline(h.headlineIntent, h.name)}: ${h.title}`,
      href: `/pulse/conversations/${h.id}`,
      at: new Date(now).toISOString(),
      actor: { id: h.authorId, name: h.name },
      reason: h.reason,
    })),
  ];
  const couldHelp = helpItems.length ? { items: helpItems.slice(0, 4) } : undefined;
  const yourQuestion: HomeQuestionCard | undefined = community?.question
    ? { conversationId: community.question.id, title: community.question.title, newReplies: community.question.newReplies, newParticipants: community.question.newParticipants }
    : undefined;

  /* ------------------------------------------------------------------ Mode, slots, line */
  const available: Partial<Record<HomeSlot, HomeCandidateKind>> = {};
  if (whileAway) available.whileAway = whileAway.candidate;
  const worldConnection = links?.connection ?? found ?? null;
  if (worldConnection) available.worldConnecting = "moment_connection";
  if (links?.dejavu) available.dejavu = "creative_memory";
  if (spark) available.spark = "creative_memory";
  // A live Huddle is *relevant* when someone you follow or have worked with is in it; a stranger's is just activity.
  const huddleRelevant =
    worthHearing?.kind === "huddle" && huddle
      ? ((await safe("huddle-relevance", async () => {
          const ids = huddle.participantIds;
          const [{ data: follows }, known] = await Promise.all([
            db.from("creator_follows").select("followed_creator_id").eq("follower_creator_id", creatorId).in("followed_creator_id", ids),
            knownCollaborators(db, creatorId, ids),
          ]);
          return (follows?.length ?? 0) > 0 || known.size > 0;
        })) ?? false)
      : false;
  if (worthHearing)
    available.worthHearing = worthHearing.kind === "huddle" ? (huddleRelevant ? "relevant_huddle" : "general_activity") : worthHearing.kind === "conversation" ? "relevant_conversation" : "general_activity";
  if (couldHelp) available.couldHelp = asks.some((a) => DECISION_KINDS.has(a.kind)) ? "requires_decision" : "help_opportunity";
  if (yourQuestion) available.yourQuestion = "collaborator_response";
  const mode = homeMode({ lastVisit, now, available });
  const slots = new Set(selectSlots(mode, available));

  const start = !cont ? ((await safe("start", () => somethingToStart(db, now))) ?? undefined) : undefined;

  /* ------------------------------------------------------------------ From the community */
  const shownHearing = slots.has("worthHearing") ? worthHearing : undefined;
  const rawGlance =
    f.community_enabled && f.community_home_cards_enabled
      ? await safe("community_glance", () =>
          homeCommunityGlance(db, creatorId, {
            excludeConversations: [...(slots.has("couldHelp") ? (community?.help ?? []).map((h) => h.id) : []), ...(shownHearing?.kind === "conversation" ? [shownHearing.conversationId] : [])],
          }),
        )
      : null;
  // Never repeat what a row above already shows.
  const glance = rawGlance
    ? {
        ...rawGlance,
        live: shownHearing?.kind === "huddle" && rawGlance.live?.huddleId === shownHearing.huddleId ? null : rawGlance.live,
        thought: shownHearing?.kind === "post" && rawGlance.thought?.id === shownHearing.postId ? null : rawGlance.thought,
      }
    : null;
  const hasGlance = !!glance && !!(glance.live || glance.creations.length || glance.thought || glance.ask || glance.person || glance.catchUp || glance.week);
  const rooms = (await roomsP) ?? [];
  const communities = communitiesP ? await communitiesP : null;
  const glanceCovers = hasGlance && glance!.creations.length ? ((await safe("glance_covers", coverUrls(db, glance!.creations.map((c) => ({ id: c.id, cover_material_id: c.coverMaterialId }))))) ?? {}) : {};

  const avatars =
    (await safe(
      "avatars",
      avatarUrls(
        db,
        [
          ...(couldHelp?.items ?? []).map((i) => i.actor?.id ?? ""),
          worthHearing?.kind === "post" ? worthHearing.authorId : "",
          worthHearing?.kind === "huddle" ? (worthHearing.participantId ?? "") : "",
          ...rooms.map((r) => r.by.id),
          ...(hasGlance ? [...glance!.creations.map((c) => c.author.id), glance!.thought?.author.id ?? "", glance!.ask?.author.id ?? "", glance!.person?.person.id ?? ""] : []),
        ].filter(Boolean),
      ),
    )) ?? {};

  return {
    mode,
    contextLine: homeContextLine({
      mode,
      whileAway: slots.has("whileAway") ? whileAway : null,
      singleReady,
      waiting: slots.has("couldHelp") ? (couldHelp?.items.length ?? 0) : 0,
      questionReplies: slots.has("yourQuestion") ? (yourQuestion?.newReplies ?? 0) : 0,
      connection: slots.has("worldConnecting"),
      dejavuName: slots.has("dejavu") ? (links?.dejavu?.name ?? null) : null,
    }),
    lastVisit,
    continue: cont,
    inProgress: inProgress.length ? inProgress : undefined,
    start,
    beginning: !cont && !start ? { hasMaterials: (materialCount ?? 0) > 0 } : undefined,
    quickCapture: { textEnabled: true, voiceEnabled: flags().quick_capture_voice_enabled },
    whileAway: slots.has("whileAway") ? whileAway : undefined,
    worldConnecting: slots.has("worldConnecting") ? worldConnection! : undefined,
    dejavu: slots.has("dejavu") ? links!.dejavu! : undefined,
    spark: slots.has("spark") ? spark! : undefined,
    worthHearing: slots.has("worthHearing") ? worthHearing : undefined,
    couldHelp: slots.has("couldHelp") ? couldHelp : undefined,
    yourQuestion: slots.has("yourQuestion") ? yourQuestion : undefined,
    community: hasGlance ? { ...glance!, covers: glanceCovers } : undefined,
    rooms: rooms.length ? rooms : undefined,
    communities: communities ?? undefined,
    avatars,
    generatedAt: new Date(now).toISOString(),
  };
}

/* -------------------------------------------------------------------------------------------------- Connections */

const KIND_WORD: Record<string, string> = {
  image: "photograph",
  sketch: "sketch",
  voice: "voice note",
  audio: "recording",
  video: "video",
  note: "note",
  text: "note",
  idea: "idea",
};
const kindWord = (m: { entity_type: string; subtype: string | null }) => (m.entity_type === "creation" ? "Creation" : (KIND_WORD[m.subtype ?? ""] ?? "Material"));
const monthOf = (iso: string, now: number) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "long", ...(d.getUTCFullYear() !== new Date(now).getUTCFullYear() ? { year: "numeric" } : {}), timeZone: "UTC" });
};

/**
 * The connection CreativeMind found (Phase 05 §5), as a Home card: its plain explanation, why it's here, and where it
 * leads — the unfinished Creation for a creative opportunity, else the newest of its Moments.
 */
async function foundConnection(db: Db, now: number): Promise<HomeConnectionCard | null> {
  const c = await currentConnection(db, now);
  if (!c) return null;
  const { data: ms } = await db.from("moment_references").select("id, entity_type, entity_id, occurred_at").in("id", c.momentIds);
  const list = (ms ?? []).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const target = c.connectionType === "creative_opportunity" ? (list.find((m) => m.entity_type === "creation") ?? list[0]) : list[0];
  const href = target ? momentHref({ entityType: target.entity_type as never, entityId: target.entity_id }) : null;
  if (!href) return null;
  return { text: c.shortExplanation, href: c.connectionType === "creative_opportunity" && target?.entity_type === "creation" ? `${href}/studio` : href, connectionId: c.id, why: c.evidence };
}

/**
 * "Your world is connecting" and "A DejaVu surfaced" (§10–11), deterministic in this phase: Moments that recently
 * joined a DejaVu alongside much older ones, and CreativeMind's pending suggestions for something just captured.
 * Nothing here changes a DejaVu.
 */
async function connections(db: Db, lastVisit: string | null, now: number): Promise<{ connection: HomeConnectionCard | null; dejavu: HomeDejaVuCard | null }> {
  const recentSince = new Date(Math.min(lastVisit ? Date.parse(lastVisit) : now, now - 14 * DAY)).toISOString();
  const { data: fresh } = await db
    .from("dejavu_moments")
    .select("dejavu_id, moment_id, created_at, dejavus!inner(name, archived_at)")
    .gt("created_at", recentSince)
    .is("dejavus.archived_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  const touched = [...new Set((fresh ?? []).map((r) => r.dejavu_id))].slice(0, 6);
  let connection: HomeConnectionCard | null = null;
  let dejavu: HomeDejaVuCard | null = null;
  for (const id of touched) {
    const { data: rows } = await db
      .from("dejavu_moments")
      .select("moment_id, created_at, moment_references!inner(entity_type, subtype, occurred_at, deleted_at)")
      .eq("dejavu_id", id)
      .is("moment_references.deleted_at", null)
      .limit(200);
    const all = (rows ?? []).map((r) => ({ ...(r.moment_references as unknown as { entity_type: string; subtype: string | null; occurred_at: string }), linkedAt: r.created_at }));
    const name = ((fresh ?? []).find((r) => r.dejavu_id === id)!.dejavus as unknown as { name: string }).name;
    const newer = all.filter((m) => Date.parse(m.occurred_at) >= now - 14 * DAY);
    const older = all.filter((m) => Date.parse(m.occurred_at) < now - 30 * DAY);
    // A recent Moment and a much older one of a different kind, on the same thread.
    if (!connection && newer.length && older.length) {
      const recent = newer.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0]!;
      const old = older.find((m) => filterOf({ entityType: m.entity_type as never, subtype: m.subtype }) !== filterOf({ entityType: recent.entity_type as never, subtype: recent.subtype }) || m.subtype !== recent.subtype);
      if (old) {
        connection = { text: `Your ${kindWord(old)} from ${monthOf(old.occurred_at, now)} and a new ${kindWord(recent)} share “${name}”.`, href: `/dejavu/${id}` };
        continue;
      }
    }
    // New Moments since the last visit joining older ones.
    if (!dejavu && lastVisit) {
      const joined = all.filter((m) => m.linkedAt > lastVisit).length;
      if (joined && all.length > joined) dejavu = { id, name, newCount: joined, olderCount: all.length - joined };
    }
  }
  if (!connection) {
    // Something just captured that plainly mentions an existing DejaVu: offered, never attached.
    const { data: sugg } = await db
      .from("dejavu_suggestions")
      .select("id, moment_id, suggested_dejavu_id, dejavus(name, archived_at), moment_references!inner(entity_type, subtype, occurred_at, deleted_at)")
      .eq("status", "pending")
      .is("moment_references.deleted_at", null)
      .gt("created_at", new Date(now - 3 * DAY).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const s = sugg?.[0];
    const d = s?.dejavus as unknown as { name: string; archived_at: string | null } | null;
    if (s && d && !d.archived_at) {
      const m = s.moment_references as unknown as { entity_type: string; subtype: string | null; occurred_at: string };
      const when = Date.parse(m.occurred_at) >= now - DAY ? "Today's" : "Your new";
      connection = { text: `${when} ${kindWord(m)} may belong with “${d.name}”.`, href: `/dejavu/${s.suggested_dejavu_id}`, suggestion: { momentId: s.moment_id, suggestionId: s.id, name: d.name } };
    }
  }
  return { connection, dejavu };
}

/* ------------------------------------------------------------------------------------------------------- Spark */

/**
 * "A little spark" (§9): one older Material to rediscover — an anniversary first ("A year ago today you recorded this
 * voice note."), else a photograph that has never been used in a Creation, else a gentle reminder. The pick holds
 * through the day. No call to action.
 */
async function sparkCard(db: Db, creatorId: string, now: number): Promise<HomeMomentCard | null> {
  const { data: old } = await db
    .from("creative_materials")
    .select("id, title, type, created_at, storage_object_id")
    .eq("creator_id", creatorId)
    .in("type", ["image", "voice", "audio"])
    .eq("status", "active")
    .lt("created_at", new Date(now - SPARK_MIN_AGE_DAYS * DAY).toISOString())
    .order("created_at", { ascending: false })
    .limit(80);
  const pick = pickSpark(old ?? [], now);
  if (!pick) return null;
  const days = (now - Date.parse(pick.created_at)) / DAY;
  const anniversary = days >= 350 && (days % 365 <= 14 || days % 365 >= 351);
  const today = anniversary && (days % 365 <= 1 || days % 365 >= 364);
  const [{ data: used }, urls] = await Promise.all([
    db.from("lineage_edges").select("source_id").eq("source_type", "material").eq("source_id", pick.id).eq("target_type", "artifact").limit(1),
    pick.type === "image" ? signedUrlsFor(db, [pick.storage_object_id]) : Promise.resolve({} as Record<string, string>),
  ]);
  const verb = pick.type === "image" ? "saved this photograph" : "recorded this voice note";
  const text = anniversary
    ? `${agoPhrase(pick.created_at, now)}${today ? " today" : ""} you ${verb}.`
    : pick.type === "image" && !used?.length
      ? "This photograph has never appeared in one of your Creations."
      : `${agoPhrase(pick.created_at, now)} you saved ${pick.title || "this"}.`;
  return { materialId: pick.id, text, imageUrl: pick.storage_object_id ? (urls[pick.storage_object_id] ?? null) : null };
}

/* ------------------------------------------------------------------------------------------ Something worth starting */

/** No Creation yet (§5): recent Materials that already share a thread — or simply wait — suggest a start. Nothing is created. */
async function somethingToStart(db: Db, now: number): Promise<HomeStart | null> {
  const { data: recent } = await db.from("moment_references").select("id").eq("entity_type", "material").is("deleted_at", null).gt("occurred_at", new Date(now - 14 * DAY).toISOString()).limit(50);
  const ids = (recent ?? []).map((r) => r.id);
  if (ids.length < 2) return null;
  const { data: links } = await db.from("dejavu_moments").select("dejavu_id, dejavus!inner(name, archived_at)").in("moment_id", ids).is("dejavus.archived_at", null);
  const count = new Map<string, { n: number; name: string }>();
  for (const l of links ?? []) count.set(l.dejavu_id, { n: (count.get(l.dejavu_id)?.n ?? 0) + 1, name: (l.dejavus as unknown as { name: string }).name });
  const shared = [...count.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n)[0];
  if (shared) return { text: `${shared[1].n} recent Materials share “${shared[1].name}”.`, href: `/dejavu/${shared[0]}` };
  if (ids.length >= 3) return { text: `${ids.length} recent Materials are waiting for a first Creation.`, href: "/materials?tab=ideas" };
  return null;
}

/* ---------------------------------------------------------------------------------------------------- Fallback */

async function fallback(db: Db, creatorId: string, now: number): Promise<HomePayload> {
  const { data } = await db.from("artifacts").select("id, title, artifact_type, status, updated_at, cover_material_id").eq("creator_id", creatorId).neq("status", "archived").order("updated_at", { ascending: false }).limit(4);
  const [first, ...rest] = data ?? [];
  return {
    mode: "fallback",
    contextLine: "Ready to create",
    lastVisit: null,
    continue: first
      ? {
          id: first.id,
          title: first.title,
          typeLabel: artifactType(first.artifact_type).label,
          playable: false,
          version: null,
          coverUrl: null,
          updatedAt: first.updated_at,
          hint: { kind: "edited", text: null },
          sources: null,
        }
      : undefined,
    beginning: first ? undefined : { hasMaterials: true },
    quickCapture: { textEnabled: true, voiceEnabled: flags().quick_capture_voice_enabled },
    recent: rest.map((r) => ({ id: r.id, title: r.title, typeLabel: artifactType(r.artifact_type).label })),
    avatars: {},
    generatedAt: new Date(now).toISOString(),
  };
}
