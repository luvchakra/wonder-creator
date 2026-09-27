import { artifactType, listDerivatives, publicationDerivativesFor } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { DerivativesView } from "./derivatives-view";

export const metadata = { title: "Derivatives" };

export default async function DerivativesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const { data: a } = await db.from("artifacts").select("id, title, artifact_type, creator_id, current_version_id").eq("id", id).maybeSingle();
  if (!a || a.creator_id !== creator.id) notFound();
  const [derivatives, rights, current] = await Promise.all([
    listDerivatives(db, id),
    db.from("rights_records").select("attribution_required, derivatives_allowed").eq("artifact_id", id).maybeSingle(),
    a.current_version_id ? db.from("artifact_versions").select("version_number").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <DerivativesView
      source={{
        id: a.id,
        title: a.title,
        typeLabel: artifactType(a.artifact_type).label,
        version: current.data?.version_number ?? null,
        hasContent: !!a.current_version_id,
        attributionRequired: rights.data?.attribution_required ?? true,
      }}
      presets={publicationDerivativesFor(a.artifact_type)}
      derivatives={derivatives}
    />
  );
}
