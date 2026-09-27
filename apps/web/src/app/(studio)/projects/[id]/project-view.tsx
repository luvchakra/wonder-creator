"use client";
import { MAX_GOALS, PROJECT_ITEM_LABEL, PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectItemKind, type ProjectStatus } from "@wonder/creator-projects/options";
import { BACKGROUNDS, Badge, Button, ConfirmDialog, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Select, Switch, Textarea, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, MessageCircle, MoreHorizontal, PenLine, Plus, Search, Sparkles, Users } from "lucide-react";
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
}

/** Sections in the order the work matters: what's being made, what it's made from, then how it's being made. */
const SECTIONS: Array<{ kind: ProjectItemKind[]; title: string; add: ProjectItemKind; empty: string }> = [
  { kind: ["artifact"], title: "Pieces", add: "artifact", empty: "Pieces you make in this project, or add to it, appear here." },
  { kind: ["material", "reference"], title: "Material & references", add: "material", empty: "Add the notes, images, voice memos and references this work draws on." },
  { kind: ["conversation"], title: "Conversations", add: "conversation", empty: "Conversations started in this project appear here." },
  { kind: ["huddle"], title: "Huddles", add: "huddle", empty: "Add Huddles you were part of that shaped this work." },
  { kind: ["collection"], title: "Collections", add: "collection", empty: "Add collections that belong with this project." },
];

export function ProjectView({ project, items, approvals }: { project: Project; items: Item[]; approvals: Array<{ id: string; actionLabel: string; understood: string; urgent: boolean }> }) {
  const router = useRouter();
  const [status, setStatus] = useState(project.status);
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
        <div className="relative h-40 sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={project.coverUrl ?? BACKGROUNDS.botanicalLeaves} alt="" className={cn("size-full object-cover", !project.coverUrl && "opacity-60")} />
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 id="project-title" className="break-words font-display text-3xl text-ink sm:text-4xl">
                {project.title}
              </h1>
              <p className="mt-1 text-sm text-ink-subtle">
                Updated <RelativeTime iso={project.updatedAt} />
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="project-status" className="sr-only">
                Status
              </label>
              <Select id="project-status" value={status} onChange={(e) => changeStatus(e.target.value as ProjectStatus)} className="w-40">
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Menu>
                <MenuTrigger className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface hover:bg-black/[0.03]" aria-label="More project actions">
                  <MoreHorizontal className="size-5" aria-hidden />
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setEditing(true)}>Edit details</MenuItem>
                  <MenuItem destructive onSelect={() => setDeleting(true)}>
                    Delete project
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </div>
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
          {!project.brief && !project.goals.length ? (
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 text-left text-[15px] text-accent-ink hover:underline">
              Add a brief and goals — CreatorBrain keeps them in mind when you create here.
            </button>
          ) : null}
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

      {approvals.length ? (
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

      {SECTIONS.map((s) => {
        const list = items.filter((i) => s.kind.includes(i.kind));
        return (
          <section key={s.title} aria-label={s.title}>
            <SectionHeader
              title={`${s.title}${list.length ? ` (${list.length})` : ""}`}
              action={
                <Button variant="ghost" onClick={() => setAdding(s.add)}>
                  <Plus className="size-4" aria-hidden /> Add
                </Button>
              }
            />
            {!list.length ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">{s.empty}</p>
            ) : s.kind[0] === "artifact" || s.kind[0] === "material" ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((i) => (
                  <li key={i.id} className="relative">
                    {i.artifact ? <ArtifactCard a={i.artifact} /> : i.material ? <MaterialCard m={i.material} href={i.href ?? undefined} /> : <Unavailable title={i.title} />}
                    <ItemMenu item={i} onUnlink={unlink} onNote={setNoteFor} onCover={i.kind === "material" && i.material && (i.material.type === "image" || i.material.type === "sketch") ? makeCover : undefined} />
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
                    <ItemMenu item={i} onUnlink={unlink} onNote={setNoteFor} inline />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section aria-label="Rights">
        <SectionHeader
          title="Rights"
          action={
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          }
        />
        <p className="rounded-2xl border border-border-soft bg-surface px-5 py-4 text-[15px] leading-relaxed text-ink-muted">
          {project.rightsNote || "Each piece keeps its own rights and licences. Note anything that applies to the whole project here — for example, who owns what, or what a collaborator agreed to."}
        </p>
      </section>

      {project.budget.enabled ? (
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

function ItemMenu({ item, onUnlink, onNote, onCover, inline }: { item: Item; onUnlink: (i: Item) => void; onNote: (i: Item) => void; onCover?: (i: Item) => void; inline?: boolean }) {
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
        {onCover ? <MenuItem onSelect={() => onCover(item)}>Use as project cover</MenuItem> : null}
        <MenuItem destructive onSelect={() => onUnlink(item)}>
          Remove from project
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const ADD_KINDS: ProjectItemKind[] = ["artifact", "material", "reference", "conversation", "huddle", "collection"];

function AddDialog({ projectId, initialKind, onOpenChange, onAdded }: { projectId: string; initialKind: ProjectItemKind; onOpenChange: (o: boolean) => void; onAdded: (n: number, kind: ProjectItemKind) => void }) {
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
      <DialogContent title="Add to project" description="Adding links your work to the project. Nothing is moved or copied." wide>
        <div className="-mx-1 overflow-x-auto px-1">
          <div role="radiogroup" aria-label="What to add" className="flex gap-2">
            {ADD_KINDS.map((k) => (
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
                const r = await api<{ added: number }>(`/api/v1/projects/${projectId}/items`, { method: "POST", json: { kind, ids: picked } });
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

