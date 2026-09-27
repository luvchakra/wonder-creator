import { formatOutcome, getPublishingPreferences, publicationOutcomes, publishingOverview, UNCONNECTED_PLATFORMS } from "@wonder/creator-studio";
import { requireSession } from "@/lib/session";
import { serviceConfigured } from "@/lib/supabase/service";
import { PublishingHub } from "./publishing-hub";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Publishing" };

export default async function PublishingPage() {
  const { db, creator } = await requireSession();
  const [o, preferences] = await Promise.all([publishingOverview(db), getPublishingPreferences(db, creator.id)]);
  // Platform-reported outcomes for published work (P1-20): only what the destinations themselves sent.
  const outcomes = new Map((await publicationOutcomes(db, { publicationIds: o.history.filter((p) => p.status === "published").map((p) => p.id) })).map((x) => [x.publicationId, x]));
  const slim = (p: (typeof o.queue)[number]) => ({
    id: p.id,
    artifact: p.artifacts ? { id: p.artifacts.id, title: p.artifacts.title } : null,
    destinationName: p.destination_name,
    destinationKind: p.destination_kind,
    title: p.title,
    caption: p.caption,
    description: p.description,
    tags: ((p.metadata as { tags?: string[] } | null)?.tags ?? []) as string[],
    status: p.status,
    scheduledFor: p.scheduled_for,
    publishedAt: p.published_at,
    externalUrl: p.external_url,
    failureReason: p.failure_reason,
    attempts: p.attempts,
    updatedAt: p.updated_at,
    outcome: outcomes.get(p.id) ? { text: formatOutcome(outcomes.get(p.id)!), reportedBy: outcomes.get(p.id)!.reportedBy, observedAt: outcomes.get(p.id)!.metrics[0]?.observedAt ?? null } : null,
  });
  return (
    <>
      <PaletteScope
        context={{
          page: "publishing",
          strip: o.queue.some((p) => p.status === "failed")
            ? { publishState: "failed" }
            : o.queue.some((p) => p.status === "publishing")
              ? { publishState: "publishing" }
              : { label: o.queue.length ? `${o.queue.length} scheduled` : "Nothing scheduled" },
        }}
      />
      <PublishingHub
        queue={o.queue.map(slim)}
        history={o.history.map(slim)}
        destinations={o.destinations.map((d) => ({ id: d.id, name: d.name, host: new URL(d.url).host, status: d.status, lastUsedAt: d.last_used_at }))}
        unconnected={[...UNCONNECTED_PLATFORMS]}
        preferences={preferences}
        available={serviceConfigured()}
      />
    </>
  );
}
