"use client";
import { CREW_ACCESS_HELP, CREW_ACCESS_LABEL, CREW_STATUS_LABEL, ROLE_SUGGESTIONS, type CrewAccess, type CrewStatus } from "@wonder/creator-projects/options";
import { Avatar, Badge, Button, ConfirmDialog, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Select, Textarea, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, MoreHorizontal, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalTime, RelativeTime } from "@/components/client-time";
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
  scope: string | null;
  compensationNote: string | null;
  rightsNote: string | null;
  expiresAt: string | null;
  declineNote: string | null;
  expired: boolean;
}

interface Message {
  id: string;
  inviteeId: string;
  authorId: string | null;
  author: string;
  body: string;
  at: string;
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
    case "asked":
      return `${them} asked a question about the invitation`;
    case "answered":
      return `${who} answered ${them}'s question`;
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
  messages,
}: {
  viewerId: string;
  crew: { id: string; name: string; purpose: string; status: CrewStatus; projectId: string; ownerId: string };
  project: { id: string; title: string; brief: string };
  me: (Member & { inviterName: string | null }) | null;
  active: Member[];
  invited: Member[];
  former: Member[];
  activity: Activity[];
  messages: Message[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [roleFor, setRoleFor] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; run: () => Promise<void> } | null>(null);
  const [declining, setDeclining] = useState(false);
  const [threadFor, setThreadFor] = useState<Member | null>(null);
  const threadOf = (inviteeId: string) => messages.filter((m) => m.inviteeId === inviteeId);
  const questionWaiting = (inviteeId: string) => {
    const t = threadOf(inviteeId);
    return t.length > 0 && t[t.length - 1].authorId === inviteeId;
  };

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
            <ArrowLeft className="size-4" aria-hidden /> Creative Rooms
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
            {manages && crew.status !== "completed" ? (
              <Link href={`/discover?project=${crew.projectId}`} className={buttonClasses({ variant: "secondary" })}>
                Find collaborators
              </Link>
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
                {myAccess === "owner" && crew.status !== "completed" ? (
                  <MenuItem onSelect={() => router.push(`/projects/${crew.projectId}/complete`)}>Dissolve crew…</MenuItem>
                ) : null}
                {myAccess !== "owner" ? (
                  <MenuItem
                    destructive
                    onSelect={() =>
                      setConfirm({
                        title: "Leave this crew?",
                        body: "You'll stop seeing the Creative Room. What you contributed stays credited to you, and your membership stays in the crew's history.",
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
              <dt className="text-sm text-ink-subtle">Creative Room</dt>
              <dd className="text-ink">{project.title}</dd>
              {project.brief ? <dd className="mt-1 line-clamp-4 text-ink-muted">{project.brief}</dd> : null}
            </div>
            <div>
              <dt className="text-sm text-ink-subtle">What you could do</dt>
              <dd className="text-ink">{CREW_ACCESS_LABEL[me.access]}</dd>
              <dd className="mt-1 text-ink-muted">{CREW_ACCESS_HELP[me.access]} Your own material and Creations stay private unless you share them.</dd>
            </div>
            {me.scope ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-ink-subtle">What you&rsquo;re asked to do</dt>
                <dd className="whitespace-pre-line text-ink">{me.scope}</dd>
              </div>
            ) : null}
            {me.compensationNote ? (
              <div>
                <dt className="text-sm text-ink-subtle">Compensation</dt>
                <dd className="text-ink">{me.compensationNote}</dd>
              </div>
            ) : null}
            {me.rightsNote ? (
              <div>
                <dt className="text-sm text-ink-subtle">Rights & credit</dt>
                <dd className="text-ink">{me.rightsNote}</dd>
              </div>
            ) : null}
            {me.expiresAt ? (
              <div>
                <dt className="text-sm text-ink-subtle">Answer by</dt>
                <dd className="text-ink">
                  <LocalTime iso={me.expiresAt} />
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-sm text-ink-muted">Notes about compensation and rights record what was proposed; they aren&rsquo;t a contract.</p>
          <Thread messages={threadOf(viewerId)} viewerId={viewerId} />
          <AskForm crewId={crew.id} label="Ask a question before you decide" placeholder="Anything you'd like to know first" onSent={() => (setMsg("Your question was sent to the crew's owner and admins."), router.refresh())} />
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setDeclining(true)}>
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
                            body: `${m.name} will stop seeing the Creative Room. What they contributed stays credited to them, and their membership stays in the crew's history.`,
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
                    {m.roleTitle ? `${m.roleTitle} · ` : ""}
                    {m.expired ? (
                      "Expired"
                    ) : m.expiresAt ? (
                      <>
                        Answer by <LocalTime iso={m.expiresAt} />
                      </>
                    ) : (
                      <>Invited {m.invitedAt ? <RelativeTime iso={m.invitedAt} /> : null}</>
                    )}
                  </p>
                </div>
                {m.expired ? <Badge tone="warning">Expired</Badge> : questionWaiting(m.creatorId) ? <Badge tone="accent">Question asked</Badge> : <Badge tone="neutral">Waiting</Badge>}
                {manages ? (
                  <Menu>
                    <MenuTrigger aria-label={`Invitation options for ${m.name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                      <MoreHorizontal className="size-5" aria-hidden />
                    </MenuTrigger>
                    <MenuContent>
                      {!m.expired ? <MenuItem onSelect={() => setThreadFor(m)}>{threadOf(m.creatorId).length ? "Questions & answers" : "Invitation details"}</MenuItem> : null}
                      {m.expired && (myAccess === "owner" || m.access === "member") ? (
                        <MenuItem
                          onSelect={() =>
                            act(
                              `reinvite:${m.creatorId}`,
                              () =>
                                api(`/api/v1/crews/${crew.id}/members`, {
                                  method: "POST",
                                  json: { creatorId: m.creatorId, access: m.access === "owner" ? "member" : m.access, roleTitle: m.roleTitle ?? undefined, note: m.inviteNote ?? undefined, scope: m.scope ?? undefined, compensation: m.compensationNote ?? undefined, rights: m.rightsNote ?? undefined },
                                }),
                              `Invited ${m.name} again.`,
                            )
                          }
                        >
                          Invite again
                        </MenuItem>
                      ) : null}
                      {canRemove(m) ? (
                        <MenuItem destructive onSelect={() => act(`cancel:${m.creatorId}`, () => api(`/api/v1/crews/${crew.id}/members`, { method: "DELETE", json: { creatorId: m.creatorId } }), `Cancelled ${m.name}'s invitation.`)}>
                          Cancel invitation
                        </MenuItem>
                      ) : null}
                    </MenuContent>
                  </Menu>
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

      {declining ? (
        <DeclineDialog
          crewName={crew.name}
          onOpenChange={setDeclining}
          onDecline={async (note) => {
            await api(`/api/v1/crews/${crew.id}/respond`, { method: "POST", json: { accept: false, note: note || undefined } });
            router.replace("/projects");
            router.refresh();
          }}
        />
      ) : null}
      {threadFor ? <ThreadDialog crewId={crew.id} member={threadFor} messages={threadOf(threadFor.creatorId)} viewerId={viewerId} onOpenChange={(o) => !o && setThreadFor(null)} onSent={() => router.refresh()} /> : null}
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
  const [scope, setScope] = useState("");
  const [compensation, setCompensation] = useState("");
  const [rights, setRights] = useState("");
  const [days, setDays] = useState<3 | 7 | 14 | 30>(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Invite to the crew" description="They'll see the Creative Room's name and brief, their role and your note, and choose whether to join." wide>
        {who ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await api(`/api/v1/crews/${crewId}/members`, { method: "POST", json: { creatorId: who.id, access, roleTitle: role || undefined, note: note || undefined, scope: scope || undefined, compensation: compensation || undefined, rights: rights || undefined, expiresInDays: days } });
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
            <Field label="What you're asking them to do" htmlFor="invite-scope" hint="Optional, but it helps them decide: the work, rough timing, how much.">
              <Textarea id="invite-scope" value={scope} onChange={(e) => setScope(e.target.value)} maxLength={1000} className="min-h-20" />
            </Field>
            <Field label="Note" htmlFor="invite-note" hint="Optional. Why them, and what you'd love them to bring.">
              <Textarea id="invite-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Compensation" htmlFor="invite-compensation" hint="Optional. E.g. flat fee, revenue share, unpaid collaboration.">
                <Input id="invite-compensation" value={compensation} onChange={(e) => setCompensation(e.target.value)} maxLength={500} />
              </Field>
              <Field label="Rights & credit" htmlFor="invite-rights" hint="Optional. E.g. credit, who owns what.">
                <Input id="invite-rights" value={rights} onChange={(e) => setRights(e.target.value)} maxLength={1000} />
              </Field>
            </div>
            <Field label="Expires in" htmlFor="invite-expiry" hint="After this, it can't be accepted — you can invite them again.">
              <Select id="invite-expiry" value={String(days)} onChange={(e) => setDays(Number(e.target.value) as 3 | 7 | 14 | 30)}>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </Select>
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


function Thread({ messages, viewerId }: { messages: Message[]; viewerId: string }) {
  if (!messages.length) return null;
  return (
    <ol aria-label="Questions and answers" className="mt-4 space-y-2">
      {messages.map((m) => (
        <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-[15px]", m.authorId === viewerId ? "ml-auto bg-accent-soft text-ink" : "bg-surface text-ink")}>
          <p className="text-sm text-ink-subtle">
            {m.authorId === viewerId ? "You" : m.author} · <RelativeTime iso={m.at} />
          </p>
          <p className="whitespace-pre-line">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}

function AskForm({ crewId, inviteeId, label, placeholder, onSent }: { crewId: string; inviteeId?: string; label: string; placeholder: string; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = inviteeId ? `answer-${inviteeId}` : "ask-question";
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/api/v1/crews/${crewId}/questions`, { method: "POST", json: { body, inviteeId } });
          setBody("");
          onSent();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={label} htmlFor={id} error={error}>
        <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder={placeholder} className="min-h-20" />
      </Field>
      <Button type="submit" variant="secondary" loading={busy} disabled={!body.trim()}>
        Send
      </Button>
    </form>
  );
}

function ThreadDialog({ crewId, member, messages, viewerId, onOpenChange, onSent }: { crewId: string; member: Member; messages: Message[]; viewerId: string; onOpenChange: (o: boolean) => void; onSent: () => void }) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={`Invitation for ${member.name}`} wide>
        <dl className="grid gap-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-subtle">Role</dt>
            <dd className="text-ink">{member.roleTitle ?? "No role yet"} · {CREW_ACCESS_LABEL[member.access]}</dd>
          </div>
          {member.expiresAt ? (
            <div>
              <dt className="text-sm text-ink-subtle">Answer by</dt>
              <dd className="text-ink">
                <LocalTime iso={member.expiresAt} />
              </dd>
            </div>
          ) : null}
          {member.scope ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-ink-subtle">Asked to do</dt>
              <dd className="whitespace-pre-line text-ink">{member.scope}</dd>
            </div>
          ) : null}
          {member.compensationNote ? (
            <div>
              <dt className="text-sm text-ink-subtle">Compensation</dt>
              <dd className="text-ink">{member.compensationNote}</dd>
            </div>
          ) : null}
          {member.rightsNote ? (
            <div>
              <dt className="text-sm text-ink-subtle">Rights & credit</dt>
              <dd className="text-ink">{member.rightsNote}</dd>
            </div>
          ) : null}
        </dl>
        <Thread messages={messages} viewerId={viewerId} />
        {messages.length ? <AskForm crewId={crewId} inviteeId={member.creatorId} label="Your answer" placeholder={`Reply to ${member.name}`} onSent={onSent} /> : <p className="mt-4 text-sm text-ink-muted">No questions yet.</p>}
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ crewName, onOpenChange, onDecline }: { crewName: string; onOpenChange: (o: boolean) => void; onDecline: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={`Decline ${crewName}?`} description="They'll see that you declined. A reason is optional.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await onDecline(note.trim());
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Reason (optional)" htmlFor="decline-note" error={error}>
            <Textarea id="decline-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Keep invitation
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Decline
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
