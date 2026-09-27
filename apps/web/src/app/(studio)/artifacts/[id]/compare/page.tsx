import { artifactType, listVersions } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CompareView } from "./compare-view";

export const metadata = { title: "Compare versions" };

/** Version compare in its own view (UI redesign §19): Single view, Before / After, or Swipe — never two dense documents side by side on a phone. */
export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { id } = await params;
  const { a, b } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const { data: art } = await db.from("artifacts").select("id, title, artifact_type, current_version_id").eq("id", id).maybeSingle();
  if (!art) notFound();
  const versions = await listVersions(db, id);
  if (!versions.length) notFound();
  const newest = versions.find((v) => v.id === b) ?? versions.find((v) => v.id === art.current_version_id) ?? versions[0]!;
  const older = versions.find((v) => v.id === a) ?? versions.find((v) => v.version_number < newest.version_number) ?? newest;
  return (
    <CompareView
      artifact={{ id: art.id, title: art.title, format: artifactType(art.artifact_type).format }}
      currentId={art.current_version_id}
      versions={versions.map((v) => ({ id: v.id, number: v.version_number, label: v.label, content: v.content, summary: v.change_summary, createdAt: v.created_at }))}
      initialA={older.id}
      initialB={newest.id}
    />
  );
}
