"use client";
import { TASK_GROUP_ORDER, TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from "@wonder/creator-projects/options";
import { Badge, Button, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Segmented, Select, Switch, Textarea, cn, EmptyNote, KIT } from "@wonder/ui";
import { CalendarDays, Flag, MoreHorizontal, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LocalTime, RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueOn: string | null;
  overdue: boolean;
  milestone: { id: string; title: string } | null;
  itemId: string | null;
  dependsOn: { id: string; title: string; done: boolean } | null;
  needsApproval: boolean;
  createdBy: string | null;
  assignees: Array<{ id: string; name: string }>;
  comments: number;
}

export interface MilestoneRow {
  id: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  doneAt: string | null;
  tasks: number;
  tasksDone: number;
}

export interface Summary {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  blocked: number;
  overdue: number;
  nextMilestone: { title: string; dueOn: string | null; overdue: boolean } | null;
}

type Role = "owner" | "admin" | "member";

const dateLabel = (d: string) => <LocalTime iso={`${d}T12:00:00`} options={{ day: "numeric", month: "short" }} />;

export function TasksPanel({
  projectId,
  role,
  viewerId,
  tasks,
  milestones,
  summary,
  people,
  items,
}: {
  projectId: string;
  role: Role;
  viewerId: string;
  tasks: TaskRow[];
  milestones: MilestoneRow[];
  summary: Summary;
  people: Array<{ id: string; name: string }>;
  /** Things in the project a task can relate to. */
  items: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const manages = role === "owner" || role === "admin";
  const [editing, setEditing] = useState<TaskRow | "new" | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  // Light by default (UI redesign §26): what's moving now; finished work is one tap away.
  const [view, setView] = useState<"open" | "done">("open");
  const [milestoneFor, setMilestoneFor] = useState<MilestoneRow | "new" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const itemTitle = new Map(items.map((i) => [i.id, i.title]));

  async function act(fn: () => Promise<unknown>, done: string) {
    setError(null);
    try {
      await fn();
      setMsg(done);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const canMove = (t: TaskRow) => manages || t.createdBy === viewerId || t.assignees.some((a) => a.id === viewerId);

  return (
    <div className="space-y-8">
      <section aria-label="Progress" className="rounded-2xl border border-border-soft bg-surface px-5 py-4">
        {summary.total ? (
          <p className="text-[15px] text-ink">
            {summary.inProgress} in progress · {summary.review} in review · {summary.todo} to do · {summary.done} done
            {summary.blocked ? <span className="text-danger"> · {summary.blocked} blocked</span> : null}
            {summary.overdue ? <span className="text-danger"> · {summary.overdue} overdue</span> : null}
          </p>
        ) : (
          <p className="text-[15px] text-ink-muted">No tasks yet. Keep it light: a few clear next steps are plenty.</p>
        )}
        {summary.nextMilestone ? (
          <p className="mt-1 text-sm text-ink-muted">
            Next milestone: <span className="text-ink">{summary.nextMilestone.title}</span>
            {summary.nextMilestone.dueOn ? <> · {dateLabel(summary.nextMilestone.dueOn)}</> : null}
            {summary.nextMilestone.overdue ? <span className="text-danger"> · overdue</span> : null}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> New task
          </Button>
          {manages ? (
            <Button variant="secondary" onClick={() => setSuggesting(true)}>
              <Sparkles className="size-4" aria-hidden /> Suggest tasks
            </Button>
          ) : null}
        </div>
      </section>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {summary.total ? (
        <Segmented
          label="Tasks view"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `In progress (${summary.total - summary.done})` },
            { value: "done", label: `Completed (${summary.done})` },
          ]}
        />
      ) : null}
      {view === "done" && !summary.done ? <p className="text-[15px] text-ink-muted">Nothing finished yet.</p> : null}
      {view === "open" && summary.total && summary.total === summary.done ? <p className="text-[15px] text-ink-muted">Everything&rsquo;s done. Add a task when there&rsquo;s a next step.</p> : null}

      {TASK_GROUP_ORDER.map((status) => {
        const list = tasks.filter((t) => t.status === status);
        if (!list.length) return null;
        if ((view === "done") !== (status === "done")) return null;
        const body = (
          <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
            {list.map((t) => {
              const waiting = t.dependsOn && !t.dependsOn.done;
              const onIt = t.assignees.some((a) => a.id === viewerId);
              return (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setEditing(t)} className={cn("min-h-11 text-left font-medium text-ink hover:underline", t.status === "done" && "text-ink-muted line-through")}>
                      {t.title}
                    </button>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                      <span>{t.assignees.length ? t.assignees.map((a) => (a.id === viewerId ? "You" : a.name)).join(", ") : "Nobody yet"}</span>
                      {t.dueOn ? (
                        <span className={cn("inline-flex items-center gap-1", t.overdue && "text-danger")}>
                          <CalendarDays className="size-3.5" aria-hidden /> {dateLabel(t.dueOn)}
                          {t.overdue ? " (overdue)" : ""}
                        </span>
                      ) : null}
                      {t.milestone ? (
                        <span className="inline-flex items-center gap-1">
                          <Flag className="size-3.5" aria-hidden /> {t.milestone.title}
                        </span>
                      ) : null}
                      {t.itemId && itemTitle.has(t.itemId) ? <span>· {itemTitle.get(t.itemId)}</span> : null}
                      {t.comments ? <span>· {t.comments} {t.comments === 1 ? "comment" : "comments"}</span> : null}
                    </p>
                    {waiting ? <p className="text-sm text-danger">Waiting on “{t.dependsOn!.title}”</p> : null}
                  </div>
                  {t.needsApproval ? <Badge tone="warning">Needs approval</Badge> : null}
                  <Menu>
                    <MenuTrigger aria-label={`Options for ${t.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                      <MoreHorizontal className="size-5" aria-hidden />
                    </MenuTrigger>
                    <MenuContent>
                      {canMove(t)
                        ? TASK_STATUSES.filter((s) => s !== t.status && (s !== "done" || !t.needsApproval || manages)).map((s) => (
                            <MenuItem key={s} onSelect={() => act(() => api(`/api/v1/tasks/${t.id}`, { method: "PATCH", json: { status: s } }), `Moved “${t.title}” to ${TASK_STATUS_LABEL[s]}.`)}>
                              Move to {TASK_STATUS_LABEL[s]}
                            </MenuItem>
                          ))
                        : null}
                      {onIt ? (
                        <MenuItem onSelect={() => act(() => api(`/api/v1/tasks/${t.id}/assignees`, { method: "DELETE", json: { creatorId: viewerId } }), `You stepped off “${t.title}”.`)}>Step off this task</MenuItem>
                      ) : (
                        <MenuItem onSelect={() => act(() => api(`/api/v1/tasks/${t.id}/assignees`, { method: "POST", json: { creatorId: viewerId } }), `You took on “${t.title}”.`)}>Take it on</MenuItem>
                      )}
                      <MenuItem onSelect={() => setEditing(t)}>Open</MenuItem>
                      {manages || t.createdBy === viewerId ? (
                        <MenuItem destructive onSelect={() => act(() => api(`/api/v1/tasks/${t.id}`, { method: "DELETE" }), `Removed “${t.title}”.`)}>
                          Remove task
                        </MenuItem>
                      ) : null}
                    </MenuContent>
                  </Menu>
                </li>
              );
            })}
          </ul>
        );
        return (
          <section key={status} aria-label={TASK_STATUS_LABEL[status]}>
            <SectionHeader title={`${TASK_STATUS_LABEL[status]} (${list.length})`} />
            {body}
          </section>
        );
      })}

      <section aria-label="Milestones">
        <SectionHeader
          title="Milestones"
          action={
            manages ? (
              <Button variant="ghost" onClick={() => setMilestoneFor("new")}>
                <Plus className="size-4" aria-hidden /> Add
              </Button>
            ) : undefined
          }
        />
        {milestones.length ? (
          <ol className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Flag className={cn("size-5 shrink-0", m.doneAt ? "text-success" : "text-accent-ink")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium text-ink", m.doneAt && "line-through text-ink-muted")}>{m.title}</p>
                  <p className="text-sm text-ink-muted">
                    {m.dueOn ? <>{dateLabel(m.dueOn)} · </> : null}
                    {m.tasks ? `${m.tasksDone} of ${m.tasks} tasks done` : "No tasks yet"}
                    {m.doneAt ? " · reached" : ""}
                  </p>
                </div>
                {manages ? (
                  <Menu>
                    <MenuTrigger aria-label={`Options for milestone ${m.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                      <MoreHorizontal className="size-5" aria-hidden />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => act(() => api(`/api/v1/milestones/${m.id}`, { method: "PATCH", json: { done: !m.doneAt } }), m.doneAt ? `“${m.title}” reopened.` : `“${m.title}” reached.`)}>
                        {m.doneAt ? "Mark not reached" : "Mark reached"}
                      </MenuItem>
                      <MenuItem onSelect={() => setMilestoneFor(m)}>Edit</MenuItem>
                      <MenuItem destructive onSelect={() => act(() => api(`/api/v1/milestones/${m.id}`, { method: "DELETE" }), `Removed “${m.title}” (its tasks stay).`)}>
                        Remove milestone
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyNote art={KIT.mark.starGold}>
            {manages ? "Mark the moments that matter — a first cut, a demo, a premiere." : "No milestones yet."}
          </EmptyNote>
        )}
      </section>

      {editing ? (
        <TaskDialog
          projectId={projectId}
          task={editing === "new" ? null : editing}
          manages={manages}
          viewerId={viewerId}
          people={people}
          items={items}
          milestones={milestones}
          tasks={tasks}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMsg(text);
            router.refresh();
          }}
        />
      ) : null}
      {suggesting ? <SuggestDialog projectId={projectId} onOpenChange={setSuggesting} onAdded={(n) => (setMsg(`Added ${n} ${n === 1 ? "task" : "tasks"}.`), router.refresh())} /> : null}
      {milestoneFor ? <MilestoneDialog projectId={projectId} milestone={milestoneFor === "new" ? null : milestoneFor} onOpenChange={(o) => !o && setMilestoneFor(null)} onSaved={() => (setMilestoneFor(null), setMsg("Milestone saved."), router.refresh())} /> : null}
    </div>
  );
}

function TaskDialog({
  projectId,
  task,
  manages,
  viewerId,
  people,
  items,
  milestones,
  tasks,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  task: TaskRow | null;
  manages: boolean;
  viewerId: string;
  people: Array<{ id: string; name: string }>;
  items: Array<{ id: string; title: string }>;
  milestones: MilestoneRow[];
  tasks: TaskRow[];
  onOpenChange: (o: boolean) => void;
  onSaved: (msg: string) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueOn, setDueOn] = useState(task?.dueOn ?? "");
  const [milestoneId, setMilestoneId] = useState(task?.milestone?.id ?? "");
  const [itemId, setItemId] = useState(task?.itemId ?? "");
  const [dependsOn, setDependsOn] = useState(task?.dependsOn?.id ?? "");
  const [needsApproval, setNeedsApproval] = useState(task?.needsApproval ?? false);
  const [assignees, setAssignees] = useState<string[]>(task ? task.assignees.map((a) => a.id) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = !task || manages || task.createdBy === viewerId || task.assignees.some((a) => a.id === viewerId);
  const assignable = manages ? people : people.filter((p) => p.id === viewerId);

  async function save() {
    const fields = { title, description, dueOn: dueOn || null, milestoneId: milestoneId || null, itemId: itemId || null, dependsOn: dependsOn || null, ...(manages ? { needsApproval } : {}) };
    if (!task) {
      await api(`/api/v1/projects/${projectId}/tasks`, { method: "POST", json: { ...fields, assigneeIds: assignees } });
      return;
    }
    await api(`/api/v1/tasks/${task.id}`, { method: "PATCH", json: fields });
    const before = new Set(task.assignees.map((a) => a.id));
    for (const id of assignees.filter((a) => !before.has(a))) await api(`/api/v1/tasks/${task.id}/assignees`, { method: "POST", json: { creatorId: id } });
    for (const id of [...before].filter((a) => !assignees.includes(a))) await api(`/api/v1/tasks/${task.id}/assignees`, { method: "DELETE", json: { creatorId: id } });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={task ? task.title : "New task"} description={task ? TASK_STATUS_LABEL[task.status] : undefined} wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await save();
              onSaved(task ? "Task saved." : `Added “${title.trim()}”.`);
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={!editable} className="space-y-4">
            <Field label="Task" htmlFor="task-title">
              <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus={!task} />
            </Field>
            <Field label="Details" htmlFor="task-description" hint="Optional. Context, links, what done looks like.">
              <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} className="min-h-20" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Due" htmlFor="task-due">
                <Input id="task-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              </Field>
              <Field label="Milestone" htmlFor="task-milestone">
                <Select id="task-milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                  <option value="">None</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Related to" htmlFor="task-item">
                <Select id="task-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">Nothing in particular</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Waits on" htmlFor="task-depends">
                <Select id="task-depends" value={dependsOn} onChange={(e) => setDependsOn(e.target.value)}>
                  <option value="">Nothing</option>
                  {tasks
                    .filter((t) => t.id !== task?.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-ink">{manages ? "Who's on it" : "Take it on"}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {assignable.map((p) => (
                  <label key={p.id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                    <input type="checkbox" checked={assignees.includes(p.id)} onChange={() => setAssignees((a) => (a.includes(p.id) ? a.filter((x) => x !== p.id) : [...a, p.id]))} className="accent-[var(--color-accent)]" />
                    {p.id === viewerId ? "Me" : p.name}
                  </label>
                ))}
              </div>
              {!manages ? <p className="mt-1 text-sm text-ink-subtle">Only the owner or an admin assigns other people.</p> : null}
            </fieldset>
            {manages ? <Switch checked={needsApproval} onCheckedChange={setNeedsApproval} label="Needs approval before it's done" id="task-approval" /> : task?.needsApproval ? <p className="text-sm text-ink-muted">This task needs approval: move it to Review when it&rsquo;s ready.</p> : null}
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {editable ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!title.trim()}>
                {task ? "Save" : "Add task"}
              </Button>
            </div>
          ) : null}
        </form>
        {task ? <Comments taskId={task.id} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Comments({ taskId }: { taskId: string }) {
  const [list, setList] = useState<Array<{ id: string; body: string; at: string; author: { name: string } }> | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ comments: Array<{ id: string; body: string; at: string; author: { name: string } }> }>(`/api/v1/tasks/${taskId}/comments`)
      .then((r) => live && setList(r.comments))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [taskId]);
  return (
    <section aria-label="Comments" className="mt-6 border-t border-border-soft pt-4">
      <h3 className="font-medium text-ink">Comments</h3>
      {list === null ? (
        <p className="mt-2 text-sm text-ink-muted">Loading…</p>
      ) : list.length ? (
        <ol className="mt-2 space-y-2">
          {list.map((c) => (
            <li key={c.id} className="rounded-xl bg-accent-softer px-3 py-2 text-[15px]">
              <p className="text-sm text-ink-subtle">
                {c.author.name} · <RelativeTime iso={c.at} />
              </p>
              <p className="whitespace-pre-line text-ink">{c.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">No comments yet.</p>
      )}
      <form
        className="mt-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api(`/api/v1/tasks/${taskId}/comments`, { method: "POST", json: { body } });
            const r = await api<{ comments: Array<{ id: string; body: string; at: string; author: { name: string } }> }>(`/api/v1/tasks/${taskId}/comments`);
            setList(r.comments);
            setBody("");
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Add a comment" htmlFor="task-comment" error={error}>
          <Textarea id="task-comment" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} className="min-h-16" />
        </Field>
        <Button type="submit" variant="secondary" loading={busy} disabled={!body.trim()}>
          Comment
        </Button>
      </form>
    </section>
  );
}

function SuggestDialog({ projectId, onOpenChange, onAdded }: { projectId: string; onOpenChange: (o: boolean) => void; onAdded: (n: number) => void }) {
  const [plan, setPlan] = useState<{ tasks: Array<{ title: string; why?: string }>; missing: string[]; offline: boolean } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ tasks: Array<{ title: string; why?: string }>; missing: string[]; offline: boolean }>(`/api/v1/projects/${projectId}/tasks/suggest`, { method: "POST" })
      .then((r) => {
        if (!live) return;
        setPlan(r);
        setPicked(r.tasks.map((t) => t.title));
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [projectId]);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Suggested tasks" description="CreativeMind suggests; you decide. Nothing is added or assigned until you choose." wide>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : !plan ? (
          <p className="py-6 text-center text-sm text-ink-muted">Thinking about next steps…</p>
        ) : (
          <div className="space-y-4">
            {plan.offline ? <p className="rounded-xl bg-accent-softer px-3 py-2 text-sm text-ink-muted">AI isn&rsquo;t connected, so these are general starting points rather than suggestions about your Creative Room.</p> : null}
            {plan.tasks.length ? (
              <ul className="space-y-1">
                {plan.tasks.map((t) => (
                  <li key={t.title}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2 hover:bg-black/[0.03]">
                      <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]" checked={picked.includes(t.title)} onChange={() => setPicked((p) => (p.includes(t.title) ? p.filter((x) => x !== t.title) : [...p, t.title]))} />
                      <span>
                        <span className="block text-[15px] text-ink">{t.title}</span>
                        {t.why ? <span className="block text-sm text-ink-muted">{t.why}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Nothing new to suggest — your list already covers it.</p>
            )}
            {plan.missing.length ? (
              <div>
                <h3 className="text-sm font-medium text-ink">Might be missing</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
                  {plan.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
                    for (const title of picked) await api(`/api/v1/projects/${projectId}/tasks`, { method: "POST", json: { title } });
                    onAdded(picked.length);
                    onOpenChange(false);
                  } catch (e) {
                    setError(errorMessage(e));
                    setBusy(false);
                  }
                }}
              >
                Add {picked.length || ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MilestoneDialog({ projectId, milestone, onOpenChange, onSaved }: { projectId: string; milestone: MilestoneRow | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [dueOn, setDueOn] = useState(milestone?.dueOn ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={milestone ? "Edit milestone" : "New milestone"}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const json = { title, dueOn: dueOn || null, description };
              if (milestone) await api(`/api/v1/milestones/${milestone.id}`, { method: "PATCH", json });
              else await api(`/api/v1/projects/${projectId}/milestones`, { method: "POST", json });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Milestone" htmlFor="milestone-title">
            <Input id="milestone-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required autoFocus />
          </Field>
          <Field label="Date" htmlFor="milestone-due">
            <Input id="milestone-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="milestone-description" error={error}>
            <Textarea id="milestone-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="min-h-16" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!title.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
