import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

/**
 * Collaborative editing (P1-06). Collaborators comment, propose changes or edit, by access level. Every change is a
 * new version credited to the person who wrote it; proposals are accepted or declined by the owner; stale edits are
 * refused and stale proposals need the owner's explicit confirmation. The database enforces all of it.
 */

export const COLLABORATOR_ACCESS = ["comment", "propose", "edit"] as const;
export type CollaboratorAccess = (typeof COLLABORATOR_ACCESS)[number];
export type ArtifactAccess = "owner" | CollaboratorAccess;

export const collaboratorSchema = z.object({
  creatorId: z.string().uuid(),
  role: z.string().trim().min(1, "Say what they bring (e.g. Editor).").max(60),
  access: z.enum(COLLABORATOR_ACCESS).default("propose"),
});

export const proposalSchema = z.object({
  baseVersionId: z.string().uuid(),
  content: z.string().max(500000),
  summary: z.string().trim().min(1, "Say what you changed.").max(500),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first.").max(4000),
  versionId: z.string().uuid().nullish(),
  quote: z.string().trim().max(500).nullish(),
});

function collabError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("stale proposal")) return new DomainError("conflict", "The Creation has changed since this was proposed. Compare it with the current version, then confirm to accept anyway.");
  if (msg.includes("stale edit")) return new DomainError("conflict", "Someone saved a newer version while you were editing. Your text is still here — copy it, reload, and apply it to the latest version.");
  if (msg.includes("already decided")) return new DomainError("conflict", "That proposal has already been decided.");
  if (msg.includes("proposal not found")) return new DomainError("not_found", "We couldn't find that proposal.");
  if (msg.includes("no changes")) return new DomainError("validation", "There are no changes to save.");
  if (msg.includes("archived")) return new DomainError("conflict", "This Creation is archived.");
  if (msg.includes("not allowed") || e.code === "42501") return new DomainError("forbidden", "You don't have that access to this Creation.");
  return fromDbError(e);
}

export async function artifactAccess(db: Db, artifactId: string): Promise<ArtifactAccess | null> {
  const { data, error } = await db.rpc("artifact_access_of", { p_artifact: artifactId });
  if (error) throw fromDbError(error);
  return (data as ArtifactAccess | null) ?? null;
}

type Named = { display_name: string; handle: string | null } | null;

export async function getCollaboration(db: Db, viewerId: string, artifactId: string) {
  const access = await artifactAccess(db, artifactId);
  if (!access) return null;
  const artifact = must(await db.from("artifacts").select("id, title, artifact_type, creator_id, current_version_id, status, creators!artifacts_creator_id_fkey(display_name, handle)").eq("id", artifactId).maybeSingle(), "We couldn't find that piece.");
  const [collabs, versions, proposals, comments] = await Promise.all([
    db.from("artifact_contributors").select("contributor_creator_id, role, access, created_at, creators!artifact_contributors_contributor_creator_id_fkey(display_name, handle)").eq("artifact_id", artifactId).order("created_at"),
    db
      .from("artifact_versions")
      .select("id, version_number, label, change_summary, author_kind, created_by_creator_id, created_at, content, creators!artifact_versions_created_by_creator_id_fkey(display_name)")
      .eq("artifact_id", artifactId)
      .order("version_number", { ascending: false })
      .limit(100),
    db.from("artifact_change_proposals").select("*, creators!artifact_change_proposals_creator_id_fkey(display_name)").eq("artifact_id", artifactId).order("created_at", { ascending: false }).limit(100),
    db.from("artifact_comments").select("*, creators!artifact_comments_creator_id_fkey(display_name)").eq("artifact_id", artifactId).order("created_at").limit(500),
  ]);
  for (const r of [collabs, versions, proposals, comments]) if (r.error) throw fromDbError(r.error);
  const numberOf = new Map((versions.data ?? []).map((v) => [v.id, v.version_number]));
  const owner = artifact.creators as Named;
  const current = (versions.data ?? []).find((v) => v.id === artifact.current_version_id) ?? null;
  return {
    access,
    artifact: { id: artifact.id, title: artifact.title, type: artifact.artifact_type, status: artifact.status, ownerId: artifact.creator_id, ownerName: owner?.display_name ?? "Creator" },
    current: current ? { id: current.id, number: current.version_number, content: current.content } : null,
    collaborators: (collabs.data ?? []).map((c) => ({
      creatorId: c.contributor_creator_id,
      name: (c.creators as Named)?.display_name ?? "Creator",
      handle: (c.creators as Named)?.handle ?? null,
      role: c.role,
      access: c.access as CollaboratorAccess,
      since: c.created_at,
    })),
    // Who wrote each version — never flattened: people by name, AI marked as AI.
    versions: (versions.data ?? []).map((v) => ({
      id: v.id,
      number: v.version_number,
      label: v.label,
      summary: v.change_summary,
      authorKind: v.author_kind as "creator" | "ai" | "restore",
      author: v.author_kind === "ai" ? "CreativeMind (AI)" : ((v.creators as { display_name: string } | null)?.display_name ?? "Someone"),
      authorId: v.created_by_creator_id,
      at: v.created_at,
    })),
    proposals: (proposals.data ?? []).map((p) => ({
      id: p.id,
      status: p.status as "open" | "accepted" | "declined" | "withdrawn",
      summary: p.summary,
      content: p.content,
      proposer: { id: p.creator_id, name: (p.creators as { display_name: string } | null)?.display_name ?? "Someone" },
      mine: p.creator_id === viewerId,
      baseVersion: { id: p.base_version_id, number: numberOf.get(p.base_version_id) ?? null },
      stale: p.status === "open" && p.base_version_id !== artifact.current_version_id,
      decisionNote: p.decision_note,
      resultingVersion: p.resulting_version_id ? (numberOf.get(p.resulting_version_id) ?? null) : null,
      at: p.created_at,
      decidedAt: p.decided_at,
    })),
    comments: (comments.data ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      quote: c.quote,
      versionNumber: c.version_id ? (numberOf.get(c.version_id) ?? null) : null,
      author: { id: c.creator_id, name: (c.creators as { display_name: string } | null)?.display_name ?? "Someone" },
      mine: c.creator_id === viewerId,
      resolved: !!c.resolved_at,
      at: c.created_at,
    })),
  };
}

