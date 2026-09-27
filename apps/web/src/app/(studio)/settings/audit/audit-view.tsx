"use client";
import { Badge, Button, Dialog, DialogContent, EmptyState, Field, Input, buttonClasses, cn } from "@wonder/ui";
import { Download, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import type { AuditEntry } from "@/lib/audit";
import { api, errorMessage } from "@/lib/client";

type Category = { key: string; label: string };
type Page = { entries: AuditEntry[]; nextBefore: string | null };
type Filters = { category: string; from: string; to: string };

const OUTCOME: Record<AuditEntry["outcome"], { label: string; tone: "success" | "danger" | "neutral" }> = {
  done: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  declined: { label: "Declined or ended", tone: "neutral" },
};

function query(f: Filters, before?: string | null): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (before) p.set("before", before);
  return p.toString();
}

export function AuditView(props: {
  categories: Category[];
  initial: Page;
  summary: { lastSignIn: { at: string; device: string | null } | null; failedChecks: number; liveShares: number; published: number };
}) {
  const [filters, setFilters] = useState<Filters>({ category: "", from: "", to: "" });
  const [entries, setEntries] = useState(props.initial.entries);
  const [nextBefore, setNextBefore] = useState(props.initial.nextBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const label = new Map(props.categories.map((c) => [c.key, c.label]));
  const s = props.summary;

  async function apply(f: Filters, more = false) {
    setBusy(true);
    setError(null);
    try {
      const page = await api<Page>(`/api/v1/audit?${query(f, more ? nextBefore : null)}`);
      setEntries((e) => (more ? [...e, ...page.entries] : page.entries));
      setNextBefore(page.nextBefore);
      setFilters(f);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const active = [filters.category && label.get(filters.category), filters.from && `from ${filters.from}`, filters.to && `to ${filters.to}`].filter(Boolean).join(", ");

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Summary">
        <SummaryCard title="Last sign-in" value={s.lastSignIn ? <RelativeTime iso={s.lastSignIn.at} /> : "Not recorded yet"} note={s.lastSignIn?.device ?? undefined} />
        <SummaryCard title="Password checks that failed" value={String(s.failedChecks)} note={s.failedChecks ? "Recent password confirmations that didn't match. If this wasn't you, change your password." : "None recently."} warn={s.failedChecks > 0} />
        <SummaryCard title="Live shares" value={String(s.liveShares)} note="Private links and creators who can open your Creations." />
        <SummaryCard title="Publications" value={String(s.published)} note="Confirmed by their destination." />
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Activity</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSheet(true)} aria-haspopup="dialog">
            <SlidersHorizontal className="size-4" aria-hidden /> Filter{active ? " (on)" : ""}
          </Button>
          <a href={`/api/v1/audit/export?${query(filters)}`} className={buttonClasses({ variant: "ghost" })}>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        </div>
      </div>
      {active ? (
        <p className="mt-2 text-sm text-ink-muted" role="status">
          Showing {active}.{" "}
          <button type="button" className="min-h-11 font-medium text-accent-ink hover:underline" onClick={() => apply({ category: "", from: "", to: "" })}>
            Clear filters
          </button>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {entries.length ? (
        <ol className="mt-4 space-y-2" aria-label="Activity" aria-busy={busy}>
          {entries.map((e) => (
            <li key={e.id} className="rounded-2xl border border-border-soft bg-surface">
              <details>
                <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">{e.title}</p>
                    <p className="text-sm text-ink-muted">
                      {e.actor} · {label.get(e.category)} · <RelativeTime iso={e.at} />
                    </p>
                    {e.entity ? <p className="truncate text-sm text-ink-muted">{e.entity.label}</p> : null}
                  </div>
                  <Badge tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</Badge>
                </summary>
                <dl className="space-y-1 border-t border-border-soft px-4 py-3 text-sm">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-ink-muted">When</dt>
                    <dd className="text-ink">
                      <time dateTime={e.at}>{new Date(e.at).toUTCString()}</time>
                    </dd>
                  </div>
                  {e.details.map((d) => (
                    <div key={d.label} className="flex flex-wrap gap-x-2">
                      <dt className="text-ink-muted">{d.label}</dt>
                      <dd className="break-all text-ink">{d.value}</dd>
                    </div>
                  ))}
                  {e.entity?.href ? (
                    <Link href={e.entity.href} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
                      Open {e.entity.label.startsWith("The request") ? "the request" : e.entity.label.startsWith("Creation:") ? "Creation" : e.entity.label.split(":")[0].toLowerCase()}
                    </Link>
                  ) : null}
                </dl>
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState className="mt-4" title="Nothing here" body={active ? "No activity matches these filters." : "Activity on your account will show here."} />
      )}
      {nextBefore ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" loading={busy} onClick={() => apply(filters, true)}>
            Show older
          </Button>
        </div>
      ) : null}

      <FilterSheet open={sheet} onOpenChange={setSheet} categories={props.categories} value={filters} onApply={(f) => (setSheet(false), apply(f))} />
    </div>
  );
}

function SummaryCard({ title, value, note, warn }: { title: string; value: React.ReactNode; note?: string; warn?: boolean }) {
  return (
    <li className={cn("rounded-2xl border p-4", warn ? "border-warning bg-warning-soft" : "border-border-soft bg-surface")}>
      <p className="text-sm text-ink-muted">{title}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
      {note ? <p className="mt-1 text-sm text-ink-muted">{note}</p> : null}
    </li>
  );
}

function FilterSheet({ open, onOpenChange, categories, value, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; categories: Category[]; value: Filters; onApply: (f: Filters) => void }) {
  const [f, setF] = useState(value);
  return (
    <Dialog open={open} onOpenChange={(o) => (o && setF(value), onOpenChange(o))}>
      <DialogContent title="Filter activity">
        <fieldset>
          <legend className="text-sm font-medium text-ink">Category</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ key: "", label: "Everything" }, ...categories].map((c) => (
              <label key={c.key || "all"} className={cn("inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm", f.category === c.key ? "border-accent bg-accent-softer font-medium text-accent-ink" : "border-border-soft text-ink")}>
                <input type="radio" name="audit-category" className="sr-only" checked={f.category === c.key} onChange={() => setF({ ...f, category: c.key })} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="audit-from">
            <Input id="audit-from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="To" htmlFor="audit-to">
            <Input id="audit-to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setF({ category: "", from: "", to: "" })}>
            Reset
          </Button>
          <Button onClick={() => onApply(f)}>Show results</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
