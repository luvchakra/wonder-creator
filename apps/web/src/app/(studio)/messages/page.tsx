import { listThreads } from "@wonder/creator-projects";
import { Badge, PageTitle } from "@wonder/ui";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { db, creator } = await requireSession();
  const threads = await listThreads(db, creator.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Messages" subtitle="Direct conversations with people you work with. Crew conversations live in each Creative Room's Chat." />
      {threads.length ? (
        <ul aria-label="Conversations" className="space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/messages/${t.id}`} className="flex min-h-11 items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3 hover:bg-black/[0.02]">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {t.other.name}
                    {t.unread ? <Badge tone="accent">{t.unread} new</Badge> : null}
                  </span>
                  {t.lastMessage ? (
                    <span className="block truncate text-sm text-ink-muted">
                      {t.lastMessage.mine ? "You: " : ""}
                      {t.lastMessage.body}
                    </span>
                  ) : null}
                </span>
                {t.lastMessage ? (
                  <span className="shrink-0 text-sm text-ink-subtle">
                    <RelativeTime iso={t.lastMessage.at} />
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">
          No conversations yet. Open someone&rsquo;s profile and choose Message.
        </p>
      )}
    </div>
  );
}
