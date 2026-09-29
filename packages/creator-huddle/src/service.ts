import { DomainError, fromDbError, publishEvent } from "@wonder/core";
import { createMaterial } from "@wonder/creator-library";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";

export type Huddle = Tables<"huddles">;

export const startSchema = z.object({
  topic: z.string().trim().max(140).optional().default(""),
  discoverability: z.enum(["public", "invite_only"]).default("public"),
  description: z.string().trim().max(500).optional().default(""),
  /** Whether participants may save each other's chat messages (from the start). Off unless the host says so. */
  allowSavingChat: z.boolean().default(false),
  relatedArtifactId: z.string().uuid().nullish(),
  relatedMaterialId: z.string().uuid().nullish(),
  invite: z.array(z.string().uuid()).max(20).default([]),
});

export const configureSchema = z.object({
  description: z.string().trim().max(500).optional(),
  allowSavingChat: z.boolean().optional(),
  relatedArtifactId: z.string().uuid().nullish(),
  relatedMaterialId: z.string().uuid().nullish(),
  clearRelated: z.boolean().optional(),
});

const rpcError = (e: { code?: string; message?: string }) => {
  const msg = e.message ?? "";
  if (msg.includes("already in a live huddle")) return new DomainError("conflict", "You're already in a live Huddle. Leave it first.");
  if (msg.includes("not live")) return new DomainError("not_found", "This Huddle has ended.");
  if (msg.includes("already a participant")) return new DomainError("conflict", "You're already in this Huddle.");
  if (msg.includes("cannot resolve own")) return new DomainError("forbidden", "Someone already in the Huddle needs to approve your request.");
  if (msg.includes("already resolved")) return new DomainError("conflict", "That request was already handled.");
  if (msg.includes("only the host")) return new DomainError("forbidden", "Only the host can do that.");
  if (msg.includes("not admitted")) return new DomainError("forbidden", "Your request needs to be approved first.");
  if (msg.includes("not a participant")) return new DomainError("forbidden", "You're not in this Huddle.");
  if (msg.includes("saving not allowed")) return new DomainError("forbidden", "Only your own messages can be saved, unless the host allowed saving chat when it was sent.");
  if (msg.includes("invalid related item")) return new DomainError("validation", "You can only link your own material, or a Creation you can open.");
  if (msg.includes("invalid invitee")) return new DomainError("validation", "You can't invite that creator.");
  if (msg.includes("invitation not found")) return new DomainError("not_found", "That invitation isn't open anymore.");
  if (msg.includes("message not found")) return new DomainError("not_found", "That message is gone.");
  return fromDbError(e);
};

export async function startHuddle(db: Db, raw: unknown): Promise<string> {
  const s = startSchema.parse(raw);
  const { data, error } = await db.rpc("huddle_start", { p_topic: s.topic, p_discoverability: s.discoverability });
  if (error) throw rpcError(error);
  const id = data as string;
  if (s.description || s.allowSavingChat || s.relatedArtifactId || s.relatedMaterialId) {
    await configureHuddle(db, id, { description: s.description, allowSavingChat: s.allowSavingChat, relatedArtifactId: s.relatedArtifactId, relatedMaterialId: s.relatedMaterialId });
  }
  for (const invitee of s.invite) await inviteCreator(db, id, invitee);
  return id;
}

/** Host-only settings while live. Allowing chat saving applies to messages sent from now on. */
export async function configureHuddle(db: Db, huddleId: string, raw: unknown) {
  const c = configureSchema.parse(raw);
  const { data, error } = await db.rpc("huddle_configure", {
    p_huddle: huddleId,
    p_description: c.description,
    p_allow_saving_chat: c.allowSavingChat,
    p_related_artifact: c.relatedArtifactId ?? undefined,
    p_related_material: c.relatedMaterialId ?? undefined,
    p_clear_related: c.clearRelated ?? false,
  });
  if (error) throw rpcError(error);
  return data as Huddle;
}

