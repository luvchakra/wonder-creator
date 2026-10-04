import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, TablesUpdate } from "@wonder/db";
import { z } from "zod";
import { DEFAULT_ARTIFACT_TYPE, PART_KINDS, PART_TEMPLATES, type PartEventView, type PartKind, type PartStatus, type PartTemplateKey, type PartView } from "./parts-options";

/**
 * Parts (docs/creative-room-parts.md): what a joint Creation is made of — Lyrics · Tune · Voice — each a Creation of
 * its own with one or more people on it. Parts are peers: none waits on another and none is locked; a part is
 * "final" only when its people say so. Membership changes go through security-definer functions (as crews do) and
 * rows are never deleted, only ended. Someone invited to a part sees the Room's name and its parts — not its items,
 * tasks or chat — unless they're in the crew too.
 */
export * from "./parts-options";

export const partSchema = z.object({
  title: z.string().trim().min(1, "Name the part.").max(60),
  kind: z.enum(PART_KINDS).default("writing"),
  artifactType: z.string().trim().min(1).max(60).optional(),
});
export const updatePartSchema = z.object({
  title: z.string().trim().min(1, "Name the part.").max(60).optional(),
  kind: z.enum(PART_KINDS).optional(),
  artifactType: z.string().trim().min(1).max(60).optional(),
  position: z.number().int().min(0).max(999).optional(),
});
export const partInviteSchema = z.object({ creatorId: z.string().uuid(), note: z.string().trim().max(500).optional() });

type CreatorRef = { id: string; display_name: string; handle: string | null } | null;
const person = (c: CreatorRef) => (c ? { id: c.id, name: c.display_name, handle: c.handle } : null);

/** The Room's parts in order, with who's on each and what each has produced so far. */
export async function listParts(db: Db, projectId: string, viewerId: string): Promise<PartView[]> {
  const { data, error } = await db
    .from("project_parts")
    .select("id, project_id, title, kind, artifact_type, position, status, artifact_id, final_at, project_part_members(creator_id, status, creators:creators!project_part_members_creator_id_fkey(id, display_name, handle))")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  if (!rows.length) return [];
  const crewIds = await crewPeople(db, projectId);
  const artifactIds = rows.map((r) => r.artifact_id).filter((x): x is string => !!x);
  const artifacts = new Map<string, { id: string; title: string; artifact_type: string; updated_at: string; current_version_id: string | null }>();
  const versionNumbers = new Map<string, number>();
  if (artifactIds.length) {
    const { data: as } = await db.from("artifacts").select("id, title, artifact_type, updated_at, current_version_id").in("id", artifactIds);
    for (const a of as ?? []) artifacts.set(a.id, a);
    const current = (as ?? []).map((a) => a.current_version_id).filter((x): x is string => !!x);
    if (current.length) {
      const { data: vs } = await db.from("artifact_versions").select("id, version_number").in("id", current);
      for (const v of vs ?? []) versionNumbers.set(v.id, v.version_number);
    }
  }
  return rows.map((r) => {
    const members = (r.project_part_members as Array<{ creator_id: string; status: string; creators: CreatorRef }>) ?? [];
    const people = members
      .filter((m) => m.status === "active" || m.status === "invited")
      .map((m) => ({ ...(person(m.creators) ?? { id: m.creator_id, name: "A creator", handle: null }), status: m.status as "invited" | "active", outside: !crewIds.has(m.creator_id) }))
      .sort((x, y) => (x.status === y.status ? x.name.localeCompare(y.name) : x.status === "active" ? -1 : 1));
    const a = r.artifact_id ? artifacts.get(r.artifact_id) : undefined;
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      kind: r.kind as PartKind,
      artifactType: r.artifact_type,
      position: r.position,
      status: r.status as PartStatus,
      artifactId: r.artifact_id,
      artifact: a ? { id: a.id, title: a.title, type: a.artifact_type, versionNumber: a.current_version_id ? (versionNumbers.get(a.current_version_id) ?? 1) : 1, updatedAt: a.updated_at } : null,
      people,
      mine: people.some((p) => p.id === viewerId && p.status === "active"),
      invitedMe: people.some((p) => p.id === viewerId && p.status === "invited"),
      finalAt: r.final_at,
    };
  });
}

