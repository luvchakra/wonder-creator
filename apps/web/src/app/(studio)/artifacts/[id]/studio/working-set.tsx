"use client";
import {
  RIGHTS_LABEL,
  BRING_IN_KINDS,
  MODE_DEFAULT_TYPE,
  OUTPUT_MODES,
  ROLE_LABEL,
  STATE_LABEL,
  mmss,
  outputModeOf,
  workingSetSummary,
  type BringInResult,
  type Direction,
  type Fragment,
  type SourceState,
  type SourceType,
  type WorkingSetView,
  type WorkingSource,
  directionsFor,
  usageOptionsFor,
  type UsageOption,
} from "@wonder/creator-studio/working-set";
import { Button, Dialog, DialogContent, Input, KIT, KitArt, Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@wonder/ui";
import { ArrowLeft, ArrowRight, Check, MoreHorizontal, Pin, Plus, Scissors, Search, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { DejaVuIntake } from "./studio-community";

/**
 * The Working Set sheets (creative-studio-working-set.md §7–11, §15–17, §19–21): everything on the table for this
 * Creation, one doorway to bring more in, "Use together" for a selection, and fragments of a source. Sheets, not
 * pages; one dominant action per state; routine changes save as they happen.
 */

export type Change = (row: WorkingSource, body: { state?: SourceState } | "remove") => Promise<void>;

/* ---------------------------------------------------------------- Working Set */

export function WorkingSetSheet({
  open,
  onOpenChange,
  set,
  onChange,
  onSet,
  initialFilter = "all",
  onBringIn,
  onFragments,
  onUsed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  set: WorkingSetView | null;
  onChange: Change;
  onSet: (next: WorkingSetView) => void;
  initialFilter?: "all" | SourceState;
  onBringIn: () => void;
  onFragments: (row: WorkingSource) => void;
  /** After "How do you want to use this?" is answered and saved: make those uses happen (the Studio knows how). */
  onUsed?: (rows: WorkingSource[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Working Set" description={set ? workingSetSummary(set.sources) : "Opening…"} art={KIT.painted.leafSprigSage} wide className="sm:max-w-3xl">
        {open ? (
          <WorkingSetBody
            set={set}
            onChange={onChange}
            onSet={onSet}
            initialFilter={initialFilter}
            onBringIn={onBringIn}
            onFragments={onFragments}
            onUsed={onUsed}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WorkingSetBody({
  set,
  onChange,
  onSet,
  initialFilter,
  onBringIn,
  onFragments,
  onUsed,
  onClose,
}: {
  onUsed?: (rows: WorkingSource[]) => void;
  onClose: () => void;
  set: WorkingSetView | null;
  onChange: Change;
  onSet: (next: WorkingSetView) => void;
  initialFilter: "all" | SourceState;
  onBringIn: () => void;
  onFragments: (row: WorkingSource) => void;
}) {
  const [filter, setFilter] = useState<"all" | SourceState>(initialFilter);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [together, setTogether] = useState<false | "ask" | "together">(false);
  const sources = set?.sources ?? [];
  const shown = sources.filter((s) => filter === "all" || s.state === filter);
  const counts = {
    all: sources.length,
    in_use: sources.filter((s) => s.state === "in_use").length,
    available: sources.filter((s) => s.state === "available").length,
    pinned: sources.filter((s) => s.state === "pinned").length,
  };
  const chosen = sources.filter((s) => picked.has(s.id));
  return (
    <>
      {!set ? (
        <p className="text-sm text-ink-muted">Opening your Working Set…</p>
      ) : !sources.length ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <KitArt art={KIT.painted.coastalVignette} sizes="12rem" className="h-auto w-44 opacity-90" />
          <p className="font-display text-lg text-ink">Nothing here yet.</p>
          <p className="max-w-xs text-sm text-ink-muted">Bring in a photo, note, voice, Creation or reference.</p>
          <Button className="mt-1" onClick={onBringIn}>
            <Plus className="size-4" aria-hidden /> Bring in
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pb-14">
          <div className="flex items-center justify-between gap-2">
            <div role="radiogroup" aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
              {(["all", "in_use", "available", "pinned"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className="inline-flex min-h-11 shrink-0 items-center">
                  <span
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]",
                      filter === k ? "bg-accent-soft font-medium text-accent-ink" : "bg-surface-muted text-ink-muted",
                    )}
                  >
                    {k === "all" ? "All" : STATE_LABEL[k]}
                    <span className={cn("rounded-full px-1.5 text-[11px]", filter === k ? "bg-accent/15" : "bg-black/5")}>{counts[k]}</span>
                  </span>
                </button>
              ))}
            </div>
            <Button size="sm" onClick={onBringIn} className="shrink-0">
              <Plus className="size-4" aria-hidden /> Bring in
            </Button>
          </div>
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft sm:grid sm:grid-cols-2 sm:gap-2 sm:divide-y-0 sm:border-0">
            {shown.map((s) => (
              <SourceRow
                key={s.id}
                s={s}
                picked={picked.has(s.id)}
                onPick={() =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
                onChange={onChange}
                onFragments={() => onFragments(s)}
              />
            ))}
            {!shown.length ? <li className="px-3 py-4 text-center text-sm text-ink-muted">Nothing {filter === "all" ? "here" : STATE_LABEL[filter].toLowerCase()} yet.</li> : null}
          </ul>
          {chosen.length ? (
            <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border-soft bg-surface px-5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:absolute sm:rounded-b-3xl">
              <span className="flex items-center gap-2 text-sm text-ink">
                <span aria-hidden className="flex -space-x-2">
                  {chosen.slice(0, 3).map((s) => (
                    <SourceIcon key={s.id} s={s} size="size-7" ring />
                  ))}
                </span>
                {chosen.length} selected
              </span>
              <Button onClick={() => setTogether("ask")}>
                <Sparkles className="size-4" aria-hidden /> {chosen.length > 1 ? "Use together" : "Use this"} <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {/* Use this / Use together: ask how each one is used (one question per source), then — for several — what
          they could become together. */}
      {set && together === "ask" ? (
        <UseEach
          set={set}
          rows={chosen}
          onClose={() => setTogether(false)}
          onPart={(row) => {
            setTogether(false);
            onFragments(row);
          }}
          onDone={(next) => {
            onSet(next);
            // Make each chosen use happen now, with the saved answers (the fresh rows carry them).
            onUsed?.(next.sources.filter((x) => chosen.some((c) => c.id === x.id)));
            if (chosen.length > 1) return setTogether("together");
            setTogether(false);
            setPicked(new Set());
            onClose();
          }}
        />
      ) : null}
      {set && together === "together" ? (
        <UseTogether
          set={set}
          chosen={chosen}
          onClose={() => setTogether(false)}
          onDone={(next) => {
            // Back to the canvas with the idea in hand (§17): one transition, not two.
            onSet(next);
            setTogether(false);
            setPicked(new Set());
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

function SourceRow({ s, picked, onPick, onChange, onFragments }: { s: WorkingSource; picked: boolean; onPick: () => void; onChange: Change; onFragments: () => void }) {
  const router = useRouter();
  const on = s.state !== "available";
  const canFragment = s.available && !s.fragment && s.sourceType !== "collection";
  return (
    <li className={cn("flex min-h-12 items-center gap-2 py-1 pl-2 pr-1 sm:rounded-2xl sm:border sm:border-border-soft", picked && "bg-accent-softer/60")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={picked}
        aria-label={`Select ${s.title}`}
        disabled={!s.available}
        onClick={onPick}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
      >
        <span aria-hidden className={cn("inline-flex size-5 items-center justify-center rounded-md border", picked ? "border-accent bg-accent text-white" : "border-border bg-surface")}>
          {picked ? <Check className="size-3.5" /> : null}
        </span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${s.title}: ${on ? "in use" : "available"}`}
        disabled={!s.available || s.state === "pinned"}
        onClick={() => onChange(s, { state: on ? "available" : "in_use" })}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default"
      >
        <span className="relative shrink-0">
          <SourceIcon s={s} size="size-11" square />
          {on ? (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 inline-flex size-4 items-center justify-center rounded-full text-white ring-2 ring-surface",
                s.state === "pinned" ? "bg-orange" : "bg-accent",
              )}
            >
              {s.state === "pinned" ? <Pin className="size-2.5" aria-hidden /> : <Check className="size-2.5" aria-hidden />}
            </span>
          ) : null}
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", s.available ? "text-ink" : "italic text-ink-subtle")}>{s.title}</span>
          <span className="block truncate text-[12px] text-ink-subtle">
            {s.available ? [s.rights !== "reuse_permitted" ? RIGHTS_LABEL[s.rights] : null, s.kind, s.attribution].filter(Boolean).join(" · ") : "Kept on the table; nothing of it is shown."}
          </span>
          {s.available && s.roles.length ? (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {s.roles.map((r) => (
                <span key={r} className="rounded-md bg-accent-softer px-1.5 py-px text-[11px] font-medium text-accent-ink">
                  {ROLE_LABEL[r]}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
      {s.available ? (
        <button
          type="button"
          aria-label={s.state === "pinned" ? `Unpin ${s.title}` : `Pin ${s.title}`}
          aria-pressed={s.state === "pinned"}
          onClick={() => onChange(s, { state: s.state === "pinned" ? "in_use" : "pinned" })}
          className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5", s.state === "pinned" ? "text-orange" : "text-ink-subtle")}
        >
          <Pin className={cn("size-4", s.state === "pinned" && "fill-current")} aria-hidden />
        </button>
      ) : null}
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`More for ${s.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </MenuTrigger>
        <MenuContent>
          {canFragment ? (
            <MenuItem onSelect={onFragments}>
              <Scissors className="size-4" aria-hidden /> Use a part of it…
            </MenuItem>
          ) : null}
          {s.href ? <MenuItem onSelect={() => router.push(s.href!)}>Open</MenuItem> : null}
          <MenuItem onSelect={() => onChange(s, "remove")}>
            <Trash2 className="size-4" aria-hidden /> Take off the table
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

/* ---------------------------------------------------------------- Use this */

/**
 * "How do you want to use this?" (owner, 28 Sep 2026): for one source, 3–4 options from what it is and what the
 * Creation is becoming, then "Something else…" in the creator's own words. Choosing puts it In use with that intent;
 * a "part" option opens Fragments first. No model involved, nothing invented.
 */
function UseEach({
  set,
  rows,
  onClose,
  onPart,
  onDone,
}: {
  set: WorkingSetView;
  rows: WorkingSource[];
  onClose: () => void;
  onPart: (row: WorkingSource) => void;
  onDone: (next: WorkingSetView) => void;
}) {
  const type = currentType(set);
  const several = rows.length > 1;
  const initial = (row: WorkingSource) => {
    const options = usageOptionsFor(row, type);
    return { pick: row.usageNote ? "other" : (options.find((o) => o.intent === row.usageIntent)?.key ?? options[0]!.key), other: row.usageNote ?? "" };
  };
  const [answers, setAnswers] = useState<Record<string, { pick: string; other: string }>>(() => Object.fromEntries(rows.map((r) => [r.id, initial(r)])));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const row = rows[step]!;
  const options = usageOptionsFor(row, type);
  const a = answers[row.id]!;
  const set1 = (patch: Partial<{ pick: string; other: string }>) => setAnswers((x) => ({ ...x, [row.id]: { ...x[row.id]!, ...patch } }));
  const chosenOf = (r: WorkingSource): UsageOption | null => {
    const x = answers[r.id]!;
    return x.pick === "other" ? null : (usageOptionsFor(r, type).find((o) => o.key === x.pick) ?? null);
  };
  const chosen = chosenOf(row);
  const last = step === rows.length - 1;

  async function next() {
    if (!chosen && !a.other.trim()) return setError("Say how you'd like to use it.");
    setError(null);
    // One source and a "part" choice: pick the passage or moment first (Fragments).
    if (!several && chosen?.part) return onPart(row);
    if (!last) return setStep(step + 1);
    setBusy(true);
    try {
      let view: WorkingSetView | null = null;
      for (const r of rows) {
        const c = chosenOf(r);
        const res = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}/sources/${r.id}`, {
          method: "PATCH",
          json: { state: r.state === "pinned" ? "pinned" : "in_use", usageIntent: c?.intent ?? null, usageNote: c ? null : answers[r.id]!.other.trim() },
        });
        view = res.workingSet;
      }
      onDone(view!);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="How do you want to use this?" description={several ? `${step + 1} of ${rows.length} · ${row.title}` : row.title} art={KIT.mark.sparklePurple}>
        <div key={row.id} className="space-y-3">
          {several ? (
            <div className="flex items-center gap-1" aria-hidden>
              {rows.map((r, i) => (
                <span key={r.id} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-light-gray")} />
              ))}
            </div>
          ) : null}
          <div role="radiogroup" aria-label="Ways to use it" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={a.pick === o.key}
                onClick={() => set1({ pick: o.key })}
                className={cn("flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left", a.pick === o.key ? "bg-accent-softer" : "hover:bg-black/[0.02]")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {o.label}
                    {o.part ? "…" : ""}
                  </span>
                  <span className="block text-[12.5px] text-ink-muted">{o.part && several ? "Choose the part afterwards, from its row" : o.hint}</span>
                </span>
                {a.pick === o.key ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : null}
              </button>
            ))}
            <div className={cn("px-3 py-2", a.pick === "other" && "bg-accent-softer")}>
              <button type="button" role="radio" aria-checked={a.pick === "other"} onClick={() => set1({ pick: "other" })} className="min-h-9 text-left text-sm font-medium text-ink">
                Something else…
              </button>
              <Input
                aria-label="How you'd like to use it"
                value={a.other}
                maxLength={300}
                onFocus={() => set1({ pick: "other" })}
                onChange={(e) => set1({ pick: "other", other: e.target.value })}
                placeholder="e.g. only the colours of the sky, for the last slide"
                className="mt-1"
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            {several && step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Button>
            ) : null}
            <Button className="flex-1" loading={busy} onClick={next}>
              {!several && chosen?.part ? "Choose the part" : !last ? "Next" : several ? "Use them together" : "Use it"} <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Use together */

function UseTogether({ set, chosen, onClose, onDone }: { set: WorkingSetView; chosen: WorkingSource[]; onClose: () => void; onDone: (next: WorkingSetView) => void }) {
  const router = useRouter();
  const [r, setR] = useState<{ live: boolean; idea: string | null; suggestedFormat: string | null; directions: Direction[] } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<Direction | null>(null);
  useEffect(() => {
    let live = true;
    api<typeof r>(`/api/v1/studio-sessions/${set.sessionId}/use-together`, { method: "POST", json: { ids: chosen.map((c) => c.id) } })
      .then((x) => {
        if (!live || !x) return;
        setR(x);
        setPick(x.directions[0]?.key ?? null);
      })
      .catch((e) => {
        if (!live) return;
        // CreativeMind couldn't add its idea (provider down, out of credit): the directions from the sources' roles
        // still stand, so the creator can go on. The reason shows as a quiet note, not a dead end.
        setError(errorMessage(e));
        const directions = directionsFor(chosen);
        setR({ live: false, idea: null, suggestedFormat: null, directions });
        setPick(directions[0]?.key ?? null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.sessionId]);
  const direction = r?.directions.find((d) => d.key === pick) ?? null;

  async function useIdea() {
    if (!r) return;
    setBusy(true);
    setError(null);
    try {
      const goal = other.trim() || r.idea || direction?.title || "";
      await api(`/api/v1/studio-sessions/${set.sessionId}`, { method: "PATCH", json: { intent: { ...set.intent, goal: goal.slice(0, 300), format: direction?.artifactType ?? set.intent.format } } });
      const next = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}/states`, { method: "POST", json: { ids: chosen.map((c) => c.id), state: "in_use" } });
      // A direction in another format offers the switch (§24–25); the creator decides.
      if (direction && outputModeOf(direction.artifactType) !== outputModeOf(currentType(set))) {
        setSwitching(direction);
        setBusy(false);
        onDone(next.workingSet);
        return;
      }
      onDone(next.workingSet);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function switchNow() {
    if (!switching) return;
    setBusy(true);
    try {
      const res = await api<{ artifactId: string; fromArtifactId: string }>(`/api/v1/studio-sessions/${set.sessionId}/switch-format`, { method: "POST", json: { artifactType: switching.artifactType } });
      router.push(`/artifacts/${res.artifactId}/studio?from=${res.fromArtifactId}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`${chosen.length} ${chosen.length === 1 ? "source" : "sources"} selected`} description="What these could become together." art={KIT.mark.sparklePurple}>
        {switching ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              <span className="font-medium">{switching.title}</span> is a different kind of Creation. Wonder Creator can make it from the same ingredients — this one stays as it is, and the new one
              keeps a link back.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button className="w-full" loading={busy} onClick={switchNow}>
              Make the {switching.title.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Keep working here
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex -space-x-2" aria-hidden>
              {chosen.slice(0, 5).map((s) => (
                <SourceIcon key={s.id} s={s} size="size-9" ring />
              ))}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {!r ? (
              <p className="text-sm text-ink-muted" role="status">
                Looking at what these share…
              </p>
            ) : (
              <>
                {r.idea ? (
                  <p className="rounded-2xl bg-[linear-gradient(135deg,#f6efff_0%,#fff0f4_100%)] px-4 py-3 text-[15px] text-ink">
                    <Sparkles className="mr-1.5 inline size-4 text-accent" aria-hidden />
                    {r.idea}
                  </p>
                ) : (
                  <p className="text-[12.5px] text-ink-muted">
                    {r.live
                      ? "No single idea stood out; here are directions from what's on the table."
                      : error
                        ? "Meanwhile, these directions come from what the sources are."
                        : "CreativeMind isn't connected, so these directions come from what the sources are."}
                  </p>
                )}
                <ul role="radiogroup" aria-label="Directions" className="divide-y divide-border-soft rounded-2xl border border-border-soft">
                  {r.directions.map((d) => (
                    <li key={d.key}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pick === d.key}
                        onClick={() => setPick(d.key)}
                        className={cn("flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left", pick === d.key && "bg-accent-softer/70")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{d.title}</span>
                          <span className="block text-[12.5px] text-ink-muted">{d.hint}</span>
                        </span>
                        <span
                          aria-hidden
                          className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border", pick === d.key ? "border-accent bg-accent text-white" : "border-border")}
                        >
                          {pick === d.key ? <Check className="size-3" /> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm text-ink-muted">Something else…</span>
                    <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Say what you have in mind" className="h-9 min-w-0 flex-1 text-sm" maxLength={300} />
                  </li>
                </ul>
                <Button className="w-full" loading={busy} disabled={!direction && !other.trim() && !r.idea} onClick={useIdea}>
                  Use this idea <ArrowRight className="size-4" aria-hidden />
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// The Creation's own type isn't in the set; the Studio passes it through `outputMode`.
function currentType(set: WorkingSetView): string {
  return MODE_DEFAULT_TYPE[set.outputMode as keyof typeof MODE_DEFAULT_TYPE] ?? "story";
}

/* ---------------------------------------------------------------- Bring in */

const GROUP_LABEL: Record<SourceType, string> = {
  material: "Materials",
  creation: "Creations",
  collection: "Collections",
  comment: "Comments",
  huddle_moment: "Huddle moments",
  conversation: "Conversations",
  conversation_reply: "Replies",
  scrapbook_entry: "Scrapbook",
};
const KIND_CHIP: Record<string, keyof typeof KIT.iconChip> = {
  material: "image",
  creation: "book",
  capture: "camera",
  link: "link",
  collection: "layers",
  huddle_moment: "users",
  comment: "message",
  dejavu: "sparkles",
  community: "users",
  external: "image",
  browse: "search",
};

export function BringInSheet({
  open,
  onOpenChange,
  sessionId,
  onAdded,
  onExternal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string | null;
  onAdded: (next: WorkingSetView) => void;
  /** Royalty-free images: searched on the Working Table's External tab. */
  onExternal: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Bring in" description="All your sources in one place. No need to leave." art={KIT.painted.coralLeaves} wide>
        {open ? <BringInBody sessionId={sessionId} onAdded={onAdded} onExternal={onExternal} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** A Bring in filter: one kind of source, or all of Community (conversations, replies, Scrapbook). */
type Only = SourceType | "community";

function BringInBody({ sessionId, onAdded, onExternal }: { sessionId: string | null; onAdded: (next: WorkingSetView) => void; onExternal: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<Only | null>(null);
  const [dejavu, setDejavu] = useState(false);
  const [results, setResults] = useState<BringInResult[] | null>(null);
  const [picked, setPicked] = useState<Map<string, BringInResult>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const searching = !!q.trim() || !!only || dejavu;

  useEffect(() => {
    if (!sessionId || dejavu) return;
    const n = ++seq.current;
    const t = setTimeout(
      () => {
        api<{ results: BringInResult[] }>(`/api/v1/studio-sessions/${sessionId}/bring-in?q=${encodeURIComponent(q)}${only ? `&only=${only}` : ""}`)
          .then((r) => n === seq.current && setResults(r.results))
          .catch((e) => n === seq.current && setError(errorMessage(e)));
      },
      q ? 200 : 0,
    );
    return () => clearTimeout(t);
  }, [q, only, sessionId, dejavu]);

  const key = (r: BringInResult) => `${r.sourceType}:${r.sourceId}`;
  const toggle = (r: BringInResult) =>
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(key(r))) next.delete(key(r));
      else next.set(key(r), r);
      return next;
    });
  async function add(items: BringInResult[]) {
    if (!sessionId || !items.length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${sessionId}/sources`, {
        method: "POST",
        json: { items: items.map((p) => ({ type: p.sourceType, id: p.sourceId })) },
      });
      onAdded(r.workingSet);
      setPicked(new Map());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function tile(k: (typeof BRING_IN_KINDS)[number]["key"]) {
    if (k === "capture" || k === "link") router.push("/send");
    else if (k === "browse") router.push("/search");
    else if (k === "external") onExternal();
    else if (k === "dejavu") setDejavu(true);
    else setOnly(k);
  }
  const groups = results ? (Object.keys(GROUP_LABEL) as SourceType[]).map((t) => ({ type: t, list: results.filter((r) => r.sourceType === t) })).filter((g) => g.list.length) : [];
  const COMMUNITY: SourceType[] = ["conversation", "conversation_reply", "scrapbook_entry"];
  const chipOn = (k: SourceType | null) => (only === "community" ? k !== null && COMMUNITY.includes(k) : only === k);

  if (dejavu && sessionId)
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setDejavu(false)} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[13px] text-ink-muted hover:bg-black/5">
          <ArrowLeft className="size-4" aria-hidden /> Bring in
        </button>
        <DejaVuIntake sessionId={sessionId} onAdded={(next) => onAdded(next)} />
      </div>
    );
  const total = results?.length ?? 0;

  return (
    <>
      <div className="space-y-3 pb-14">
        <div className="flex items-center gap-1">
          {searching ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setOnly(null);
              }}
              aria-label="Back"
              className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          ) : null}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search what to bring in</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials, creations, people, web…" className="pl-9" />
          </label>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {!searching ? (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Kinds of source">
              {BRING_IN_KINDS.map((k) => (
                <li key={k.key}>
                  <button
                    type="button"
                    onClick={() => tile(k.key)}
                    className="flex min-h-[4.5rem] w-full items-center gap-2.5 rounded-2xl border border-border-soft bg-surface p-2.5 text-left hover:bg-accent-softer/50 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <KitArt art={KIT.iconChip[KIND_CHIP[k.key] ?? "type"]} sizes="2.5rem" className="size-10 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink">{k.label}</span>
                      <span className="block truncate text-[11.5px] text-ink-subtle">{k.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {results?.length ? (
              <section aria-label="Recent">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Recent</h3>
                  <button type="button" onClick={() => setOnly("material")} className="min-h-8 text-[12.5px] font-medium text-accent-ink hover:underline">
                    See all
                  </button>
                </div>
                <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
                  {results.slice(0, 5).map((r) => (
                    <li key={key(r)} className="flex min-h-12 items-center gap-2.5 py-1 pl-2 pr-1">
                      <SourceIcon s={{ ...r, available: true }} size="size-10" square />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{r.title}</span>
                        <span className="block truncate text-[12px] text-ink-subtle">{r.inSet ? `${r.kind} · on the table` : r.kind}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Add ${r.title}`}
                        disabled={r.inSet || busy}
                        onClick={() => add([r])}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-accent-softer disabled:opacity-40"
                      >
                        {r.inSet ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="Kind" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
              {[{ key: null, label: "All", n: total }, ...groups.map((g) => ({ key: g.type, label: GROUP_LABEL[g.type], n: g.list.length }))].map((c) => (
                <button key={c.key ?? "all"} type="button" role="radio" aria-checked={chipOn(c.key)} onClick={() => setOnly(c.key)} className="inline-flex min-h-11 shrink-0 items-center">
                  <span
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]",
                      chipOn(c.key) ? "bg-accent-soft font-medium text-accent-ink" : "bg-surface-muted text-ink-muted",
                    )}
                  >
                    {c.label} <span className="text-[11px] opacity-70">({c.n})</span>
                  </span>
                </button>
              ))}
            </div>
            {!results ? <p className="text-sm text-ink-muted">Looking…</p> : null}
            {results && !results.length ? <p className="text-sm text-ink-muted">{q ? "Nothing matches that yet." : "Nothing of this kind yet."}</p> : null}
            {groups.map((g) => (
              <section key={g.type} aria-label={GROUP_LABEL[g.type]}>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{GROUP_LABEL[g.type]}</h3>
                <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
                  {g.list.map((r) => {
                    const on = picked.has(key(r));
                    return (
                      <li key={key(r)} className="flex min-h-12 items-center gap-1 py-1 pl-1 pr-1">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={r.inSet || on}
                          disabled={r.inSet}
                          onClick={() => toggle(r)}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
                              r.inSet || on ? "border-accent bg-accent text-white" : "border-border bg-surface",
                            )}
                          >
                            {r.inSet || on ? <Check className="size-3.5" /> : null}
                          </span>
                          <SourceIcon s={{ ...r, available: true }} size="size-10" square />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{r.title}</span>
                            <span className="block truncate text-[12px] text-ink-subtle">{r.inSet ? `${r.kind} · on the table` : r.kind}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Add ${r.title}`}
                          disabled={r.inSet || busy}
                          onClick={() => add([r])}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-accent-softer disabled:opacity-40"
                        >
                          <Plus className="size-4" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
      {picked.size ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border-soft bg-surface px-5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:absolute sm:rounded-b-3xl">
          <span className="text-sm text-ink">{picked.size} selected</span>
          <Button loading={busy} onClick={() => add([...picked.values()])}>
            Add to Studio
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- Fragments */

export function FragmentsSheet({ sessionId, row, onClose, onAdded }: { sessionId: string; row: WorkingSource; onClose: () => void; onAdded: (next: WorkingSetView) => void }) {
  const [d, setD] = useState<{ text: string | null; durationSeconds: number | null; mediaType: string | null; audioUrl: string | null; suggested: Array<Fragment & { text: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:30");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let live = true;
    api<typeof d>(`/api/v1/studio-sessions/${sessionId}/sources/${row.id}/detail`)
      .then((x) => live && setD(x))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [sessionId, row.id]);
  const parse = (v: string) => {
    const m = /^(\d{1,3}):(\d{2})$/.exec(v.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : Number.isFinite(Number(v)) ? Number(v) : NaN;
  };
  async function add(fragment: Fragment, k: string) {
    setBusy(k);
    setError(null);
    try {
      const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${sessionId}/sources`, {
        method: "POST",
        json: { items: [{ type: row.sourceType, id: row.sourceId, fragment }], state: "in_use" },
      });
      setAdded((a) => new Set(a).add(k));
      onAdded(r.workingSet);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const playable = d?.mediaType === "voice" || d?.mediaType === "audio" || d?.mediaType === "video";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={row.title} description={`${row.kind}${d?.durationSeconds ? ` · ${mmss(d.durationSeconds)}` : ""} — use a part of it`} art={KIT.mark.sparklePeach}>
        {error ? (
          <p role="alert" className="mb-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {!d ? (
          <p className="text-sm text-ink-muted">Opening…</p>
        ) : (
          <div className="space-y-4">
            {playable ? (
              <section aria-label="A moment" className="space-y-2">
                {d.audioUrl ? (
                  <audio controls src={d.audioUrl} className="w-full" />
                ) : (
                  <p className="text-[12.5px] text-ink-muted">This one can&rsquo;t be played here, but you can still mark a moment by time.</p>
                )}
                <div className="flex items-end gap-2">
                  <label className="text-[12px] text-ink-muted">
                    From
                    <Input value={start} onChange={(e) => setStart(e.target.value)} className="mt-0.5 h-10 w-20 text-center tabular-nums" inputMode="numeric" aria-label="Start (mm:ss)" />
                  </label>
                  <label className="text-[12px] text-ink-muted">
                    To
                    <Input value={end} onChange={(e) => setEnd(e.target.value)} className="mt-0.5 h-10 w-20 text-center tabular-nums" inputMode="numeric" aria-label="End (mm:ss)" />
                  </label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What's in it (optional)" className="h-10 min-w-0 flex-1" maxLength={80} />
                </div>
                <Button
                  size="sm"
                  loading={busy === "range"}
                  disabled={!(parse(end) > parse(start))}
                  onClick={() => add({ kind: d.mediaType === "video" ? "video_range" : "audio_range", start: parse(start), end: parse(end), label: label.trim() || undefined }, "range")}
                >
                  <Plus className="size-4" aria-hidden /> Add moment
                </Button>
              </section>
            ) : null}
            {d.suggested.length ? (
              <section aria-label="Suggested fragments" className="space-y-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Suggested fragments</h3>
                <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
                  {d.suggested.map((f, i) => {
                    const k = `s${i}`;
                    return (
                      <li key={k} className="flex min-h-12 items-center gap-2 py-1 pl-3 pr-1">
                        <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">“{f.text}”</span>
                        <button
                          type="button"
                          aria-label={`Add “${f.text.slice(0, 40)}”`}
                          disabled={added.has(k) || !!busy}
                          onClick={() => add(f, k)}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-accent-softer disabled:opacity-40"
                        >
                          {added.has(k) ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {d.text ? (
              <section aria-label="Choose a passage" className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Or select a passage</h3>
                <textarea
                  ref={textRef}
                  readOnly
                  value={d.text}
                  className="block max-h-48 w-full resize-none rounded-2xl border border-border-soft bg-surface-muted px-3 py-2 text-[13.5px] leading-relaxed text-ink"
                  rows={6}
                  aria-label="Source text"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "sel"}
                  onClick={() => {
                    const el = textRef.current;
                    if (!el) return;
                    const text = el.value.slice(el.selectionStart, el.selectionEnd).trim();
                    if (!text) {
                      setError("Select some of the text first.");
                      return;
                    }
                    void add({ kind: "text_range", start: el.selectionStart, end: el.selectionEnd, text: text.slice(0, 1000) }, "sel");
                  }}
                >
                  <Scissors className="size-4" aria-hidden /> Add selection
                </Button>
              </section>
            ) : !playable ? (
              <p className="text-sm text-ink-muted">There&rsquo;s no text or recording to take a part from — this one is used whole.</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Change format */

export function ChangeFormatSheet({
  open,
  onOpenChange,
  sessionId,
  currentType: cur,
  aiLive,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string | null;
  currentType: string;
  aiLive: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Make a new Creation" description="This one stays exactly as it is. A separate new Creation is made from the same ingredients, with a link back." art={KIT.mark.sun}>
        {open ? <ChangeFormatBody sessionId={sessionId} currentType={cur} aiLive={aiLive} /> : null}
      </DialogContent>
    </Dialog>
  );
}

// Never changes this Creation (owner, 29 Sep 2026: "should create a new creation completely, not destroy the existing
// one"): the switch makes a new, derived Creation, and its Studio says where it came from.
function ChangeFormatBody({ sessionId, currentType: cur, aiLive }: { sessionId: string | null; currentType: string; aiLive: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<(typeof OUTPUT_MODES)[number]["key"] | "auto" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = outputModeOf(cur);
  async function go() {
    if (!sessionId || !pick) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ artifactId: string; fromArtifactId: string }>(`/api/v1/studio-sessions/${sessionId}/switch-format`, {
        method: "POST",
        json: pick === "auto" ? { instruction: "Choose the format that suits these ingredients best." } : { mode: pick },
      });
      router.push(`/artifacts/${res.artifactId}/studio?from=${res.fromArtifactId}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  const label = pick && pick !== "auto" ? OUTPUT_MODES.find((m) => m.key === pick)?.label : null;
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format">
        {OUTPUT_MODES.map((m) => {
          const isCurrent = m.key === current;
          const on = pick === m.key;
          return (
            <li key={m.key}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                disabled={isCurrent}
                onClick={() => setPick(m.key)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left",
                  on ? "border-accent bg-accent-softer" : "border-border-soft bg-surface",
                  isCurrent && "opacity-60",
                )}
              >
                <KitArt art={KIT.iconChip[MODE_CHIP[m.key]]} sizes="2.25rem" className="size-9 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-ink">
                    {m.label}
                    {isCurrent ? <span className="ml-1 text-[11px] font-normal text-ink-subtle">· current</span> : null}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-subtle">{m.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {aiLive ? (
        <button
          type="button"
          role="radio"
          aria-checked={pick === "auto"}
          onClick={() => setPick("auto")}
          className={cn("flex min-h-12 w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left", pick === "auto" ? "border-accent bg-accent-softer" : "border-border-soft bg-surface")}
        >
          <KitArt art={KIT.iconChip.sparkles} sizes="2.25rem" className="size-9 shrink-0" />
          <span>
            <span className="block text-[13.5px] font-medium text-ink">Let CreativeMind decide</span>
            <span className="block text-[11.5px] text-ink-subtle">Suggest the best format</span>
          </span>
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pick ? (
        <Button className="w-full" loading={busy} onClick={go}>
          {pick === "auto" ? "Create a new Creation" : `Create a new ${label?.toLowerCase()}`} <ArrowRight className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
const MODE_CHIP: Record<(typeof OUTPUT_MODES)[number]["key"], keyof typeof KIT.iconChip> = {
  writing: "type",
  carousel: "layers",
  image: "image",
  video: "video",
  audio: "waveform",
  presentation: "file",
};

/* ---------------------------------------------------------------- Icons */

const CHIP: Record<string, keyof typeof KIT.iconChip> = {
  image: "image",
  sketch: "pencil",
  video: "video",
  voice: "mic",
  audio: "waveform",
  pdf: "file",
  document: "file",
  research: "file",
  url: "link",
  reference: "link",
  collection: "layers",
  conversation: "message",
  comment: "message",
  huddle: "users",
};

export function SourceIcon({
  s,
  size,
  ring,
  square,
}: {
  s: { sourceType: string; mediaType: string | null; thumbnailUrl: string | null; available: boolean };
  size: string;
  ring?: boolean;
  square?: boolean;
}) {
  const cls = cn("shrink-0 bg-surface object-cover", size, square ? "rounded-xl" : "rounded-full", ring && "ring-2 ring-surface");
  if (s.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s.thumbnailUrl} alt="" className={cls} />;
  }
  const chip = !s.available ? "search" : s.sourceType === "creation" ? "book" : (CHIP[s.mediaType ?? ""] ?? "type");
  return <KitArt art={KIT.iconChip[chip]} sizes="2.75rem" className={cn(cls, !s.available && "opacity-40 grayscale")} />;
}
