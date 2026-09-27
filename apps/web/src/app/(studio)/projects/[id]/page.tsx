import { listApprovals } from "@wonder/creator-brain";
import { signedUrlsFor } from "@wonder/creator-library";
import { crewForProject, getCrew, getProject, projectConversationIds, type ProjectStatus } from "@wonder/creator-projects";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { requireSession } from "@/lib/session";
import { ProjectView } from "./project-view";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getProject(db, id).catch(() => null);
  if (!data) notFound();
  const { project: p, items } = data;

  const artifacts = items.filter((i) => i.artifact).map((i) => ({ id: i.itemId, cover_material_id: i.artifact!.cover_material_id }));
  const [previews, covers, approvals, cover] = await Promise.all([
    signedUrlsFor(db, items.map((i) => i.material?.storage_object_id)),
    coverUrls(db, artifacts),
    projectConversationIds(db, id).then((conversationIds) => listApprovals(db, { state: "open", conversationIds })),
    p.cover_material_id ? db.from("creative_materials").select("storage_object_id").eq("id", p.cover_material_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const coverObject = cover.data?.storage_object_id ?? items.find((i) => i.material && (i.material.type === "image" || i.material.type === "sketch") && i.material.storage_object_id)?.material?.storage_object_id ?? null;
  const canEdit = p.creator_id === creator.id;
  const crewRow = await crewForProject(db, id);
  const crew = crewRow ? await getCrew(db, creator.id, crewRow.id) : null;
  const [avatars, owner] = await Promise.all([
    avatarUrls(db, (crew?.active ?? []).map((m) => m.creatorId)),
    canEdit ? Promise.resolve({ data: { display_name: creator.display_name } }) : db.from("creators").select("display_name").eq("id", p.creator_id).maybeSingle(),
  ]);
  const coverUrl = coverObject ? (previews[coverObject] ?? (await signedUrlsFor(db, [coverObject]))[coverObject] ?? null) : null;

  return (
    <ProjectView
      project={{
        id: p.id,
        title: p.title,
        brief: p.brief,
        goals: p.goals,
        status: p.status as ProjectStatus,
        coverUrl,
        coverMaterialId: p.cover_material_id,
        rightsNote: p.rights_note,
        budget: { enabled: p.budget_enabled, amount: p.budget_amount, currency: p.budget_currency, note: p.budget_note },
        updatedAt: p.updated_at,
      }}
      items={items.map((i) => ({
        id: i.id,
        kind: i.kind,
        itemId: i.itemId,
        title: i.title,
        detail: i.detail,
        href: i.href,
        available: i.available,
        note: i.note,
        at: i.at,
        material: i.material ? { id: i.itemId, ...i.material, previewUrl: i.material.storage_object_id ? (previews[i.material.storage_object_id] ?? null) : null } : null,
        artifact: i.artifact ? { id: i.itemId, ...i.artifact, coverUrl: covers[i.itemId] ?? null } : null,
      }))}
      canEdit={canEdit}
      ownerName={owner.data?.display_name ?? "A creator"}
      crew={
        crew
          ? {
              id: crew.crew.id,
              name: crew.crew.name,
              status: crew.crew.status,
              members: crew.active.map((m) => ({ creatorId: m.creatorId, name: m.name, avatarUrl: avatars[m.creatorId] ?? null, roleTitle: m.roleTitle })),
              invited: crew.invited.length,
            }
          : null
      }
      approvals={approvals.map((a) => ({ id: a.id, actionLabel: a.actionLabel, understood: a.understood, urgent: a.urgent }))}
    />
  );
}
