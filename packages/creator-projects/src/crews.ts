import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import type { CrewAccess, CrewMemberStatus, CrewStatus } from "./options";

/**
 * CreatorCrew (P1-02): a temporary team around one project. Membership changes go through security-definer
 * functions that authorize the caller; rows are never deleted, so who was involved (and when) stays on record.
 */

export const crewSchema = z.object({
  name: z.string().trim().min(1, "Give your crew a name.").max(120).optional(),
  purpose: z.string().trim().max(2000).default(""),
});

export const updateCrewSchema = z.object({
  name: z.string().trim().min(1, "Give your crew a name.").max(120).optional(),
  purpose: z.string().trim().max(2000).optional(),
  status: z.enum(["forming", "active", "completed"]).optional(),
});

const roleTitle = z.string().trim().max(60);

export const inviteSchema = z.object({
  creatorId: z.string().uuid(),
  access: z.enum(["admin", "member"]).default("member"),
  roleTitle: roleTitle.optional(),
  note: z.string().trim().max(500).optional(),
});

export const roleSchema = z.object({
  creatorId: z.string().uuid(),
  access: z.enum(["admin", "member"]).optional(),
  roleTitle: roleTitle.nullable().optional(),
});

function crewError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("only the owner can invite admins")) return new DomainError("forbidden", "Only the crew's owner can invite admins.");
  if (msg.includes("only the crew's owner or admins can invite")) return new DomainError("forbidden", "Only the crew's owner or admins can invite people.");
  if (msg.includes("already in this crew")) return new DomainError("validation", "You're already in this crew.");
  if (msg.includes("creator not found")) return new DomainError("not_found", "We couldn't find that creator.");
  if (msg.includes("completed its work")) return new DomainError("conflict", "This crew has completed its work.");
  if (msg.includes("already invited")) return new DomainError("conflict", "They're already invited or in the crew.");
  if (msg.includes("invitation not found")) return new DomainError("not_found", "That invitation isn't open anymore.");
  if (msg.includes("only the owner can change access")) return new DomainError("forbidden", "Only the crew's owner can change what someone can do.");
  if (msg.includes("change someone else's role")) return new DomainError("forbidden", "Only the owner or admins can change someone else's role.");
  if (msg.includes("member not found")) return new DomainError("not_found", "They're no longer in this crew.");
  if (msg.includes("use Leave instead")) return new DomainError("forbidden", "You can't remove yourself or the owner.");
  if (msg.includes("can't remove this person")) return new DomainError("forbidden", "You can't remove this person.");
  if (msg.includes("can't leave their own crew")) return new DomainError("forbidden", "As the owner, you can't leave your own crew.");
  if (msg.includes("not a member")) return new DomainError("forbidden", "You're not in this crew.");
  return fromDbError(e);
}

export interface CrewMember {
  creatorId: string;
  name: string;
  handle: string | null;
  avatarObjectId: string | null;
  access: CrewAccess;
  roleTitle: string | null;
  status: CrewMemberStatus;
  invitedBy: string | null;
  inviteNote: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  endedAt: string | null;
}

export interface CrewActivity {
  id: string;
  kind: string;
  actor: string | null;
  subject: string | null;
  detail: Record<string, unknown>;
  at: string;
}

type MemberRow = {
  creator_id: string;
  access: string;
  role_title: string | null;
  status: string;
  invited_by: string | null;
  invite_note: string | null;
  invited_at: string | null;
  joined_at: string | null;
  ended_at: string | null;
  creators: { display_name: string; handle: string | null; avatar_object_id: string | null } | null;
};

const MEMBER_COLUMNS = "creator_id, access, role_title, status, invited_by, invite_note, invited_at, joined_at, ended_at, creators!crew_members_creator_id_fkey(display_name, handle, avatar_object_id)";

function toMember(r: MemberRow): CrewMember {
  return {
    creatorId: r.creator_id,
    name: r.creators?.display_name ?? "Creator",
    handle: r.creators?.handle ?? null,
    avatarObjectId: r.creators?.avatar_object_id ?? null,
    access: r.access as CrewAccess,
    roleTitle: r.role_title,
    status: r.status as CrewMemberStatus,
    invitedBy: r.invited_by,
    inviteNote: r.invite_note,
    invitedAt: r.invited_at,
    joinedAt: r.joined_at,
    endedAt: r.ended_at,
  };
}

const ACCESS_ORDER: Record<CrewAccess, number> = { owner: 0, admin: 1, member: 2 };

/** Start the crew for a project (owner only). Its name defaults to the project's. */
export async function startCrew(db: Db, creatorId: string, projectId: string, raw: unknown) {
  const c = crewSchema.parse(raw);
  const project = must(await db.from("projects").select("id, title, creator_id").eq("id", projectId).maybeSingle(), "We couldn't find that project.");
  if (project.creator_id !== creatorId) throw new DomainError("forbidden", "Only the project's owner can start its crew.");
  const res = await db.from("crews").insert({ project_id: projectId, creator_id: creatorId, name: c.name || project.title, purpose: c.purpose }).select("*").single();
  if (res.error?.code === "23505") throw new DomainError("conflict", "This project already has a crew.");
  return must(res);
}

