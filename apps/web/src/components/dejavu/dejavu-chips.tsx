"use client";
import { normalizeDejaVuName, type DejaVu } from "@wonder/creator-moments/shared";
import { Dialog, DialogContent, KIT, cn } from "@wonder/ui";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { useFeature } from "@/components/features";

/**
 * DejaVu chips (docs/moments-dejavu.md §10): the recurring threads this Material or Creation carries. Up to three
 * show; the rest fold into "+N". A chip opens its DejaVu; "+ DejaVu" opens the Add sheet.
 */
export function DejaVuChips({
  entityType,
  entityId,
  initial,
  className,
}: {
  entityType: "material" | "creation" | "conversation" | "scrapbook_entry";
  entityId: string;
  initial: { momentId: string | null; dejavus: DejaVu[] };
  className?: string;
}) {
  const on = useFeature("dejavu_enabled");
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const shown = all ? state.dejavus : state.dejavus.slice(0, 3);
  const more = state.dejavus.length - shown.length;
  if (!on) return null;
  return (
    <div role="group" aria-label="DejaVus" className={cn("flex flex-wrap items-center gap-x-1.5", className)}>
      {shown.map((d) => (
        <Link key={d.id} href={`/dejavu/${d.id}`} className="inline-flex min-h-11 items-center">
          <span className="inline-flex h-7 items-center rounded-full bg-accent-softer px-2.5 text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft">{d.name}</span>
        </Link>
      ))}
      {more > 0 ? (
        <button type="button" onClick={() => setAll(true)} aria-label={`Show ${more} more DejaVus`} className="inline-flex min-h-11 items-center">
          <span className="inline-flex h-7 items-center rounded-full bg-surface-muted px-2.5 text-[12.5px] font-medium text-ink-muted">+{more}</span>
        </button>
      ) : null}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Add a DejaVu" className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-accent/50 px-2.5 text-[12.5px] font-medium text-accent-ink hover:bg-accent-softer">
          <Plus className="size-3.5" aria-hidden /> DejaVu
        </span>
      </button>
      <AddDejaVuSheet open={open} onOpenChange={setOpen} entityType={entityType} entityId={entityId} momentId={state.momentId} attached={state.dejavus} onChanged={setState} />
    </div>
  );
}

/**
 * "Add a DejaVu" (§11): search existing first; typing something new offers `Create "…"`; CreativeMind's suggestions
 * are labelled as suggestions and only attach when tapped. Every change is immediate and immediately reversible (tap
 * again to take it off).
 */
