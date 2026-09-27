"use client";
import { CREW_STATUS_LABEL, MAX_GOALS, PROJECT_ITEM_LABEL, type CrewStatus, PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectItemKind, type ProjectStatus } from "@wonder/creator-projects/options";
import { Avatar, AvatarStack, BACKGROUNDS, Badge, Button, ConfirmDialog, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Select, Switch, Textarea, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, MessageCircle, MoreHorizontal, PenLine, Plus, Search, Sparkles, Users } from "lucide-react";
import { CrewChat, type ChatMessage } from "./crew-chat";
import { ContributionsPanel } from "./contributions-panel";
import { RightsPanel } from "./rights-panel";
import { TasksPanel } from "./tasks-panel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArtifactCard, MaterialCard, type ArtifactCardData, type MaterialCardData } from "@/components/cards";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";

interface Project {
  id: string;
  title: string;
  brief: string;
  goals: string[];
  status: ProjectStatus;
  coverUrl: string | null;
  coverMaterialId: string | null;
  rightsNote: string | null;
  budget: { enabled: boolean; amount: number | null; currency: string | null; note: string | null };
  updatedAt: string;
}

interface Item {
  id: string;
  kind: ProjectItemKind;
  itemId: string;
  title: string;
  detail: string | null;
  href: string | null;
  available: boolean;
  note: string | null;
  at: string;
  material: (MaterialCardData & { storage_object_id: string | null }) | null;
  artifact: ArtifactCardData | null;
  shared: boolean;
  linkedBy: string;
}

export interface SharedSummary {
  itemId: string;
  kind: "material" | "reference" | "artifact";
  title: string;
  detail: string | null;
  sharedBy: { id: string; name: string };
  sharedAt: string;
  mine: boolean;
}

export type ProjectTab = "overview" | "work" | "tasks" | "chat" | "contributions" | "rights";
const SHAREABLE: ProjectItemKind[] = ["material", "reference", "artifact"];

/** Sections in the order the work matters: what's being made, what it's made from, then how it's being made. */
const SECTIONS: Array<{ kind: ProjectItemKind[]; title: string; add: ProjectItemKind; empty: string }> = [
  { kind: ["artifact"], title: "Pieces", add: "artifact", empty: "Pieces you make in this project, or add to it, appear here." },
  { kind: ["material", "reference"], title: "Material & references", add: "material", empty: "Add the notes, images, voice memos and references this work draws on." },
  { kind: ["conversation"], title: "Conversations", add: "conversation", empty: "Conversations started in this project appear here." },
  { kind: ["huddle"], title: "Huddles", add: "huddle", empty: "Add Huddles you were part of that shaped this work." },
  { kind: ["collection"], title: "Collections", add: "collection", empty: "Add collections that belong with this project." },
];

export interface CrewSummary {
  id: string;
  name: string;
  status: CrewStatus;
  members: Array<{ creatorId: string; name: string; avatarUrl: string | null; roleTitle: string | null }>;
  invited: number;
}

