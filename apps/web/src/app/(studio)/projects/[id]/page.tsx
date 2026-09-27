import { listApprovals } from "@wonder/creator-brain";
import { signedUrlsFor } from "@wonder/creator-library";
import {
  crewForProject,
  getCrew,
  getProject,
  listCrewMessages,
  listSharedItems,
  listTasks,
  progressSummary,
  projectConversationIds,
  projectPeople,
  contributionSummary,
  listContributions,
  getProjectRights,
  type ProjectStatus,
} from "@wonder/creator-projects";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { PaletteActions } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { ProjectView, type ProjectTab } from "./project-view";

export const metadata = { title: "Creative Room" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const requested = (await searchParams).tab;
  const asked: ProjectTab = (["work", "tasks", "chat", "contributions", "rights"] as const).find((t) => t === requested) ?? "overview";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const data = await getProject(db, id).catch(() => null);
  if (!data) notFound();
  const { project: p, items } = data;

  const artifacts = items.filter((i) => i.artifact).map((i) => ({ id: i.itemId, cover_material_id: i.artifact!.cover_material_id }));
  const [previews, covers, approvals, cover] = await Promise.all([
    signedUrlsFor(
      db,
      items.map((i) => i.material?.storage_object_id),
    ),
    coverUrls(db, artifacts),
    projectConversationIds(db, id).then((conversationIds) => listApprovals(db, { state: "open", conversationIds })),
    p.cover_material_id ? db.from("creative_materials").select("storage_object_id").eq("id", p.cover_material_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const coverObject =
    cover.data?.storage_object_id ??
    items.find((i) => i.material && (i.material.type === "image" || i.material.type === "sketch") && i.material.storage_object_id)?.material?.storage_object_id ??
    null;
  const canEdit = p.creator_id === creator.id;
  const crewRow = await crewForProject(db, id);
  const crew = crewRow ? await getCrew(db, creator.id, crewRow.id) : null;
  const inCrew = !!crew && crew.me?.status === "active";
  // Work and Chat need a crew; Tasks works for any project.
  const tab: ProjectTab = asked === "tasks" || asked === "contributions" || asked === "rights" || (inCrew && asked !== "overview") ? asked : "overview";
  const [shared, chat, taskData, people, role, ledger, rights] = await Promise.all([
    crew ? listSharedItems(db, id) : Promise.resolve([]),
    inCrew && tab === "chat" ? listCrewMessages(db, creator.id, crew!.crew.id) : Promise.resolve(null),
    tab === "tasks" ? listTasks(db, id) : Promise.resolve(null),
    tab === "tasks" || tab === "contributions" ? projectPeople(db, id) : Promise.resolve([]),
    tab === "tasks" || tab === "contributions" ? db.rpc("project_role_of", { p_project: id }).then((r) => r.data as "owner" | "admin" | "member" | null) : Promise.resolve(null),
    tab === "contributions" ? listContributions(db, creator.id, { projectId: id }) : Promise.resolve(null),
    tab === "rights" ? getProjectRights(db, creator.id, id) : Promise.resolve(null),
  ]);
  // The overview's "next steps" (UI redesign §23): a few open tasks, soonest first.
  const nextSteps =
    tab === "overview"
      ? ((await db.from("project_tasks").select("id, title, status, due_on").eq("project_id", id).neq("status", "done").order("due_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(3)).data ?? [])
      : [];
  // What the crew can point a chat message at: pieces, open tasks, open change proposals and ownership claims.
  const chatContexts =
    tab === "chat" && chat
      ? await (async () => {
          const pieceIds = items.filter((i) => i.kind === "artifact").map((i) => i.itemId);
          const [openTasks, proposals, claims] = await Promise.all([
            db.from("project_tasks").select("id, title").eq("project_id", id).neq("status", "done").order("created_at", { ascending: false }).limit(50),
            pieceIds.length
              ? db.from("artifact_change_proposals").select("id, summary").in("artifact_id", pieceIds).eq("status", "open").limit(30)
              : Promise.resolve({ data: [] as Array<{ id: string; summary: string }> }),
            db.from("ownership_assertions").select("id, claim, artifacts(title)").eq("project_id", id).in("status", ["asserted", "disputed"]).limit(30),
          ]);
          return [
            ...items.filter((i) => i.kind === "artifact" && i.available).map((i) => ({ kind: "artifact" as const, id: i.itemId, label: `Creation: ${i.title}` })),
            ...(openTasks.data ?? []).map((t) => ({ kind: "task" as const, id: t.id, label: `Task: ${t.title}` })),
            ...(proposals.data ?? []).map((p) => ({ kind: "proposal" as const, id: p.id, label: `Proposed change: ${p.summary.slice(0, 60)}` })),
            ...(claims.data ?? []).map((c) => ({ kind: "claim" as const, id: c.id, label: `Ownership claim on ${(c.artifacts as { title: string } | null)?.title ?? "a Creation"}` })),
          ];
        })()
      : [];
  const [avatars, owner] = await Promise.all([
    avatarUrls(
      db,
      (crew?.active ?? []).map((m) => m.creatorId),
    ),
    canEdit ? Promise.resolve({ data: { display_name: creator.display_name } }) : db.from("creators").select("display_name").eq("id", p.creator_id).maybeSingle(),
  ]);
  const coverUrl = coverObject ? (previews[coverObject] ?? (await signedUrlsFor(db, [coverObject]))[coverObject] ?? null) : null;

  const room = `/projects/${id}`;
  return (
    <>
      <PaletteActions
        title="This Creative Room"
        actions={[
          { key: "create", label: "Create", href: `/create?project=${id}`, icon: "spark" },
          { key: "bring", label: "Bring Material", href: "/send", icon: "add" },
          ...(crew
            ? [
                { key: "people", label: "People", href: `/crews/${crew.crew.id}`, icon: "people" as const },
                { key: "chat", label: "Chat & Huddle", href: `${room}?tab=chat` },
              ]
            : []),
          { key: "tasks", label: "Tasks", href: `${room}?tab=tasks` },
          { key: "rights", label: "Rights", href: `${room}?tab=rights` },
          { key: "contributions", label: "Contributions", href: `${room}?tab=contributions` },
          ...(canEdit ? [{ key: "complete", label: "Complete or archive", href: `${room}/complete` }] : []),
        ]}
      />
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
          shared: i.shared,
          linkedBy: i.linkedBy,
        }))}
        viewerId={creator.id}
        tab={tab}
        shared={shared}
        chat={chat}
        chatContexts={chatContexts}
        tasks={
          taskData && role
            ? {
                role,
                tasks: taskData.tasks,
                milestones: taskData.milestones,
                summary: progressSummary(taskData.tasks, taskData.milestones),
                people,
                items: [
                  ...items.filter((i) => i.linkedBy === creator.id && (canEdit || i.available)).map((i) => ({ id: i.id, title: i.title })),
                  ...shared.filter((x) => !x.mine).map((x) => ({ id: x.itemId, title: `${x.title} (shared)` })),
                ],
              }
            : null
        }
        contributions={ledger ? { manages: role === "owner" || role === "admin", entries: ledger, summary: contributionSummary(ledger), people } : null}
        rights={rights}
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
        nextSteps={nextSteps.map((t) => ({ id: t.id, title: t.title, status: t.status, dueOn: t.due_on }))}
      />
    </>
  );
}
