import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { MATERIAL_BUCKET } from "./materials";
import type { ScrapbookAttachment, ScrapbookPost } from "./scrapbook-options";

export * from "./scrapbook-options";

/**
 * Scrapbook (P0.1-14): reflective fragments with replies. No likes, counts, popularity or trending; feeds are
 * chronological. Who can see a post and who can reply are the creator's choice, enforced by RLS.
 */
export const postSchema = z
  .object({
    kind: z.enum(["thought", "reflection", "sketch", "fragment"]).default("thought"),
    body: z.string().trim().max(5000).default(""),
    visibility: z.enum(["public", "private"]).default("public"),
    replyPolicy: z.enum(["anyone", "following", "none"]).default("anyone"),
    materialIds: z.array(z.string().uuid()).max(6).default([]),
    artifactIds: z.array(z.string().uuid()).max(6).default([]),
  })
  .refine((p) => p.body.length > 0 || p.materialIds.length + p.artifactIds.length > 0, { message: "Write something or attach something.", path: ["body"] });

export const postSettingsSchema = z.object({
  visibility: z.enum(["public", "private"]).optional(),
  replyPolicy: z.enum(["anyone", "following", "none"]).optional(),
});

export const replySchema = z.object({ body: z.string().trim().min(1, "Write a reply first.").max(2000) });

export async function createPost(db: Db, creatorId: string, raw: unknown): Promise<string> {
  const p = postSchema.parse(raw);
  const post = must(
    await db.from("scrapbook_posts").insert({ creator_id: creatorId, kind: p.kind, body: p.body, visibility: p.visibility, reply_policy: p.replyPolicy }).select("id").single(),
  );
  const rows = [
    ...p.materialIds.map((id, i) => ({ post_id: post.id, creator_id: creatorId, material_id: id, position: i })),
    ...p.artifactIds.map((id, i) => ({ post_id: post.id, creator_id: creatorId, artifact_id: id, position: p.materialIds.length + i })),
  ];
  if (rows.length) {
    const res = await db.from("scrapbook_attachments").insert(rows);
    if (res.error) {
      await db.from("scrapbook_posts").delete().eq("id", post.id);
      throw res.error.code === "42501" ? new DomainError("validation", "You can attach only your own material and pieces (and only files that passed checks).") : fromDbError(res.error);
    }
  }
  return post.id;
}

export async function updatePostSettings(db: Db, postId: string, raw: unknown) {
  const s = postSettingsSchema.parse(raw);
  const res = await db
    .from("scrapbook_posts")
    .update({ ...(s.visibility ? { visibility: s.visibility } : {}), ...(s.replyPolicy ? { reply_policy: s.replyPolicy } : {}) })
    .eq("id", postId)
    .select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that post.");
}

export async function deletePost(db: Db, postId: string) {
  const res = await db.from("scrapbook_posts").delete().eq("id", postId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that post.");
}

type FeedScope = { scope: "everyone" } | { scope: "following"; creatorId: string } | { scope: "creator"; authorId: string } | { scope: "post"; postId: string };

/** Chronological only. Never ranked by popularity (there is nothing to rank by). */
export async function listPosts(db: Db, viewerId: string, s: FeedScope, opts: { before?: string; limit?: number } = {}): Promise<{ posts: ScrapbookPost[]; nextBefore: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 50);
  let q = db.from("scrapbook_posts").select("id, creator_id, kind, body, visibility, reply_policy, created_at, creators(id, display_name, handle)").order("created_at", { ascending: false }).limit(limit);
  if (s.scope === "post") q = q.eq("id", s.postId);
  if (s.scope === "creator") q = q.eq("creator_id", s.authorId);
  // Public posts from everyone you can see, plus your own (including private ones).
  if (s.scope === "everyone") q = q.or(`visibility.eq.public,creator_id.eq.${viewerId}`);
  if (s.scope === "following") {
    const { data: f } = await db.from("creator_follows").select("followed_creator_id").eq("follower_creator_id", s.creatorId).limit(500);
    q = q.in("creator_id", [s.creatorId, ...(f ?? []).map((x) => x.followed_creator_id)]);
  }
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const posts = data ?? [];
  const attachments = await attachmentDetails(db, posts.map((p) => p.id));
  return {
    posts: posts.map((p) => {
      const c = p.creators as { id: string; display_name: string; handle: string | null } | null;
      return {
        id: p.id,
        kind: p.kind,
        body: p.body,
        visibility: p.visibility as "public" | "private",
        replyPolicy: p.reply_policy as ScrapbookPost["replyPolicy"],
        createdAt: p.created_at,
        author: { id: p.creator_id, name: c?.display_name ?? "Creator", handle: c?.handle ?? null },
        mine: p.creator_id === viewerId,
        attachments: attachments.filter((a) => a.postId === p.id).map(({ postId: _p, ...a }) => a),
      };
    }),
    nextBefore: posts.length === limit ? posts[posts.length - 1].created_at : null,
  };
}

async function attachmentDetails(db: Db, postIds: string[]): Promise<Array<ScrapbookAttachment & { postId: string }>> {
  if (!postIds.length) return [];
  const { data, error } = await db.rpc("scrapbook_attachment_details", { p_posts: postIds });
  if (error) throw fromDbError(error);
  const rows = data ?? [];
  // Files attached to a post the viewer can see are readable to them (storage policy), so they sign their own URLs.
  const paths = [...new Set(rows.map((r) => r.file_path).filter((x): x is string => !!x))];
  const signed = paths.length ? (await db.storage.from(MATERIAL_BUCKET).createSignedUrls(paths, 600)).data ?? [] : [];
  const url = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    postId: r.post_id,
    id: r.attachment_id,
    kind: r.kind as "material" | "artifact",
    itemId: r.item_id,
    title: r.title,
    itemType: r.item_type,
    excerpt: r.excerpt || null,
    mimeType: r.mime_type,
    fileUrl: r.file_path ? (url.get(r.file_path) ?? null) : null,
    canOpen: r.can_open,
  }));
}

export async function getPost(db: Db, viewerId: string, postId: string) {
  const { posts } = await listPosts(db, viewerId, { scope: "post", postId });
  const post = posts[0];
  if (!post) return null;
  const [replies, canReply] = await Promise.all([
    db.from("scrapbook_replies").select("id, creator_id, body, created_at, creators(id, display_name, handle)").eq("post_id", postId).order("created_at").limit(200),
    db.rpc("scrapbook_can_reply", { p_post: postId }),
  ]);
  if (replies.error) throw fromDbError(replies.error);
  return {
    post,
    canReply: !!canReply.data,
    replies: (replies.data ?? []).map((r) => {
      const c = r.creators as { id: string; display_name: string; handle: string | null } | null;
      return { id: r.id, body: r.body, createdAt: r.created_at, author: { id: r.creator_id, name: c?.display_name ?? "Creator", handle: c?.handle ?? null }, mine: r.creator_id === viewerId, canRemove: r.creator_id === viewerId || post.mine };
    }),
  };
}

export async function replyToPost(db: Db, creatorId: string, postId: string, raw: unknown) {
  const { body } = replySchema.parse(raw);
  const res = await db.from("scrapbook_replies").insert({ post_id: postId, creator_id: creatorId, body }).select("id").single();
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Replies to this post are limited by its creator.");
  if (res.error) throw fromDbError(res.error);
  return res.data;
}

export async function deleteReply(db: Db, replyId: string) {
  const res = await db.from("scrapbook_replies").delete().eq("id", replyId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that reply.");
}
