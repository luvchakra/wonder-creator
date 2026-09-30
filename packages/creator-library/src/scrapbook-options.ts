/** Scrapbook choices and shapes (client-safe). */
export const SCRAPBOOK_KINDS = [
  { value: "thought", label: "Thought" },
  { value: "reflection", label: "Reflection" },
  { value: "sketch", label: "Sketch" },
  { value: "fragment", label: "Fragment" },
] as const;

export const REPLY_POLICIES = [
  { value: "anyone", label: "Anyone who can see it" },
  { value: "following", label: "Only people I follow" },
  { value: "none", label: "No replies (read-only)" },
] as const;

export interface ScrapbookAttachment {
  id: string;
  kind: "material" | "artifact";
  itemId: string;
  title: string;
  itemType: string;
  excerpt: string | null;
  mimeType: string | null;
  fileUrl: string | null;
  canOpen: boolean;
}

export interface ScrapbookPost {
  id: string;
  kind: string;
  body: string;
  visibility: "public" | "private";
  replyPolicy: "anyone" | "following" | "none";
  createdAt: string;
  author: { id: string; name: string; handle: string | null };
  mine: boolean;
  attachments: ScrapbookAttachment[];
}

export type MomentFace = "note" | "photo" | "audio" | "quote" | "sketch" | "inspiration" | "link" | "video" | "document";

/**
 * How a Scrapbook entry shows among a Profile's Moments (profile board, 30 Sep 2026). Read from what it actually holds —
 * its first attachment, else its words — never guessed from anything else.
 */
export function momentFace(post: Pick<ScrapbookPost, "kind" | "body" | "attachments">): { face: MomentFace; label: string } {
  const a = post.attachments[0];
  const t = a?.itemType ?? "";
  const mime = a?.mimeType ?? "";
  if (t === "sketch" || (post.kind === "sketch" && (t === "image" || mime.startsWith("image/")))) return { face: "sketch", label: "Sketch" };
  if (t === "inspiration") return { face: "inspiration", label: "Inspiration" };
  if (t === "image" || mime.startsWith("image/")) return { face: "photo", label: "Photo" };
  if (t === "voice" || t === "audio" || mime.startsWith("audio/")) return { face: "audio", label: "Audio note" };
  if (t === "video" || mime.startsWith("video/")) return { face: "video", label: "Video" };
  if (t === "url" || t === "reference") return { face: "link", label: "Link" };
  if (t === "pdf" || t === "document") return { face: "document", label: "Document" };
  if (/^\s*["“'‘][\s\S]+["”'’]/.test(post.body)) return { face: "quote", label: "Quote" };
  if (post.kind === "sketch") return { face: "sketch", label: "Sketch" };
  return { face: "note", label: post.kind === "reflection" ? "Reflection" : "Note" };
}