export async function relatedItem(db: Db, huddleId: string): Promise<{ kind: "artifact" | "material"; id: string | null; title: string; canOpen: boolean } | null> {
  const { data, error } = await db.rpc("huddle_related", { p_huddle: huddleId });
  if (error) throw rpcError(error);
  return (data as never) ?? null;
}

export async function declineInvite(db: Db, huddleId: string) {
  const { error } = await db.rpc("huddle_decline_invite", { p_huddle: huddleId });
  if (error) throw rpcError(error);
}

export async function inviteCreator(db: Db, huddleId: string, inviteeId: string) {
  const { error } = await db.rpc("huddle_invite", { p_huddle: huddleId, p_invitee: inviteeId });
  if (error) throw rpcError(error);
}

export async function requestJoin(db: Db, huddleId: string, message?: string | null) {
  const { data, error } = await db.rpc("huddle_request_join", { p_huddle: huddleId, p_message: message?.slice(0, 280) ?? undefined });
  if (error) throw rpcError(error);
  return data as string;
}

export async function cancelRequest(db: Db, requestId: string) {
  const { error } = await db.rpc("huddle_cancel_request", { p_request: requestId });
  if (error) throw rpcError(error);
}

export async function resolveRequest(db: Db, requestId: string, approve: boolean) {
  const { error } = await db.rpc("huddle_resolve_request", { p_request: requestId, p_approve: approve });
  if (error) throw rpcError(error);
}

export async function enterHuddle(db: Db, huddleId: string) {
  const { error } = await db.rpc("huddle_enter", { p_huddle: huddleId });
  if (error) throw rpcError(error);
}

export async function leaveHuddle(db: Db, huddleId: string): Promise<{ dissolved: boolean }> {
  const { data, error } = await db.rpc("huddle_leave", { p_huddle: huddleId });
  if (error) throw rpcError(error);
  return { dissolved: !!data };
}

export async function heartbeat(db: Db, huddleId: string, audio?: boolean, video?: boolean): Promise<"live" | "dissolved" | "not_joined"> {
  const { data, error } = await db.rpc("huddle_heartbeat", { p_huddle: huddleId, p_audio: audio, p_video: video });
  if (error) throw rpcError(error);
  return data as "live" | "dissolved" | "not_joined";
}

export async function removeParticipant(db: Db, huddleId: string, creatorId: string) {
  const { error } = await db.rpc("huddle_remove_participant", { p_huddle: huddleId, p_creator: creatorId });
  if (error) throw rpcError(error);
}

export async function endHuddle(db: Db, huddleId: string) {
  const { error } = await db.rpc("huddle_end", { p_huddle: huddleId });
  if (error) throw rpcError(error);
}

export interface LiveCard {
  huddleId: string;
  topic: string | null;
  participantCount: number;
  participantNames: string[];
  participantIds: string[];
  startedAt: string;
  viewerState: "joined" | "approved" | "requested" | "none";
}

/** Public, safe metadata only (never chat, transcript or media). */
export async function liveCards(db: Db, opts: { limit?: number; creatorId?: string } = {}): Promise<LiveCard[]> {
  const { data, error } = await db.rpc("live_huddle_cards", { p_limit: opts.limit ?? 24, p_creator: opts.creatorId });
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    huddleId: r.huddle_id,
    topic: r.topic,
    participantCount: r.participant_count,
    participantNames: r.participant_names ?? [],
    participantIds: r.participant_ids ?? [],
    startedAt: r.started_at,
    viewerState: r.viewer_state as LiveCard["viewerState"],
  }));
}

