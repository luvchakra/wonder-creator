"use client";
import { Badge, Button, ConfirmDialog, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Select, Textarea, cn, EmptyNote, KIT } from "@wonder/ui";
import { ArrowLeft, Bot, MoreHorizontal, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { CreatorPicker, type PickedCreator } from "@/components/creator-picker";
import { SignoffDialog } from "@/components/signoff-dialog";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";

type Access = "comment" | "propose" | "edit";
const ACCESS_LABEL: Record<Access, string> = { comment: "Can comment", propose: "Can propose changes", edit: "Can edit" };

interface Props {
  viewerId: string;
  access: "owner" | Access;
  artifact: { id: string; title: string; type: string; status: string; ownerId: string; ownerName: string };
  current: { id: string; number: number; content: string } | null;
  collaborators: Array<{ creatorId: string; name: string; handle: string | null; role: string; access: Access; since: string }>;
  versions: Array<{ id: string; number: number; label: string; summary: string | null; authorKind: "creator" | "ai" | "restore"; author: string; authorId: string | null; at: string }>;
  proposals: Array<{
    id: string;
    status: "open" | "accepted" | "declined" | "withdrawn";
    summary: string;
    content: string;
    proposer: { id: string | null; name: string };
    mine: boolean;
    baseVersion: { id: string; number: number | null };
    stale: boolean;
    decisionNote: string | null;
    resultingVersion: number | null;
    at: string;
  }>;
  comments: Array<{ id: string; body: string; quote: string | null; versionNumber: number | null; author: { id: string | null; name: string }; mine: boolean; resolved: boolean; at: string }>;
  /** The piece's contribution ledger (live entries). */
  credits: Array<{ id: string; name: string; kind: string; description: string; versionNumber: number | null }>;
  /** Who must approve the current version before it's published (only when a project requires it). */
  signoffs: Array<{ creatorId: string; name: string; decision: "approve" | "object" | null; note: string | null; at: string | null }>;
}

export function CollaborateView({ viewerId, access, artifact, current, collaborators, versions, proposals, comments, credits, signoffs }: Props) {
  const router = useRouter();
  const owner = access === "owner";
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [writing, setWriting] = useState(false);
  const [reviewing, setReviewing] = useState<Props["proposals"][number] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [signing, setSigning] = useState<"approve" | "object" | null>(null);
  const mySignoff = signoffs.find((s) => s.creatorId === viewerId);
  const open = proposals.filter((p) => p.status === "open");
  const decided = proposals.filter((p) => p.status !== "open");

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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href={`/artifacts/${artifact.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {artifact.title}
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Collaborate</h1>
        <p className="text-[15px] text-ink-muted">
          {owner ? "People you bring in can comment, propose changes you accept or decline, or edit. " : `You're a collaborator on ${artifact.ownerName}'s Creation (${ACCESS_LABEL[access as Access].toLowerCase()}). `}
          Every change is a new version credited to whoever wrote it.
        </p>
        <div className="flex flex-wrap gap-2">
          {owner ? (
            <Button onClick={() => setAdding(true)}>
              <UserPlus className="size-4" aria-hidden /> Add a collaborator
            </Button>
          ) : null}
          {(access === "propose" || access === "edit") && current ? <Button onClick={() => setWriting(true)}>{access === "edit" ? "Edit the Creation" : "Propose a change"}</Button> : null}
          {!owner ? (
            <Button variant="ghost" onClick={() => setLeaving(true)}>
              Stop collaborating
            </Button>
          ) : null}
        </div>
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

      {signoffs.length ? (
        <section aria-label="Publishing sign-off" className="rounded-2xl border border-border-soft bg-surface px-5 py-4">
          <SectionHeader title="Publishing sign-off" />
          <p className="text-sm text-ink-muted">
            This Creation&rsquo;s Creative Room asks collaborators and co-owners to approve {current ? `version ${current.number}` : "the current version"} before it&rsquo;s published. A new version needs a new sign-off.
          </p>
          <ul className="mt-2 space-y-1">
            {signoffs.map((s) => (
              <li key={s.creatorId} className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
                {s.creatorId === viewerId ? "You" : s.name}
                <Badge tone={s.decision === "approve" ? "success" : s.decision === "object" ? "warning" : "neutral"}>{s.decision === "approve" ? "Approved" : s.decision === "object" ? "Objected" : "Not yet"}</Badge>
                {s.note ? <span className="text-sm text-ink-muted">“{s.note}”</span> : null}
              </li>
            ))}
          </ul>
          {mySignoff ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={mySignoff.decision === "approve" ? "secondary" : "primary"} onClick={() => setSigning("approve")}>
                Approve publishing
              </Button>
              <Button variant="ghost" onClick={() => setSigning("object")}>
                Object
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Proposed changes">
        <SectionHeader title={`Proposed changes${open.length ? ` (${open.length})` : ""}`} />
        {open.length ? (
          <ul className="space-y-2">
            {open.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{p.summary}</p>
                  <p className="text-sm text-ink-muted">
                    {p.mine ? "You" : p.proposer.name} · on v{p.baseVersion.number ?? "?"} · <RelativeTime iso={p.at} />
                  </p>
                </div>
                {p.stale ? <Badge tone="warning">Creation changed since</Badge> : null}
                <Button variant="secondary" onClick={() => setReviewing(p)}>
                  Review
                </Button>
                {p.mine ? (
                  <Button variant="ghost" onClick={() => act(() => api(`/api/v1/artifact-proposals/${p.id}`, { method: "POST", json: { action: "withdraw" } }), "Proposal withdrawn.")}>
                    Withdraw
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote art={KIT.painted.lavenderSprig}>No open proposals.</EmptyNote>
        )}
        {decided.length ? (
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-muted">Decided ({decided.length})</summary>
            <ul className="space-y-1 text-sm text-ink-muted">
              {decided.map((p) => (
                <li key={p.id}>
                  “{p.summary}” by {p.mine ? "you" : p.proposer.name} — {p.status === "accepted" ? `accepted as v${p.resultingVersion}` : p.status}
                  {p.decisionNote ? ` (${p.decisionNote})` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section aria-label="People">
        <SectionHeader title="People" />
        <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
          <li className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-ink">{artifact.ownerId === viewerId ? "You" : artifact.ownerName}</span> <span className="text-sm text-ink-muted">· Owner</span>
            </span>
          </li>
          {collaborators.map((c) => (
            <li key={c.creatorId} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-ink">{c.creatorId === viewerId ? "You" : c.name}</span> <span className="text-sm text-ink-muted">· {c.role}</span>
              </span>
              {owner ? (
                <>
                  <label htmlFor={`access-${c.creatorId}`} className="sr-only">
                    What {c.name} can do
                  </label>
                  <Select
                    id={`access-${c.creatorId}`}
                    value={c.access}
                    onChange={(e) => act(() => api(`/api/v1/artifacts/${artifact.id}/collaborators`, { method: "PATCH", json: { creatorId: c.creatorId, access: e.target.value } }), `${c.name}: ${ACCESS_LABEL[e.target.value as Access].toLowerCase()}.`)}
                    className="w-auto"
                  >
                    {(Object.keys(ACCESS_LABEL) as Access[]).map((a) => (
                      <option key={a} value={a}>
                        {ACCESS_LABEL[a]}
                      </option>
                    ))}
                  </Select>
                  <Menu>
                    <MenuTrigger aria-label={`Options for ${c.name}`} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/[0.05]">
                      <MoreHorizontal className="size-5" aria-hidden />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem destructive onSelect={() => act(() => api(`/api/v1/artifacts/${artifact.id}/collaborators`, { method: "DELETE", json: { creatorId: c.creatorId } }), `${c.name} is no longer a collaborator. What they wrote stays credited to them.`)}>
                        Remove collaborator
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </>
              ) : (
                <Badge tone="neutral">{ACCESS_LABEL[c.access]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Comments artifactId={artifact.id} versionId={current?.id ?? null} comments={comments} owner={owner} onChanged={(t) => (setMsg(t), router.refresh())} onError={setError} />

      <section aria-label="Version history">
        <SectionHeader title="Who wrote what" />
        <ol className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-start gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3">
              <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-full bg-accent-softer px-2 text-sm font-medium text-accent-ink">v{v.number}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  {v.authorKind === "ai" ? <Bot className="size-4" aria-hidden /> : null}
                  {v.authorId === viewerId ? "You" : v.author}
                  {v.authorKind === "restore" ? <span className="text-sm font-normal text-ink-muted">(restored)</span> : null}
                </span>
                <span className="block text-sm text-ink-muted">
                  {v.summary ?? v.label} · <RelativeTime iso={v.at} />
                </span>
              </span>
              {current?.id === v.id ? <Badge tone="accent">Current</Badge> : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Credits">
        <SectionHeader
          title="Contributions"
          action={
            <a href={`/api/v1/artifacts/${artifact.id}/credits`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
              Export credits
            </a>
          }
        />
        {credits.length ? (
          <ul className="space-y-1 text-[15px]">
            {credits.map((c) => (
              <li key={c.id} className="text-ink">
                <span className="font-medium">{c.name}</span> <span className="text-ink-muted">· {c.kind}{c.versionNumber ? ` · v${c.versionNumber}` : ""} — {c.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-muted">Contributions by collaborators are recorded here automatically.</p>
        )}
      </section>

      {adding ? <AddCollaboratorDialog artifactId={artifact.id} exclude={[artifact.ownerId, ...collaborators.map((c) => c.creatorId)]} onOpenChange={setAdding} onAdded={(n) => (setMsg(`${n} is now a collaborator.`), router.refresh())} /> : null}
      {writing && current ? <WriteDialog artifactId={artifact.id} base={current} mode={access === "edit" ? "edit" : "propose"} onOpenChange={setWriting} onDone={(t) => (setWriting(false), setMsg(t), router.refresh())} /> : null}
      {reviewing && current ? <ReviewDialog proposal={reviewing} current={current} owner={owner} onOpenChange={(o) => !o && setReviewing(null)} onDone={(t) => (setReviewing(null), setMsg(t), router.refresh())} /> : null}
      {signing ? <SignoffDialog piece={{ artifactId: artifact.id, title: artifact.title }} decision={signing} onOpenChange={(o) => !o && setSigning(null)} onSaved={(t) => (setSigning(null), setMsg(t), router.refresh())} /> : null}
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Stop collaborating?"
        body="You'll lose access to this Creation. Every version you wrote stays credited to you."
        confirmLabel="Stop collaborating"
        destructive
        onConfirm={() =>
          act(async () => {
            await api(`/api/v1/artifacts/${artifact.id}/collaborators`, { method: "DELETE", json: { creatorId: viewerId } });
            router.replace("/");
          }, "You stopped collaborating.")
        }
      />
    </div>
  );
}

function Comments({ artifactId, versionId, comments, owner, onChanged, onError }: { artifactId: string; versionId: string | null; comments: Props["comments"]; owner: boolean; onChanged: (m: string) => void; onError: (e: string) => void }) {
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const open = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);
  const row = (c: Props["comments"][number]) => (
    <li key={c.id} className={cn("rounded-2xl border border-border-soft bg-surface px-4 py-3", c.resolved && "opacity-70")}>
      <p className="text-sm text-ink-subtle">
        {c.mine ? "You" : c.author.name}
        {c.versionNumber ? ` · on v${c.versionNumber}` : ""} · <RelativeTime iso={c.at} />
      </p>
      {c.quote ? <blockquote className="mt-1 border-l-2 border-accent pl-2 text-sm italic text-ink-muted">{c.quote}</blockquote> : null}
      <p className="mt-1 whitespace-pre-line text-[15px] text-ink">{c.body}</p>
      {owner || c.mine ? (
        <Button
          variant="ghost"
          className="mt-1 -ml-3"
          onClick={async () => {
            try {
              await api(`/api/v1/artifact-comments/${c.id}`, { method: "PATCH", json: { resolved: !c.resolved } });
              onChanged(c.resolved ? "Comment reopened." : "Comment resolved.");
            } catch (e) {
              onError(errorMessage(e));
            }
          }}
        >
          {c.resolved ? "Reopen" : "Resolve"}
        </Button>
      ) : null}
    </li>
  );
  return (
    <section aria-label="Comments">
      <SectionHeader title={`Comments${open.length ? ` (${open.length})` : ""}`} />
      {open.length ? <ol className="space-y-2">{open.map(row)}</ol> : <p className="text-[15px] text-ink-muted">No open comments.</p>}
      {resolved.length ? (
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-muted">Resolved ({resolved.length})</summary>
          <ol className="space-y-2">{resolved.map(row)}</ol>
        </details>
      ) : null}
      <form
        className="mt-3 space-y-2 rounded-2xl border border-border-soft bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/api/v1/artifacts/${artifactId}/comments`, { method: "POST", json: { body, quote: quote || null, versionId } });
            setBody("");
            setQuote("");
            onChanged("Comment added.");
          } catch (err) {
            onError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Passage (optional)" htmlFor="comment-quote" hint="Paste the words you're commenting on.">
          <Input id="comment-quote" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={500} />
        </Field>
        <Field label="Comment" htmlFor="comment-body">
          <Textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} className="min-h-20" />
        </Field>
        <Button type="submit" variant="secondary" loading={busy} disabled={!body.trim()}>
          Add comment
        </Button>
      </form>
    </section>
  );
}

