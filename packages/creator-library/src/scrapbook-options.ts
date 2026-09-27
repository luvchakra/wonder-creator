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
