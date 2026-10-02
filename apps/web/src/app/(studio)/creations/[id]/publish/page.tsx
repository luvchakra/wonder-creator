import { getPublishingPreferences, listDestinations, listPublications, UNCONNECTED_PLATFORMS } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { serviceConfigured } from "@/lib/supabase/service";
import { PublishFlow } from "./publish-flow";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Publish" };

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: artifact } = await db.from("artifacts").select("id, title, description, creator_id, status, privacy, current_version_id").eq("id", id).maybeSingle();
  if (!artifact || artifact.creator_id !== creator.id) notFound();
  const [destinations, publications, prefs] = await Promise.all([listDestinations(db), listPublications(db, id), getPublishingPreferences(db, creator.id)]);
  return (
    <>
      <PaletteScope context={{ page: "publish", permissions: ["edit", "publish", "rights", "collaborate", "invite"], ids: { artifactId: id } }} />
      <PublishFlow
        artifact={{ id: artifact.id, title: artifact.title, description: artifact.description, archived: artifact.status === "archived", hasContent: !!artifact.current_version_id }}
        handle={creator.handle ?? null}
        destinations={destinations.filter((d) => d.status === "active").map((d) => ({ id: d.id, name: d.name, url: d.url, secret: d.signing_secret }))}
        unconnected={[...UNCONNECTED_PLATFORMS]}
        initialPublications={publications}
        available={serviceConfigured()}
        preferences={{ defaultDestinations: prefs.defaultDestinations, defaultTags: prefs.defaultTags }}
      />
    </>
  );
}
