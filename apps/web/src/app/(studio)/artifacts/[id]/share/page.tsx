import { listShares, listVersions } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ShareManager } from "./share-manager";

export const metadata = { title: "Share" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: artifact } = await db.from("artifacts").select("id, title, creator_id, current_version_id, privacy, status").eq("id", id).maybeSingle();
  if (!artifact || artifact.creator_id !== creator.id) notFound();
  const [versions, shares] = await Promise.all([listVersions(db, id), listShares(db, id)]);
  return (
    <ShareManager
      artifact={{ id: artifact.id, title: artifact.title, isPublic: artifact.privacy === "public" && (artifact.status === "final" || artifact.status === "published"), archived: artifact.status === "archived" }}
      versions={versions.map((v) => ({ id: v.id, number: v.version_number, label: v.label, current: v.id === artifact.current_version_id }))}
      initialShares={shares}
    />
  );
}
