"use client";
import type { ScrapbookPost } from "@wonder/creator-library/scrapbook-options";
import { Avatar, cn } from "@wonder/ui";
import { ChevronDown, ChevronRight, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LocalTime, RelativeTime } from "@/components/client-time";

const KIND: Record<string, string> = { thought: "Thought", reflection: "Reflection", sketch: "Sketch", fragment: "Fragment" };

/**
 * The Scrapbook rows on Home (owner, 3 Oct 2026: "give a down chevron for each scrapbook entry, expand the entry in
 * context, show full details… only one expanded entry at a time, allow to collapse all"). Each row opens in place to the
 * whole scrap — every word, its pictures and attachments, who and when, and a way to the full page to reply. Opening one
 * closes the other; "Collapse" closes it. Nothing animates beyond the chevron turning, and not even that with reduced
 * motion.
 */
export function ScrapbookRows({ posts, avatars }: { posts: ScrapbookPost[]; avatars: Record<string, string> }) {
  const [open, toggle] = useState<string | null>(null);
  return (
    <>
      <ul aria-label="Last written in the Scrapbook" className="divide-y divide-border-soft">
        {posts.map((p) => {
          const text = p.body.trim() || p.attachments[0]?.title || "A fragment";
          const who = p.mine ? "You" : p.author.name.split(" ")[0];
          const expanded = open === p.id;
          return (
            <li key={p.id} className={cn(expanded && "bg-surface-muted/60")}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`scrap-${p.id}`}
                onClick={() => toggle(expanded ? null : p.id)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-muted"
              >
                <Avatar name={p.author.name} src={avatars[p.author.id]} size={24} />
                <span className="min-w-0 flex-1 truncate font-display text-[15px] italic leading-snug text-ink">{text}</span>
                <span className="shrink-0 text-[11.5px] text-ink-subtle">
                  {who} · <RelativeTime iso={p.createdAt} />
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-ink-subtle transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
              </button>
              {expanded ? <ScrapDetail id={`scrap-${p.id}`} post={p} /> : null}
            </li>
          );
        })}
      </ul>
      {open ? (
        <button type="button" onClick={() => toggle(null)} className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-ink-muted hover:bg-surface-muted">
          <span className="min-w-0 flex-1">Collapse</span>
          <ChevronDown className="size-4 shrink-0 rotate-180" aria-hidden />
        </button>
      ) : null}
    </>
  );
}

function ScrapDetail({ id, post }: { id: string; post: ScrapbookPost }) {
  const images = post.attachments.filter((a) => a.fileUrl && a.mimeType?.startsWith("image/"));
  const others = post.attachments.filter((a) => !images.includes(a));
  return (
    <div id={id} className="space-y-2.5 px-3 pb-3 pl-[2.75rem]">
      {post.body.trim() ? <p className="whitespace-pre-wrap break-words font-display text-[16px] leading-relaxed text-ink">{post.body}</p> : null}
      {images.length ? (
        <div className={cn("grid gap-1.5", images.length > 1 && "grid-cols-2")}>
          {images.map((a) => (
            // Signed, short-lived URL for a file the author attached to this scrap.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a.id} src={a.fileUrl!} alt={a.title} className="max-h-72 w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : null}
      {others.length ? (
        <ul className="space-y-1">
          {others.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-[13px]">
              <FileText className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
              <span className="min-w-0">
                {a.canOpen ? (
                  <Link href={a.kind === "artifact" ? `/creations/${a.itemId}` : `/materials/${a.itemId}`} className="font-medium text-accent-ink hover:underline">
                    {a.title}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{a.title}</span>
                )}
                {a.excerpt ? <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap text-ink-muted">{a.excerpt}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-ink-subtle">
        <span>{KIND[post.kind] ?? "Scrap"}</span>
        <span aria-hidden>·</span>
        {post.author.handle ? (
          <Link href={`/creators/${post.author.handle}`} className="font-medium text-ink hover:underline">
            {post.mine ? "You" : post.author.name}
          </Link>
        ) : (
          <span className="font-medium text-ink">{post.mine ? "You" : post.author.name}</span>
        )}
        <span aria-hidden>·</span>
        <LocalTime iso={post.createdAt} />
        {post.visibility === "private" ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden /> Only you
            </span>
          </>
        ) : null}
      </p>
      <Link href={`/scrapbook/${post.id}`} className="inline-flex min-h-11 items-center gap-0.5 text-[13px] font-medium text-accent-ink hover:underline">
        {post.replyPolicy === "none" ? "Open" : "Open and reply"} <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