export function AddDejaVuSheet({
  open,
  onOpenChange,
  entityType,
  entityId,
  momentId,
  attached,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: string;
  entityId: string;
  momentId: string | null;
  attached: DejaVu[];
  onChanged: (next: { momentId: string | null; dejavus: DejaVu[] }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a DejaVu" description="A recurring thread — a person, place, idea or feeling." art={KIT.painted.leafSprigSage}>
        {open ? <AddBody entityType={entityType} entityId={entityId} momentId={momentId} attached={attached} onChanged={onChanged} /> : null}
      </DialogContent>
    </Dialog>
  );
}

type Suggestion = { id: string; name: string; rationale: string | null };

function AddBody({
  entityType,
  entityId,
  momentId,
  attached,
  onChanged,
}: {
  entityType: string;
  entityId: string;
  momentId: string | null;
  attached: DejaVu[];
  onChanged: (next: { momentId: string | null; dejavus: DejaVu[] }) => void;
}) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<{ q: string; items: DejaVu[] } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const on = new Set(attached.map((d) => d.id));

  // Existing first: recent when empty, matches as you type (a short pause so each key isn't a request).
  useEffect(() => {
    let live = true;
    const term = q.trim();
    const t = setTimeout(
      () => {
        api<{ dejavus: DejaVu[] }>(`/api/v1/dejavus?limit=${term ? 12 : 8}&q=${encodeURIComponent(term)}`)
          .then((r) => live && setList({ q: term, items: r.dejavus }))
          .catch((e) => live && setError(errorMessage(e)));
      },
      term ? 180 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  useEffect(() => {
    if (!momentId) return;
    let live = true;
    api<{ suggestions: Suggestion[] }>(`/api/v1/moments/${momentId}/dejavu-suggestions`)
      .then((r) => live && setSuggestions(r.suggestions))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [momentId]);

  async function toggle(d: DejaVu) {
    setBusy(d.id);
    setError(null);
    try {
      if (on.has(d.id) && momentId) {
        await api(`/api/v1/dejavus/${d.id}/moments/${momentId}`, { method: "DELETE" });
        onChanged({ momentId, dejavus: attached.filter((x) => x.id !== d.id) });
        setNote(`Taken off “${d.name}”.`);
      } else {
        const r = await api<{ momentId: string }>(`/api/v1/dejavus/${d.id}/moments`, { method: "POST", json: { entityType, entityId } });
        onChanged({ momentId: r.momentId, dejavus: [...attached, d] });
        setNote(`Added to “${d.name}”.`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function create(name: string) {
    setBusy("create");
    setError(null);
    try {
      const r = await api<{ dejavu: DejaVu; existed: boolean; momentId: string }>("/api/v1/dejavus", { method: "POST", json: { name, attach: { entityType, entityId } } });
      onChanged({ momentId: r.momentId, dejavus: on.has(r.dejavu.id) ? attached : [...attached, r.dejavu] });
      setNote(r.existed ? `Added to “${r.dejavu.name}”.` : `Started “${r.dejavu.name}” and added this.`);
      setQ("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function resolve(s: Suggestion, accept: boolean) {
    if (!momentId) return;
    setBusy(s.id);
    setError(null);
    try {
      if (accept) {
        const r = await api<{ dejavu: DejaVu }>(`/api/v1/moments/${momentId}/dejavu-suggestions/${s.id}/accept`, { method: "POST" });
        onChanged({ momentId, dejavus: on.has(r.dejavu.id) ? attached : [...attached, r.dejavu] });
        setNote(`Added to “${r.dejavu.name}”.`);
      } else await api(`/api/v1/moments/${momentId}/dejavu-suggestions/${s.id}/dismiss`, { method: "POST" });
      setSuggestions((all) => all.filter((x) => x.id !== s.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const term = q.trim();
  const items = list && list.q === term ? list.items : null;
  const exact = !!term && (items ?? []).some((d) => normalizeDejaVuName(d.name) === normalizeDejaVuName(term));
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (term && !exact) void create(term);
        }}
        className="flex items-center gap-2 rounded-full border border-border-soft bg-surface px-3 focus-within:border-accent"
      >
        <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <label htmlFor="dejavu-q" className="sr-only">
          Search or type a DejaVu
        </label>
        <input id="dejavu-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} autoComplete="off" placeholder="Search or type…" className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none" />
      </form>

      <section aria-labelledby="dejavu-list-h" className="space-y-1">
        <h3 id="dejavu-list-h" className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          {term ? "Matching" : "Recent"}
        </h3>
        {term && !exact && items ? (
          <button type="button" onClick={() => create(term)} disabled={!!busy} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[14px] font-medium text-accent-ink hover:bg-accent-softer disabled:opacity-60">
            <Plus className="size-4 shrink-0" aria-hidden />
            Create “{term.replace(/\s+/g, " ")}”
          </button>
        ) : null}
        {items === null ? (
          <p className="px-1 py-2 text-[13px] text-ink-subtle">Loading…</p>
        ) : items.length ? (
          <ul className="divide-y divide-border-soft" aria-label={term ? "Matching DejaVus" : "Recent DejaVus"}>
            {items.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={on.has(d.id)}
                  disabled={!!busy}
                  onClick={() => toggle(d)}
                  className="flex min-h-11 w-full items-center gap-2.5 px-2 text-left text-[14px] text-ink hover:bg-surface-muted disabled:opacity-60"
                >
                  <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border", on.has(d.id) ? "border-accent bg-accent text-white" : "border-border-strong")}>
                    {on.has(d.id) ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : !term ? (
          <p className="px-1 py-2 text-[13px] text-ink-muted">No DejaVus yet. Type a name to start one.</p>
        ) : null}
      </section>

      {suggestions.length && !term ? (
        <section aria-labelledby="dejavu-suggested-h" className="space-y-1">
          <h3 id="dejavu-suggested-h" className="flex items-center gap-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            <Sparkles className="size-3.5 text-accent" aria-hidden /> Suggested by CreativeMind
          </h3>
          <ul className="divide-y divide-border-soft" aria-label="Suggested DejaVus">
            {suggestions.map((s) => (
              <li key={s.id} className="flex items-center gap-1">
                <button type="button" disabled={!!busy} onClick={() => resolve(s, true)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2 text-left text-[14px] text-ink hover:bg-surface-muted disabled:opacity-60">
                  <Plus className="size-4 shrink-0 text-accent-ink" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.name}</span>
                    {s.rationale ? <span className="block truncate text-[12px] text-ink-subtle">{s.rationale}</span> : null}
                  </span>
                </button>
                <button type="button" disabled={!!busy} onClick={() => resolve(s, false)} aria-label={`Not “${s.name}”`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5">
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p role="status" className="min-h-5 px-1 text-[13px] text-ink-muted">
        {note}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Link href="/dejavu" className="inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-accent-ink hover:underline">
        All DejaVus
      </Link>
    </div>
  );
}
