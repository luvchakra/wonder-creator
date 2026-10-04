"use client";
import { PART_KINDS, PART_KIND_LABEL, type PartEventView, type PartKind, type PartView } from "@wonder/creator-projects/parts-options";
import { Avatar, Button, Dialog, DialogContent, Field, Input, KIT, KitArt, Menu, MenuContent, MenuItem, MenuTrigger, buttonClasses, cn } from "@wonder/ui";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { CreatorPicker } from "@/components/creator-picker";
import { api, errorMessage } from "@/lib/client";

/**
 * The Room's parts (docs/creative-room-parts.md): what the joint work is made of, who's on each, where it stands, and
 * what happened — the owner's choice B with C's timeline beneath (4 Oct 2026). One primary action: open, start or
 * claim your part. Everything else lives in each row's menu.
 */
export type PartRow = PartView & { href: string | null };
export interface PartsData {
  parts: PartRow[];
  timeline: PartEventView[];
  /** The Room's owner or a crew admin: adds, renames and removes parts; invites; takes people off. */
  manages: boolean;
  /** In the Room (owner or crew): may claim a part. */
  canClaim: boolean;
  /** The first lines of a writing part the viewer may read, for the hero. */
  excerpt: { partTitle: string; lines: string[] } | null;
}

const DOT: Record<PartView["status"], string> = { open: "border-2 border-border bg-transparent", in_rounds: "bg-accent", final: "bg-success-ink" };

