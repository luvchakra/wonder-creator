import { mediaLink } from "@wonder/core/server";
import type { CommunityPrivacy } from "@wonder/creator-community/shared";
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
  listParts,
  partsTimeline,
  partMix, partTakes,
  songAgreement,
  type ProjectStatus,
} from "@wonder/creator-projects";
import { creationPath } from "@wonder/creator-studio";
import { notFound } from "next/navigation";
import { avatarUrls } from "@/lib/avatars";
import { coverUrls } from "@/lib/covers";
import { PaletteScope } from "@/components/creative-palette";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";
import { ProjectView, type ProjectTab } from "./project-view";

// The Room's own name: the tab reads it, and Back elsewhere says "Back to <Room>" (back-navigation.md).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireSession();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("projects").select("title").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.title ?? "Creative Room" };
}

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
  // Parts (docs/creative-room-parts.md): what the work is made of, who's on each, and what happened.
  const parts = await listParts(db, id, creator.id);
  // Everything that needs only the parts, at once (docs/performance.md): the timeline; the kept takes and the Room's mix,
  // so the work plays right here in its hero (owner, 6 Oct 2026); credits & shares (step 5a); and the crew.
  const [timeline, takes, mix, agreement, crew] = await Promise.all([
    parts.length ? partsTimeline(db, id, parts) : Promise.resolve([]),
    parts.some((x) => x.kind === "audio" && x.artifactId) ? partTakes(db, id).catch(() => []) : Promise.resolve([]),
    parts.length ? partMix(db, id).catch(() => ({ tracks: {}, updatedAt: null })) : Promise.resolve({ tracks: {}, updatedAt: null }),
    parts.length ? songAgreement(db, id).catch(() => null) : Promise.resolve(null),
    crewForProject(db, id).then((row) => (row ? getCrew(db, creator.id, row.id) : null)),
  ]);
  const listen = takes.length
    ? {
        tracks: takes.flatMap((t) => {
          const url = mediaLink(t.storageObjectId);
          return url ? [{ partId: t.partId, title: t.title, versionNumber: t.versionNumber, url, seconds: t.seconds, people: [] }] : [];
        }),
        mix: mix.tracks,
      }
    : null;
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
  const [avatars, owner, manages, excerpt] = await Promise.all([
    avatarUrls(db, [...new Set([...(crew?.active ?? []).map((m) => m.creatorId), ...parts.flatMap((x) => x.people.map((y) => y.id)), ...timeline.map((e) => e.actor?.id).filter((x): x is string => !!x)])]),
    canEdit ? Promise.resolve({ data: { display_name: creator.display_name } }) : db.from("creators").select("display_name").eq("id", p.creator_id).maybeSingle(),
    canEdit ? Promise.resolve(true) : parts.length ? db.rpc("project_role_of", { p_project: id }).then((r) => r.data === "admin") : Promise.resolve(false),
    partExcerpt(db, parts),
  ]);
  const coverUrl = coverObject ? (previews[coverObject] ?? (await signedUrlsFor(db, [coverObject]))[coverObject] ?? null) : null;

  // The room's current Creation: the most recently touched one you can open (palette-spec §9.30–9.31).
  const activeCreationId = items.filter((i) => i.artifact && i.available).sort((a, b) => b.artifact!.updated_at.localeCompare(a.artifact!.updated_at))[0]?.itemId ?? null;
  const activeCreationTitle = items.find((i) => i.itemId === activeCreationId)?.artifact?.title ?? null;
  const myPart = parts.find((x) => x.mine && x.artifact) ?? null;
  return (
    <>
      <PaletteScope
        context={{
          page: "room",
          entityType: "room",
          permissions: canEdit ? ["edit", "invite"] : [],
          ids: { projectId: id, crewId: crew?.crew.id },
          facts: { activeCreationId, hasCrew: !!crew, hasParts: parts.length > 0, myPartHref: myPart?.artifact ? creationPath(myPart.artifact.id, myPart.artifact.type) : null },
          strip: { label: parts.length ? (agreement ? (agreement.status === "agreed" && agreement.holds ? "Credits agreed" : `Credits · waiting on ${agreement.lines.filter((l) => l.decision !== "approve").length || "a new proposal"}`) : `${parts.filter((x) => x.status === "final").length} of ${parts.length} parts final`) : activeCreationTitle ? `${activeCreationTitle} · Active` : "No active Creation" },
        }}
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
          community: flagOn("communities_enabled") ? { privacy: (p.community_privacy as CommunityPrivacy | null) ?? null } : null,
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
        parts={parts.length ? { parts: parts.map((x) => ({ ...x, href: x.artifact ? creationPath(x.artifact.id, x.artifact.type) : null })), timeline, manages, canClaim: canEdit || inCrew, excerpt, listen: listen?.tracks.length ? listen : null, agreement } : null}
        avatars={avatars}
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

/** The first lines of a writing part the viewer may read: the hero's glimpse of the work. */
async function partExcerpt(db: Parameters<typeof listParts>[0], parts: Awaited<ReturnType<typeof listParts>>): Promise<{ partTitle: string; lines: string[]; rest: string[] } | null> {
  const part = parts.find((x) => x.kind === "writing" && x.artifact);
  if (!part?.artifact) return null;
  const { data: a } = await db.from("artifacts").select("current_version_id").eq("id", part.artifact.id).maybeSingle();
  if (!a?.current_version_id) return null;
  const { data: v } = await db.from("artifact_versions").select("content").eq("id", a.current_version_id).maybeSingle();
  // The first four lines lead the hero; the rest opens below them on "More" (owner, 6 Oct 2026), stanza breaks kept.
  const all = (v?.content ?? "").split("\n").map((l) => l.trim());
  const lines = all.filter(Boolean).slice(0, 4);
  if (!lines.length) return null;
  let seen = 0;
  const cut = all.findIndex((l) => l && ++seen > 4);
  const rest = cut < 0 ? [] : all.slice(cut, cut + 400).join("\n").replace(/\n{3,}/g, "\n\n").trim().split("\n");
  return { partTitle: part.title, lines, rest };
}
