import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

/**
 * P1-16 Campaign Domain Foundation (plan §37). A campaign brief, invitations to creators who are open to brand work,
 * proposed deliverables with approval state, the usage rights the campaign needs, and a link to a Creative Room as
 * its workspace. No payments, contracts or legal automation; every state change is a person's action, enforced by
 * the database functions (supabase/migrations/…048_campaigns.sql).
 */

export const CAMPAIGN_STATUSES = ["draft", "open", "in_progress", "completed", "cancelled"] as const;
export { DELIVERABLE_STATUS_LABEL } from "./campaign-labels";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const campaignSchema = z.object({
  brandName: text(1, 80),
  title: text(1, 120),
  brief: text(1, 4000),
  usageRights: text(1, 1000),
  channels: z.array(text(1, 40)).max(12).default([]),
  dueOn: z.string().date().nullish(),
  projectId: z.string().uuid().nullish(),
});

export async function createCampaign(db: Db, creatorId: string, raw: unknown) {
  const i = campaignSchema.parse(raw);
  return must(
    await db
      .from("campaigns")
      .insert({ owner_creator_id: creatorId, brand_name: i.brandName, title: i.title, brief: i.brief, usage_rights: i.usageRights, channels: i.channels, due_on: i.dueOn ?? null, project_id: i.projectId ?? null })
      .select("*")
      .single(),
  );
}

export async function updateCampaign(db: Db, id: string, raw: unknown) {
  const i = campaignSchema.partial().extend({ status: z.enum(CAMPAIGN_STATUSES).optional() }).parse(raw);
  const { data, error } = await db
    .from("campaigns")
    .update({
      ...(i.brandName !== undefined ? { brand_name: i.brandName } : {}),
      ...(i.title !== undefined ? { title: i.title } : {}),
      ...(i.brief !== undefined ? { brief: i.brief } : {}),
      ...(i.usageRights !== undefined ? { usage_rights: i.usageRights } : {}),
      ...(i.channels !== undefined ? { channels: i.channels } : {}),
      ...(i.dueOn !== undefined ? { due_on: i.dueOn ?? null } : {}),
      ...(i.projectId !== undefined ? { project_id: i.projectId ?? null } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new DomainError("not_found", "Only the campaign's owner can change it.");
  return data;
}

/** The creator's campaigns: ones they run, and ones they're invited to or working on. */
export async function listCampaigns(db: Db, creatorId: string) {
  const [mine, invites] = await Promise.all([
    db.from("campaigns").select("id, brand_name, title, status, due_on, created_at").eq("owner_creator_id", creatorId).order("created_at", { ascending: false }),
    db.from("campaign_invitations").select("status, invited_at, campaigns(id, brand_name, title, status, due_on)").eq("creator_id", creatorId).in("status", ["invited", "accepted"]).order("invited_at", { ascending: false }),
  ]);
  if (mine.error) throw fromDbError(mine.error);
  if (invites.error) throw fromDbError(invites.error);
  return {
    running: mine.data ?? [],
    joined: (invites.data ?? []).filter((r) => r.campaigns).map((r) => ({ ...r.campaigns!, invitation: r.status })),
  };
}

export async function getCampaign(db: Db, creatorId: string, id: string) {
  const { data: c, error } = await db.from("campaigns").select("*, projects(id, title)").eq("id", id).maybeSingle();
  if (error) throw fromDbError(error);
  if (!c) return null;
  const owner = c.owner_creator_id === creatorId;
  const [inv, del] = await Promise.all([
    db.from("campaign_invitations").select("creator_id, status, note, response_note, invited_at, responded_at, creators!campaign_invitations_creator_id_fkey(display_name, handle)").eq("campaign_id", id).order("invited_at"),
    db.from("campaign_deliverables").select("*, creators!campaign_deliverables_creator_id_fkey(display_name, handle)").eq("campaign_id", id).order("created_at"),
  ]);
  if (inv.error) throw fromDbError(inv.error);
  if (del.error) throw fromDbError(del.error);
  const mine = (inv.data ?? []).find((i) => i.creator_id === creatorId) ?? null;
  return { campaign: c, role: owner ? ("owner" as const) : mine?.status === "accepted" ? ("creator" as const) : ("invited" as const), invitations: inv.data ?? [], myInvitation: mine, deliverables: del.data ?? [] };
}

/** The campaign functions raise plain, human messages (written for people); pass those through with the right code. */
const CODES: Record<string, "forbidden" | "not_found" | "validation" | "conflict"> = { "42501": "forbidden", P0002: "not_found", "22023": "validation", "55000": "conflict", "23505": "conflict" };
const rpc = async (db: Db, fn: string, args: Record<string, unknown>) => {
  const { data, error } = await (db.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>)(fn, args);
  if (error) {
    const code = CODES[error.code ?? ""];
    if (code && error.message && !/[_.]|violates|relation|column/.test(error.message)) throw new DomainError(code, error.message[0]!.toUpperCase() + error.message.slice(1) + ".");
    throw fromDbError(error as never);
  }
  return data;
};

/** Invite by @handle (or id) — only creators who opted into brand work (the database checks). */
export async function inviteToCampaign(db: Db, campaignId: string, raw: unknown) {
  const i = z
    .object({ handle: z.string().trim().min(1).max(40).transform((h) => h.replace(/^@/, "")).optional(), creatorId: z.string().uuid().optional(), note: z.string().trim().max(1000).optional() })
    .refine((x) => x.handle || x.creatorId, "Say who to invite.")
    .parse(raw);
  let id = i.creatorId;
  if (!id) {
    const { data: who } = await db.from("creators").select("id").eq("handle", i.handle!).maybeSingle();
    if (!who) throw new DomainError("not_found", "No creator with that handle.");
    id = who.id;
  }
  await rpc(db, "campaign_invite", { p_campaign: campaignId, p_creator: id, p_note: i.note ?? null });
}
export const withdrawInvite = (db: Db, campaignId: string, creatorId: string) => rpc(db, "campaign_withdraw_invite", { p_campaign: campaignId, p_creator: creatorId });
export const respondToCampaign = (db: Db, campaignId: string, accept: boolean, note?: string) => rpc(db, "campaign_respond", { p_campaign: campaignId, p_accept: accept, p_note: note ?? null });

export const deliverableSchema = z.object({ creatorId: z.string().uuid(), title: text(1, 120), description: z.string().trim().max(2000).optional(), format: z.string().trim().max(60).optional(), dueOn: z.string().date().nullish() });
export async function proposeDeliverable(db: Db, campaignId: string, raw: unknown) {
  const i = deliverableSchema.parse(raw);
  return (await rpc(db, "campaign_propose_deliverable", { p_campaign: campaignId, p_creator: i.creatorId, p_title: i.title, p_description: i.description ?? null, p_format: i.format ?? null, p_due_on: i.dueOn ?? null })) as string;
}
export const agreeDeliverable = (db: Db, id: string) => rpc(db, "campaign_agree_deliverable", { p_deliverable: id });
export const submitDeliverable = (db: Db, id: string, artifactId: string) => rpc(db, "campaign_submit_deliverable", { p_deliverable: id, p_artifact: artifactId });
export async function reviewDeliverable(db: Db, id: string, approve: boolean, note?: string) {
  await rpc(db, "campaign_review_deliverable", { p_deliverable: id, p_approve: approve, p_note: note ?? null });
}
export async function campaignSubmission(db: Db, deliverableId: string) {
  return (await rpc(db, "campaign_submission", { p_deliverable: deliverableId })) as { title: string; type: string; version: number | null; content: string | null } | null;
}