/** The Room's owner and active crew: everyone on a part who isn't one of them is "on this part only". */
async function crewPeople(db: Db, projectId: string): Promise<Set<string>> {
  const [{ data: p }, { data: crew }] = await Promise.all([
    db.from("projects").select("creator_id").eq("id", projectId).maybeSingle(),
    db.from("crews").select("crew_members(creator_id, status)").eq("project_id", projectId).maybeSingle(),
  ]);
  const ids = new Set<string>();
  if (p?.creator_id) ids.add(p.creator_id);
  for (const m of (crew?.crew_members as Array<{ creator_id: string; status: string }> | null) ?? []) if (m.status === "active") ids.add(m.creator_id);
  return ids;
}

/**
 * What happened, newest first: part events (claimed, invited, joined, started, final…) and every version of a part's
 * Creation the viewer may read. This is the Room's timeline; nothing in it is inferred.
 */
export async function partsTimeline(db: Db, projectId: string, parts: PartView[], limit = 40): Promise<PartEventView[]> {
  const { data: events, error } = await db
    .from("project_part_events")
    .select("id, part_id, kind, detail, created_at, actor:creators!project_part_events_actor_creator_id_fkey(id, display_name, handle), subject:creators!project_part_events_subject_creator_id_fkey(id, display_name, handle)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw fromDbError(error);
  const titles = new Map(parts.map((p) => [p.id, p.title]));
  const byArtifact = new Map(parts.filter((p) => p.artifactId).map((p) => [p.artifactId!, p]));
  const out: PartEventView[] = (events ?? []).map((e) => ({
    id: e.id,
    partId: e.part_id,
    partTitle: titles.get(e.part_id) ?? "A part",
    kind: e.kind,
    actor: person(e.actor as CreatorRef),
    subject: person(e.subject as CreatorRef),
    detail: (e.detail ?? {}) as Record<string, unknown>,
    at: e.created_at,
  }));
  if (byArtifact.size) {
    const { data: versions } = await db
      .from("artifact_versions")
      .select("id, artifact_id, version_number, label, created_at, creators:creators!artifact_versions_created_by_creator_id_fkey(id, display_name, handle)")
      .in("artifact_id", [...byArtifact.keys()])
      .gt("version_number", 1)
      .order("created_at", { ascending: false })
      .limit(limit);
    for (const v of versions ?? []) {
      const part = byArtifact.get(v.artifact_id)!;
      out.push({ id: `v:${v.id}`, partId: part.id, partTitle: part.title, kind: "version", actor: person(v.creators as CreatorRef), subject: null, detail: { versionNumber: v.version_number, label: v.label }, at: v.created_at });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Add a part (the Room's owner or admins). */
export async function addPart(db: Db, creatorId: string, projectId: string, raw: unknown): Promise<string> {
  const input = partSchema.parse(raw);
  const { data: last } = await db.from("project_parts").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1).maybeSingle();
  const row = must(
    await db
      .from("project_parts")
      .insert({ project_id: projectId, title: input.title, kind: input.kind, artifact_type: input.artifactType ?? DEFAULT_ARTIFACT_TYPE[input.kind], position: (last?.position ?? -1) + 1, created_by: creatorId })
      .select("id")
      .single(),
  );
  return row.id;
}

/** The parts a template starts a Room with. */
export async function addTemplateParts(db: Db, creatorId: string, projectId: string, template: PartTemplateKey): Promise<void> {
  const t = PART_TEMPLATES[template];
  if (!t) throw new DomainError("validation", "Unknown template.");
  const { error } = await db.from("project_parts").insert(t.parts.map((p, i) => ({ project_id: projectId, title: p.title, kind: p.kind, artifact_type: p.artifactType, position: i, created_by: creatorId })));
  if (error) throw fromDbError(error);
}

export async function updatePart(db: Db, partId: string, raw: unknown): Promise<void> {
  const input = updatePartSchema.parse(raw);
  const patch: TablesUpdate<"project_parts"> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.artifactType !== undefined) patch.artifact_type = input.artifactType;
  if (input.position !== undefined) patch.position = input.position;
  const { data, error } = await db.from("project_parts").update(patch).eq("id", partId).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new DomainError("forbidden", "Only the Room's owner or admins can change a part.");
}

/** Remove a part. Its Creation, if any, stays with whoever made it. */
export async function deletePart(db: Db, partId: string): Promise<void> {
  const { data, error } = await db.from("project_parts").delete().eq("id", partId).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new DomainError("forbidden", "Only the Room's owner or admins can remove a part.");
}

type PartFn = "part_claim" | "part_invite" | "part_respond" | "part_leave" | "part_remove" | "part_set_final" | "part_attach";
/** What each refusal means, in the creator's words (the database's own messages never reach the client). */
const REFUSALS: Record<PartFn, Partial<Record<string, string>>> = {
  part_claim: { "42501": "Join the Room's crew first, or ask to be invited to this part.", "55000": "This part is final.", "23505": "You're already on this part." },
  part_invite: { "42501": "Only people on this part, or the Room's owner or admins, can invite.", "55000": "This part is final.", "23505": "They're already invited, or on this part.", "22023": "You're already here.", P0002: "We couldn't find that creator." },
  part_respond: { P0002: "That invitation isn't here any more." },
  part_leave: { P0002: "You're not on this part." },
  part_remove: { "42501": "Only the Room's owner or admins can take someone off a part.", P0002: "They're not on this part." },
  part_set_final: { "42501": "Only people on this part, or the Room's owner or admins, can mark it final.", "55000": "Start the part's Creation first." },
  part_attach: { "42501": "Only people on this part can start its Creation, and only with their own.", "23505": "This part already has a Creation." },
};
const rpc = async (db: Db, fn: PartFn, args: Record<string, unknown>) => {
  const { error } = await db.rpc(fn as never, args as never);
  if (!error) return;
  const e = fromDbError(error);
  const message = REFUSALS[fn][error.code ?? ""];
  throw message ? new DomainError(e.code === "internal" ? "conflict" : e.code, message, { cause: error }) : e;
};

/** Join a part (anyone in the Room's crew; the owner too). Two or more people may share a part. */
export const claimPart = (db: Db, partId: string) => rpc(db, "part_claim", { p_part: partId });
/** Invite someone to this part only — they need not join the Room. People on the part, and the Room's owner or admins, may invite. */
export async function inviteToPart(db: Db, partId: string, raw: unknown): Promise<void> {
  const input = partInviteSchema.parse(raw);
  await rpc(db, "part_invite", { p_part: partId, p_creator: input.creatorId, p_note: input.note ?? null });
}
export const respondToPart = (db: Db, partId: string, accept: boolean) => rpc(db, "part_respond", { p_part: partId, p_accept: accept });
export const leavePart = (db: Db, partId: string) => rpc(db, "part_leave", { p_part: partId });
export const removeFromPart = (db: Db, partId: string, creatorId: string) => rpc(db, "part_remove", { p_part: partId, p_creator: creatorId });
/** Final, or back into rounds — the people on the part decide (the Room's owner or admins may too). */
export const setPartFinal = (db: Db, partId: string, final: boolean) => rpc(db, "part_set_final", { p_part: partId, p_final: final });
/** Name the Creation a part produces: the caller's own, made just for it. Everyone else on the part becomes an editor of it. */
export const attachPartArtifact = (db: Db, partId: string, artifactId: string) => rpc(db, "part_attach", { p_part: partId, p_artifact: artifactId });

export interface PartInvite {
  partId: string;
  partTitle: string;
  projectId: string;
  projectTitle: string;
  invitedBy: string;
  note: string | null;
}
/** Parts the creator has been invited to and hasn't answered. */
export async function myPartInvites(db: Db, creatorId: string): Promise<PartInvite[]> {
  const { data, error } = await db
    .from("project_part_members")
    .select("part_id, invite_note, inviter:creators!project_part_members_invited_by_fkey(display_name), project_parts(id, title, project_id, projects(id, title))")
    .eq("creator_id", creatorId)
    .eq("status", "invited")
    .order("invited_at", { ascending: false })
    .limit(20);
  if (error) throw fromDbError(error);
  return (data ?? []).flatMap((m) => {
    const part = m.project_parts as { id: string; title: string; project_id: string; projects: { id: string; title: string } | null } | null;
    if (!part?.projects) return [];
    return [{ partId: part.id, partTitle: part.title, projectId: part.project_id, projectTitle: part.projects.title, invitedBy: (m.inviter as { display_name: string } | null)?.display_name ?? "Someone", note: m.invite_note }];
  });
}