/** Full room state; only readable by participants (RLS). */
export async function roomState(db: Db, huddleId: string, myCreatorId: string) {
  const huddle = await db.from("huddles").select("*").eq("id", huddleId).maybeSingle();
  if (huddle.error) throw fromDbError(huddle.error);
  const [participants, requests, messages] = await Promise.all([
    db
      .from("huddle_participants")
      .select("creator_id, role, status, audio_on, video_on, joined_at, last_seen_at, creators(id, display_name, handle, avatar_object_id)")
      .eq("huddle_id", huddleId)
      .in("status", ["joined", "joining"])
      .order("joined_at"),
    db
      .from("huddle_join_requests")
      .select("id, requester_creator_id, message, status, created_at, creators!huddle_join_requests_requester_creator_id_fkey(id, display_name, handle, avatar_object_id)")
      .eq("huddle_id", huddleId)
      .eq("status", "pending")
      .order("created_at"),
    db.from("huddle_messages").select("id, creator_id, body, created_at").eq("huddle_id", huddleId).order("created_at").limit(200),
  ]);
  const invitations = await db
    .from("huddle_invitations")
    .select("invitee_creator_id, status, created_at, creators!huddle_invitations_invitee_creator_id_fkey(display_name, handle)")
    .eq("huddle_id", huddleId)
    .order("created_at");
  const disciplines = await db
    .from("creator_disciplines")
    .select("creator_id, value")
    .in("creator_id", [...(participants.data ?? []).map((p) => p.creator_id), ...(requests.data ?? []).map((r) => r.requester_creator_id)])
    .eq("position", 0);
  const firstDiscipline = new Map((disciplines.data ?? []).map((d) => [d.creator_id, d.value]));
  const me = (participants.data ?? []).find((p) => p.creator_id === myCreatorId);
  const myRequest = await db.from("huddle_join_requests").select("id").eq("huddle_id", huddleId).eq("requester_creator_id", myCreatorId).eq("status", "pending").maybeSingle();
  return {
    huddle: huddle.data,
    me: me ? { role: me.role, status: me.status } : null,
    myPendingRequestId: myRequest.data?.id ?? null,
    participants: (participants.data ?? []).map((p) => ({ ...p, discipline: firstDiscipline.get(p.creator_id) ?? null })),
    requests: (requests.data ?? []).map((r) => ({ ...r, discipline: firstDiscipline.get(r.requester_creator_id) ?? null })),
    messages: messages.data ?? [],
    // Invitations are visible to participants (and to each invitee, their own).
    invitations: (invitations.data ?? []).map((i) => ({ creatorId: i.invitee_creator_id, status: i.status, name: (i.creators as { display_name: string } | null)?.display_name ?? "Creator" })),
  };
}

export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function sendMessage(db: Db, creatorId: string, huddleId: string, raw: unknown) {
  const { body } = messageSchema.parse(raw);
  const res = await db.from("huddle_messages").insert({ huddle_id: huddleId, creator_id: creatorId, body }).select("*").single();
  if (res.error) throw res.error.code === "42501" ? new DomainError("forbidden", "Only people in this Huddle can send messages.") : fromDbError(res.error);
  return res.data;
}

export const preserveSchema = z.object({
  kind: z.enum(["idea", "material"]),
  text: z.string().trim().min(1).max(20000),
  title: z.string().trim().max(200).optional(),
});

/** Explicitly preserve something from a live Huddle as durable Creative Material. The Huddle stays ephemeral. */
export async function preserve(db: Db, creatorId: string, huddleId: string, raw: unknown) {
  const p = preserveSchema.parse(raw);
  // Live participants, or past participants adding their own notes afterwards (their history row proves it).
  const live = (await db.from("huddles").select("id, topic, status").eq("id", huddleId).maybeSingle()).data;
  const past = live?.status === "live" ? null : (await db.from("huddle_history").select("topic").eq("huddle_id", huddleId).maybeSingle()).data;
  if (live?.status !== "live" && !past) throw new DomainError("not_found", "This Huddle has ended.");
  const h = { topic: live?.status === "live" ? live.topic : (past?.topic ?? null) };
  const material = await createMaterial(db, creatorId, {
    type: p.kind === "idea" ? "idea" : "note",
    title: p.title || (h.topic ? `From the Huddle: ${h.topic}` : "From a Huddle"),
    textContent: p.text,
    sourceType: "huddle",
    provenance: { origin: "huddle", huddleId, details: { topic: h.topic } },
  });
  const item = await db.from("huddle_preserved_items").insert({ huddle_id: huddleId, creator_id: creatorId, kind: p.kind, material_id: material.id }).select("id").single();
  if (item.error) throw fromDbError(item.error);
  await publishEvent(db, { type: "HuddleContentPreserved", aggregate: "huddle", aggregateId: huddleId, payload: { materialId: material.id, kind: p.kind } });
  return material;
}