export function ProjectView({
  project,
  items: allItems,
  approvals,
  canEdit,
  ownerName,
  crew,
  viewerId,
  tab,
  shared,
  chat,
  tasks,
  contributions,
  rights,
}: {
  project: Project;
  items: Item[];
  approvals: Array<{ id: string; actionLabel: string; understood: string; urgent: boolean }>;
  /** The project's owner edits it; crew members read it. */
  canEdit: boolean;
  ownerName: string;
  crew: CrewSummary | null;
  viewerId: string;
  tab: ProjectTab;
  /** Work shared with the crew (read-only for everyone but its owner). */
  shared: SharedSummary[];
  chat: { messages: ChatMessage[]; olderBefore: string | null } | null;
  tasks: Omit<React.ComponentProps<typeof TasksPanel>, "projectId" | "viewerId"> | null;
  contributions: Omit<React.ComponentProps<typeof ContributionsPanel>, "projectId"> | null;
  rights: Omit<React.ComponentProps<typeof RightsPanel>, "projectId" | "viewerId" | "isOwner"> | null;
}) {
  // Your own links here; work others shared with the crew is listed separately (and opened read-only).
  const items = allItems.filter((i) => i.linkedBy === viewerId && (canEdit || i.available));
  const fromCrew = shared.filter((x) => !x.mine);
  const showOverview = tab === "overview";
  // Without a crew, a project's work sits on its overview.
  const showWork = crew ? tab === "work" : tab === "overview";
  const [sharing, setSharing] = useState(false);
  const router = useRouter();
  const [status, setStatus] = useState(project.status);
  const closed = status === "completed" || status === "archived";
  const [adding, setAdding] = useState<ProjectItemKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [noteFor, setNoteFor] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(next: ProjectStatus) {
    const prev = status;
    setStatus(next);
    setError(null);
    try {
      await api(`/api/v1/projects/${project.id}`, { method: "PATCH", json: { status: next } });
      setMsg(`Marked ${PROJECT_STATUS_LABEL[next].toLowerCase()}.`);
      router.refresh();
    } catch (e) {
      setStatus(prev);
      setError(errorMessage(e));
    }
  }

  async function unlink(i: Item) {
    setError(null);
    try {
      await api(`/api/v1/projects/${project.id}/items`, { method: "DELETE", json: { itemId: i.id } });
      setMsg(`Removed “${i.title}” from the project. It's still in your space.`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function toggleShare(i: Item) {
    setError(null);
    try {
      await api(`/api/v1/projects/${project.id}/items`, { method: "PATCH", json: { itemId: i.id, shared: !i.shared } });
      setMsg(i.shared ? `“${i.title}” is no longer shared with the crew.` : `Shared “${i.title}” with the crew (read-only for them).`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function makeCover(i: Item) {
    setError(null);
    try {
      await api(`/api/v1/projects/${project.id}`, { method: "PATCH", json: { coverMaterialId: i.itemId } });
      setMsg("Cover updated.");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/projects" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Projects
        </Link>
      </div>

      <section aria-labelledby="project-title" className="overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
        {showOverview ? (
          <div className="relative h-40 sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.coverUrl ?? BACKGROUNDS.botanicalLeaves} alt="" className={cn("size-full object-cover", !project.coverUrl && "opacity-60")} />
          </div>
        ) : null}
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 id="project-title" className="break-words font-display text-3xl text-ink sm:text-4xl">
                {project.title}
              </h1>
              <p className="mt-1 text-sm text-ink-subtle">
                {canEdit ? null : <>{ownerName}&rsquo;s project · You&rsquo;re in the crew · </>}
                Updated <RelativeTime iso={project.updatedAt} />
              </p>
            </div>
            {canEdit ? (
            <div className="flex items-center gap-2">
              <label htmlFor="project-status" className="sr-only">
                Status
              </label>
              {crew && closed ? (
                <Badge tone="accent">{PROJECT_STATUS_LABEL[status]}</Badge>
              ) : (
                <Select id="project-status" value={status} onChange={(e) => changeStatus(e.target.value as ProjectStatus)} className="w-40">
                  {/* With a crew, completing or archiving goes through the checklist. */}
                  {PROJECT_STATUSES.filter((s) => !crew || (s !== "completed" && s !== "archived")).map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              )}
              <Menu>
                <MenuTrigger className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface hover:bg-black/[0.03]" aria-label="More project actions">
                  <MoreHorizontal className="size-5" aria-hidden />
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setEditing(true)}>Edit details</MenuItem>
                  <MenuItem onSelect={() => router.push(`/discover?project=${project.id}`)}>Find collaborators</MenuItem>
                  <MenuItem onSelect={() => router.push(`/projects/${project.id}/complete`)}>{closed ? "Reopen or review completion" : crew ? "Complete, archive or dissolve crew…" : "Complete or archive…"}</MenuItem>
                  <MenuItem destructive onSelect={() => setDeleting(true)}>
                    Delete project
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
            ) : (
              <Badge tone={status === "active" ? "success" : "accent"}>{PROJECT_STATUS_LABEL[status]}</Badge>
            )}
          </div>
          {showOverview ? (
            <>
          {project.brief ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{project.brief}</p> : null}
          {project.goals.length ? (
            <div>
              <h2 className="text-sm font-medium text-ink">Goals</h2>
              <ul className="mt-2 space-y-1.5">
                {project.goals.map((g) => (
                  <li key={g} className="flex gap-2 text-[15px] text-ink-muted">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canEdit && !project.brief && !project.goals.length ? (
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 text-left text-[15px] text-accent-ink hover:underline">
              Add a brief and goals — CreatorBrain keeps them in mind when you create here.
            </button>
          ) : null}
          {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/create?project=${project.id}`} className={buttonClasses()}>
              <Sparkles className="size-4" aria-hidden /> Create in this project
            </Link>
            <Button variant="secondary" onClick={() => setAdding("artifact")}>
              <Plus className="size-4" aria-hidden /> Add work
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <PenLine className="size-4" aria-hidden /> Edit
            </Button>
          </div>
          ) : null}
            </>
          ) : null}
        </div>
      </section>

      {crew || canEdit ? (
        <nav aria-label="Project sections" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {(
              [
                ["overview", "Overview", `/projects/${project.id}`],
                ...(crew ? ([["work", "Work", `/projects/${project.id}?tab=work`]] as const) : []),
                ["tasks", "Tasks", `/projects/${project.id}?tab=tasks`],
                ...(crew ? ([["chat", "Chat", `/projects/${project.id}?tab=chat`]] as const) : []),
                ["contributions", "Contributions", `/projects/${project.id}?tab=contributions`],
                ["rights", "Rights", `/projects/${project.id}?tab=rights`],
              ] as const
            ).map(([key, label, href]) => (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={tab === key ? "page" : undefined}
                  className={cn("inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm", tab === key ? "bg-accent text-white" : "border border-border bg-surface text-ink-muted hover:border-accent")}
                >
                  {label}
                </Link>
              </li>
            ))}
            {crew ? (
            <li>
              <Link href={`/crews/${crew.id}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm text-ink-muted hover:border-accent">
                People
              </Link>
            </li>
            ) : null}
          </ul>
        </nav>
      ) : null}

      {showOverview ? <CrewStrip projectId={project.id} crew={crew} canEdit={canEdit} projectTitle={project.title} /> : null}

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {showOverview && approvals.length ? (
        <section aria-labelledby="approvals-h">
          <SectionHeader title="Waiting for your approval" />
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id}>
                <Link href={`/approvals/${a.id}`} className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#cfd0ff] bg-accent-softer px-4 py-3 text-[15px] text-ink hover:bg-accent-soft">
                  <Sparkles className="size-5 shrink-0 text-accent-ink" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{a.actionLabel}</span> <span className="text-ink-muted">— {a.understood}</span>
                  </span>
                  {a.urgent ? <Badge tone="warning">Expires soon</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showWork && crew ? (
        <section aria-label="Shared by the crew">
          <SectionHeader
            title={`Shared by the crew${fromCrew.length ? ` (${fromCrew.length})` : ""}`}
            action={
              <Button variant="ghost" onClick={() => setSharing(true)}>
                <Plus className="size-4" aria-hidden /> Share your work
              </Button>
            }
          />
          {fromCrew.length ? (
            <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
              {fromCrew.map((x) => (
                <li key={x.itemId}>
                  <Link href={`/projects/${project.id}/shared/${x.itemId}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-medium text-ink">{x.title}</span>
                      <span className="line-clamp-1 text-sm text-ink-muted">
                        {x.detail ? `${x.detail} · ` : ""}Shared by {x.sharedBy.name} · <RelativeTime iso={x.sharedAt} />
                      </span>
                    </span>
                    <Badge tone="neutral">Read-only</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">
              When someone in the crew shares their material or pieces, they appear here. You can open them, not change them.
            </p>
          )}
        </section>
      ) : null}

      {showWork && SECTIONS.map((s) => {
        const list = items.filter((i) => s.kind.includes(i.kind));
        if (!canEdit && !list.length) return null;
        return (
          <section key={s.title} aria-label={s.title}>
            <SectionHeader
              title={`${s.title}${list.length ? ` (${list.length})` : ""}`}
              action={
                canEdit ? (
                  <Button variant="ghost" onClick={() => setAdding(s.add)}>
                    <Plus className="size-4" aria-hidden /> Add
                  </Button>
                ) : undefined
              }
            />
            {!list.length ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">{s.empty}</p>
            ) : s.kind[0] === "artifact" || s.kind[0] === "material" ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((i) => (
                  <li key={i.id} className="relative">
                    {i.artifact ? <ArtifactCard a={i.artifact} /> : i.material ? <MaterialCard m={i.material} href={i.href ?? undefined} /> : <Unavailable title={i.title} />}
                    {i.shared ? <Badge tone="accent" className="absolute left-2 top-2">Shared with crew</Badge> : null}
                    {canEdit || i.linkedBy === viewerId ? <ItemMenu item={i} onUnlink={unlink} onNote={setNoteFor} onShare={crew && SHAREABLE.includes(i.kind) ? toggleShare : undefined} onCover={canEdit && i.kind === "material" && i.material && (i.material.type === "image" || i.material.type === "sketch") ? makeCover : undefined} /> : null}
                    {i.note ? <p className="mt-1 px-1 text-sm italic text-ink-muted">{i.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
                {list.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2">
                    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-softer text-accent-ink">
                      {i.kind === "huddle" ? <Users className="size-4" /> : i.kind === "conversation" ? <MessageCircle className="size-4" /> : <Search className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1 py-1">
                      {i.href ? (
                        <Link href={i.href} className="line-clamp-1 font-medium text-ink hover:underline">
                          {i.title}
                        </Link>
                      ) : (
                        <p className="line-clamp-1 font-medium text-ink-muted">{i.title}</p>
                      )}
                      <p className="text-sm text-ink-subtle">
                        {i.available ? (
                          <>
                            {i.detail ? `${i.detail} · ` : ""}
                            <RelativeTime iso={i.at} />
                          </>
                        ) : (
                          "No longer available to you"
                        )}
                        {i.note ? <span className="italic"> · {i.note}</span> : null}
                      </p>
                    </div>
                    {canEdit || i.linkedBy === viewerId ? <ItemMenu item={i} onUnlink={unlink} onNote={setNoteFor} inline /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {tab === "contributions" && contributions ? <ContributionsPanel projectId={project.id} {...contributions} /> : null}
      {tab === "rights" && rights ? <RightsPanel projectId={project.id} viewerId={viewerId} isOwner={canEdit} {...rights} /> : null}
      {tab === "tasks" && tasks ? <TasksPanel projectId={project.id} viewerId={viewerId} {...tasks} /> : null}

      {crew && tab === "chat" && chat ? <CrewChat crewId={crew.id} projectId={project.id} viewerId={viewerId} canModerate={canEdit} initial={chat} shared={shared} /> : null}

      {showOverview ? (
      <section aria-label="Rights">
        <SectionHeader
          title="Rights"
          action={
            canEdit ? (
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : undefined
          }
        />
        <p className="rounded-2xl border border-border-soft bg-surface px-5 py-4 text-[15px] leading-relaxed text-ink-muted">
          {project.rightsNote || "Each piece keeps its own rights and licences. Note anything that applies to the whole project here — for example, who owns what, or what a collaborator agreed to."}
        </p>
      </section>

      ) : null}

      {showOverview && project.budget.enabled ? (
        <section aria-label="Budget">
          <SectionHeader title="Budget" />
          <div className="rounded-2xl border border-border-soft bg-surface px-5 py-4 text-[15px] text-ink-muted">
            {project.budget.amount != null ? (
              <p className="text-lg font-medium text-ink">{new Intl.NumberFormat(undefined, { style: "currency", currency: project.budget.currency || "USD" }).format(project.budget.amount)}</p>
            ) : (
              <p>No amount set.</p>
            )}
            {project.budget.note ? <p className="mt-1">{project.budget.note}</p> : null}
          </div>
        </section>
      ) : null}

      {sharing ? <AddDialog projectId={project.id} initialKind="artifact" shareMode onOpenChange={setSharing} onAdded={(n) => (setMsg(n ? `Shared ${n} with the crew.` : "Those were already shared."), router.refresh())} /> : null}
      {adding ? <AddDialog projectId={project.id} initialKind={adding} onOpenChange={(o) => !o && setAdding(null)} onAdded={(n, kind) => (setMsg(n ? `Added ${n} ${(n === 1 ? PROJECT_ITEM_LABEL[kind].one : PROJECT_ITEM_LABEL[kind].many).toLowerCase()} to the project.` : "Those were already here."), router.refresh())} /> : null}
      {editing ? <EditDialog project={project} onOpenChange={setEditing} onSaved={() => (setEditing(false), setMsg("Project saved."), router.refresh())} /> : null}
      {noteFor ? <NoteDialog projectId={project.id} item={noteFor} onOpenChange={(o) => !o && setNoteFor(null)} onSaved={() => (setNoteFor(null), router.refresh())} /> : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this project?"
        body="The project, its brief and its list of links will be deleted. Your material, pieces, conversations and collections are not deleted — they stay in your space."
        confirmLabel="Delete project"
        destructive
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/api/v1/projects/${project.id}?confirm=true`, { method: "DELETE" });
            router.replace("/projects");
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

function Unavailable({ title }: { title: string }) {
  return (
    <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-border bg-surface/70 p-3 text-center text-sm text-ink-muted">
      “{title}” is no longer available to you
    </div>
  );
}

function ItemMenu({ item, onUnlink, onNote, onCover, onShare, inline }: { item: Item; onUnlink: (i: Item) => void; onNote: (i: Item) => void; onCover?: (i: Item) => void; onShare?: (i: Item) => void; inline?: boolean }) {
  return (
    <Menu>
      <MenuTrigger
        aria-label={`Options for ${item.title}`}
        className={cn("inline-flex size-11 items-center justify-center rounded-full hover:bg-black/[0.05]", inline ? "shrink-0" : "absolute right-1.5 top-1.5 bg-surface/90 shadow-sm")}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => onNote(item)}>{item.note ? "Edit note" : "Add a note"}</MenuItem>
        {onShare ? <MenuItem onSelect={() => onShare(item)}>{item.shared ? "Stop sharing with crew" : "Share with crew"}</MenuItem> : null}
        {onCover ? <MenuItem onSelect={() => onCover(item)}>Use as project cover</MenuItem> : null}
        <MenuItem destructive onSelect={() => onUnlink(item)}>
          Remove from project
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const ADD_KINDS: ProjectItemKind[] = ["artifact", "material", "reference", "conversation", "huddle", "collection"];

function AddDialog({ projectId, initialKind, onOpenChange, onAdded, shareMode }: { projectId: string; initialKind: ProjectItemKind; onOpenChange: (o: boolean) => void; onAdded: (n: number, kind: ProjectItemKind) => void; shareMode?: boolean }) {
  const [kind, setKind] = useState<ProjectItemKind>(initialKind);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Array<{ id: string; title: string; detail: string | null }> | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ candidates: Array<{ id: string; title: string; detail: string | null }> }>(`/api/v1/projects/${projectId}/candidates?kind=${kind}&q=${encodeURIComponent(q)}`);
        if (live) {
          setList(r.candidates);
          setError(null);
        }
      } catch (e) {
        if (live) setError(errorMessage(e));
      }
    }, 200);
    return () => ((live = false), clearTimeout(t));
  }, [projectId, kind, q]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={shareMode ? "Share with the crew" : "Add to project"}
        description={shareMode ? "The crew can open what you share, read-only. You can stop sharing any time; nothing is moved or copied." : "Adding links your work to the project. Nothing is moved or copied."}
        wide
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <div role="radiogroup" aria-label="What to add" className="flex gap-2">
            {ADD_KINDS.filter((k) => !shareMode || SHAREABLE.includes(k)).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => (setKind(k), setPicked([]), setList(null))}
                className={cn("inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm", kind === k ? "bg-accent text-white" : "border border-border text-ink-muted hover:border-accent")}
              >
                {PROJECT_ITEM_LABEL[k].many}
              </button>
            ))}
          </div>
        </div>
        <label htmlFor="add-search" className="sr-only">
          Search
        </label>
        <Input id="add-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" className="mt-4" />
        <div className="mt-3 min-h-40">
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : list === null ? (
            <p className="py-6 text-center text-sm text-ink-muted">Loading…</p>
          ) : !list.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">{q ? "Nothing matches that." : `No ${PROJECT_ITEM_LABEL[kind].many.toLowerCase()} to add — everything is already here, or there's nothing yet.`}</p>
          ) : (
            <ul className="max-h-[45dvh] space-y-1 overflow-y-auto">
              {list.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2", on ? "bg-accent-soft" : "hover:bg-black/[0.03]")}>
                      <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id].slice(0, 50)))} className="size-4 accent-[var(--color-accent)]" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-[15px] text-ink">{c.title}</span>
                        {c.detail ? <span className="text-sm capitalize text-ink-subtle">{c.detail}</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!picked.length}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ added: number }>(`/api/v1/projects/${projectId}/items`, { method: "POST", json: { kind, ids: picked, shared: !!shareMode } });
                onAdded(r.added, kind);
                onOpenChange(false);
              } catch (e) {
                setError(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            Add{picked.length ? ` ${picked.length}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ project, onOpenChange, onSaved }: { project: Project; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [brief, setBrief] = useState(project.brief);
  const [goals, setGoals] = useState(project.goals.join("\n"));
  const [rightsNote, setRightsNote] = useState(project.rightsNote ?? "");
  const [budgetOn, setBudgetOn] = useState(project.budget.enabled);
  const [amount, setAmount] = useState(project.budget.amount != null ? String(project.budget.amount) : "");
  const [currency, setCurrency] = useState(project.budget.currency ?? "");
  const [budgetNote, setBudgetNote] = useState(project.budget.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goalList = goals.split("\n").map((g) => g.trim()).filter(Boolean);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Edit project" wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/projects/${project.id}`, {
                method: "PATCH",
                json: {
                  title,
                  brief,
                  goals: goalList,
                  rightsNote: rightsNote || null,
                  budget: { enabled: budgetOn, amount: amount.trim() ? Number(amount) : null, currency: currency.trim() || null, note: budgetNote || null },
                },
              });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Name" htmlFor="edit-title">
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Brief" htmlFor="edit-brief" counter={`${brief.length}/5000`}>
            <Textarea id="edit-brief" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={5000} className="min-h-32" />
          </Field>
          <Field label="Goals" htmlFor="edit-goals" hint={`One per line, up to ${MAX_GOALS}.`} error={goalList.length > MAX_GOALS ? `That's ${goalList.length} — keep it to ${MAX_GOALS}.` : null}>
            <Textarea id="edit-goals" value={goals} onChange={(e) => setGoals(e.target.value)} className="min-h-24" />
          </Field>
          <Field label="Rights" htmlFor="edit-rights" hint="Optional. Anything that applies to the whole project.">
            <Textarea id="edit-rights" value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} maxLength={2000} className="min-h-20" />
          </Field>
          <div className="space-y-3 rounded-2xl border border-border-soft p-4">
            <Switch checked={budgetOn} onCheckedChange={setBudgetOn} label="Track a budget for this project" id="edit-budget" />
            {budgetOn ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <Field label="Amount" htmlFor="edit-amount">
                  <Input id="edit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                </Field>
                <Field label="Currency" htmlFor="edit-currency">
                  <Input id="edit-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="INR" autoCapitalize="characters" />
                </Field>
                <Field label="Note" htmlFor="edit-budget-note" className="sm:col-span-2">
                  <Input id="edit-budget-note" value={budgetNote} onChange={(e) => setBudgetNote(e.target.value)} maxLength={500} />
                </Field>
              </div>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!title.trim() || goalList.length > MAX_GOALS}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ projectId, item, onOpenChange, onSaved }: { projectId: string; item: Item; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [note, setNote] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Note" description={`Why “${item.title}” belongs in this project.`}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/api/v1/projects/${projectId}/items`, { method: "PATCH", json: { itemId: item.id, note: note.trim() || null } });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Note" htmlFor="item-note" error={error}>
            <Textarea id="item-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-24" autoFocus />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save note
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/** Who's working on this, at a glance (Project > Crew). */
function CrewStrip({ projectId, crew, canEdit, projectTitle }: { projectId: string; crew: CrewSummary | null; canEdit: boolean; projectTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(projectTitle);
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!crew && !canEdit) return null;
  return (
    <section aria-label="Crew">
      <SectionHeader title="Crew" action={crew ? <Link href={`/crews/${crew.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">Open crew</Link> : undefined} />
      {crew ? (
        <Link href={`/crews/${crew.id}`} className="flex items-center gap-4 rounded-2xl border border-border-soft bg-surface px-4 py-3 hover:bg-black/[0.02]">
          <AvatarStack people={crew.members.map((m) => ({ name: m.name, src: m.avatarUrl }))} size={36} max={5} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">
              {crew.name} <Badge tone={crew.status === "active" ? "success" : "accent"}>{CREW_STATUS_LABEL[crew.status]}</Badge>
            </span>
            <span className="line-clamp-1 text-sm text-ink-muted">
              {crew.members.map((m) => (m.roleTitle ? `${m.name} (${m.roleTitle})` : m.name)).join(", ")}
              {crew.invited ? ` · ${crew.invited} invited` : ""}
            </span>
          </span>
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-4">
          <Avatar name="+" size={36} />
          <p className="min-w-0 flex-1 text-[15px] text-ink-muted">Bring people in: a crew is the team for this project, with whatever roles it needs.</p>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Users className="size-4" aria-hidden /> Start a crew
          </Button>
        </div>
      )}
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent title="Start a crew" description="You'll be its owner. Invite people next — they choose whether to join.">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  const r = await api<{ crew: { id: string } }>(`/api/v1/projects/${projectId}/crew`, { method: "POST", json: { name, purpose } });
                  router.push(`/crews/${r.crew.id}`);
                } catch (err) {
                  setError(errorMessage(err));
                  setBusy(false);
                }
              }}
            >
              <Field label="Crew name" htmlFor="crew-name">
                <Input id="crew-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
              </Field>
              <Field label="Purpose" htmlFor="crew-purpose" hint="Optional. What is this crew coming together to make?">
                <Textarea id="crew-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={2000} className="min-h-24" />
              </Field>
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy} disabled={!name.trim()}>
                  Start crew
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