export async function addCollaborator(db: Db, ownerId: string, artifactId: string, raw: unknown) {
  const c = collaboratorSchema.parse(raw);
  if (c.creatorId === ownerId) throw new DomainError("validation", "You already own this Creation.");
  const { data: reachable } = await db.rpc("creator_reachable", { p_creator: c.creatorId });
  if (!reachable) throw new DomainError("not_found", "We couldn't find that creator.");
  const res = await db.from("artifact_contributors").insert({ artifact_id: artifactId, contributor_creator_id: c.creatorId, role: c.role, access: c.access, added_by_creator_id: ownerId });
  if (res.error?.code === "23505") throw new DomainError("conflict", "They're already a collaborator.");
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only the Creation's owner can add collaborators.");
  if (res.error) throw fromDbError(res.error);
}

export async function updateCollaborator(db: Db, ownerId: string, artifactId: string, raw: unknown) {
  const c = collaboratorSchema.partial({ role: true, access: true }).parse(raw);
  const res = await db
    .from("artifact_contributors")
    .update({ ...(c.role ? { role: c.role } : {}), ...(c.access ? { access: c.access } : {}), added_by_creator_id: ownerId })
    .eq("artifact_id", artifactId)
    .eq("contributor_creator_id", c.creatorId)
    .select("artifact_id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "Only the Creation's owner can change collaborators.");
}

/** The owner removes someone, or a collaborator leaves. Their versions and comments stay credited to them. */
export async function removeCollaborator(db: Db, artifactId: string, creatorId: string) {
  const res = await db.from("artifact_contributors").delete().eq("artifact_id", artifactId).eq("contributor_creator_id", creatorId).select("artifact_id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "You can't remove that collaborator.");
}

export async function proposeChange(db: Db, creatorId: string, artifactId: string, raw: unknown) {
  const p = proposalSchema.parse(raw);
  const cur = await db.from("artifacts").select("current_version_id").eq("id", artifactId).maybeSingle();
  if (cur.data && cur.data.current_version_id !== p.baseVersionId) throw new DomainError("conflict", "The Creation changed while you were editing. Your text is still here — copy it, reload, and propose it on the latest version.");
  const res = await db.from("artifact_change_proposals").insert({ artifact_id: artifactId, creator_id: creatorId, base_version_id: p.baseVersionId, content: p.content, summary: p.summary }).select("id").single();
  if (res.error) throw collabError(res.error);
  return res.data.id;
}

export async function acceptProposal(db: Db, proposalId: string, confirmStale = false) {
  const { data, error } = await db.rpc("accept_artifact_proposal", { p_proposal: proposalId, p_confirm_stale: confirmStale });
  if (error) throw collabError(error);
  return data as { id: string; version_number: number };
}

export async function declineProposal(db: Db, proposalId: string, note?: string) {
  const { error } = await db.rpc("decline_artifact_proposal", { p_proposal: proposalId, p_note: note?.trim().slice(0, 500) || undefined });
  if (error) throw collabError(error);
}

export async function withdrawProposal(db: Db, proposalId: string) {
  const { error } = await db.rpc("withdraw_artifact_proposal", { p_proposal: proposalId });
  if (error) throw collabError(error);
}

/** A collaborator with edit access saves a new version, credited to them. Refused if the base isn't current. */
export async function collaboratorSave(db: Db, artifactId: string, raw: unknown) {
  const p = proposalSchema.extend({ summary: z.string().trim().max(500).default("") }).parse(raw);
  const { data, error } = await db.rpc("collaborator_save_version", { p_artifact: artifactId, p_base_version: p.baseVersionId, p_content: p.content, p_summary: p.summary || undefined });
  if (error) throw collabError(error);
  return data as { id: string; version_number: number };
}

export async function addArtifactComment(db: Db, creatorId: string, artifactId: string, raw: unknown) {
  const c = commentSchema.parse(raw);
  const res = await db.from("artifact_comments").insert({ artifact_id: artifactId, creator_id: creatorId, body: c.body, version_id: c.versionId ?? null, quote: c.quote || null }).select("id").single();
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only the owner and collaborators can comment here.");
  return must(res).id;
}

export async function resolveArtifactComment(db: Db, viewerId: string, commentId: string, resolved: boolean) {
  const res = await db.from("artifact_comments").update({ resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? viewerId : null }).eq("id", commentId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "The owner or the comment's author can resolve it.");
}

export async function deleteArtifactComment(db: Db, commentId: string) {
  const res = await db.from("artifact_comments").delete().eq("id", commentId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "You can remove your own comments.");
}
