import { MATERIAL_BUCKET } from "@wonder/creator-library";
import { getSharedItem } from "@wonder/creator-projects";
import { artifactType } from "@wonder/creator-studio/types";
import { Badge, buttonClasses } from "@wonder/ui";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/client-time";
import { requireSession } from "@/lib/session";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Shared with the crew" };

/** Work shared with a crew, read-only. Its owner opens the real thing instead. */
export default async function SharedItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(itemId)) notFound();
  const { db } = await requireSession();
  const item = await getSharedItem(db, itemId, MATERIAL_BUCKET).catch(() => null);
  if (!item || item.projectId !== id) notFound();
  const image = item.kind === "material" && item.fileUrl && item.mimeType?.startsWith("image/");
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <BackLink home={`/rooms/${id}?tab=work`} homeLabel="the Creative Room" />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Read-only</Badge>
          <span className="text-sm text-ink-muted">
            {item.kind === "artifact" ? artifactType(item.type).label : item.type} · Shared by {item.mine ? "you" : item.sharedBy} on <LocalTime iso={item.sharedAt} options={{ dateStyle: "medium" }} />
          </span>
        </div>
        <h1 className="break-words font-display text-3xl text-ink sm:text-4xl">{item.title}</h1>
        {item.kind === "artifact" && item.versionNumber ? <p className="text-sm text-ink-subtle">Version {item.versionNumber}</p> : null}
      </header>
      {item.kind === "artifact" ? (
        <div className="whitespace-pre-wrap rounded-3xl border border-border-soft bg-surface p-5 font-serif text-[17px] leading-relaxed text-ink sm:p-8">{item.content || "This Creation is empty so far."}</div>
      ) : (
        <div className="space-y-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.fileUrl!} alt={item.title} className="max-h-[70vh] w-full rounded-3xl border border-border-soft object-contain" />
          ) : null}
          {item.text ? <div className="whitespace-pre-wrap rounded-3xl border border-border-soft bg-surface p-5 text-[15px] leading-relaxed text-ink sm:p-8">{item.text}</div> : null}
          {item.fileUrl && !image ? (
            <a href={item.fileUrl} className={buttonClasses({ variant: "secondary" })} rel="noreferrer">
              Open the file
            </a>
          ) : null}
          {item.sourceUrl ? <p className="break-all text-sm text-ink-muted">Source: {item.sourceUrl}</p> : null}
          {!item.text && !item.fileUrl ? <p className="text-ink-muted">Nothing to preview for this material.</p> : null}
        </div>
      )}
      <p className="text-sm text-ink-muted">Shared with this Creative Room&rsquo;s crew. It stays {item.mine ? "yours" : `${item.sharedBy}'s`}: the crew can read it, not change or reuse it elsewhere.</p>
    </article>
  );
}
