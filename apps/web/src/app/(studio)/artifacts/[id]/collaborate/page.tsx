import { listContributions } from "@wonder/creator-projects";
import { getCollaboration } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CollaborateView } from "./collaborate-view";

export const metadata = { title: "Collaborate" };

export default async function CollaboratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getCollaboration(db, creator.id, id).catch(() => null);
  if (!data) notFound();
  const credits = await listContributions(db, creator.id, { artifactId: id }).catch(() => []);
  return (
    <CollaborateView
      viewerId={creator.id}
      {...data}
      credits={credits.filter((c) => !c.retracted).map((c) => ({ id: c.id, name: c.contributor.name, kind: c.kindLabel, description: c.description, versionNumber: c.related.versionNumber }))}
    />
  );
}