function Diff({ from, to }: { from: string; to: string }) {
  const lines = diffLines(from, to);
  return (
    <pre aria-label="Changes" className="max-h-[45dvh] overflow-auto whitespace-pre-wrap rounded-xl border border-border-soft bg-cream p-3 text-sm leading-relaxed">
      {lines.map((l, i) => (
        <div key={i} className={cn(l.kind === "added" && "bg-[#e7f6ec] text-ink", l.kind === "removed" && "bg-[#fdecec] text-ink-muted line-through")}>
          <span aria-hidden className="mr-2 inline-block w-3 select-none text-ink-subtle">{l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}</span>
          <span className="sr-only">{l.kind === "added" ? "Added: " : l.kind === "removed" ? "Removed: " : ""}</span>
          {l.text || " "}
        </div>
      ))}
    </pre>
  );
}

function ReviewDialog({ proposal, current, owner, onOpenChange, onDone }: { proposal: Props["proposals"][number]; current: { id: string; number: number; content: string }; owner: boolean; onOpenChange: (o: boolean) => void; onDone: (m: string) => void }) {
  const [note, setNote] = useState("");
  const [confirmStale, setConfirmStale] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function decide(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    try {
      const r = await api<{ version?: { version_number: number } }>(`/api/v1/artifact-proposals/${proposal.id}`, { method: "POST", json: action === "accept" ? { action, confirmStale } : { action, note: note || undefined } });
      onDone(action === "accept" ? `Accepted — now v${r.version?.version_number}, credited to ${proposal.proposer.name}.` : "Proposal declined.");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={proposal.summary} description={`Proposed by ${proposal.mine ? "you" : proposal.proposer.name} on v${proposal.baseVersion.number ?? "?"}.`} wide>
        {proposal.stale ? (
          <p role="status" className="mb-3 rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-ink">
            The Creation has changed since this was proposed (it&rsquo;s now v{current.number}). Below is the difference from the <strong>current</strong> version — accepting replaces the newer changes with this text.
          </p>
        ) : null}
        <Diff from={current.content} to={proposal.content} />
        {owner ? (
          <div className="mt-4 space-y-3">
            {proposal.stale ? (
              <label className="flex min-h-11 items-center gap-2 text-[15px]">
                <input type="checkbox" checked={confirmStale} onChange={(e) => setConfirmStale(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
                I&rsquo;ve compared it with the current version
              </label>
            ) : null}
            <Field label="Note if declining (optional)" htmlFor="decline-note">
              <Input id="decline-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" loading={busy === "decline"} onClick={() => decide("decline")}>
                Decline
              </Button>
              <Button loading={busy === "accept"} disabled={proposal.stale && !confirmStale} onClick={() => decide("accept")}>
                Accept as a new version
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WriteDialog({ artifactId, base, mode, onOpenChange, onDone }: { artifactId: string; base: { id: string; number: number; content: string }; mode: "edit" | "propose"; onOpenChange: (o: boolean) => void; onDone: (m: string) => void }) {
  const [content, setContent] = useState(base.content);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={mode === "edit" ? "Edit the Creation" : "Propose a change"} description={`Based on v${base.number}. ${mode === "edit" ? "Saving creates a new version credited to you." : "The owner reviews it and accepts or declines."}`} wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              if (mode === "edit") {
                const r = await api<{ version: { version_number: number } }>(`/api/v1/artifacts/${artifactId}/edits`, { method: "POST", json: { baseVersionId: base.id, content, summary } });
                onDone(`Saved as v${r.version.version_number}, credited to you.`);
              } else {
                await api(`/api/v1/artifacts/${artifactId}/proposals`, { method: "POST", json: { baseVersionId: base.id, content, summary } });
                onDone("Proposal sent to the owner.");
              }
            } catch (err) {
              // Nothing is lost on a conflict: the text stays in the editor.
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Text" htmlFor="write-content">
            <Textarea id="write-content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-72 font-serif text-[16px]" />
          </Field>
          <Field label={mode === "edit" ? "What changed (optional)" : "What you changed"} htmlFor="write-summary">
            <Input id="write-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} required={mode === "propose"} />
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
            <Button type="submit" loading={busy} disabled={content === base.content || (mode === "propose" && !summary.trim())}>
              {mode === "edit" ? "Save new version" : "Send proposal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddCollaboratorDialog({ artifactId, exclude, onOpenChange, onAdded }: { artifactId: string; exclude: string[]; onOpenChange: (o: boolean) => void; onAdded: (name: string) => void }) {
  const [who, setWho] = useState<PickedCreator | null>(null);
  const [role, setRole] = useState("");
  const [access, setAccess] = useState<Access>("propose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Add a collaborator" description="They'll be able to open this Creation and its versions." wide>
        {who ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await api(`/api/v1/artifacts/${artifactId}/collaborators`, { method: "POST", json: { creatorId: who.id, role, access } });
                onAdded(who.display_name);
                onOpenChange(false);
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            <p className="rounded-2xl bg-accent-softer px-4 py-3 text-ink">
              {who.display_name} <span className="text-ink-subtle">@{who.handle}</span>
            </p>
            <Field label="Their part" htmlFor="collab-role" hint="E.g. Co-writer, Editor, Translator.">
              <Input id="collab-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} required />
            </Field>
            <Field label="What they can do" htmlFor="collab-access">
              <Select id="collab-access" value={access} onChange={(e) => setAccess(e.target.value as Access)}>
                {(Object.keys(ACCESS_LABEL) as Access[]).map((a) => (
                  <option key={a} value={a}>
                    {ACCESS_LABEL[a]}
                  </option>
                ))}
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
              <Button type="submit" loading={busy} disabled={!role.trim()}>
                Add collaborator
              </Button>
            </div>
          </form>
        ) : (
          <CreatorPicker id="collab-picker" exclude={exclude} actionLabel="Choose" onPick={(c) => setWho(c)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
