import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, TablesUpdate } from "@wonder/db";
import { z } from "zod";
import { DEFAULT_ARTIFACT_TYPE, PART_KINDS, PART_TEMPLATES, type MadeWith, type PartContext, type PartEventView, type PartKind, type PartStatus, type PartTemplateKey, type PartView } from "./parts-options";

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
  const madeWith = await latestMadeWith(db, rows.map((r) => r.id));
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
      madeWith: madeWith.get(r.id) ?? null,
    };
  });
}

/** Each part's latest "made with" (step 2): the other parts' versions when its newest version was saved. */
async function latestMadeWith(db: Db, partIds: string[]): Promise<Map<string, MadeWith[]>> {
  const out = new Map<string, MadeWith[]>();
  if (!partIds.length) return out;
  const { data } = await db.from("project_part_version_context").select("part_id, made_with, created_at").in("part_id", partIds).order("created_at", { ascending: false }).limit(partIds.length * 8);
  for (const row of data ?? []) if (!out.has(row.part_id)) out.set(row.part_id, madeWithOf(row.made_with));
  return out;
}
const madeWithOf = (raw: unknown): MadeWith[] =>
  Array.isArray(raw)
    ? raw.map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return { partId: String(o.partId ?? ""), title: String(o.title ?? "A part"), artifactId: typeof o.artifactId === "string" ? o.artifactId : null, versionId: typeof o.versionId === "string" ? o.versionId : null, versionNumber: typeof o.versionNumber === "number" ? o.versionNumber : null };
      })
    : [];

/**
 * A Creation's place in a Room (step 2), for its own page: which part it is, what its latest version was made with, and
 * which other parts moved on since. Null when the Creation isn't a part's.
 */
