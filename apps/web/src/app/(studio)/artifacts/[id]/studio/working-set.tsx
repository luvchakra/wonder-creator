"use client";
import { ROLE_LABEL, STATE_LABEL, groupSources, workingSetSummary, type BringInResult, type SourceState, type WorkingSetView, type WorkingSource } from "@wonder/creator-studio/working-set";
import { Button, Dialog, DialogContent, Input, KIT, KitArt, Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@wonder/ui";
import { ArrowLeft, Check, MoreHorizontal, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";

/**
 * The CreativeStudio Working Set (docs/ui-redesign/creative-studio-working-set.md, phase A): everything brought to the
 * table for this Creation. The canvas stays dominant; one compact "Sources N" pill opens the sheet, where rows are
 * Pinned / In use / Available and one "Bring in" searches Materials, Creations and Collections without leaving.
 * Routine changes save as they happen — no Save button, no versions.
 */
export function WorkingSet({ artifactId }: { artifactId: string }) {
  const [set, setSet] = useState<WorkingSetView | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"set" | "bring">("set");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api<{ workingSet: WorkingSetView }>("/api/v1/studio-sessions", { method: "POST", json: { artifactId } })
      .then((r) => live && setSet(r.workingSet))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [artifactId]);

  const change = useCallback(
    async (row: WorkingSource, body: { state?: SourceState } | "remove") => {
      if (!set) return;
      setError(null);
      // Optimistic: state changes are instant on the table.
      setSet((s) => (s ? { ...s, sources: body === "remove" ? s.sources.filter((x) => x.id !== row.id) : s.sources.map((x) => (x.id === row.id ? { ...x, ...body } : x)) } : s));
      try {
        const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${set.sessionId}/sources/${row.id}`, body === "remove" ? { method: "DELETE" } : { method: "PATCH", json: body });
        setSet(r.workingSet);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [set],
  );

  const sources = set?.sources ?? [];
  const inUse = sources.filter((s) => s.state !== "available").length;

  return (
    <>
      {/* The one compact affordance (§7): what's on the table, a tap away. */}
      <div className="pointer-events-none sticky bottom-3 z-20 flex">
        <button
          type="button"
          onClick={() => {
            setView("set");
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-label={`Working Set: ${workingSetSummary(sources)}${inUse ? `, ${inUse} in use` : ""}`}
          className="pointer-events-auto inline-flex min-h-11 items-center"
        >
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border-soft bg-surface/95 py-1 pl-1.5 pr-3.5 text-[13.5px] font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-surface">
            <span aria-hidden className="flex -space-x-2">
              {sources.length ? (
                sources.slice(0, 3).map((s) => <SourceIcon key={s.id} s={s} size="size-7" ring />)
              ) : (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent-softer">
                  <Plus className="size-4 text-accent" />
                </span>
              )}
            </span>
            {set ? (sources.length ? `Sources ${sources.length}` : "Bring in") : "Sources"}
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={view === "set" ? "Working Set" : "Bring in"} description={view === "set" ? "What's on the table for this Creation." : "Your Materials, Creations and Collections."} art={view === "set" ? KIT.painted.leafSprigSage : KIT.painted.coralLeaves}>
          {error ? (
            <p role="alert" className="mb-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {!set ? (
            <p className="text-sm text-ink-muted">Opening your Working Set…</p>
          ) : view === "set" ? (
            <SetView set={set} onChange={change} onBringIn={() => setView("bring")} />
          ) : (
            <BringIn
              sessionId={set.sessionId}
              onBack={() => setView("set")}
              onAdded={(next) => {
                setSet(next);
                setView("set");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SetView({ set, onChange, onBringIn }: { set: WorkingSetView; onChange: (row: WorkingSource, body: { state?: SourceState } | "remove") => void; onBringIn: () => void }) {
  const groups = groupSources(set.sources);
  if (!set.sources.length) {
    // Empty Working Set (§69): one short message, one action.
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <KitArt art={KIT.painted.coastalVignette} sizes="12rem" className="h-auto w-44 opacity-90" />
        <p className="font-display text-lg text-ink">Nothing here yet.</p>
        <p className="max-w-xs text-sm text-ink-muted">Bring in a photo, note, voice, Creation or reference.</p>
        <Button className="mt-1" onClick={onBringIn}>
          <Plus className="size-4" aria-hidden /> Bring in
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-ink-muted">Tap a source to use it or set it aside. Pinned sources are kept as they are.</p>
      {groups.map((g) => (
        <section key={g.state} aria-label={STATE_LABEL[g.state]}>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{STATE_LABEL[g.state]}</h3>
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
            {g.sources.map((s) => (
              <SourceRow key={s.id} s={s} onChange={onChange} />
            ))}
          </ul>
        </section>
      ))}
      <Button className="w-full" onClick={onBringIn}>
        <Plus className="size-4" aria-hidden /> Bring in
      </Button>
    </div>
  );
}

function SourceRow({ s, onChange }: { s: WorkingSource; onChange: (row: WorkingSource, body: { state?: SourceState } | "remove") => void }) {
  const router = useRouter();
  const on = s.state !== "available";
  return (
    <li className="flex min-h-12 items-center gap-2 py-1 pl-2 pr-1 motion-safe:animate-[fade-in_140ms_ease-out]">
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
          <SourceIcon s={s} size="size-9" />
          {on ? (
            <span className={cn("absolute -bottom-0.5 -right-0.5 inline-flex size-4 items-center justify-center rounded-full text-white ring-2 ring-surface", s.state === "pinned" ? "bg-orange" : "bg-accent")}>
              {s.state === "pinned" ? <Pin className="size-2.5" aria-hidden /> : <Check className="size-2.5" aria-hidden />}
            </span>
          ) : null}
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", s.available ? "text-ink" : "italic text-ink-subtle")}>{s.title}</span>
          <span className="block truncate text-[12px] text-ink-subtle">
            {s.available ? [s.kind, s.roles.map((r) => ROLE_LABEL[r]).join(" · ")].filter(Boolean).join(" — ") : "Kept on the table; nothing of it is shown."}
          </span>
        </span>
      </button>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`More for ${s.title}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </MenuTrigger>
        <MenuContent>
          {s.available ? (
            s.state === "pinned" ? (
              <MenuItem onSelect={() => onChange(s, { state: "in_use" })}>
                <PinOff className="size-4" aria-hidden /> Unpin
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => onChange(s, { state: "pinned" })}>
                <Pin className="size-4" aria-hidden /> Pin — keep it as it is
              </MenuItem>
            )
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

const GROUPS = [
  { type: "material", label: "Materials" },
  { type: "creation", label: "Creations" },
  { type: "collection", label: "Collections" },
] as const;

function BringIn({ sessionId, onBack, onAdded }: { sessionId: string; onBack: () => void; onAdded: (next: WorkingSetView) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BringInResult[] | null>(null);
  const [picked, setPicked] = useState<Map<string, BringInResult>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(
      () => {
        api<{ results: BringInResult[] }>(`/api/v1/studio-sessions/${sessionId}/bring-in?q=${encodeURIComponent(q)}`)
          .then((r) => n === seq.current && setResults(r.results))
          .catch((e) => n === seq.current && setError(errorMessage(e)));
      },
      q ? 200 : 0,
    );
    return () => clearTimeout(t);
  }, [q, sessionId]);

  const key = (r: BringInResult) => `${r.sourceType}:${r.sourceId}`;
  async function add() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${sessionId}/sources`, { method: "POST", json: { items: [...picked.values()].map((p) => ({ type: p.sourceType, id: p.sourceId })) } });
      onAdded(r.workingSet);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label="Back to the Working Set" className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search what to bring in</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Materials, Creations, Collections…" className="pl-9" autoFocus />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!results ? <p className="text-sm text-ink-muted">Looking…</p> : null}
      {results && !results.length ? <p className="text-sm text-ink-muted">{q ? "Nothing matches that yet." : "Bring something into your space first — a photo, a note, a voice memo."}</p> : null}
      {results
        ? GROUPS.map((g) => {
            const list = results.filter((r) => r.sourceType === g.type);
            if (!list.length) return null;
            return (
              <section key={g.type} aria-label={g.label}>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{g.label}</h3>
                <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft">
                  {list.map((r) => {
                    const on = picked.has(key(r));
                    return (
                      <li key={key(r)}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={r.inSet || on}
                          disabled={r.inSet}
                          onClick={() =>
                            setPicked((m) => {
                              const next = new Map(m);
                              if (next.has(key(r))) next.delete(key(r));
                              else next.set(key(r), r);
                              return next;
                            })
                          }
                          className="flex min-h-12 w-full items-center gap-2.5 px-2 py-1 text-left hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                        >
                          <SourceIcon s={{ ...r, available: true }} size="size-9" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{r.title}</span>
                            <span className="block truncate text-[12px] text-ink-subtle">{r.inSet ? `${r.kind} · already on the table` : r.kind}</span>
                          </span>
                          <span aria-hidden className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md border", r.inSet || on ? "border-accent bg-accent text-white" : "border-border")}>
                            {r.inSet || on ? <Check className="size-3.5" /> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        : null}
      <div className="sticky bottom-0 -mx-5 border-t border-border-soft bg-surface px-5 pt-3">
        <Button className="w-full" disabled={!picked.size} loading={busy} onClick={add}>
          {picked.size ? `Add to Studio (${picked.size})` : "Add to Studio"}
        </Button>
      </div>
    </div>
  );
}

// Brand icon chips (Vector Kit) for each kind of source; photos show themselves.
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
};

function SourceIcon({ s, size, ring }: { s: { sourceType: string; mediaType: string | null; thumbnailUrl: string | null; available: boolean }; size: string; ring?: boolean }) {
  const cls = cn("shrink-0 rounded-full bg-surface object-cover", size, ring && "ring-2 ring-surface");
  if (s.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s.thumbnailUrl} alt="" className={cls} />;
  }
  const chip = !s.available ? "search" : s.sourceType === "creation" ? "book" : (CHIP[s.mediaType ?? ""] ?? "type");
  return <KitArt art={KIT.iconChip[chip]} sizes="2.5rem" className={cn(cls, !s.available && "opacity-40 grayscale")} />;
}
