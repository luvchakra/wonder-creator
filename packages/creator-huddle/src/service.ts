import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import { createMaterial } from "@wonder/creator-library";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";

export type Huddle = Tables<"huddles">;

export const startSchema = z.object({
  topic: z.string().trim().max(140).optional().default(""),
  discoverability: z.enum(["public", "invite_only"]).default("public"),
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
  return fromDbError(e);
};

export async function startHuddle(db: Db, raw: unknown): Promise<string> {
  const s = startSchema.parse(raw);
  const { data, error } = await db.rpc("huddle_start", { p_topic: s.topic, p_discoverability: s.discoverability });
  if (error) throw rpcError(error);
  return data as string;
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
  const h = must(await db.from("huddles").select("id, topic, status").eq("id", huddleId).maybeSingle(), "This Huddle has ended.");
  if (h.status !== "live") throw new DomainError("not_found", "This Huddle has ended.");
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

export const reportSchema = z.object({
  reportedCreatorId: z.string().uuid().nullable().optional(),
  reason: z.enum(["spam", "harassment", "hate", "sexual", "violence", "impersonation", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export async function report(db: Db, creatorId: string, contextType: "huddle" | "profile" | "artifact" | "message", contextId: string | null, raw: unknown) {
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
