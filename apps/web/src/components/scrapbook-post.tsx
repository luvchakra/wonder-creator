"use client";
import type { ScrapbookPost } from "@wonder/creator-library";
import { Avatar, Badge } from "@wonder/ui";
import { FileText, Lock } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "./client-time";

const KIND: Record<string, string> = { thought: "Thought", reflection: "Reflection", sketch: "Sketch", fragment: "Fragment" };

/** A Scrapbook post: the fragment first; who, when and privacy after. No engagement numbers. */
export function ScrapbookPostCard({ post, linkToDetail = true }: { post: ScrapbookPost; linkToDetail?: boolean }) {
  return (
    <article className="rounded-2xl border border-border-soft bg-surface p-4" aria-label={`${KIND[post.kind] ?? "Post"} by ${post.author.name}`}>
      {post.body ? <p className="whitespace-pre-wrap font-display text-[17px] leading-relaxed text-ink">{post.body}</p> : null}
      {post.attachments.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {post.attachments.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-xl border border-border-soft">
              {a.fileUrl && a.mimeType?.startsWith("image/") ? (
                // Signed, short-lived URL for a file the author attached to this post.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.fileUrl} alt={a.title} className="aspect-[4/3] w-full object-cover" />
              ) : null}
              <div className="flex items-start gap-2 p-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0">
                  {a.canOpen ? (
                    <Link href={a.kind === "artifact" ? `/creations/${a.itemId}` : `/materials/${a.itemId}`} className="text-sm font-medium text-accent-ink hover:underline">
                      {a.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-ink">{a.title}</p>
                  )}
                  {a.excerpt ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-muted">{a.excerpt}</p> : null}
                  {a.fileUrl && !a.mimeType?.startsWith("image/") ? (
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-accent-ink hover:underline">
                      Open the file
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <Avatar name={post.author.name} size={24} />
          {post.author.handle ? (
            <Link href={`/creators/${post.author.handle}`} className="hover:underline">
              {post.mine ? "You" : post.author.name}
            </Link>
          ) : (
            <span>{post.mine ? "You" : post.author.name}</span>
          )}
        </span>
        <Badge>{KIND[post.kind] ?? "Post"}</Badge>
        <RelativeTime iso={post.createdAt} />
        {post.visibility === "private" ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3.5" aria-hidden /> Only you
          </span>
        ) : null}
        {post.replyPolicy === "none" ? <span>Replies off</span> : null}
        {linkToDetail ? (
          <Link href={`/scrapbook/${post.id}`} className="ml-auto inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
            {post.replyPolicy === "none" ? "Open" : "Open and reply"}
          </Link>
        ) : null}
      </footer>
    </article>
  );
}
