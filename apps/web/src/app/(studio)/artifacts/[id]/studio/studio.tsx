"use client";
import { useMiniPlayerConstraint } from "@/components/soundtrack/audio-provider";
import type { StudioAction } from "@wonder/creator-studio/types";
import { Button, ErrorState, Input, Segmented, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, Save, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";
import { TransformDialog } from "../view";
import { QualityPanel, type QualityProposal, type QualityReportView } from "./quality-panel";
import { WorkingSet } from "./working-set";

export function Studio({
  artifact,
  version,
  actions,
  initialAction,
  quality,
  pendingProposal,
  offline,
}: {
  artifact: { id: string; title: string; type: string; typeLabel: string; format: string; status: string };
  version: { id: string; number: number; content: string } | null;
  actions: StudioAction[];
  initialAction: string | null;
  quality: QualityReportView | null;
  pendingProposal: QualityProposal | null;
  offline: boolean;
}) {
  // Immersive writing: the mini player stays a slim tab (music keeps playing; mini-player.md §33).
  useMiniPlayerConstraint({ forceCollapsed: true });
  const router = useRouter();
  const [content, setContent] = useState(version?.content ?? "");
  const [base, setBase] = useState(version);
  const [title, setTitle] = useState(artifact.title);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<QualityProposal | null>(pendingProposal);
  const [view, setView] = useState<"changes" | "original" | "proposed">("changes");
  const [q, setQ] = useState(quality);
  // Keep the panel in sync with server data after refreshes (dismiss, apply).
  const [lastQuality, setLastQuality] = useState(quality);
  if (quality !== lastQuality) {
    setLastQuality(quality);
    setQ(quality);
  }
  const [kept, setKept] = useState<{ versionNumber: number; titles: string[] } | null>(null);
  const [transformType, setTransformType] = useState<string | null>(() => {
    const a = actions.find((x) => x.key === initialAction);
    return a?.kind === "transform" ? (a.targetType ?? null) : null;
  });
  const dirty = content !== (base?.content ?? "");
  // Save state lives in the navbar Context Strip (context-strip §23): Unsaved → Saving… → Saved, then back to the version.
  const strip = useStripSignal();
  useEffect(() => {
    if (saving) strip("save", { text: "Saving…", tone: "active" });
    else if (dirty) strip("save", { text: "Unsaved changes", shortText: "Unsaved", tone: "neutral" });
    else if (savedAt) strip("save", { text: "Saved", tone: "success", ttl: 1500 });
    else strip("save", null);
    return () => strip("save", null);
  }, [saving, dirty, savedAt, strip]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (title.trim() && title !== artifact.title) await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { title: title.trim() } });
      if (dirty) {
        const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifact.id}/versions`, {
          method: "POST",
          json: { content, baseVersionId: base?.id, label: "Revised", changeSummary: "Edited in the Creative Studio." },
        });
        setBase({ id: r.version.id, number: r.version.version_number, content: r.version.content });
      }
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function refine(a: { key: string; label: string } | null) {
    if (dirty) {
      setError("Save your edits first — CreativeMind works on your latest saved version.");
      return;
    }
    const text = a ? `${a.label}${instruction.trim() ? `: ${instruction.trim()}` : ""}` : instruction.trim();
    if (!text) return;
    setWorking(a?.key ?? "custom");
    setError(null);
    try {
      const r = await api<{ kind: "version" | "proposal"; versionId?: string; versionNumber?: number; proposal?: { id: string }; preview?: string }>(`/api/v1/artifacts/${artifact.id}/refine`, {
        method: "POST",
        json: { instruction: text, action: a?.key },
      });
      if (r.kind === "proposal" && r.proposal) setProposal({ id: r.proposal.id, preview: r.preview ?? "", baseVersionId: base?.id ?? "" });
      else router.refresh();
      setInstruction("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!proposal) return;
    setWorking(decision);
    setError(null);
    try {
      const r = await api<{ versionId?: string; versionNumber?: number }>(`/api/v1/brain/proposals/${proposal.id}`, { method: "POST", json: { decision } });
      if (decision === "approve" && r.versionId) {
        setContent(proposal.preview);
        setBase({ id: r.versionId, number: r.versionNumber ?? (base?.number ?? 0) + 1, content: proposal.preview });
        setKept({ versionNumber: r.versionNumber ?? (base?.number ?? 0) + 1, titles: proposal.quality?.titles ?? [] });
      } else {
        setKept(null);
      }
      setProposal(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  /** Discard this preview and ask for a fresh one applying the same suggestions. */
  async function regenerate() {
    if (!proposal?.quality) return;
    const { reportId, keys, titles } = proposal.quality;
    setWorking("regenerate");
    setError(null);
    try {
      await api(`/api/v1/brain/proposals/${proposal.id}`, { method: "POST", json: { decision: "reject" } });
      setProposal(null);
      const r = await api<{ proposal?: { id: string }; preview?: string }>(`/api/v1/artifacts/${artifact.id}/quality/apply`, { method: "POST", json: { reportId, keys } });
      if (r.proposal) setProposal({ id: r.proposal.id, preview: r.preview ?? "", baseVersionId: base?.id ?? "", quality: { reportId, keys, titles } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  async function review() {
    setWorking("quality");
    setError(null);
    try {
      const r = await api<{ reportId: string; versionId: string; checks: QualityReportView["checks"]; findings: QualityReportView["findings"] }>(`/api/v1/artifacts/${artifact.id}/quality`, { method: "POST" });
      setQ({ reportId: r.reportId, versionId: r.versionId, checks: r.checks, findings: r.findings });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  const editorFont = artifact.format === "screenplay" ? "font-mono text-[14px] leading-7" : artifact.format === "verse" ? "font-display text-[19px] leading-8" : "font-display text-[18px] leading-8";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Title and status stay minimal (UI redesign §15.1): the writing surface is the screen. */}
      <header className="flex items-start gap-2">
        <Link href={`/artifacts/${artifact.id}`} className={buttonClasses({ variant: "ghost", className: "shrink-0 px-3" })} aria-label="Back to Creation">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <label htmlFor="title" className="sr-only">
            Title
          </label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-auto border-transparent bg-transparent px-1 font-display text-2xl text-ink hover:border-border sm:text-3xl" maxLength={200} />
          <p className="px-1 text-sm text-ink-subtle">
            {artifact.typeLabel} · v{base?.number ?? 1}
            {dirty ? " · unsaved changes" : savedAt ? ` · saved ${savedAt}` : ""}
          </p>
        </div>
        <Button className="shrink-0" onClick={save} loading={saving} disabled={!dirty && title === artifact.title}>
          <Save className="size-4" aria-hidden /> Save
        </Button>
      </header>

      {offline ? <p className="rounded-2xl border border-[#f6dfb6] bg-warning-soft px-4 py-2 text-sm text-warning-ink">Offline development model: CreativeMind actions produce placeholder revisions.</p> : null}
      {error ? <ErrorState title="That didn't work" body={error} /> : null}
      {kept ? (
        <p role="status" className="flex flex-wrap items-center gap-x-3 rounded-2xl bg-success-soft px-4 py-2 text-sm text-success-ink">
          Saved as v{kept.versionNumber}
          {kept.titles.length ? ` with: ${kept.titles.join("; ")}` : ""}.
          <Link href={`/artifacts/${artifact.id}?tab=versions`} className="inline-flex min-h-11 items-center font-medium underline">
            Compare with the previous version
          </Link>
        </p>
      ) : null}

      <section aria-label="Editor" className="rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
        {proposal ? (
          <div className="p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent-softer px-4 py-3">
              <div className="min-w-0 text-[15px] text-ink">
                <p>
                  <Sparkles className="mr-1.5 inline size-4 text-accent-ink" aria-hidden />
                  {proposal.quality ? "Preview of the suggestions you chose." : "CreativeMind suggested a revision."} Your current version stays in history either way.
                </p>
                {proposal.quality ? <p className="mt-1 text-sm text-ink-muted">Applying: {proposal.quality.titles.join("; ")}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={working === "approve"} disabled={!!working} onClick={() => decide("approve")}>
                  Keep revision
                </Button>
                {proposal.quality ? (
                  <Button size="sm" variant="secondary" loading={working === "regenerate"} disabled={!!working} onClick={regenerate}>
                    Try another version
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" loading={working === "reject"} disabled={!!working} onClick={() => decide("reject")}>
                  Discard
                </Button>
              </div>
            </div>
            {/* Original / proposed switch (UI redesign §18): read either whole, or just what changes. */}
            <Segmented
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { value: "changes", label: "Changes" },
                { value: "original", label: `Original (v${base?.number ?? 1})` },
                { value: "proposed", label: "Proposed" },
              ]}
              className="mb-3"
            />
            {view === "changes" ? (
              <div aria-label="Changes" role="region" className="max-h-[65vh] overflow-auto rounded-2xl bg-surface-muted p-4 font-mono text-[13px] leading-relaxed">
                {diffLines(base?.content ?? "", proposal.preview).map((d, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap px-2", d.kind === "added" && "bg-success-soft text-success-ink", d.kind === "removed" && "bg-danger-soft text-danger line-through decoration-danger/40")}>
                    <span className="sr-only">{d.kind === "added" ? "Added: " : d.kind === "removed" ? "Removed: " : ""}</span>
                    {d.text || " "}
                  </div>
                ))}
              </div>
            ) : (
              <article aria-label={view === "original" ? "Original" : "Proposed"} className={cn("max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-muted px-5 py-6 text-ink sm:px-8", editorFont)}>
                {(view === "original" ? base?.content : proposal.preview) || "Empty."}
              </article>
            )}
          </div>
        ) : (
          <>
            <label htmlFor="editor" className="sr-only">
              {artifact.typeLabel} text
            </label>
            <textarea
              id="editor"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  void save();
                }
              }}
              spellCheck
              className={cn("block min-h-[70dvh] w-full resize-y rounded-3xl bg-transparent px-5 py-6 text-ink focus:outline-none sm:px-10 sm:py-10", editorFont)}
              placeholder="Start writing…"
            />
          </>
        )}
      </section>

      {/* CreativeMind is contextual, not a pane (§15.2): refine chips, one line to ask, and the quality review surface. */}
      <section id="creativemind" aria-labelledby="creativemind-title" className="scroll-mt-20 space-y-3">
        <h2 id="creativemind-title" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <span aria-hidden className="size-3 rounded-full" style={{ background: "var(--brand-gradient)" }} /> Refine with CreativeMind
        </h2>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Suggestions">
          {actions.map((a) => (
            <li key={a.key} className="shrink-0">
              <button
                type="button"
                disabled={!!working || !!proposal}
                title={a.hint}
                onClick={() => (a.kind === "transform" && a.targetType ? setTransformType(a.targetType) : refine(a))}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-soft bg-surface px-4 text-sm font-medium text-ink hover:border-[#cfd0ff] hover:bg-accent-softer disabled:opacity-50"
              >
                {a.kind === "transform" ? <Wand2 className="size-4 shrink-0 text-accent-ink" aria-hidden /> : <Sparkles className="size-4 shrink-0 text-accent-ink" aria-hidden />}
                {working === a.key ? "Working…" : a.label}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void refine(null);
          }}
        >
          <label htmlFor="instruction" className="sr-only">
            Describe what you want to change
          </label>
          <Input id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Describe what to change…" disabled={!!working || !!proposal} />
          <Button type="submit" size="md" disabled={!instruction.trim() || !!working || !!proposal} loading={working === "custom"}>
            Go
          </Button>
        </form>
        <QualityPanel
          artifactId={artifact.id}
          report={q}
          currentVersionId={base?.id ?? null}
          blocked={dirty ? "Save your edits first to apply suggestions." : proposal ? "Keep or discard the current revision first." : null}
          reviewing={working === "quality"}
          onReview={review}
          onPreview={(p) => setProposal(p)}
          onChanged={() => router.refresh()}
        />
      </section>

      {/* Everything on the table for this Creation (Working Set): one compact pill, the canvas stays dominant. */}
      <WorkingSet artifactId={artifact.id} />

      {transformType ? (
        <TransformDialog open focused onOpenChange={(o) => !o && setTransformType(null)} artifactId={artifact.id} currentType={artifact.type} initialType={transformType} />
      ) : null}
    </div>
  );
}
