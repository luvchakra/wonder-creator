"use client";
import { CREW_ACCESS_HELP, CREW_ACCESS_LABEL, CREW_STATUS_LABEL, ROLE_SUGGESTIONS, type CrewAccess, type CrewStatus } from "@wonder/creator-projects/options";
import { Avatar, Badge, Button, ConfirmDialog, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Select, Textarea } from "@wonder/ui";
import { ArrowLeft, MoreHorizontal, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { CreatorPicker, type PickedCreator } from "@/components/creator-picker";
import { api, errorMessage } from "@/lib/client";

interface Member {
  creatorId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  access: CrewAccess;
  roleTitle: string | null;
  status: string;
  inviteNote: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  endedAt: string | null;
}

interface Activity {
  id: string;
  kind: string;
  actor: string | null;
  subject: string | null;
  detail: Record<string, unknown>;
  at: string;
}

function describe(a: Activity): string {
  const who = a.actor ?? "Someone";
  const them = a.subject ?? "someone";
  const role = typeof a.detail.role === "string" && a.detail.role ? ` as ${a.detail.role}` : "";
  switch (a.kind) {
    case "crew_created":
      return `${who} started the crew`;
    case "crew_updated":
      return a.detail.status ? `${who} marked the crew ${String(a.detail.status)}` : `${who} updated the crew's details`;
    case "invited":
      return `${who} invited ${them}${role}`;
    case "invite_cancelled":
      return `${who} cancelled ${them}'s invitation`;
    case "joined":
      return `${them} joined`;
    case "declined":
      return `${them} declined the invitation`;
    case "role_changed":
      return a.detail.access ? `${who} made ${them} ${CREW_ACCESS_LABEL[a.detail.access as CrewAccess]?.toLowerCase() ?? "a member"}` : `${who} changed ${them}'s role${role ? ` to ${String(a.detail.role)}` : ""}`;
    case "left":
      return `${them} left`;
    case "removed":
      return `${who} removed ${them}`;
    default:
      return `${who} updated the crew`;
  }
}

export function CrewView({
  viewerId,
  crew,
  project,
  me,
  active,
  invited,
  former,
  activity,
}: {
  viewerId: string;
  crew: { id: string; name: string; purpose: string; status: CrewStatus; projectId: string; ownerId: string };
  project: { id: string; title: string; brief: string };
  me: (Member & { inviterName: string | null }) | null;
  active: Member[];
  invited: Member[];
  former: Member[];
  activity: Activity[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [roleFor, setRoleFor] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; run: () => Promise<void> } | null>(null);

  const myAccess = me?.status === "active" ? me.access : null;
  const manages = myAccess === "owner" || myAccess === "admin";

  async function act(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setMsg(done);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const canRemove = (m: Member) => m.creatorId !== viewerId && m.access !== "owner" && (myAccess === "owner" || (myAccess === "admin" && m.access === "member"));

  return (
    <div className="space-y-8">
      <div>
        {myAccess ? (
          <Link href={`/projects/${project.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> {project.title}
          </Link>
        ) : (
          <Link href="/projects" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Projects
          </Link>
        )}
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-words font-display text-3xl text-ink sm:text-4xl">{crew.name}</h1>
          <Badge tone={crew.status === "active" ? "success" : "accent"}>{CREW_STATUS_LABEL[crew.status]}</Badge>
        </div>
        <p className="text-[15px] text-ink-muted">
          Crew for <span className="font-medium text-ink">{project.title}</span>
          {crew.purpose ? ` — ${crew.purpose}` : ""}
        </p>
        {myAccess ? (
          <div className="flex flex-wrap gap-2">
            {manages && crew.status !== "completed" ? (
              <Button onClick={() => setInviting(true)}>
                <UserPlus className="size-4" aria-hidden /> Invite people
              </Button>
            ) : null}
            {active.length > 1 ? (
              <Button
                variant="secondary"
                loading={busy === "huddle"}
                onClick={async () => {
                  setBusy("huddle");
                  setError(null);
                  try {
                    const r = await api<{ huddleId: string }>(`/api/v1/crews/${crew.id}/huddle`, { method: "POST" });
                    router.push(`/huddles/${r.huddleId}`);
                  } catch (e) {
                    setError(errorMessage(e));
                    setBusy(null);
                  }
                }}
              >
                <Users className="size-4" aria-hidden /> Start a Huddle with the crew
              </Button>
            ) : null}
            <Menu>
              <MenuTrigger className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface hover:bg-black/[0.03]" aria-label="More crew actions">
                <MoreHorizontal className="size-5" aria-hidden />
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => me && setRoleFor(me)}>Change my role</MenuItem>
                {manages ? <MenuItem onSelect={() => setEditing(true)}>Edit crew</MenuItem> : null}
                {manages && crew.status !== "completed" ? (
                  <MenuItem onSelect={() => act("complete", () => api(`/api/v1/crews/${crew.id}`, { method: "PATCH", json: { status: "completed" } }), "The crew is marked completed.")}>Mark completed</MenuItem>
                ) : null}
                {myAccess !== "owner" ? (
                  <MenuItem
                    destructive
                    onSelect={() =>
                      setConfirm({
                        title: "Leave this crew?",
                        body: "You'll stop seeing the project. What you contributed stays credited to you, and your membership stays in the crew's history.",
                        label: "Leave crew",
                        run: async () => {
                          await api(`/api/v1/crews/${crew.id}/leave`, { method: "POST" });
                          router.replace("/projects");
                          router.refresh();
                        },
                      })
                    }
                  >
                    Leave crew
                  </MenuItem>
                ) : null}
              </MenuContent>
            </Menu>
          </div>
        ) : null}
      </header>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {me?.status === "invited" ? (
        <section aria-label="Your invitation" className="rounded-3xl border border-[#cfd0ff] bg-accent-softer p-5 sm:p-6">
          <h2 className="font-display text-2xl text-ink">You&rsquo;re invited</h2>
          <p className="mt-2 text-[15px] text-ink">
            {me.inviterName ?? "Someone"} invited you to join <span className="font-medium">{crew.name}</span>
            {me.roleTitle ? (
              <>
                {" "}
                as <span className="font-medium">{me.roleTitle}</span>
              </>
            ) : null}
            .
          </p>
          {me.inviteNote ? <blockquote className="mt-3 border-l-2 border-accent pl-3 text-[15px] italic text-ink-muted">{me.inviteNote}</blockquote> : null}
          <dl className="mt-4 grid gap-3 text-[15px] sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-subtle">Project</dt>
              <dd className="text-ink">{project.title}</dd>
              {project.brief ? <dd className="mt-1 line-clamp-4 text-ink-muted">{project.brief}</dd> : null}
            </div>
            <div>
              <dt className="text-sm text-ink-subtle">What you could do</dt>
              <dd className="text-ink">{CREW_ACCESS_LABEL[me.access]}</dd>
              <dd className="mt-1 text-ink-muted">{CREW_ACCESS_HELP[me.access]} Your own material and pieces stay private unless you share them.</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" loading={busy === "decline"} onClick={() => act("decline", () => api(`/api/v1/crews/${crew.id}/respond`, { method: "POST", json: { accept: false } }).then(() => router.replace("/projects")), "You declined the invitation.")}>
              Decline
            </Button>
            <Button loading={busy === "accept"} onClick={() => act("accept", () => api(`/api/v1/crews/${crew.id}/respond`, { method: "POST", json: { accept: true } }), `Welcome to ${crew.name}.`)}>
              Join the crew
            </Button>
          </div>
        </section>
      ) : null}

      <section aria-label="People">
        <SectionHeader title={`People (${active.length})`} />
        <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
          {active.map((m) => (
            <li key={m.creatorId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.name} src={m.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-medium text-ink">
                  {m.handle ? (
                    <Link href={`/creators/${m.handle}`} className="hover:underline">
                      {m.name}
                    </Link>
                  ) : (
                    m.name
                  )}
                  {m.creatorId === viewerId ? <span className="font-normal text-ink-subtle"> (you)</span> : null}
                </p>
                <p className="line-clamp-1 text-sm text-ink-muted">{m.roleTitle ?? "No role yet"}</p>
              </div>
              {m.access !== "member" ? <Badge tone={m.access === "owner" ? "accent" : "neutral"}>{CREW_ACCESS_LABEL[m.access]}</Badge> : null}
              {myAccess && (manages || m.creatorId === viewerId) ? (
                <Menu>
                  <MenuTrigger aria-label={`Options for ${m.name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                    <MoreHorizontal className="size-5" aria-hidden />
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem onSelect={() => setRoleFor(m)}>Change role</MenuItem>
                    {myAccess === "owner" && m.creatorId !== viewerId ? (
                      <MenuItem
                        onSelect={() =>
                          act(`access:${m.creatorId}`, () => api(`/api/v1/crews/${crew.id}/members`, { method: "PATCH", json: { creatorId: m.creatorId, access: m.access === "admin" ? "member" : "admin" } }), m.access === "admin" ? `${m.name} is now a member.` : `${m.name} is now an admin.`)
                        }
                      >
                        {m.access === "admin" ? "Make member" : "Make admin"}
                      </MenuItem>
                    ) : null}
                    {canRemove(m) ? (
                      <MenuItem
                        destructive
                        onSelect={() =>
                          setConfirm({
                            title: `Remove ${m.name}?`,
                            body: `${m.name} will stop seeing the project. What they contributed stays credited to them, and their membership stays in the crew's history.`,
                            label: "Remove",
                            run: () => api(`/api/v1/crews/${crew.id}/members`, { method: "DELETE", json: { creatorId: m.creatorId } }).then(() => (setMsg(`${m.name} was removed from the crew.`), router.refresh())),
                          })
                        }
                      >
                        Remove from crew
                      </MenuItem>
                    ) : null}
                  </MenuContent>
                </Menu>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {invited.length && myAccess ? (
        <section aria-label="Invited">
          <SectionHeader title={`Invited (${invited.length})`} />
          <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-dashed border-border bg-surface/70">
            {invited.map((m) => (
              <li key={m.creatorId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} src={m.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-ink">{m.name}</p>
                  <p className="line-clamp-1 text-sm text-ink-muted">
                    {m.roleTitle ? `${m.roleTitle} · ` : ""}Invited {m.invitedAt ? <RelativeTime iso={m.invitedAt} /> : null}
                  </p>
                </div>
                <Badge tone="neutral">Waiting</Badge>
                {canRemove(m) ? (
                  <Button variant="ghost" loading={busy === `cancel:${m.creatorId}`} onClick={() => act(`cancel:${m.creatorId}`, () => api(`/api/v1/crews/${crew.id}/members`, { method: "DELETE", json: { creatorId: m.creatorId } }), `Cancelled ${m.name}'s invitation.`)}>
                    Cancel
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {former.length ? (
        <section aria-label="Former members">
          <SectionHeader title="Former members" />
          <ul className="space-y-1 text-[15px] text-ink-muted">
            {former.map((m) => (
              <li key={m.creatorId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink">{m.name}</span>
                {m.roleTitle ? <span>· {m.roleTitle}</span> : null}
                <span>
                  · {m.status === "left" ? "left" : "removed"} {m.endedAt ? <RelativeTime iso={m.endedAt} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activity.length ? (
        <section aria-label="Activity">
          <SectionHeader title="Activity" />
          <ol className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-[15px]">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 flex-1 text-ink">
                  {describe(a)} <span className="text-sm text-ink-subtle">· <RelativeTime iso={a.at} /></span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {inviting ? <InviteDialog crewId={crew.id} owner={myAccess === "owner"} exclude={[...active, ...invited].map((m) => m.creatorId)} onOpenChange={setInviting} onInvited={(n) => (setMsg(`Invited ${n}.`), router.refresh())} /> : null}
      {editing ? <EditCrewDialog crew={crew} onOpenChange={setEditing} onSaved={() => (setEditing(false), setMsg("Crew saved."), router.refresh())} /> : null}
      {roleFor ? <RoleDialog crewId={crew.id} member={roleFor} onOpenChange={(o) => !o && setRoleFor(null)} onSaved={() => (setRoleFor(null), setMsg("Role updated."), router.refresh())} /> : null}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        confirmLabel={confirm?.label ?? "OK"}
        destructive
        busy={busy === "confirm"}
        onConfirm={async () => {
          if (!confirm) return;
          setBusy("confirm");
          setError(null);
          try {
            await confirm.run();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(null);
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}

function RoleSuggestions({ value, onPick, id }: { value: string; onPick: (v: string) => void; id: string }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-labelledby={id}>
      {ROLE_SUGGESTIONS.map((r) => (
        <li key={r}>
          <button
            type="button"
            onClick={() => onPick(r)}
            aria-pressed={value === r}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm text-ink-muted hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-ink"
          >
            {r}
          </button>
        </li>
      ))}
    </ul>
  );
}

function InviteDialog({ crewId, owner, exclude, onOpenChange, onInvited }: { crewId: string; owner: boolean; exclude: string[]; onOpenChange: (o: boolean) => void; onInvited: (name: string) => void }) {
  const [who, setWho] = useState<PickedCreator | null>(null);
  const [role, setRole] = useState("");
  const [access, setAccess] = useState<"member" | "admin">("member");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Invite to the crew" description="They'll see the project's name and brief, their role and your note, and choose whether to join." wide>
        {who ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await api(`/api/v1/crews/${crewId}/members`, { method: "POST", json: { creatorId: who.id, access, roleTitle: role || undefined, note: note || undefined } });
                onInvited(who.display_name);
                onOpenChange(false);
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-accent-softer px-4 py-3">
              <Avatar name={who.display_name} size={36} />
              <p className="min-w-0 flex-1 text-ink">
                {who.display_name} <span className="text-ink-subtle">@{who.handle}</span>
              </p>
              <Button type="button" variant="ghost" onClick={() => setWho(null)}>
                Change
              </Button>
            </div>
            <Field label="Role" htmlFor="invite-role" hint="Any role — name it the way your crew works.">
              <Input id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} />
            </Field>
            <div>
              <p id="role-suggestions" className="text-sm text-ink-subtle">
                Or pick one
              </p>
              <RoleSuggestions id="role-suggestions" value={role} onPick={setRole} />
            </div>
            {owner ? (
              <Field label="What they can do" htmlFor="invite-access" hint={CREW_ACCESS_HELP[access]}>
                <Select id="invite-access" value={access} onChange={(e) => setAccess(e.target.value as "member" | "admin")}>
                  <option value="member">{CREW_ACCESS_LABEL.member}</option>
                  <option value="admin">{CREW_ACCESS_LABEL.admin}</option>
                </Select>
              </Field>
            ) : null}
            <Field label="Note" htmlFor="invite-note" hint="Optional. Why them, and what you'd love them to bring.">
              <Textarea id="invite-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Send invitation
              </Button>
            </div>
          </form>
        ) : (
          <CreatorPicker id="crew-invite-picker" exclude={exclude} actionLabel="Choose" onPick={(c) => setWho(c)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ crewId, member, onOpenChange, onSaved }: { crewId: string; member: Member; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [role, setRole] = useState(member.roleTitle ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={`${member.name}'s role`}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/crews/${crewId}/members`, { method: "PATCH", json: { creatorId: member.creatorId, roleTitle: role.trim() || null } });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Role" htmlFor="role-title" error={error}>
            <Input id="role-title" value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} autoFocus />
          </Field>
          <RoleSuggestions id="role-title" value={role} onPick={setRole} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCrewDialog({ crew, onOpenChange, onSaved }: { crew: { id: string; name: string; purpose: string }; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(crew.name);
  const [purpose, setPurpose] = useState(crew.purpose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Edit crew">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/crews/${crew.id}`, { method: "PATCH", json: { name, purpose } });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Crew name" htmlFor="edit-crew-name">
            <Input id="edit-crew-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Purpose" htmlFor="edit-crew-purpose" error={error}>
            <Textarea id="edit-crew-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={2000} className="min-h-24" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

