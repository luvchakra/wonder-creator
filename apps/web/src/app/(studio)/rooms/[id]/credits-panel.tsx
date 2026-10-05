"use client";
import { PART_CREDITS, PART_CREDIT_LABEL, equalShares, type PartCredit, type SongAgreement } from "@wonder/creator-projects/parts-options";
import { Button, Dialog, DialogContent, cn } from "@wonder/ui";
import { Check, CircleDashed, MessageSquareWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";
import type { PartRow } from "./parts-panel";

/**
 * Credits & shares (creative-room-parts.md, step 5a). Once every part is final, the Room's owner or admins propose who
 * is credited for what and the shares — equal per person unless they change them — and everyone named signs off. One
 * action at a time: Propose (the owner, before anything is proposed), Sign off (each person named, while it waits on
 * them). Objecting says why; a part that moves on means proposing again.
 */
export function CreditsPanel({ projectId, viewerId, manages, parts, agreement }: { projectId: string; viewerId: string; manages: boolean; parts: PartRow[]; agreement: SongAgreement | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [objecting, setObjecting] = useState(false);
  const allFinal = parts.length > 0 && parts.every((p) => p.status === "final" && p.artifactId);
  if (!agreement && !allFinal) return null;

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  const sign = (decision: "approve" | "object", note?: string) => run(decision, () => api(`/api/v1/song-agreements/${agreement!.id}/sign`, { method: "POST", json: { decision, note } }));

  const me = agreement?.lines.find((l) => l.creatorId === viewerId) ?? null;
  const waiting = agreement?.lines.filter((l) => l.decision !== "approve") ?? [];
  const objected = agreement?.lines.filter((l) => l.decision === "object") ?? [];
  const canSign = !!agreement && agreement.status === "open" && agreement.holds && !!me && me.decision !== "approve";
  const status = !agreement
    ? null
    : !agreement.holds
      ? `${agreement.moved.join(" and ")} moved on since this was ${agreement.status === "agreed" ? "agreed" : "proposed"}`
      : agreement.status === "agreed"
        ? "Agreed by everyone"
        : objected.length
          ? `${objected.map((l) => (l.creatorId === viewerId ? "You" : l.name)).join(" and ")} would change something`
          : `Waiting on ${waiting.map((l) => (l.creatorId === viewerId ? "you" : l.name)).join(", ")}`;

  return (
    <section id="credits" aria-labelledby="credits-title" className="scroll-mt-20 rounded-3xl border border-border-soft bg-surface/90 px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="credits-title" className="shrink-0 font-display text-[18px] text-ink">
          Credits &amp; shares
        </h2>
        {status ? (
          <p role="status" className={cn("text-right text-[12.5px]", agreement?.status === "agreed" && agreement.holds ? "text-success-ink" : "text-ink-muted")}>
            {status}
          </p>
        ) : null}
      </div>

      {!agreement ? (
        <div className="mt-1.5">
          <p className="text-[13.5px] text-ink-muted">
            Every part is final. {manages ? "Propose who's credited for what — shares start equal, and everyone named signs off." : "The Room's owner proposes the credits next; everyone named signs off."}
          </p>
          {manages ? (
            <Button className="mt-3" variant="secondary" onClick={() => setProposing(true)}>
              Propose credits
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-border-soft">
            {agreement.lines.map((l) => (
              <li key={l.creatorId} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-[14px] text-ink">
                    <span className="font-medium">{l.creatorId === viewerId ? "You" : l.name}</span>
                    <span className="text-ink-muted"> · {l.parts.map((x) => `${x.title}, ${PART_CREDIT_LABEL[x.credit].toLowerCase()}`).join(" · ")}</span>
                  </p>
                  <span className="shrink-0 font-display text-[16px] tabular-nums text-ink">{formatPercent(l.percent)}</span>
                </div>
                <p className={cn("mt-0.5 inline-flex items-center gap-1 text-[12px]", l.decision === "approve" ? "text-success-ink" : l.decision === "object" ? "text-danger" : "text-ink-subtle")}>
                  {l.decision === "approve" ? <Check className="size-3.5" aria-hidden /> : l.decision === "object" ? <MessageSquareWarning className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
                  {l.decision === "approve" ? "Signed off" : l.decision === "object" ? "Would change something" : "Hasn't signed yet"}
                </p>
                {l.decision === "object" && l.note ? <p className="mt-1 rounded-xl bg-[#fdf1ec] px-3 py-1.5 text-[13px] text-ink">“{l.note}”</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-ink-subtle">
            For {agreement.versions.map((v) => `${v.title} v${v.versionNumber}`).join(" · ")}
            {agreement.proposedBy ? ` · proposed by ${agreement.proposedBy.id === viewerId ? "you" : agreement.proposedBy.name}` : ""}
            {agreement.note ? ` — “${agreement.note}”` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canSign ? (
              <>
                <Button loading={busy === "approve"} onClick={() => void sign("approve")}>
                  Sign off
                </Button>
                <Button variant="ghost" onClick={() => setObjecting(true)}>
                  I&rsquo;d change something…
                </Button>
              </>
            ) : null}
            {manages && allFinal && (agreement.status === "open" || !agreement.holds) ? (
              <Button variant="ghost" size="sm" onClick={() => setProposing(true)}>
                Propose again
              </Button>
            ) : null}
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-2 rounded-2xl bg-[#fdecec] px-3.5 py-2 text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      {proposing ? <ProposeDialog projectId={projectId} parts={parts} replacing={!!agreement} onClose={() => setProposing(false)} onDone={() => (setProposing(false), router.refresh())} /> : null}
      {objecting ? (
        <ObjectDialog
          busy={busy === "object"}
          onClose={() => setObjecting(false)}
          onSend={async (note) => {
            if (await sign("object", note)) setObjecting(false);
          }}
        />
      ) : null}
    </section>
  );
}

const formatPercent = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

/** Who's credited for what, and the shares: equal unless changed. The server lays out the final list. */
function ProposeDialog({ projectId, parts, replacing, onClose, onDone }: { projectId: string; parts: PartRow[]; replacing: boolean; onClose: () => void; onDone: () => void }) {
  const people = [...new Map(parts.flatMap((p) => p.people.filter((x) => x.status === "active").map((x) => [x.id, x.name] as const))).entries()].map(([id, name]) => ({ id, name }));
  const equal = equalShares(people.length);
  const [credits, setCredits] = useState<Record<string, PartCredit>>(Object.fromEntries(parts.map((p) => [p.id, p.credit])));
  const [shares, setShares] = useState<Record<string, string>>(Object.fromEntries(people.map((x, i) => [x.id, String(equal[i])])));
  const [custom, setCustom] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = Math.round(people.reduce((a, x) => a + (Number(shares[x.id]) || 0), 0) * 100) / 100;
  const valid = !custom || (total === 100 && people.every((x) => /^\d{1,3}(\.\d{1,2})?$/.test(shares[x.id] ?? "")));

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const changed = Object.fromEntries(parts.filter((p) => credits[p.id] !== p.credit).map((p) => [p.id, credits[p.id]]));
      await api(`/api/v1/projects/${projectId}/song-agreement`, {
        method: "POST",
        json: { credits: Object.keys(changed).length ? changed : null, shares: custom ? Object.fromEntries(people.map((x) => [x.id, Number(shares[x.id])])) : null, note: note.trim() || null },
      });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent title="Propose credits" description={replacing ? "This replaces the current proposal; everyone named signs off again." : "Everyone named signs off before it's agreed."}>
        <div className="space-y-4">
          <fieldset>
            <legend className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Credited as</legend>
            <ul className="mt-1 divide-y divide-border-soft">
              {parts.map((p) => (
                <li key={p.id} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-[14px] text-ink">
                    {p.title} <span className="text-ink-muted">· {p.people.filter((x) => x.status === "active").map((x) => x.name).join(", ") || "no one"}</span>
                  </span>
                  <select aria-label={`${p.title} is credited as`} value={credits[p.id]} onChange={(e) => setCredits({ ...credits, [p.id]: e.target.value as PartCredit })} className="h-9 rounded-full border border-border-soft bg-surface px-3 text-[13px] text-ink">
                    {PART_CREDITS.map((c) => (
                      <option key={c} value={c}>
                        {PART_CREDIT_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </fieldset>
          <fieldset>
            <div className="flex items-baseline justify-between">
              <legend className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Shares</legend>
              <button
                type="button"
                className="inline-flex min-h-11 items-center text-[12.5px] font-medium text-accent-ink hover:underline"
                onClick={() => {
                  setCustom(!custom);
                  setShares(Object.fromEntries(people.map((x, i) => [x.id, String(equal[i])])));
                }}
              >
                {custom ? "Back to equal" : "Change shares"}
              </button>
            </div>
            <ul className="divide-y divide-border-soft">
              {people.map((x, i) => (
                <li key={x.id} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-[14px] text-ink">{x.name}</span>
                  {custom ? (
                    <label className="flex items-center gap-1 text-[13px] text-ink-muted">
                      <span className="sr-only">{x.name}&rsquo;s share</span>
                      <input inputMode="decimal" value={shares[x.id] ?? ""} onChange={(e) => setShares({ ...shares, [x.id]: e.target.value })} className="h-9 w-20 rounded-full border border-border-soft bg-surface px-3 text-right text-[14px] tabular-nums text-ink" />%
                    </label>
                  ) : (
                    <span className="text-[14px] tabular-nums text-ink">{formatPercent(equal[i]!)}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className={cn("mt-1 text-[12px]", valid ? "text-ink-subtle" : "text-danger")}>{custom ? `${total}% of 100%` : "Equal for everyone on the work."}</p>
          </fieldset>
          <label className="block text-[12.5px] font-medium text-ink">
            A note (optional)
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full resize-none rounded-xl border border-border-soft bg-surface px-3 py-2 text-[14px] font-normal text-ink" />
          </label>
          {error ? (
            <p role="alert" className="rounded-2xl bg-[#fdecec] px-3.5 py-2 text-[14px] text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!valid} onClick={() => void send()}>
              Send for sign-off
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ObjectDialog({ busy, onClose, onSend }: { busy: boolean; onClose: () => void; onSend: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent title="What would you change?" description="The Room's owner sees it and can propose again.">
        <textarea aria-label="What would you change?" rows={3} maxLength={500} autoFocus value={note} onChange={(e) => setNote(e.target.value)} className="block w-full resize-none rounded-xl border border-border-soft bg-surface px-3 py-2 text-[14px] text-ink" />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!note.trim()} onClick={() => void onSend(note.trim())}>
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