export async function crewForProject(db: Db, projectId: string) {
  const { data, error } = await db.from("crews").select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

/** Everything the viewer may see of a crew. Null when they can't see it. */
export async function getCrew(db: Db, viewerId: string, crewId: string) {
  const { data: crew, error } = await db.from("crews").select("*").eq("id", crewId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!crew) return null;
  const [members, overview, activity] = await Promise.all([
    db.from("crew_members").select(MEMBER_COLUMNS).eq("crew_id", crewId).limit(500),
    db.rpc("crew_overview", { p_crew: crewId }),
    db.from("crew_activity").select("id, kind, actor_creator_id, subject_creator_id, detail, created_at").eq("crew_id", crewId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (members.error) throw fromDbError(members.error);
  const all = ((members.data ?? []) as unknown as MemberRow[]).map(toMember);
  const me = all.find((m) => m.creatorId === viewerId) ?? null;
  const names = new Map(all.map((m) => [m.creatorId, m.name]));
  const o = (overview.data ?? {}) as { projectId?: string; projectTitle?: string; projectBrief?: string; projectStatus?: string };
  return {
    crew: { id: crew.id, name: crew.name, purpose: crew.purpose, status: crew.status as CrewStatus, projectId: crew.project_id, ownerId: crew.creator_id, createdAt: crew.created_at },
    project: { id: o.projectId ?? crew.project_id, title: o.projectTitle ?? "Project", brief: o.projectBrief ?? "", status: o.projectStatus ?? null },
    me,
    active: all.filter((m) => m.status === "active").sort((a, b) => ACCESS_ORDER[a.access] - ACCESS_ORDER[b.access] || (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "")),
    invited: all.filter((m) => m.status === "invited").sort((a, b) => (b.invitedAt ?? "").localeCompare(a.invitedAt ?? "")),
    // Former members stay on record (who they were and when they left); shown to active members only.
    former: me?.status === "active" ? all.filter((m) => m.status === "left" || m.status === "removed").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? "")) : [],
    activity: (activity.data ?? []).map(
      (a): CrewActivity => ({
        id: a.id,
        kind: a.kind,
        actor: a.actor_creator_id ? (names.get(a.actor_creator_id) ?? "Someone") : null,
        subject: a.subject_creator_id ? (names.get(a.subject_creator_id) ?? "Someone") : null,
        detail: (a.detail ?? {}) as Record<string, unknown>,
        at: a.created_at,
      }),
    ),
  };
}

export async function updateCrew(db: Db, crewId: string, raw: unknown) {
  const u = updateCrewSchema.parse(raw);
  const patch = { ...(u.name !== undefined ? { name: u.name } : {}), ...(u.purpose !== undefined ? { purpose: u.purpose } : {}), ...(u.status ? { status: u.status } : {}) };
  if (!Object.keys(patch).length) return;
  const res = await db.from("crews").update(patch).eq("id", crewId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "Only the crew's owner or admins can change it.");
}

export async function inviteToCrew(db: Db, crewId: string, raw: unknown) {
  const i = inviteSchema.parse(raw);
  const { error } = await db.rpc("crew_invite", { p_crew: crewId, p_creator: i.creatorId, p_access: i.access, p_role_title: i.roleTitle || undefined, p_note: i.note || undefined });
  if (error) throw crewError(error);
}

export async function respondToCrew(db: Db, crewId: string, accept: boolean) {
  const { error } = await db.rpc("crew_respond", { p_crew: crewId, p_accept: accept });
  if (error) throw crewError(error);
}

export async function setCrewRole(db: Db, crewId: string, raw: unknown) {
  const r = roleSchema.parse(raw);
  const clear = r.roleTitle === null || r.roleTitle === "";
  const { error } = await db.rpc("crew_set_role", { p_crew: crewId, p_creator: r.creatorId, p_access: r.access, p_role_title: clear ? undefined : (r.roleTitle ?? undefined), p_clear_title: clear });
  if (error) throw crewError(error);
}

export async function removeFromCrew(db: Db, crewId: string, creatorId: string) {
  const { error } = await db.rpc("crew_remove", { p_crew: crewId, p_creator: creatorId });
  if (error) throw crewError(error);
}

export async function leaveCrew(db: Db, crewId: string) {
  const { error } = await db.rpc("crew_leave", { p_crew: crewId });
  if (error) throw crewError(error);
}

export interface CrewInvite {
  crewId: string;
  crewName: string;
  projectTitle: string;
  roleTitle: string | null;
  access: CrewAccess;
  invitedBy: string;
  note: string | null;
  invitedAt: string;
}

/** Crew invitations waiting on the creator. */
export async function myCrewInvites(db: Db, creatorId: string): Promise<CrewInvite[]> {
  const { data, error } = await db
    .from("crew_members")
    .select("crew_id, access, role_title, invite_note, invited_at, crews(name), inviter:creators!crew_members_invited_by_fkey(display_name)")
    .eq("creator_id", creatorId)
    .eq("status", "invited")
    .order("invited_at", { ascending: false })
    .limit(20);
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  const overviews = await Promise.all(rows.map((r) => db.rpc("crew_overview", { p_crew: r.crew_id })));
  return rows.map((r, i) => ({
    crewId: r.crew_id,
    crewName: (r.crews as { name: string } | null)?.name ?? "A crew",
    projectTitle: ((overviews[i].data ?? {}) as { projectTitle?: string }).projectTitle ?? "a project",
    roleTitle: r.role_title,
    access: r.access as CrewAccess,
    invitedBy: (r.inviter as { display_name: string } | null)?.display_name ?? "A creator",
    note: r.invite_note,
    invitedAt: r.invited_at ?? new Date(0).toISOString(),
  }));
}

/** Active crew members other than the viewer (for starting a crew Huddle). */
export async function crewmates(db: Db, crewId: string, viewerId: string): Promise<string[]> {
  const { data, error } = await db.from("crew_members").select("creator_id").eq("crew_id", crewId).eq("status", "active").neq("creator_id", viewerId).limit(50);
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => r.creator_id);
}
