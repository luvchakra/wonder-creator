"use client";
import type { ApprovalView } from "@wonder/creator-brain";
import { ARTIFACT_TYPES } from "@wonder/creator-studio/types";
import { Button, Dialog, DialogContent, Field, Select, StickyActions, Textarea } from "@wonder/ui";
import { Clock, Scale, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";
import { StateBadge } from "../shared";

type ApproveResult = { kind: "version"; artifactId: string } | { kind: "artifact"; artifact: { id: string } };

export function ApprovalDetail({ approval: a, setting }: { approval: ApprovalView; setting: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "decline" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");
  const current = (label: string) => a.parameters.find((p) => p.label === label)?.value ?? "";
  const [instruction, setInstruction] = useState(current("Request"));
  const [kind, setKind] = useState(() => ARTIFACT_TYPES.find((t) => t.type.replace(/_/g, " ") === current("Kind of piece"))?.type ?? "");
  const open = a.state === "pending";

  async function decide(decision: "approve" | "reject" | "edit", extra: Record<string, unknown> = {}) {
    setBusy(decision === "reject" ? "decline" : decision);
    setError(null);
    try {
      const res = await api<ApproveResult | { ok: true } | { approval: ApprovalView }>(`/api/v1/brain/proposals/${a.id}`, { method: "POST", json: { decision, ...extra } });
      if ("approval" in res) {
        setEditOpen(false);
        router.replace(`/approvals/${res.approval.id}`);
      } else if ("kind" in res) {
        router.push(`/artifacts/${res.kind === "version" ? res.artifactId : res.artifact.id}`);
      } else {
        setDeclineOpen(false);
        router.refresh();
      }
    } catch (e) {
      setError(errorMessage(e));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Back" className="flex flex-wrap gap-x-5">
        {a.conversationId ? (
          <Link href={`/create?c=${a.conversationId}`} className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
            ← Back to the conversation
          </Link>
        ) : null}
        <Link href="/approvals" className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
          All approvals
        </Link>
      </nav>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] leading-tight text-ink">{a.actionLabel}</h1>
        <StateBadge state={a.state} />
      </div>
      <p className="mt-1 text-[15px] text-ink-muted">
        {a.domainLabel}
        {setting ? ` · your setting: ${setting}` : ""} ·{" "}
        <Link href="/settings?section=autonomy" className="text-accent-ink hover:underline">
          Change
        </Link>
      </p>

      <dl className="mt-6 space-y-5 rounded-2xl border border-border-soft bg-surface p-5">
        <Row term="What you asked">{a.understood}</Row>
        <Row term="What CreatorBrain will do">{a.plan}</Row>
        <Row term="What changes">{a.impact}</Row>
        {a.target.title ? (
          <Row term={a.target.kind === "artifact" ? "Piece" : "Conversation"}>
            <Link href={a.target.kind === "artifact" ? `/artifacts/${a.target.id}` : `/create?c=${a.target.id}`} className="text-accent-ink hover:underline">
              {a.target.title}
            </Link>
          </Row>
        ) : null}
        {a.parameters.length ? (
          <Row term="Exactly this">
            <ul className="space-y-1">
              {a.parameters.map((p) => (
                <li key={p.label}>
                  <span className="text-ink-muted">{p.label}: </span>
                  {p.value}
                </li>
              ))}
            </ul>
          </Row>
        ) : null}
      </dl>

      <ul className="mt-4 grid gap-2 text-[15px] text-ink-muted sm:grid-cols-3">
        <li className="flex items-center gap-2">
          <Scale className="size-4 shrink-0" aria-hidden />
          {a.rightsImplications ? "Affects rights or licensing" : "No rights changes"}
        </li>
        <li className="flex items-center gap-2">
          <Wallet className="size-4 shrink-0" aria-hidden />
          {a.cost}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden />
          {open ? (
            <span>
              Expires <RelativeTime iso={a.expiresAt} />
            </span>
          ) : a.resolvedAt ? (
            <span>
              Decided <RelativeTime iso={a.resolvedAt} />
            </span>
          ) : (
            <span>Closed</span>
          )}
        </li>
      </ul>

      {a.decisionNote ? <p className="mt-4 rounded-xl bg-black/[0.03] px-4 py-3 text-[15px] text-ink-muted">Note: {a.decisionNote}</p> : null}
      {a.supersedes ? (
        <p className="mt-4 text-sm text-ink-muted">
          This replaces an earlier request.{" "}
          <Link href={`/approvals/${a.supersedes}`} className="text-accent-ink hover:underline">
            See the original
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {open ? (
        <>
          <p className="mt-6 flex items-start gap-2 text-sm text-ink-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Approving runs exactly what&apos;s shown, once. It doesn&apos;t change your autonomy settings. To change anything, edit it: that makes a new request.
          </p>
          <StickyActions className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeclineOpen(true)} disabled={!!busy}>
              Decline
            </Button>
            {a.editable ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)} disabled={!!busy}>
                Edit
              </Button>
            ) : null}
            <Button onClick={() => decide("approve")} loading={busy === "approve"} disabled={!!busy}>
              Approve once
            </Button>
          </StickyActions>
        </>
      ) : null}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent title="Decline this?" description="Nothing will change. CreatorBrain won't do this unless you ask again.">
          <Field label="Note (optional)" htmlFor="decline-note" hint="Only you see this.">
            <Textarea id="decline-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} rows={3} />
          </Field>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy === "decline"} onClick={() => decide("reject", note.trim() ? { note: note.trim() } : {})}>
              Decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Edit the request" description="Your changes make a new request for you to approve; this one is cancelled.">
          <div className="space-y-4">
            <Field label="Kind of piece" htmlFor="edit-kind">
              <Select id="edit-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Keep as is</option>
                {ARTIFACT_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Request" htmlFor="edit-instruction">
              <Textarea id="edit-instruction" value={instruction} maxLength={4000} onChange={(e) => setInstruction(e.target.value)} rows={4} />
            </Field>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "edit"}
              disabled={!instruction.trim()}
              onClick={() => decide("edit", { ...(kind ? { artifactType: kind } : {}), instruction: instruction.trim() })}
            >
              Save as new request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-muted">{term}</dt>
      <dd className="mt-1 text-[15px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}
