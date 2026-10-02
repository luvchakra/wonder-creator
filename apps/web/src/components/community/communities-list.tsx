import type { CommunityListItem } from "@wonder/creator-community";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { CommunityAvatar } from "./community-art";

/** A short list of communities: picture, name, what it's about, and when it last moved. No rank, no likes, no member counts. */
export function CommunitiesList({ title, items, pictures }: { title: string; items: CommunityListItem[]; pictures: Record<string, string> }) {
  const id = `communities-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <h2 id={id} className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        {title}
      </h2>
      <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/communities/${c.id}`} className="flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-black/[0.02]">
              <CommunityAvatar id={c.id} title={c.title} src={c.avatarObjectId ? pictures[c.avatarObjectId] : null} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[16.5px] leading-snug text-ink">{c.title}</span>
                {c.brief ? <span className="block truncate text-[13px] text-ink-muted">{c.brief}</span> : null}
                <span className="block truncate text-[12px] text-ink-subtle">
                  {c.topicCount ? `${c.topicCount === 1 ? "1 topic" : `${c.topicCount} topics`} · ` : ""}active <RelativeTime iso={c.lastActivityAt} />
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