/**
 * Save a chat message as Creative Material: your own, or someone else's if it was sent while the host allowed
 * saving (checked by the database). Other people's words keep their attribution.
 */
export async function saveMoment(db: Db, creatorId: string, huddleId: string, messageId: string) {
  const { data, error } = await db.rpc("huddle_moment", { p_huddle: huddleId, p_message: messageId });
  if (error) throw rpcError(error);
  const m = data as { body: string; author: string; own: boolean };
  return preserve(db, creatorId, huddleId, { kind: "material", text: m.own ? m.body : `“${m.body}”\n— ${m.author}`, title: undefined });
}

export interface HuddleSummary {
  huddleId: string;
  topic: string | null;
  role: "host" | "member";
  startedAt: string;
  joinedAt: string;
  leftAt: string | null;
  endedAt: string | null;
  met: Array<{ id: string; name: string; handle: string | null }>;
  saved: Array<{ id: string; kind: string; materialId: string | null; title: string | null; createdAt: string }>;
}

/** Your own record of a Huddle you were in: when, who you met, what you saved. Never its chat. */
export async function huddleSummary(db: Db, huddleId: string): Promise<HuddleSummary | null> {
  const h = await db.from("huddle_history").select("*").eq("huddle_id", huddleId).maybeSingle();
  if (h.error) throw fromDbError(h.error);
  if (!h.data) return null;
  const saved = await db
    .from("huddle_preserved_items")
    .select("id, kind, material_id, created_at, creative_materials(title)")
    .eq("huddle_id", huddleId)
    .order("created_at");
  if (saved.error) throw fromDbError(saved.error);
  return {
    huddleId,
    topic: h.data.topic,
    role: h.data.role as "host" | "member",
    startedAt: h.data.started_at,
    joinedAt: h.data.joined_at,
    leftAt: h.data.left_at,
    endedAt: h.data.ended_at,
    met: (h.data.met as HuddleSummary["met"]) ?? [],
    saved: (saved.data ?? []).map((x) => ({ id: x.id, kind: x.kind, materialId: x.material_id, title: (x.creative_materials as { title: string | null } | null)?.title ?? null, createdAt: x.created_at })),
  };
}

export async function recentHuddles(db: Db, limit = 10) {
  const { data, error } = await db.from("huddle_history").select("huddle_id, topic, joined_at, ended_at, met").not("ended_at", "is", null).order("joined_at", { ascending: false }).limit(limit);
  if (error) throw fromDbError(error);
  return (data ?? []).map((h) => ({ huddleId: h.huddle_id, topic: h.topic, joinedAt: h.joined_at, endedAt: h.ended_at, metCount: Array.isArray(h.met) ? h.met.length : 0 }));
}

export const reportSchema = z.object({
  reportedCreatorId: z.string().uuid().nullable().optional(),
  reason: z.enum(["spam", "harassment", "hate", "sexual", "violence", "impersonation", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export type ReportContext = "huddle" | "profile" | "artifact" | "message" | "scrapbook_post" | "scrapbook_reply" | "open_conversation" | "open_conversation_reply";

export async function report(db: Db, creatorId: string, contextType: ReportContext, contextId: string | null, raw: unknown) {
  const r = reportSchema.parse(raw);
  const res = await db.from("moderation_reports").insert({
    reporter_creator_id: creatorId,
    reported_creator_id: r.reportedCreatorId ?? null,
    context_type: contextType,
    context_id: contextId,
    reason: r.reason,
    details: r.details || null,
  });
  if (res.error) throw fromDbError(res.error);
}
