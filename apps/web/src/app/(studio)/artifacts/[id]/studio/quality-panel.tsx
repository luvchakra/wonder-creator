"use client";
import type { Finding } from "@wonder/creator-brain";
import { Badge, Button, cn } from "@wonder/ui";
import { Check, CircleAlert, ClipboardCheck, Lock, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export interface QualityReportView {
  reportId: string;
  versionId: string;
  checks: Array<{ key: string; label: string; status: string; note: string }>;
  findings: Finding[];
}

export interface QualityProposal {
  id: string;
  preview: string;
  baseVersionId: string;
  quality?: { reportId: string; keys: string[]; titles: string[] };
}

/**
 * Quality findings as a checklist. The creator picks which to apply, previews a revision that applies only
 * those, and can set findings aside. Rights & provenance notes are locked: they can't be dismissed or
 * rewritten away. Nothing here changes the piece until the creator keeps a previewed revision.
 */
export function QualityPanel({
  artifactId,
  report,
  currentVersionId,
  blocked,
  reviewing,
  onReview,
  onPreview,
  onChanged,
}: {
  artifactId: string;
  report: QualityReportView | null;
  currentVersionId: string | null;
  /** Unsaved edits or a pending revision: findings can't be applied right now. */
  blocked: string | null;
  reviewing: boolean;
  onReview: () => void;
  onPreview: (p: QualityProposal) => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stale = !!report && report.versionId !== currentVersionId;
  const good = report?.checks.filter((c) => c.status === "good") ?? [];
  const open = report?.findings.filter((f) => f.state === "open") ?? [];
  const closed = report?.findings.filter((f) => f.state !== "open") ?? [];

  async function preview() {
    if (!report) return;
    setBusy("preview");
    setError(null);
    try {
      const r = await api<{ kind: string; proposal?: { id: string }; preview?: string }>(`/api/v1/artifacts/${artifactId}/quality/apply`, { method: "POST", json: { reportId: report.reportId, keys: selected } });
      if (r.proposal) {
        const titles = report.findings.filter((f) => selected.includes(f.key)).map((f) => f.title);
        onPreview({ id: r.proposal.id, preview: r.preview ?? "", baseVersionId: currentVersionId ?? "", quality: { reportId: report.reportId, keys: selected, titles } });
        setSelected([]);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function setDismissed(key: string, dismissed: boolean) {
    if (!report) return;
    setBusy(key);
    setError(null);
    try {
      await api(`/api/v1/artifacts/${artifactId}/quality`, { method: "PATCH", json: { reportId: report.reportId, key, dismissed } });
      setSelected((s) => s.filter((k) => k !== key));
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-border-soft bg-surface p-4" aria-labelledby="quality-heading">
      <div className="flex items-center justify-between">
        <h2 id="quality-heading" className="font-semibold text-ink">
          Quality
        </h2>
        <Button size="sm" variant="ghost" onClick={onReview} loading={reviewing} disabled={reviewing || !!blocked}>
          <ClipboardCheck className="size-4" aria-hidden /> {report ? "Review again" : "Review"}
        </Button>
      </div>

      {!report ? (
        <p className="mt-2 text-sm text-ink-muted">Review for structure, voice, pacing, and rights & provenance. Suggestions only — nothing is rewritten unless you choose to.</p>
      ) : (
        <>
          {stale ? <Badge className="mt-2">From an earlier version — review again to apply suggestions</Badge> : null}
          {good.length ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-ink-muted">
                <Check className="mr-1 inline size-4 text-success-ink" aria-hidden />
                {good.length} check{good.length === 1 ? "" : "s"} look good
              </summary>
              <ul className="mt-1 space-y-1 pl-5 text-ink-muted">
                {good.map((c) => (
                  <li key={c.key}>
                    <span className="font-medium text-ink">{c.label}</span> — {c.note}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {open.length ? (
            <ul className="mt-3 space-y-2" aria-label="Suggestions">
              {open.map((f) => (
                <li key={f.key} className={cn("rounded-2xl border p-3 text-sm", f.locked ? "border-[#f6dfb6] bg-warning-soft" : "border-border-soft")}>
                  <div className="flex items-start gap-2">
                    {f.locked ? (
                      <Lock className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
                    ) : (
                      <input
                        type="checkbox"
                        id={`finding-${f.key}`}
                        className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
                        checked={selected.includes(f.key)}
                        disabled={stale || !!blocked}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, f.key] : s.filter((k) => k !== f.key)))}
                      />
                    )}
                    <label htmlFor={f.locked ? undefined : `finding-${f.key}`} className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium text-ink">
                        {f.kind === "check" && !f.locked ? <CircleAlert className="size-3.5 text-warning-ink" aria-hidden /> : null}
                        {f.title}
                      </span>
                      <span className="block text-ink-muted">{f.detail}</span>
                      {f.locked ? <span className="mt-1 block text-xs text-warning-ink">Stays visible — rewriting can&apos;t resolve it. Check your permissions, or set the piece&apos;s rights.</span> : null}
                    </label>
                    {!f.locked ? (
                      <button
                        type="button"
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/[0.05] hover:text-ink"
                        aria-label={`Set aside “${f.title}”`}
                        disabled={busy === f.key}
                        onClick={() => setDismissed(f.key, true)}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No open suggestions.</p>
          )}

          {closed.length ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-ink-muted">Applied or set aside ({closed.length})</summary>
              <ul className="mt-1 space-y-1">
                {closed.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-2 text-ink-muted">
                    <span>
                      <span className="text-ink">{f.title}</span> · {f.state === "applied" ? "Applied" : "Set aside"}
                    </span>
                    {f.state === "dismissed" ? (
                      <button type="button" className="inline-flex min-h-11 items-center gap-1 text-accent-ink hover:underline" disabled={busy === f.key} onClick={() => setDismissed(f.key, false)}>
                        <RotateCcw className="size-3.5" aria-hidden /> Bring back
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {blocked && open.some((f) => !f.locked) ? <p className="mt-2 text-xs text-ink-subtle">{blocked}</p> : null}
          {selected.length ? (
            <div className="sticky bottom-[calc(var(--palette-clearance)+0.5rem)] mt-3">
              <Button className="w-full" loading={busy === "preview"} disabled={stale || !!blocked} onClick={preview}>
                Preview {selected.length} change{selected.length === 1 ? "" : "s"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
