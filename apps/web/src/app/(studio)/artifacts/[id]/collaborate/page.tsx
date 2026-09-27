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
  return <CollaborateView viewerId={creator.id} {...data} />;
}
