"use client";
import { DELIVERABLE_STATUS_LABEL } from "@wonder/creator-projects/campaign-labels";
import { Badge, Button, Field, Input, Textarea } from "@wonder/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Person = { display_name: string; handle: string | null } | null;
interface Data {
  campaign: { id: string; brand_name: string; title: string; brief: string; usage_rights: string; channels: string[]; due_on: string | null; status: string; project_id: string | null; projects: { id: string; title: string } | null };
  role: "owner" | "creator" | "invited";
  invitations: Array<{ creator_id: string; status: string; note: string | null; response_note: string | null; creators: Person }>;
  myInvitation: { status: string; note: string | null } | null;
  deliverables: Array<{ id: string; creator_id: string; proposed_by: string; title: string; description: string | null; format: string | null; due_on: string | null; status: string; review_note: string | null; artifact_id: string | null; creators: Person }>;
}

const who = (p: Person) => p?.display_name ?? "Creator";

/**
 * A campaign (P1-16). What you can do depends on your part in it — the owner invites, agrees to proposals and reviews;
 * an invited creator answers; a creator who joined proposes, agrees to the owner's proposals and submits work. The
 * database decides; this only shows the actions that make sense.
 */
export function CampaignView({ me, data, creations, projects }: { me: string; data: Data; creations: Array<{ id: string; title: string }>; projects: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const c = data.campaign;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [proposal, setProposal] = useState({ title: "", format: "", creatorId: "" });
  const [submitFor, setSubmitFor] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<Record<string, { title: string; content: string | null } | null>>({});
  const accepted = data.invitations.filter((i) => i.status === "accepted");

  async function act(key: string, fn: () => Promise<unknown>) {
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
  const post = (url: string, json?: unknown) => api(url, { method: "POST", json });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/campaigns" className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
        ← Campaigns
      </Link>
      <header className="rounded-2xl border border-border-soft bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-ink-subtle">{c.brand_name}</p>
        <h1 className="font-display text-2xl leading-tight text-ink">{c.title}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {[c.channels.join(", "), c.due_on ? `due ${c.due_on}` : null, c.projects ? `workspace: ${c.projects.title}` : null].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{c.brief}</p>
        <div className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-[13px]">
          <span className="font-medium text-ink">Usage rights needed: </span>
          <span className="text-ink-muted">{c.usage_rights}</span>
        </div>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {data.role === "invited" ? (
        <section aria-label="Your invitation" className="rounded-2xl border border-accent/30 bg-accent-softer p-4">
          <p className="text-sm text-ink">{data.myInvitation?.note ?? "You're invited to this campaign."}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={busy === "accept"} onClick={() => act("accept", () => post(`/api/v1/campaigns/${c.id}/respond`, { accept: true }))}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" loading={busy === "decline"} onClick={() => act("decline", () => post(`/api/v1/campaigns/${c.id}/respond`, { accept: false }))}>
              Decline
            </Button>
          </div>
        </section>
      ) : null}

      {data.role === "owner" ? (
        <section aria-labelledby="people" className="rounded-2xl border border-border-soft bg-surface p-4">
          <h2 id="people" className="text-[15px] font-semibold text-ink">
            Creators
          </h2>
          <ul className="mt-2 divide-y divide-border-soft/70">
            {data.invitations.map((i) => (
              <li key={i.creator_id} className="flex min-h-11 items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{who(i.creators)}</span>
                <Badge tone={i.status === "accepted" ? "success" : "neutral"}>{i.status[0]!.toUpperCase() + i.status.slice(1)}</Badge>
                {i.status === "invited" ? (
                  <Button variant="ghost" size="sm" onClick={() => act(`w-${i.creator_id}`, () => api(`/api/v1/campaigns/${c.id}/invitations?creatorId=${i.creator_id}`, { method: "DELETE" }))}>
                    Withdraw
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act("invite", async () => {
                await post(`/api/v1/campaigns/${c.id}/invitations`, { handle });
                setHandle("");
              });
            }}
          >
            <Input aria-label="Invite by @handle" placeholder="@handle of a creator open to brand work" value={handle} onChange={(e) => setHandle(e.target.value)} />
            <Button type="submit" size="sm" loading={busy === "invite"} disabled={!handle.trim()}>
              Invite
            </Button>
          </form>
          {projects.length ? (
            <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted">
              Workspace
              <select
                className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-ink"
                value={c.project_id ?? ""}
                onChange={(e) => act("ws", () => api(`/api/v1/campaigns/${c.id}`, { method: "PATCH", json: { projectId: e.target.value || null } }))}
              >
                <option value="">No Creative Room linked</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      ) : null}

      {data.role !== "invited" ? (
        <section aria-labelledby="deliverables" className="rounded-2xl border border-border-soft bg-surface p-4">
          <h2 id="deliverables" className="text-[15px] font-semibold text-ink">
            Deliverables
          </h2>
          {data.deliverables.length ? (
            <ul className="mt-2 divide-y divide-border-soft/70">
              {data.deliverables.map((d) => {
                const mine = d.creator_id === me;
                const canAgree = d.status === "proposed" && d.proposed_by !== me && (data.role === "owner" || mine);
                return (
                  <li key={d.id} className="space-y-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{d.title}</span>
                        <span className="block text-xs text-ink-subtle">{[who(d.creators), d.format, d.due_on ? `due ${d.due_on}` : null].filter(Boolean).join(" · ")}</span>
                      </span>
                      <Badge tone={d.status === "approved" ? "success" : d.status === "changes_requested" ? "warning" : "neutral"}>{DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}</Badge>
                    </div>
                    {d.review_note ? <p className="text-[13px] text-ink-muted">“{d.review_note}”</p> : null}
                    {canAgree ? (
                      <Button size="sm" variant="secondary" loading={busy === `a-${d.id}`} onClick={() => act(`a-${d.id}`, () => post(`/api/v1/campaign-deliverables/${d.id}`, { action: "agree" }))}>
                        Agree
                      </Button>
                    ) : null}
                    {mine && (d.status === "agreed" || d.status === "changes_requested") && creations.length ? (
                      <div className="flex gap-2">
                        <select aria-label={`Creation for ${d.title}`} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm" value={submitFor[d.id] ?? ""} onChange={(e) => setSubmitFor({ ...submitFor, [d.id]: e.target.value })}>
                          <option value="">Choose one of your Creations</option>
                          {creations.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" disabled={!submitFor[d.id]} loading={busy === `s-${d.id}`} onClick={() => act(`s-${d.id}`, () => post(`/api/v1/campaign-deliverables/${d.id}`, { action: "submit", artifactId: submitFor[d.id] }))}>
                          Submit
                        </Button>
                      </div>
                    ) : null}
                    {data.role === "owner" && d.status === "submitted" ? (
                      <div className="space-y-2">
                        {submission[d.id] === undefined ? (
                          <Button size="sm" variant="ghost" onClick={async () => setSubmission({ ...submission, [d.id]: (await api<{ submission: { title: string; content: string | null } | null }>(`/api/v1/campaign-deliverables/${d.id}`)).submission })}>
                            Read the submission
                          </Button>
                        ) : submission[d.id] ? (
                          <div className="max-h-60 overflow-auto rounded-xl bg-surface-muted p-3 text-sm">
                            <p className="font-medium text-ink">{submission[d.id]!.title}</p>
                            <p className="mt-1 whitespace-pre-wrap text-ink-muted">{submission[d.id]!.content ?? ""}</p>
                          </div>
                        ) : null}
                        <Textarea aria-label={`Notes for ${d.title}`} placeholder="What should change? (needed to ask for changes)" value={note[d.id] ?? ""} onChange={(e) => setNote({ ...note, [d.id]: e.target.value })} className="min-h-16" />
                        <div className="flex gap-2">
                          <Button size="sm" loading={busy === `ok-${d.id}`} onClick={() => act(`ok-${d.id}`, () => post(`/api/v1/campaign-deliverables/${d.id}`, { action: "review", approve: true, note: note[d.id] || undefined }))}>
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" disabled={!note[d.id]?.trim()} loading={busy === `no-${d.id}`} onClick={() => act(`no-${d.id}`, () => post(`/api/v1/campaign-deliverables/${d.id}`, { action: "review", approve: false, note: note[d.id] }))}>
                            Ask for changes
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Nothing proposed yet.</p>
          )}
          {(data.role === "creator" || (data.role === "owner" && accepted.length > 0)) && c.status !== "completed" && c.status !== "cancelled" ? (
            <form
              className="mt-3 space-y-2 border-t border-border-soft pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void act("propose", async () => {
                  await post(`/api/v1/campaigns/${c.id}/deliverables`, { creatorId: data.role === "creator" ? me : proposal.creatorId || accepted[0]!.creator_id, title: proposal.title, format: proposal.format || undefined });
                  setProposal({ title: "", format: "", creatorId: "" });
                });
              }}
            >
              <Field label="Propose a deliverable" htmlFor="d-title">
                <Input id="d-title" placeholder="e.g. 60-second film" value={proposal.title} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} maxLength={120} />
              </Field>
              <div className="flex gap-2">
                <Input aria-label="Format" placeholder="Format (optional)" value={proposal.format} onChange={(e) => setProposal({ ...proposal, format: e.target.value })} maxLength={60} />
                {data.role === "owner" && accepted.length > 1 ? (
                  <select aria-label="For" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm" value={proposal.creatorId} onChange={(e) => setProposal({ ...proposal, creatorId: e.target.value })}>
                    {accepted.map((i) => (
                      <option key={i.creator_id} value={i.creator_id}>
                        {who(i.creators)}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Button type="submit" size="sm" loading={busy === "propose"} disabled={!proposal.title.trim()}>
                  Propose
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
