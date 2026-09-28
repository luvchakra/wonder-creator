"use client";
import type { CarouselView } from "@wonder/creator-brain";
import { OUTPUT_MODES, outputModeOf, unusedNudge, workingSetSummary, type WorkingSetView, type WorkingSource } from "@wonder/creator-studio/working-set";
import type { StudioAction } from "@wonder/creator-studio/types";
import { Avatar, BACKGROUNDS, Button, Dialog, DialogContent, ErrorState, Input, KIT, KitArt, Segmented, Switch, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, ChevronDown, MoreHorizontal, PenLine, Sparkles, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { useMiniPlayerConstraint } from "@/components/soundtrack/audio-provider";
import { api, errorMessage } from "@/lib/client";
import { diffLines } from "@/lib/diff";
import { CarouselCanvas } from "./carousel-canvas";
import { QualityPanel, type QualityProposal, type QualityReportView } from "./quality-panel";
import { SourcesPanel } from "./sources-panel";
import { BringInSheet, ChangeFormatSheet, FragmentsSheet, SourceIcon, WorkingSetSheet } from "./working-set";

/**
 * The Creative Studio canvas (creative-studio-working-set.md §5–7, §44–47, §64–68): the Creation is the screen. One
 * compact "Sources N · M in use" pill (Bring in is inside it) sits at the bottom; the top bar names the Creation, says
 * "Autosaved", and shows who's on it. Writing autosaves as a draft; a version is made only at a checkpoint the creator
 * chooses ("Save as new version"). CreativeMind shows at most one quiet bubble at a time.
 */
export function Studio({
  artifact,
  version,
  actions,
  initialAction,
  addOnOpen,
  people,
  carousel,
  quality,
  pendingProposal,
  offline,
}: {
  artifact: { id: string; title: string; type: string; typeLabel: string; format: string; status: string; coverUrl: string | null };
  version: { id: string; number: number; content: string } | null;
  actions: StudioAction[];
  initialAction: string | null;
  /** `type:id` sent from a Huddle or a comment ("Use in Studio", §34–35). */
  addOnOpen: string | null;
  people: Array<{ id: string; name: string; avatarUrl: string | null }>;
  carousel: CarouselView | null;
  quality: QualityReportView | null;
  pendingProposal: QualityProposal | null;
  offline: boolean;
}) {
  // Immersive: the mini player stays a slim tab (music keeps playing; mini-player.md §33).
  useMiniPlayerConstraint({ forceCollapsed: true });
  const router = useRouter();
  const strip = useStripSignal();

  /* ------------------------------------------------------------ Working Set */
  const [set, setSet] = useState<WorkingSetView | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const typed = useRef(false);
  const [content, setContent] = useState(version?.content ?? "");
  const [base, setBase] = useState(version);
  const [title, setTitle] = useState(artifact.title);
  const [mode, setMode] = useState<"view" | "edit">(version?.content ? "view" : "edit");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A transform chip on the way in (?action=) opens Change format straight away.
  const [sheet, setSheet] = useState<null | "set" | "influence" | "bring" | "format" | "save" | "more">(() => (actions.find((x) => x.key === initialAction)?.kind === "transform" ? "format" : null));
  const [fragmentsFor, setFragmentsFor] = useState<WorkingSource | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let r = await api<{ workingSet: WorkingSetView }>("/api/v1/studio-sessions", { method: "POST", json: { artifactId: artifact.id } });
        if (addOnOpen) {
          const [type, id] = addOnOpen.split(":");
          r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${r.workingSet.sessionId}/sources`, { method: "POST", json: { items: [{ type, id }], state: "in_use" } });
          router.replace(`/artifacts/${artifact.id}/studio`);
        }
        if (!live) return;
        setSet(r.workingSet);
        // Resume (§45): the autosaved draft for this version comes back with the session — unless typing already began.
        const d = r.workingSet.draft;
        if (d && !typed.current && d.baseVersionId === (version?.id ?? null) && d.text !== (version?.content ?? "")) {
          setContent(d.text);
          setSavedAt(d.savedAt);
        }
      } catch (e) {
        if (live) setWsError(errorMessage(e));
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id]);
  const sources = set?.sources ?? [];
  const inUse = sources.filter((s) => s.state !== "available").length;
  const change = useCallback(
    async (row: WorkingSource, body: { state?: WorkingSource["state"] } | "remove") => {
      if (!set) return;
      setSet((s) => (s ? { ...s, sources: body === "remove" ? s.sources.filter((x) => x.id !== row.id) : s.sources.map((x) => (x.id === row.id ? { ...x, ...body } : x)) } : s));
      try {
        const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}/sources/${row.id}`, body === "remove" ? { method: "DELETE" } : { method: "PATCH", json: body });
        setSet(r.workingSet);
      } catch (e) {
        setWsError(errorMessage(e));
      }
    },
    [set],
  );
  // The navbar's quiet line (§45, §65): "3 sources · 2 unused".
  useEffect(() => {
    if (!set) return;
    const unused = sources.filter((s) => s.state === "available").length;
    strip("sources", sources.length ? { text: `${workingSetSummary(sources)}${unused ? ` · ${unused} unused` : ""}`, shortText: `${sources.length} sources`, tone: "neutral", priority: 9 } : null);
    return () => strip("sources", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set]);

  /* ------------------------------------------------------------ Canvas + autosave */
  const dirty = content !== (base?.content ?? "");
  // The last version saved from here, for the navbar's brief "Saved · vN".
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = (v: string) => {
    typed.current = true;
    setContent(v);
    if (!set) return;
    if (autosave.current) clearTimeout(autosave.current);
    setSaving(true);
    autosave.current = setTimeout(async () => {
      try {
        await api(`/api/v1/studio-sessions/${set.sessionId}`, { method: "PATCH", json: { draft: v === (base?.content ?? "") ? null : { text: v, baseVersionId: base?.id ?? null } } });
        setSavedAt(new Date().toISOString());
      } catch {
        // Kept in the editor; the next keystroke tries again.
      } finally {
        setSaving(false);
      }
    }, 900);
  };
  useEffect(() => {
    if (saving) strip("save", { text: "Saving…", tone: "active" });
    else if (savedAt) strip("save", { text: "Autosaved", tone: "success", ttl: 1500 });
    else if (savedVersion) strip("save", { text: `Saved · v${savedVersion}`, tone: "success", ttl: 1500 });
    else strip("save", null);
    return () => strip("save", null);
  }, [saving, savedAt, savedVersion, strip]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  // A selection in the text offers Rewrite · Expand · Shorten (board §8) — CreativeMind on just that passage.
  const [selection, setSelection] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<QualityProposal | null>(pendingProposal);
  const [view, setView] = useState<"changes" | "original" | "proposed">("changes");
  const [q, setQ] = useState(quality);
  const [lastQuality, setLastQuality] = useState(quality);
  if (quality !== lastQuality) {
    setLastQuality(quality);
    setQ(quality);
  }
  const [kept, setKept] = useState<{ versionNumber: number; titles: string[] } | null>(null);
  async function saveTitle() {
    if (title.trim() && title.trim() !== artifact.title) {
      try {
        await api(`/api/v1/artifacts/${artifact.id}`, { method: "PATCH", json: { title: title.trim() } });
        router.refresh();
      } catch (e) {
        setError(errorMessage(e));
      }
    }
  }

  /** Save as new version (board §12): the checkpoint that makes a durable version from the draft. */
  async function saveVersion(opts: { name: string; keepUnused: boolean }) {
    // The version supersedes any pending draft autosave, which would otherwise land afterwards and re-store the draft.
    if (autosave.current) {
      clearTimeout(autosave.current);
      autosave.current = null;
      setSaving(false);
    }
    setWorking("version");
    setError(null);
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifact.id}/versions`, {
        method: "POST",
        json: {
          content,
          baseVersionId: base?.id,
          label: opts.name.trim().slice(0, 80) || "Revised",
          changeSummary: `Saved in the Creative Studio${inUse ? ` with ${inUse} ${inUse === 1 ? "source" : "sources"} in use` : ""}.`,
        },
      });
      setBase({ id: r.version.id, number: r.version.version_number, content: r.version.content });
      if (set) {
        await api(`/api/v1/studio-sessions/${set.sessionId}`, { method: "PATCH", json: { draft: null } });
        if (!opts.keepUnused) {
          const unused = sources.filter((s) => s.state === "available");
          for (const s of unused) await api(`/api/v1/studio-sessions/${set.sessionId}/sources/${s.id}`, { method: "DELETE" }).catch(() => undefined);
          const fresh = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}`);
          setSet(fresh.workingSet);
        }
      }
      // A version, not a draft: the label reads "Saved" and the navbar briefly says which version.
      setSavedAt(null);
      setSavedVersion(r.version.version_number);
      setSheet(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  async function refine(a: { key: string; label: string; instruction?: string } | null) {
    if (dirty) {
      setError("Save a version first — CreativeMind works on your latest saved version.");
      setSheet("save");
      return;
    }
    const text = a?.instruction ?? (a ? `${a.label}${instruction.trim() ? `: ${instruction.trim()}` : ""}` : instruction.trim());
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
      } else setKept(null);
      setProposal(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
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
      const r = await api<{ reportId: string; versionId: string; checks: QualityReportView["checks"]; findings: QualityReportView["findings"] }>(`/api/v1/artifacts/${artifact.id}/quality`, {
        method: "POST",
      });
      setQ({ reportId: r.reportId, versionId: r.versionId, checks: r.checks, findings: r.findings });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }

  /* ------------------------------------------------------------ CreativeMind: one bubble at a time */
  const [connections, setConnections] = useState<Array<{ sourceIds: string[]; insight: string; why: string }> | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!set || offline || sources.filter((s) => s.available).length < 2 || connections) return;
    api<{ live: boolean; connections: Array<{ sourceIds: string[]; insight: string; why: string }> }>(`/api/v1/studio-sessions/${set.sessionId}/connections`, { method: "POST", json: {} })
      .then((r) => setConnections(r.connections))
      .catch(() => setConnections([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.sessionId, offline]);
  const connection = (connections ?? []).find((c) => !dismissed.has(c.insight) && c.sourceIds.every((id) => sources.some((s) => s.id === id)));
  const nudge = !connection && inUse > 0 ? unusedNudge(sources) : null;
  const nudgeKey = nudge ? `nudge:${nudge.count}` : null;
  const thumbs = sources.filter((x) => x.available && x.state !== "available" && x.thumbnailUrl).slice(0, 4);
  const showNudge = nudge && nudgeKey && !dismissed.has(nudgeKey);
  async function useConnection() {
    if (!set || !connection) return;
    setDismissed((d) => new Set(d).add(connection.insight));
    const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}/states`, { method: "POST", json: { ids: connection.sourceIds, state: "in_use" } }).catch(() => null);
    if (r) setSet(r.workingSet);
  }

  const modeLabel = OUTPUT_MODES.find((m) => m.key === outputModeOf(artifact.type))?.label ?? "Writing";
  const editorFont = artifact.format === "screenplay" ? "font-mono text-[14px] leading-7" : artifact.format === "verse" ? "font-display text-[19px] leading-8" : "font-display text-[18px] leading-8";
  const isCarousel = artifact.type === "carousel" && carousel;
  // "Arrange slides" (More sheet) asks the carousel canvas to open Arrange; each ask is a new number.
  const [arrangeReq, setArrangeReq] = useState(0);
  const saveLabel = saving ? "Saving…" : savedAt ? "Autosaved" : dirty ? "Unsaved" : "Saved";

  return (
    // --canvas-extra: what else takes height above the canvas (the offline notice), so the carousel canvas can size itself.
    <div className="mx-auto max-w-3xl pb-24" style={{ ["--canvas-extra" as string]: offline ? "4rem" : "0rem" }}>
      {/* Top bar (§6, §65): back · the Creation and its version · autosaved · who's on it · more. */}
      <header className="mb-2 flex items-center gap-1.5">
        <Link href={`/artifacts/${artifact.id}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-black/5" aria-label="Back to Creation">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface/90 py-1 pl-3 pr-1.5 ring-1 ring-border-soft">
            <label htmlFor="title" className="sr-only">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              maxLength={200}
              className="min-w-0 max-w-[10rem] bg-transparent text-[13.5px] font-medium text-ink focus:outline-none sm:max-w-xs"
            />
            <Link
              href={`/artifacts/${artifact.id}?tab=versions`}
              className="rounded-full bg-accent-softer px-2 py-0.5 text-[11.5px] font-semibold text-accent-ink"
              aria-label={`Version ${base?.number ?? 1} — see versions`}
            >
              v{base?.number ?? 1}
            </Link>
          </div>
          <p className="hidden truncate text-[12.5px] text-ink-subtle sm:block" aria-live="polite">
            {saveLabel}
          </p>
        </div>
        {/* Save stays visible while the text differs from the last version (minimalism: Save is never hidden). It opens
            "Save as new version"; the draft itself autosaves. Soft accent, so Bring in stays the one purple action. */}
        {dirty && !isCarousel && !proposal ? (
          <button type="button" onClick={() => setSheet("save")} aria-haspopup="dialog" className="inline-flex min-h-11 shrink-0 items-center">
            <span className="inline-flex h-8 items-center rounded-full bg-accent-soft px-3.5 text-[13px] font-semibold text-accent-ink ring-1 ring-accent/25 hover:bg-accent-softer">Save</span>
          </button>
        ) : null}
        <span role="group" className="flex -space-x-2" aria-label={`${people.length} on this Creation`}>
          {people.slice(0, 3).map((p) => (
            <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={28} className="ring-2 ring-background" />
          ))}
        </span>
        <button
          type="button"
          aria-label="More"
          aria-haspopup="dialog"
          onClick={() => setSheet("more")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-black/5"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </header>

      {/* Second line: autosave on phones, and the format lens (§24–26). */}
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[12px] text-ink-subtle sm:hidden" aria-hidden>
          {saveLabel}
        </p>
        <button
          type="button"
          onClick={() => setSheet("format")}
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface/90 px-3 text-[12.5px] font-medium text-ink hover:bg-surface"
          aria-haspopup="dialog"
        >
          <KitArt art={KIT.iconChip[MODE_ICON[outputModeOf(artifact.type)] ?? "type"]} sizes="1.25rem" className="size-5" />
          {modeLabel}
          <ChevronDown className="size-3.5 text-ink-subtle" aria-hidden />
        </button>
      </div>

      {offline ? (
        <p className="mb-2 rounded-2xl border border-[#f6dfb6] bg-warning-soft px-4 py-2 text-[13px] text-warning-ink">
          Offline development model: CreativeMind actions produce placeholder revisions.
        </p>
      ) : null}
      {error || wsError ? <ErrorState title="That didn't work" body={error ?? wsError ?? ""} className="mb-2" /> : null}
      {kept ? (
        <p role="status" className="mb-2 flex flex-wrap items-center gap-x-3 rounded-2xl bg-success-soft px-4 py-2 text-sm text-success-ink">
          Saved as v{kept.versionNumber}
          {kept.titles.length ? ` with: ${kept.titles.join("; ")}` : ""}.
          <Link href={`/artifacts/${artifact.id}?tab=versions`} className="inline-flex min-h-11 items-center font-medium underline">
            Compare with the previous version
          </Link>
        </p>
      ) : null}

      {/* The canvas */}
      {isCarousel ? (
        <section aria-label="Editor">
          <CarouselCanvas artifactId={artifact.id} initial={carousel} arrangeRequest={arrangeReq} />
        </section>
      ) : (
        <section aria-label="Editor" className="overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
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
                    <div
                      key={i}
                      className={cn(
                        "whitespace-pre-wrap px-2",
                        d.kind === "added" && "bg-success-soft text-success-ink",
                        d.kind === "removed" && "bg-danger-soft text-danger line-through decoration-danger/40",
                      )}
                    >
                      <span className="sr-only">{d.kind === "added" ? "Added: " : d.kind === "removed" ? "Removed: " : ""}</span>
                      {d.text || " "}
                    </div>
                  ))}
                </div>
              ) : (
                <article
                  aria-label={view === "original" ? "Original" : "Proposed"}
                  className={cn("max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-surface-muted px-5 py-6 text-ink sm:px-8", editorFont)}
                >
                  {(view === "original" ? base?.content : proposal.preview) || "Empty."}
                </article>
              )}
            </div>
          ) : mode === "view" ? (
            // Immersive reading (board §1): the Creation over its cover; tap, or the pen, to edit.
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="group relative block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Edit the text"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artifact.coverUrl ?? BACKGROUNDS.coastalVillage} alt="" className="absolute inset-0 size-full object-cover" />
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,18,40,0.25)_0%,rgba(20,18,40,0.55)_45%,rgba(20,18,40,0.88)_100%)]" />
              <span className="relative block min-h-[60dvh] px-5 pb-8 pt-[22vh] text-white sm:px-8">
                <span className="block font-display text-[34px] leading-[1.05] sm:text-[44px]">{title || "Untitled"}</span>
                <span
                  className={cn(
                    "mt-4 block max-h-[38dvh] overflow-hidden whitespace-pre-wrap text-white/90 [mask-image:linear-gradient(180deg,#000_75%,transparent)]",
                    artifact.format === "verse" ? "font-display text-[19px] leading-8" : "font-display text-[17px] leading-7",
                  )}
                >
                  {content}
                </span>
              </span>
            </button>
          ) : (
            <>
              <label htmlFor="editor" className="sr-only">
                {artifact.typeLabel} text
              </label>
              <textarea
                id="editor"
                value={content}
                onChange={(e) => onType(e.target.value)}
                onSelect={(e) => setSelection(e.currentTarget.value.slice(e.currentTarget.selectionStart, e.currentTarget.selectionEnd).trim().slice(0, 600))}
                onBlur={() => setTimeout(() => setSelection(""), 200)}
                autoFocus={!!version?.content}
                spellCheck
                className={cn("block min-h-[62dvh] w-full resize-y rounded-3xl bg-transparent px-5 py-6 text-ink focus:outline-none sm:px-10 sm:py-10", editorFont)}
                placeholder="Start with anything…"
              />
            </>
          )}
        </section>
      )}

      {/* Every source on the table, collapsed but for the last one opened (owner, 28 Sep 2026). */}
      {!proposal ? <SourcesPanel set={set} artifactId={artifact.id} onSeeAll={() => setSheet("set")} onUsePart={(row) => setFragmentsFor(row)} /> : null}

      {/* Refine + quality stay contextual to the canvas, below it (§15.2), never a pane. */}
      {!isCarousel ? (
        <section id="creativemind" aria-labelledby="creativemind-title" className="mt-4 scroll-mt-20 space-y-3">
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
                  onClick={() => (a.kind === "transform" ? setSheet("format") : refine(a))}
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
            blocked={dirty ? "Save a version first to apply suggestions." : proposal ? "Keep or discard the current revision first." : null}
            reviewing={working === "quality"}
            onReview={review}
            onPreview={(p) => setProposal(p)}
            onChanged={() => router.refresh()}
          />
        </section>
      ) : null}

      {/* One CreativeMind bubble at a time (§27–32): a connection, else a quiet nudge about what's unused. */}
      {connection || showNudge ? (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-20 mx-auto max-w-3xl motion-safe:animate-[fade-in_160ms_ease-out]" role="status">
          <div className="flex items-start gap-2.5 rounded-2xl border border-border-soft bg-surface/95 p-3 pr-2 shadow-[var(--shadow-card)] backdrop-blur">
            <KitArt art={KIT.iconChip.sparkles} sizes="2rem" className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink">{connection ? "Possible connection" : "Unused possibilities"}</p>
              <p className="text-[13.5px] leading-snug text-ink">{connection ? connection.insight : nudge!.text}</p>
              {connection ? (
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-subtle">
                  <span className="flex -space-x-1.5" aria-hidden>
                    {connection.sourceIds
                      .map((id) => sources.find((s) => s.id === id))
                      .filter((s): s is WorkingSource => !!s)
                      .map((s) => (
                        <SourceIcon key={s.id} s={s} size="size-5" ring />
                      ))}
                  </span>
                  {connection.why}
                </p>
              ) : null}
              <div className="mt-1.5">
                {connection ? (
                  <Button size="sm" onClick={useConnection}>
                    Use this connection
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setSheet("set")}>
                    See them
                  </Button>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setDismissed((d) => new Set(d).add(connection ? connection.insight : nudgeKey!))}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {selection && mode === "edit" && !proposal ? (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-20 mx-auto flex max-w-3xl justify-center" role="toolbar" aria-label="Selected text">
          <div className="flex items-center gap-1 rounded-full border border-border-soft bg-surface/95 p-1 shadow-[var(--shadow-card)] backdrop-blur">
            {(["Rewrite", "Expand", "Shorten"] as const).map((verb) => (
              <button
                key={verb}
                type="button"
                disabled={!!working}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => refine({ key: verb.toLowerCase(), label: `${verb} this passage`, instruction: `${verb} only this passage, keeping everything else as it is: "${selection}"` })}
                className="inline-flex h-9 min-w-11 items-center rounded-full px-3 text-[13px] font-medium text-ink hover:bg-accent-softer disabled:opacity-50"
              >
                {working === verb.toLowerCase() ? "Working…" : verb}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* In-use visuals (owner board "Fan + Preview Bubble"): a compact strip of the pictures on the table, above the
          Sources pill, in the cover view only. Tapping a picture opens the Working Set on what's In use; + brings more in. */}
      {mode === "view" && !isCarousel && !proposal && !connection && !showNudge && thumbs.length ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[4.25rem] z-20 mx-auto flex max-w-3xl">
          <ul className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border-soft bg-surface/85 p-1 shadow-[var(--shadow-card)] backdrop-blur" aria-label="Pictures in use">
            {thumbs.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSheet("influence")}
                  aria-label={`${t.title} — in the Working Set`}
                  className="block h-11 w-14 overflow-hidden rounded-lg border border-border-soft bg-cream-deep focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumbnailUrl!} alt="" className="size-full object-cover" />
                </button>
              </li>
            ))}
            {thumbs.length < inUse ? <li className="px-1 text-xs text-ink-muted">+{inUse - thumbs.length}</li> : null}
          </ul>
        </div>
      ) : null}

      {/* Bottom bar (§7, §64): pen · Sources N · M in use */}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-3xl items-center gap-2">
        {!isCarousel && !proposal ? (
          <button
            type="button"
            onClick={() => setMode((m) => (m === "view" ? "edit" : "view"))}
            aria-label={mode === "view" ? "Edit the text" : "Read it over the cover"}
            aria-pressed={mode === "edit"}
            className="pointer-events-auto inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-surface/95 text-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-surface"
          >
            <PenLine className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSheet("set")}
          aria-haspopup="dialog"
          aria-label={`Working Set: ${workingSetSummary(sources)}`}
          className="pointer-events-auto inline-flex min-h-11 items-center"
        >
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border-soft bg-surface/95 py-1 pl-1.5 pr-3.5 text-[13.5px] font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-surface">
            <span aria-hidden className="flex -space-x-2">
              {sources.length ? (
                sources.slice(0, 3).map((s) => <SourceIcon key={s.id} s={s} size="size-7" ring />)
              ) : (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent-softer">
                  <Sparkles className="size-3.5 text-accent" />
                </span>
              )}
            </span>
            {set && sources.length ? `Sources ${sources.length}${inUse ? ` · ${inUse} in use` : ""}` : "Sources"}
          </span>
        </button>
        <span className="flex-1" />
        {/* No separate "+": Bring in lives inside Sources (owner, 28 Sep 2026), so there's one way in. */}
      </div>

      {/* Sheets */}
      <WorkingSetSheet
        open={sheet === "set" || sheet === "influence"}
        onOpenChange={(o) => !o && setSheet(null)}
        set={set}
        onChange={change}
        onSet={setSet}
        initialFilter={sheet === "influence" ? "in_use" : "all"}
        onBringIn={() => setSheet("bring")}
        onFragments={(row) => setFragmentsFor(row)}
      />
      <BringInSheet
        open={sheet === "bring"}
        onOpenChange={(o) => !o && setSheet(null)}
        sessionId={set?.sessionId ?? null}
        onAdded={(next) => {
          setSet(next);
          setSheet("set");
        }}
      />
      <ChangeFormatSheet open={sheet === "format"} onOpenChange={(o) => !o && setSheet(null)} sessionId={set?.sessionId ?? null} currentType={artifact.type} aiLive={!offline} />
      {fragmentsFor && set ? <FragmentsSheet sessionId={set.sessionId} row={fragmentsFor} onClose={() => setFragmentsFor(null)} onAdded={(next) => setSet(next)} /> : null}
      <Dialog open={sheet === "more"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent title="Save, version and publish" description="Keep experimenting; save when ready." art={KIT.mark.starGold}>
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {[
              ...(!isCarousel ? [{ label: "Save version", hint: `v${(base?.number ?? 0) + 1} – ${artifact.typeLabel} (${title || "Untitled"})`, act: () => setSheet("save") }] : []),
              ...(isCarousel
                ? [
                    {
                      label: "Arrange slides",
                      hint: "Reorder without regenerating",
                      act: () => {
                        setSheet(null);
                        setArrangeReq((x) => x + 1);
                      },
                    },
                  ]
                : []),
              { label: "What's influencing this?", hint: workingSetSummary(sources), act: () => setSheet("influence") },
              { label: "View version history", hint: `v${base?.number ?? 1} is current`, act: () => router.push(`/artifacts/${artifact.id}?tab=versions`) },
              { label: "Transform / Derive", hint: "Make a carousel, video, etc.", act: () => setSheet("format") },
              { label: "Share (private link)", hint: "Only people with the link", act: () => router.push(`/artifacts/${artifact.id}/share`) },
              { label: "Publish", hint: "To profile, social, webhook", act: () => router.push(`/artifacts/${artifact.id}/publish`) },
              { label: "Rights & license", hint: "Set commercial rights", act: () => router.push(`/artifacts/${artifact.id}?tab=rights`) },
            ].map((row) => (
              <li key={row.label}>
                <button type="button" onClick={row.act} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{row.label}</span>
                    <span className="block truncate text-[12px] text-ink-subtle">{row.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <SaveVersionSheet
        open={sheet === "save"}
        onOpenChange={(o) => !o && setSheet(null)}
        defaultName={`${artifact.typeLabel} (${title || "Untitled"})`}
        inUse={inUse}
        unused={sources.length - inUse}
        busy={working === "version"}
        onSave={saveVersion}
      />
    </div>
  );
}

const MODE_ICON: Record<string, keyof typeof KIT.iconChip> = { writing: "type", carousel: "layers", image: "image", video: "video", audio: "waveform", presentation: "file" };

/** "Save as new version" (board §12): the one checkpoint that turns the draft into a durable version. */
function SaveVersionSheet({
  open,
  onOpenChange,
  defaultName,
  inUse,
  unused,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName: string;
  inUse: number;
  unused: number;
  busy: boolean;
  onSave: (o: { name: string; keepUnused: boolean }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save as new version" description="A durable checkpoint. Everything you keep experimenting with stays in the Studio." art={KIT.mark.starGold}>
        {open ? <SaveVersionBody defaultName={defaultName} inUse={inUse} unused={unused} busy={busy} onSave={onSave} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SaveVersionBody({
  defaultName,
  inUse,
  unused,
  busy,
  onSave,
  onClose,
}: {
  defaultName: string;
  inUse: number;
  unused: number;
  busy: boolean;
  onSave: (o: { name: string; keepUnused: boolean }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [keepUnused, setKeepUnused] = useState(true);
  return (
    <div className="space-y-3">
      <label className="block text-sm text-ink">
        Version name
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1" />
      </label>
      <p className="text-[13px] text-ink-muted">{inUse ? `Saved with ${inUse} ${inUse === 1 ? "source" : "sources"} in use.` : "No sources are in use yet."}</p>
      {unused ? (
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink">
          Keep {unused} unused {unused === 1 ? "source" : "sources"} for later
          <Switch checked={keepUnused} onCheckedChange={setKeepUnused} label="Keep unused sources for later" />
        </label>
      ) : null}
      <Button className="w-full" loading={busy} onClick={() => onSave({ name, keepUnused })}>
        Save version
      </Button>
      <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost", className: "w-full" })}>
        Continue in Studio
      </button>
    </div>
  );
}