export function PartsPanel({ projectId, viewerId, avatars, parts, timeline, manages, canClaim, excerpt }: PartsData & { projectId: string; viewerId: string; avatars: Record<string, string | null> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<PartRow | null>(null);
  const [rename, setRename] = useState<PartRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [allEvents, setAllEvents] = useState(false);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const call = (part: string, path: string, init: { method: string; json?: unknown }) => api(`/api/v1/projects/${projectId}/parts/${part}${path}`, init);
  const start = (p: PartRow) =>
    run(`start:${p.id}`, async () => {
      const r = await api<{ href: string }>(`/api/v1/projects/${projectId}/parts/${p.id}/start`, { method: "POST", json: {} });
      router.push(r.href);
    });

  const mine = parts.filter((p) => p.mine);
  const invites = parts.filter((p) => p.invitedMe);
  const open = parts.filter((p) => p.status !== "final" && !p.mine);
  const started = parts.filter((p) => p.artifact || p.artifactId).length;
  const finals = parts.filter((p) => p.status === "final").length;
  const primary = mine[0] ?? null;

  return (
    <section aria-labelledby="parts-title" id="parts" className="space-y-3">
      {invites.map((p) => (
        <div key={p.id} role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#cfd0ff] bg-accent-softer px-3.5 py-2.5 text-[14px] text-ink">
          <span className="min-w-0 flex-1">
            You&rsquo;re invited to <span className="font-medium">{p.title}</span> — this part only.
          </span>
          <Button size="sm" loading={busy === `yes:${p.id}`} onClick={() => run(`yes:${p.id}`, () => call(p.id, "/respond", { method: "POST", json: { accept: true } }))}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" loading={busy === `no:${p.id}`} onClick={() => run(`no:${p.id}`, () => call(p.id, "/respond", { method: "POST", json: { accept: false } }))}>
            Decline
          </Button>
        </div>
      ))}

      {/* The work, as it stands: the hero (owner's option B). */}
      <div className="relative isolate overflow-hidden rounded-3xl border border-border-soft bg-[linear-gradient(160deg,#ece7ff_0%,#fbf4ee_60%,#fff7ef_100%)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <KitArt art={KIT.wash.washLavender} sizes="18rem" className="pointer-events-none absolute -right-14 -top-16 -z-10 h-auto w-72 opacity-60" />
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="parts-title" className="font-display text-[19px] text-ink">
            The work
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            {parts.length} {parts.length === 1 ? "part" : "parts"} · {started ? `${started} started` : "nothing started yet"}
            {finals ? ` · ${finals} final` : ""}
          </p>
        </div>
        {excerpt ? (
          <blockquote className="mt-3 font-display text-[16px] leading-[1.65] text-ink">
            {excerpt.lines.map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
            <span className="mt-1 block font-sans text-[12px] text-ink-muted">— {excerpt.partTitle}</span>
          </blockquote>
        ) : (
          <p className="mt-2 text-[13.5px] text-ink-muted">Each part is a Creation of its own, by whoever is on it. None waits on another; nothing is final until its people say so.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {primary ? (
            primary.href ? (
              <Link href={primary.href} className={buttonClasses()}>
                Open {primary.title}
              </Link>
            ) : (
              <Button loading={busy === `start:${primary.id}`} onClick={() => start(primary)}>
                Start {primary.title}
              </Button>
            )
          ) : canClaim && open.length ? (
            <Button onClick={() => setClaiming(true)}>Claim a part</Button>
          ) : null}
          {mine.length > 1 ? <span className="text-[12.5px] text-ink-muted">You&rsquo;re also on {mine.slice(1).map((p) => p.title).join(", ")}.</span> : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-3.5 py-2 text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      <h3 className="pt-1 text-[15px] font-semibold text-ink">Where it stands</h3>
      <ul aria-label="Where it stands" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95">
        {parts.map((p) => {
          const people = p.people.filter((x) => x.status === "active");
          const names = people.length ? people.map((x) => (x.id === viewerId ? "you" : x.name) + (x.outside ? " (this part only)" : "")).join(", ") : "no one yet";
          const line =
            p.status === "final" ? "Final" : p.artifact ? <>v{p.artifact.versionNumber} · <RelativeTime iso={p.artifact.updatedAt} /></> : p.status === "in_rounds" ? "Not started yet" : "Open";
          const inner = (
            <>
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", DOT[p.status])} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold text-ink">{p.title}</span>
                  <span className="truncate text-[12.5px] text-ink-muted">{names}</span>
                </span>
                <span className={cn("block text-[12.5px]", p.status === "final" ? "text-success-ink" : "text-ink-muted")}>{line}</span>
              </span>
              <span className="flex -space-x-2">
                {people.slice(0, 3).map((x) => (
                  <Avatar key={x.id} name={x.name} src={avatars[x.id]} size={24} ring />
                ))}
              </span>
            </>
          );
          return (
            <li key={p.id} className={cn("flex items-center gap-2 pr-1", p.mine && "bg-accent-softer/60")}>
              {p.href ? (
                <Link href={p.href} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-black/[0.02]">
                  {inner}
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                </Link>
              ) : (
                <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2">{inner}</div>
              )}
              <Menu>
                <MenuTrigger className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.04]" aria-label={`${p.title} actions`}>
                  <MoreHorizontal className="size-5" aria-hidden />
                </MenuTrigger>
                <MenuContent>
                  {p.mine && !p.href ? <MenuItem onSelect={() => void start(p)}>Start the Creation</MenuItem> : null}
                  {p.mine && p.href ? <MenuItem onSelect={() => router.push(p.href!)}>Open</MenuItem> : null}
                  {!p.mine && !p.invitedMe && canClaim && p.status !== "final" ? <MenuItem onSelect={() => void run(`claim:${p.id}`, () => call(p.id, "/members", { method: "POST", json: {} }))}>Join this part</MenuItem> : null}
                  {(p.mine || manages) && p.artifactId ? (
                    <MenuItem onSelect={() => void run(`final:${p.id}`, () => call(p.id, "/final", { method: "POST", json: { final: p.status !== "final" } }))}>{p.status === "final" ? "Back into rounds" : "Mark final"}</MenuItem>
                  ) : null}
                  {(p.mine || manages) && p.status !== "final" ? <MenuItem onSelect={() => setInvite(p)}>Invite to this part…</MenuItem> : null}
                  {p.mine ? <MenuItem onSelect={() => void run(`leave:${p.id}`, () => call(p.id, "/members", { method: "DELETE", json: {} }))}>Leave this part</MenuItem> : null}
                  {manages
                    ? p.people
                        .filter((x) => x.id !== viewerId)
                        .map((x) => (
                          <MenuItem key={x.id} onSelect={() => void run(`remove:${p.id}:${x.id}`, () => call(p.id, "/members", { method: "DELETE", json: { creatorId: x.id } }))}>
                            {x.status === "invited" ? `Cancel ${x.name}'s invitation` : `Take ${x.name} off`}
                          </MenuItem>
                        ))
                    : null}
                  {manages ? <MenuItem onSelect={() => setRename(p)}>Rename…</MenuItem> : null}
                  {manages ? (
                    <MenuItem destructive onSelect={() => void run(`delete:${p.id}`, () => call(p.id, "", { method: "DELETE" }))}>
                      Remove part
                    </MenuItem>
                  ) : null}
                </MenuContent>
              </Menu>
            </li>
          );
        })}
      </ul>
      {manages ? (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-accent-ink hover:underline">
          <Plus className="size-4" aria-hidden /> Add a part
        </button>
      ) : null}

      {timeline.length ? (
        <>
          <h3 className="pt-1 text-[15px] font-semibold text-ink">What happened</h3>
          <ol aria-label="What happened" className="space-y-2.5">
            {(allEvents ? timeline : timeline.slice(0, 6)).map((e) => (
              <li key={e.id} className="flex items-start gap-2.5">
                <Avatar name={e.actor?.name ?? "Wonder"} src={e.actor ? avatars[e.actor.id] : null} size={26} className="mt-0.5 shrink-0" />
                <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
                  {describe(e, viewerId)} <span className="text-ink-subtle">· <RelativeTime iso={e.at} /></span>
                </p>
              </li>
            ))}
          </ol>
          {timeline.length > 6 && !allEvents ? (
            <button type="button" onClick={() => setAllEvents(true)} className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
              Earlier
            </button>
          ) : null}
        </>
      ) : null}

      <Dialog open={!!invite} onOpenChange={(o) => !o && setInvite(null)}>
        <DialogContent title={invite ? `Invite to ${invite.title}` : "Invite"} description="To this part only — they needn't join the Room. They'll see the Room's name and its parts." art={KIT.iconChip.users}>
          {invite ? (
            <CreatorPicker
              id="part-invite"
              exclude={[viewerId, ...invite.people.map((x) => x.id)]}
              onPick={async (c) => {
                await run(`invite:${invite.id}`, () => call(invite.id, "/members", { method: "POST", json: { creatorId: c.id } }));
                setInvite(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={claiming} onOpenChange={setClaiming}>
        <DialogContent title="Claim a part" description="Two or more people may share one." art={KIT.iconChip.users}>
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {open.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy === `claim:${p.id}`}
                  onClick={() =>
                    void run(`claim:${p.id}`, async () => {
                      await call(p.id, "/members", { method: "POST", json: {} });
                      setClaiming(false);
                    })
                  }
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{p.title}</span>
                    <span className="block text-[12.5px] text-ink-muted">{PART_KIND_LABEL[p.kind]} · {p.people.filter((x) => x.status === "active").length ? `with ${p.people.filter((x) => x.status === "active").map((x) => x.name).join(", ")}` : "no one yet"}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <PartForm
        open={adding || !!rename}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setRename(null);
          }
        }}
        initial={rename}
        onSubmit={async (v) => {
          if (rename) await run(`rename:${rename.id}`, () => call(rename.id, "", { method: "PATCH", json: { title: v.title } }));
          else await run("add", () => api(`/api/v1/projects/${projectId}/parts`, { method: "POST", json: v }));
          setAdding(false);
          setRename(null);
        }}
      />
    </section>
  );
}

function PartForm({ open, onOpenChange, initial, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; initial: PartRow | null; onSubmit: (v: { title: string; kind: PartKind }) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<PartKind>(initial?.kind ?? "writing");
  const [seen, setSeen] = useState(initial?.id ?? null);
  if ((initial?.id ?? null) !== seen) {
    setSeen(initial?.id ?? null);
    setTitle(initial?.title ?? "");
    setKind(initial?.kind ?? "writing");
  }
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? "Rename the part" : "Add a part"} description={initial ? undefined : "A part is one piece of the work — words, a tune, pictures — that someone takes on."} art={KIT.iconChip.type}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSubmit({ title: title.trim(), kind });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Name" htmlFor="part-title">
            <Input id="part-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required autoFocus placeholder="Lyrics" />
          </Field>
          {initial ? null : (
            <fieldset>
              <legend className="text-sm font-medium text-ink">What kind of thing</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {PART_KINDS.map((k) => (
                  <label key={k} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-3.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                    <input type="radio" name="part-kind" checked={kind === k} onChange={() => setKind(k)} className="accent-[var(--color-accent)]" />
                    {PART_KIND_LABEL[k]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!title.trim()}>
              {initial ? "Rename" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One plain sentence per event; nothing inferred. */
function describe(e: PartEventView, viewerId: string): string {
  const who = e.actor ? (e.actor.id === viewerId ? "You" : e.actor.name) : "Someone";
  const whom = e.subject ? (e.subject.id === viewerId ? "you" : e.subject.name) : "someone";
  const self = e.subject && e.actor && e.subject.id === e.actor.id;
  switch (e.kind) {
    case "added":
      return `${who} added the part ${e.partTitle}.`;
    case "claimed":
      return `${who} took ${e.partTitle}.`;
    case "invited":
      return `${who} invited ${whom} to ${e.partTitle}.`;
    case "joined":
      return `${who} joined ${e.partTitle}.`;
    case "declined":
      return `${who} declined ${e.partTitle}.`;
    case "left":
      return `${who} left ${e.partTitle}.`;
    case "removed":
      return `${who} took ${self ? "themselves" : whom} off ${e.partTitle}.`;
    case "invite_cancelled":
      return `${who} cancelled ${whom}'s invitation to ${e.partTitle}.`;
    case "started":
      return `${who} started ${e.partTitle}.`;
    case "final":
      return `${who} marked ${e.partTitle} final.`;
    case "reopened":
      return `${who} put ${e.partTitle} back into rounds.`;
    case "version": {
      const n = e.detail.versionNumber as number | undefined;
      const label = typeof e.detail.label === "string" && e.detail.label !== "Draft" ? ` — ${e.detail.label}` : "";
      return `${who} saved ${e.partTitle}${n ? ` v${n}` : ""}${label}.`;
    }
    default:
      return `${who}: ${e.kind.replace(/_/g, " ")} — ${e.partTitle}.`;
  }
}
