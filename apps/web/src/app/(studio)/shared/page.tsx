import { artifactType, sharedWithMe } from "@wonder/creator-studio";
import { EmptyState, PageTitle } from "@wonder/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Shared with you" };

export default async function SharedWithMePage() {
  const { db } = await requireSession();
  const items = await sharedWithMe(db);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Shared with you" subtitle="Pieces other creators shared with you directly. You can read them; they stay theirs." />
      {items.length ? (
        <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
          {items.map((s) => (
            <li key={s.shareId}>
              <Link href={`/shared/${s.shareId}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{s.title}</p>
                  <p className="text-sm text-ink-muted">
                    {artifactType(s.artifactType).label} · from {s.creatorName} · <RelativeTime iso={s.sharedAt} />
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing shared with you yet" body="When a creator shares a piece with you, it appears here." />
      )}
    </div>
  );
}