export async function partContextFor(db: Db, artifactId: string, viewerId: string): Promise<PartContext | null> {
  const { data: part } = await db.from("project_parts").select("id, project_id, title, kind, projects(title)").eq("artifact_id", artifactId).maybeSingle();
  if (!part) return null;
  const [{ data: others }, { data: ctx }] = await Promise.all([
    db.from("project_parts").select("id, title, kind, artifact_id, artifact_type").eq("project_id", part.project_id).neq("id", part.id).order("position").order("created_at"),
    db.from("project_part_version_context").select("version_id, made_with").eq("part_id", part.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const artifactIds = (others ?? []).map((o) => o.artifact_id).filter((x): x is string => !!x);
  const current = new Map<string, { creator_id: string; current_version_id: string | null }>();
  const numbers = new Map<string, number>();
  const versionIds = [...(ctx ? [ctx.version_id] : [])];
  if (artifactIds.length) {
    const { data: as } = await db.from("artifacts").select("id, creator_id, current_version_id").in("id", artifactIds);
    for (const a of as ?? []) current.set(a.id, a);
    versionIds.push(...(as ?? []).map((a) => a.current_version_id).filter((x): x is string => !!x));
  }
  if (versionIds.length) {
    const { data: vs } = await db.from("artifact_versions").select("id, version_number").in("id", versionIds);
    for (const v of vs ?? []) numbers.set(v.id, v.version_number);
  }
  const made = new Map(madeWithOf(ctx?.made_with).map((m) => [m.partId, m]));
  const sinceNumber = ctx ? numbers.get(ctx.version_id) : undefined;
  return {
    part: { id: part.id, title: part.title, kind: part.kind as PartKind },
    project: { id: part.project_id, title: (part.projects as { title: string } | null)?.title ?? "A Creative Room" },
    since: ctx && sinceNumber ? { versionId: ctx.version_id, number: sinceNumber } : null,
    others: (others ?? []).map((o) => {
      const a = o.artifact_id ? current.get(o.artifact_id) : undefined;
      const cur = a?.current_version_id ? { versionId: a.current_version_id, number: numbers.get(a.current_version_id) ?? 1 } : null;
      const m = made.get(o.id);
      const mw = m?.versionId ? { versionId: m.versionId, number: m.versionNumber ?? 1 } : null;
      return {
        partId: o.id,
        title: o.title,
        kind: o.kind as PartKind,
        artifactId: o.artifact_id,
        artifactType: o.artifact_id ? o.artifact_type : null,
        current: cur,
        madeWith: mw,
        movedOn: !!ctx && !!cur && cur.versionId !== (mw?.versionId ?? null),
        canSuggest: o.kind === "writing" && !!cur && !!a && a.creator_id !== viewerId,
      };
    }),
  };
}

export interface PartWords {
  artifactId: string;
  title: string;
  current: { id: string; number: number; content: string };
  /** The version asked for (what this part was made with), when it still exists. */
  from: { id: string; number: number; content: string } | null;
}
/** A part's words as they stand, and (optionally) as they stood at an earlier version, for "what changed" and a suggestion. */
export async function partWords(db: Db, partId: string, fromVersionId?: string | null): Promise<PartWords> {
  const { data: part } = await db.from("project_parts").select("id, title, artifact_id").eq("id", partId).maybeSingle();
  if (!part?.artifact_id) throw new DomainError("not_found", "That part hasn't been started.");
  const { data: a } = await db.from("artifacts").select("id, current_version_id").eq("id", part.artifact_id).maybeSingle();
  if (!a?.current_version_id) throw new DomainError("not_found", "That part has no words yet.");
  const ids = [a.current_version_id, ...(fromVersionId && fromVersionId !== a.current_version_id ? [fromVersionId] : [])];
  const { data: vs, error } = await db.from("artifact_versions").select("id, version_number, content").eq("artifact_id", a.id).in("id", ids);
  if (error) throw fromDbError(error);
  const pick = (id: string) => {
    const v = (vs ?? []).find((x) => x.id === id);
    return v ? { id: v.id, number: v.version_number, content: v.content } : null;
  };
  const current = pick(a.current_version_id);
  if (!current) throw new DomainError("not_found", "That part's words aren't yours to read.");
  return { artifactId: a.id, title: part.title, current, from: fromVersionId ? (fromVersionId === current.id ? current : pick(fromVersionId)) : null };
}

export const suggestSchema = z.object({ content: z.string().max(500_000), summary: z.string().trim().min(1, "Say what you'd change, in a line.").max(500) });
/** Suggest a change to another part (anyone making the work): a proposal its people accept or decline. Returns the proposal id. */
export async function suggestToPart(db: Db, partId: string, raw: unknown): Promise<string> {
  const p = suggestSchema.parse(raw);
  const { data, error } = await db.rpc("part_suggest", { p_part: partId, p_content: p.content, p_summary: p.summary });
  if (error) {
    const e = fromDbError(error);
    const message = REFUSALS.part_suggest[error.code ?? ""];
    throw message ? new DomainError(e.code === "internal" ? "conflict" : e.code, message, { cause: error }) : e;
  }
  if (typeof data !== "string") throw new DomainError("internal", "The suggestion wasn't sent. Try again.");
  return data;
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
    const { data: ctx } = versions?.length ? await db.from("project_part_version_context").select("version_id, made_with").in("version_id", versions.map((v) => v.id)) : { data: [] };
    const madeWith = new Map((ctx ?? []).map((c) => [c.version_id, madeWithOf(c.made_with).filter((m) => m.versionNumber)]));
    for (const v of versions ?? []) {
      const part = byArtifact.get(v.artifact_id)!;
      out.push({ id: `v:${v.id}`, partId: part.id, partTitle: part.title, kind: "version", actor: person(v.creators as CreatorRef), subject: null, detail: { versionNumber: v.version_number, label: v.label, madeWith: (madeWith.get(v.id) ?? []).map((m) => `${m.title} v${m.versionNumber}`) }, at: v.created_at });
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

type PartFn = "part_claim" | "part_invite" | "part_respond" | "part_leave" | "part_remove" | "part_set_final" | "part_attach" | "part_suggest";
/** What each refusal means, in the creator's words (the database's own messages never reach the client). */
const REFUSALS: Record<PartFn, Partial<Record<string, string>>> = {
  part_claim: { "42501": "Join the Room's crew first, or ask to be invited to this part.", "55000": "This part is final.", "23505": "You're already on this part." },
  part_invite: { "42501": "Only people on this part, or the Room's owner or admins, can invite.", "55000": "This part is final.", "23505": "They're already invited, or on this part.", "22023": "You're already here.", P0002: "We couldn't find that creator." },
  part_respond: { P0002: "That invitation isn't here any more." },
  part_leave: { P0002: "You're not on this part." },
  part_remove: { "42501": "Only the Room's owner or admins can take someone off a part.", P0002: "They're not on this part." },
  part_set_final: { "42501": "Only people on this part, or the Room's owner or admins, can mark it final.", "55000": "Start the part's Creation first." },
  part_attach: { "42501": "Only people on this part can start its Creation, and only with their own.", "23505": "This part already has a Creation." },
  part_suggest: { "42501": "Only people making this work can suggest a change.", "55000": "That part has no words yet.", "22023": "Those words are your own — just write.", P0002: "We couldn't find that part." },
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
