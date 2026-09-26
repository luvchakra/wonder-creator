"use client";
import type { StudioAction } from "@wonder/creator-studio/types";
import { Badge, Button, ErrorState, Input, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, Check, CircleAlert, ClipboardCheck, Save, Share2, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";
import { TransformDialog } from "../view";

export function Studio({
  artifact,
  version,
  actions,
  initialAction,
  materials,
  quality,
  pendingProposal,
  offline,
}: {
  artifact: { id: string; title: string; type: string; typeLabel: string; format: string; status: string };
  version: { id: string; number: number; content: string } | null;
  actions: StudioAction[];
  initialAction: string | null;
  materials: MaterialCardData[];
  quality: { checks: Array<{ key: string; label: string; status: string; note: string }>; suggestions: Array<{ title: string; detail: string }>; versionId: string } | null;
  pendingProposal: { id: string; preview: string; baseVersionId: string } | null;
  offline: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState(version?.content ?? "");
  const [base, setBase] = useState(version);
  const [title, setTitle] = useState(artifact.title);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState(pendingProposal);
  const [q, setQ] = useState(quality);
  const [transformType, setTransformType] = useState<string | null>(() => {
    const a = actions.find((x) => x.key === initialAction);
    return a?.kind === "transform" ? (a.targetType ?? null) : null;
  });
  const dirty = content !== (base?.content ?? "");

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
          json: { content, baseVersionId: base?.id, label: "Revised", changeSummary: "Edited in Studio." },
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
      setError("Save your edits first — CreatorBrain works on your latest saved version.");
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
      }
      setProposal(null);
      router.refresh();
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
      const r = await api<{ checks: Array<{ key: string; label: string; status: string; note: string }>; suggestions: Array<{ title: string; detail: string }> }>(`/api/v1/artifacts/${artifact.id}/quality`, { method: "POST" });
      setQ({ ...r, versionId: base?.id ?? "" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  const editorFont = artifact.format === "screenplay" ? "font-mono text-[14px] leading-7" : artifact.format === "verse" ? "font-display text-[18px] leading-8" : "text-[16px] leading-7";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link href={`/artifacts/${artifact.id}`} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Back to artifact">
          <ArrowLeft className="size-4" aria-hidden /> Back
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
        <div className="flex gap-2">
          <Button onClick={save} loading={saving} disabled={!dirty && title === artifact.title}>
            <Save className="size-4" aria-hidden /> Save
          </Button>
          <Link href={`/artifacts/${artifact.id}`} className={buttonClasses({ variant: "secondary" })}>
            <Share2 className="size-4" aria-hidden /> Share
          </Link>
        </div>
      </header>

      {offline ? <p className="rounded-2xl border border-[#f6dfb6] bg-warning-soft px-4 py-2 text-sm text-warning-ink">Offline development model: CreatorBrain actions produce placeholder revisions.</p> : null}
      {error ? <ErrorState title="That didn't work" body={error} /> : null}

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1fr_320px]">
        <section aria-label="Editor" className="rounded-3xl border border-border-soft bg-surface p-2 shadow-[var(--shadow-card)]">
          {proposal ? (
            <div className="p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent-softer px-4 py-3">
                <p className="text-[15px] text-ink">
                  <Sparkles className="mr-1.5 inline size-4 text-accent-ink" aria-hidden />
                  CreatorBrain suggested a revision. Your current version stays in history either way.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" loading={working === "approve"} onClick={() => decide("approve")}>
                    Keep revision
                  </Button>
                  <Button size="sm" variant="ghost" loading={working === "reject"} onClick={() => decide("reject")}>
                    Discard
                  </Button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-2xl bg-surface-muted p-4 font-mono text-[13px] leading-relaxed">
                {diffLines(base?.content ?? "", proposal.preview).map((d, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap px-2", d.kind === "added" && "bg-success-soft text-success-ink", d.kind === "removed" && "bg-danger-soft text-danger line-through decoration-danger/40")}>
                    <span className="sr-only">{d.kind === "added" ? "Added: " : d.kind === "removed" ? "Removed: " : ""}</span>
                    {d.text || " "}
                  </div>
                ))}
              </div>
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
                className={cn("block min-h-[60vh] w-full resize-y rounded-2xl bg-transparent p-4 text-ink focus:outline-none sm:p-6", editorFont)}
                placeholder="Start writing…"
              />
            </>
          )}
        </section>

        <aside aria-label="CreatorBrain" className="space-y-4">
          <section className="rounded-3xl border border-border-soft bg-surface p-4">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <span aria-hidden className="size-5 rounded-full" style={{ background: "var(--brand-gradient)" }} /> CreatorBrain
            </h2>
            <ul className="mt-3 space-y-1.5">
              {actions.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    disabled={!!working || !!proposal}
                    onClick={() => (a.kind === "transform" && a.targetType ? setTransformType(a.targetType) : refine(a))}
                    className="flex w-full items-start gap-2.5 rounded-2xl border border-border-soft px-3 py-2.5 text-left hover:border-[#cfd0ff] hover:bg-accent-softer disabled:opacity-50"
                  >
                    {a.kind === "transform" ? <Wand2 className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden /> : <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />}
                    <span>
                      <span className="block text-sm font-medium text-ink">{working === a.key ? "Working…" : a.label}</span>
                      <span className="block text-xs text-ink-subtle">{a.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
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
          </section>

          <section className="rounded-3xl border border-border-soft bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Quality</h2>
              <Button size="sm" variant="ghost" onClick={review} loading={working === "quality"} disabled={!!working || dirty}>
                <ClipboardCheck className="size-4" aria-hidden /> Review
              </Button>
            </div>
            {q ? (
              <>
                {q.versionId !== base?.id ? <Badge className="mt-2">From an earlier version</Badge> : null}
                <ul className="mt-2 space-y-1.5 text-sm">
                  {q.checks.map((c) => (
                    <li key={c.key} className="flex items-start gap-2">
                      {c.status === "good" ? <Check className="mt-0.5 size-4 shrink-0 text-success-ink" aria-label="Good" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-label="Worth a look" />}
                      <span>
                        <span className="font-medium text-ink">{c.label}</span> <span className="text-ink-muted">— {c.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {q.suggestions.length ? (
                  <ul className="mt-3 space-y-1 border-t border-border-soft pt-3 text-sm text-ink-muted">
                    {q.suggestions.map((s) => (
                      <li key={s.title}>
                        <span className="font-medium text-ink">{s.title}:</span> {s.detail}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Run a review for structure, voice and pacing suggestions. Nothing is rewritten.</p>
            )}
          </section>
        </aside>
      </div>

      <section aria-label="Related material">
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Related material</h2>
        {materials.length ? (
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {materials.map((m) => (
              <li key={m.id} className="w-28 shrink-0">
                <Link href={`/space/materials/${m.id}`}>
                  <div className="aspect-square overflow-hidden rounded-xl border border-border-soft">
                    <MaterialVisual m={m} />
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">{m.title || "Untitled"}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-subtle">No material linked. Bring material in CreatorTalk to ground this piece.</p>
        )}
      </section>

      {transformType ? (
        <TransformDialog open onOpenChange={(o) => !o && setTransformType(null)} artifactId={artifact.id} currentType={artifact.type} initialType={transformType} />
      ) : null}
    </div>
  );
}
