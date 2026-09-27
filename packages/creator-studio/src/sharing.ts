import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";

/**
 * Sharing without publishing (P0.1-09): private links and shares with named creators. Shared content is
 * served by security-definer functions that return only the piece's title and text (never source material,
 * lineage or rights details). Link tokens are random, shown once, and stored only as SHA-256 hashes.
 */
export type ArtifactShare = Tables<"artifact_shares">;

export interface SharedPiece {
  shareId: string;
  kind: "link" | "creator";
  artifactId: string;
  title: string;
  artifactType: string;
  category: string;
  versionNumber: number | null;
  versionCreatedAt: string | null;
  pinned: boolean;
  content: string;
  creatorName: string;
  creatorHandle: string | null;
  allowDownload: boolean;
  allowEmbed: boolean;
  expiresAt: string | null;
  sharedAt: string;
}

const expires = z.string().datetime({ offset: true }).nullish().refine((v) => !v || new Date(v).getTime() > Date.now(), "Choose a time in the future.");

export const shareLinkSchema = z.object({
  versionId: z.string().uuid().nullish(),
  allowDownload: z.boolean().default(false),
  allowEmbed: z.boolean().default(false),
  label: z.string().trim().min(1).max(80).nullish(),
  expiresAt: expires,
});

export const shareWithCreatorSchema = z.object({
  handle: z.string().trim().transform((h) => h.replace(/^@/, "").toLowerCase()).pipe(z.string().regex(/^[a-z0-9_]{3,30}$/, "Enter a creator's @handle.")),
  versionId: z.string().uuid().nullish(),
  allowDownload: z.boolean().default(false),
  expiresAt: expires,
});

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createShareLink(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<{ share: ArtifactShare; token: string }> {
  const input = shareLinkSchema.parse(raw);
  const token = randomToken();
  const share = must(
    await db
      .from("artifact_shares")
      .insert({
        artifact_id: artifactId,
        creator_id: creatorId,
        kind: "link",
        token_hash: await hashShareToken(token),
        version_id: input.versionId ?? null,
        allow_download: input.allowDownload,
        allow_embed: input.allowEmbed,
        label: input.label ?? null,
        expires_at: input.expiresAt ?? null,
      })
      .select("*")
      .single(),
  );
  return { share, token };
}

export async function shareWithCreator(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<ArtifactShare> {
  const input = shareWithCreatorSchema.parse(raw);
  const { data: recipient } = await db.from("creators").select("id").eq("handle", input.handle).maybeSingle();
  if (!recipient) throw new DomainError("not_found", `We couldn't find @${input.handle}.`);
  if (recipient.id === creatorId) throw new DomainError("validation", "That's you. Pick someone else to share with.");
  const res = await db
    .from("artifact_shares")
    .insert({
      artifact_id: artifactId,
      creator_id: creatorId,
      kind: "creator",
      recipient_creator_id: recipient.id,
      version_id: input.versionId ?? null,
      allow_download: input.allowDownload,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();
  if (res.error?.code === "23505") throw new DomainError("conflict", `This Creation is already shared with @${input.handle}.`);
  if (res.error?.code === "42501") throw new DomainError("forbidden", `You can't share with @${input.handle}.`);
  if (res.error) throw fromDbError(res.error);
  return res.data;
}

export type ShareState = "live" | "expired" | "revoked";
export interface ShareView {
  id: string;
  kind: "link" | "creator";
  state: ShareState;
  recipient: { id: string; name: string; handle: string | null } | null;
  label: string | null;
  versionNumber: number | null;
  allowDownload: boolean;
  allowEmbed: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
}

export async function listShares(db: Db, artifactId: string): Promise<ShareView[]> {
  const { data, error } = await db
    .from("artifact_shares")
    .select("*, recipient:creators!artifact_shares_recipient_creator_id_fkey(id, display_name, handle), version:artifact_versions(version_number)")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw fromDbError(error);
  const now = Date.now();
  return (data ?? []).map((s) => {
    const r = s.recipient as { id: string; display_name: string; handle: string | null } | null;
    return {
      id: s.id,
      kind: s.kind as "link" | "creator",
      state: s.revoked_at ? "revoked" : s.expires_at && new Date(s.expires_at).getTime() <= now ? "expired" : "live",
      recipient: r ? { id: r.id, name: r.display_name, handle: r.handle } : null,
      label: s.label,
      versionNumber: (s.version as { version_number: number } | null)?.version_number ?? null,
      allowDownload: s.allow_download,
      allowEmbed: s.allow_embed,
      expiresAt: s.expires_at,
      revokedAt: s.revoked_at,
      lastAccessedAt: s.last_accessed_at,
      createdAt: s.created_at,
    };
  });
}

export async function revokeShare(db: Db, shareId: string): Promise<ArtifactShare> {
  const res = await db.rpc("revoke_artifact_share", { p_share: shareId });
  if (res.error?.code === "P0002") throw new DomainError("not_found", "We couldn't find that share.");
  if (res.error?.code === "55000") throw new DomainError("conflict", "This share was already turned off.");
  if (res.error) throw fromDbError(res.error);
  return res.data as ArtifactShare;
}

/** A private link's piece, or null when the link is unknown, revoked or expired (indistinguishably). */
export async function openShareLink(db: Db, token: string): Promise<SharedPiece | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const res = await db.rpc("open_share_link", { p_token: token });
  if (res.error) throw fromDbError(res.error);
  return (res.data as SharedPiece | null) ?? null;
}

export async function openCreatorShare(db: Db, shareId: string): Promise<SharedPiece | null> {
  const res = await db.rpc("open_creator_share", { p_share: shareId });
  if (res.error) throw fromDbError(res.error);
  return (res.data as SharedPiece | null) ?? null;
}

export async function sharedWithMe(db: Db) {
  const res = await db.rpc("shared_with_me");
  if (res.error) throw fromDbError(res.error);
  return (res.data ?? []).map((r) => ({ shareId: r.share_id, title: r.title, artifactType: r.artifact_type, creatorName: r.creator_name, sharedAt: r.shared_at, expiresAt: r.expires_at }));
}
