import { getPublishingPreferences, publishingOverview, UNCONNECTED_PLATFORMS } from "@wonder/creator-studio";
import { requireSession } from "@/lib/session";
import { serviceConfigured } from "@/lib/supabase/service";
import { PublishingHub } from "./publishing-hub";

export const metadata = { title: "Publishing" };

export default async function PublishingPage() {
  const { db, creator } = await requireSession();
  const [o, preferences] = await Promise.all([publishingOverview(db), getPublishingPreferences(db, creator.id)]);
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
  });
  return (
    <PublishingHub
      queue={o.queue.map(slim)}
      history={o.history.map(slim)}
      destinations={o.destinations.map((d) => ({ id: d.id, name: d.name, host: new URL(d.url).host, status: d.status, lastUsedAt: d.last_used_at }))}
      unconnected={[...UNCONNECTED_PLATFORMS]}
      preferences={preferences}
      available={serviceConfigured()}
    />
  );
}
