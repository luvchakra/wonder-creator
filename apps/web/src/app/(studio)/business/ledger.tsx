"use client";
import { BUSINESS_KINDS, STATUS_LABEL, formatMoney, kindLabel, summarize, type BusinessRecord } from "@wonder/creator-studio/business";
import { Badge, Button, Dialog, DialogContent, EmptyState, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, Select, Switch, Textarea, chipBase, cn } from "@wonder/ui";
import { Check, MoreHorizontal, Plus, RotateCcw, StickyNote, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Row = BusinessRecord & { artifactTitle: string | null };
type Filter = "all" | "in" | "out" | "expected";

/**
 * The creator's business ledger (P1-19): totals per currency (never combined across currencies), then compact rows.
 * Records from licenses carry the source's amount; the creator marks them received and adds notes. Their own entries
 * (brand income, costs, payouts) can be added and deleted. Nothing here moves money.
 */
export function Ledger({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [noteFor, setNoteFor] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totals = useMemo(() => summarize(rows), [rows]);
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "expected" ? r.status === "expected" : r.direction === filter));

  async function patch(r: Row, body: { status?: string; note?: string | null }) {
    setError(null);
    try {
      const res = await api<{ record?: BusinessRecord }>(`/api/v1/business/records/${r.id}`, { method: "PATCH", json: body });
      setRows((all) => all.map((x) => (x.id === r.id ? { ...x, ...(res.record ?? {}), ...(body.note !== undefined ? { note: body.note } : {}) } : x)));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function remove(r: Row) {
    setError(null);
    try {
      await api(`/api/v1/business/records/${r.id}`, { method: "DELETE" });
      setRows((all) => all.filter((x) => x.id !== r.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-tight text-ink sm:text-[26px]">Business</h1>
          <p className="text-[13px] text-ink-muted">What your work has earned and cost. Recorded here — Wonder Creator doesn&apos;t move money.</p>
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Add record
        </Button>
      </header>

      {totals.length ? (
        <section aria-label="Totals" className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
          {totals.map((t) => (
            <div key={t.currency} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-3 py-2.5 text-[13px]">
              <span className="w-10 font-semibold text-ink">{t.currency}</span>
              {/* Only the amounts there are; zero totals are noise. */}
              {t.received ? (
                <span className="text-ink">
                  Received <strong className="font-semibold">{formatMoney(t.received, t.currency)}</strong>
                </span>
              ) : null}
              {t.expected ? <span className="text-ink-muted">Expected {formatMoney(t.expected, t.currency)}</span> : null}
              {t.paidOut ? <span className="text-ink-muted">Paid out {formatMoney(t.paidOut, t.currency)}</span> : null}
              {t.owed ? <span className="text-ink-muted">To pay {formatMoney(t.owed, t.currency)}</span> : null}
            </div>
          ))}
        </section>
      ) : null}

      {rows.length ? (
        <>
          <div role="radiogroup" aria-label="Show" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {(
              [
                ["all", "All"],
                ["in", "Income"],
                ["out", "Costs & payouts"],
                ["expected", "Expected"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cn(chipBase, filter === k ? "bg-navy text-white" : "bg-surface-muted text-ink-muted hover:text-ink")}>
                {label}
              </button>
            ))}
          </div>
          <ul aria-label="Records" className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {shown.map((r) => (
              <li key={r.id} className="flex min-h-[52px] items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {kindLabel(r.kind)}
                    {r.counterparty ? <span className="font-normal text-ink-muted"> · {r.counterparty}</span> : null}
                  </span>
                  <span className="block truncate text-xs text-ink-subtle">
                    {r.occurred_on}
                    {r.artifact_id && r.artifactTitle ? (
                      <>
                        {" · "}
                        <Link href={`/artifacts/${r.artifact_id}`} className="relative z-10 hover:underline">
                          {r.artifactTitle}
                        </Link>
                      </>
                    ) : null}
                    {r.source_type === "license" ? " · from a license" : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className={cn("block text-sm font-semibold tabular-nums", r.status === "cancelled" ? "text-ink-subtle line-through" : r.direction === "in" ? "text-ink" : "text-ink-muted")}>
                    {r.direction === "out" ? "−" : ""}
                    {formatMoney(Number(r.amount), r.currency)}
                  </span>
                  <Badge tone={r.status === "received" || r.status === "paid" ? "success" : r.status === "cancelled" ? "neutral" : "accent"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </span>
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label={`More for ${kindLabel(r.kind)} ${formatMoney(Number(r.amount), r.currency)}`}>
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {r.status === "expected" ? (
                      <MenuItem onSelect={() => patch(r, { status: r.direction === "in" ? "received" : "paid" })}>
                        <Check className="size-4" aria-hidden /> {r.direction === "in" ? "Mark received" : "Mark paid"}
                      </MenuItem>
                    ) : (
                      <MenuItem onSelect={() => patch(r, { status: "expected" })}>
                        <RotateCcw className="size-4" aria-hidden /> Mark as expected
                      </MenuItem>
                    )}
                    <MenuItem onSelect={() => setNoteFor(r)}>
                      <StickyNote className="size-4" aria-hidden /> {r.note ? "Edit note" : "Add note"}
                    </MenuItem>
                    {r.status !== "cancelled" && r.source_type !== "manual" ? (
                      <MenuItem onSelect={() => patch(r, { status: "cancelled" })}>
                        <X className="size-4" aria-hidden /> Cancel
                      </MenuItem>
                    ) : null}
                    {r.source_type === "manual" ? (
                      <MenuItem destructive onSelect={() => remove(r)}>
                        <Trash2 className="size-4" aria-hidden /> Delete
                      </MenuItem>
                    ) : null}
                  </MenuContent>
                </Menu>
              </li>
            ))}
            {!shown.length ? <li className="px-3 py-4 text-sm text-ink-muted">Nothing here for this filter.</li> : null}
          </ul>
        </>
      ) : (
        <EmptyState title="No records yet" body="Paid licenses appear here when they become active. Add brand income, costs or payouts yourself." action={<Button size="sm" onClick={() => setAdding(true)}>Add record</Button>} />
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {adding ? <AddRecord onClose={() => setAdding(false)} onAdded={(r) => setRows((all) => [{ ...r, artifactTitle: null }, ...all])} lastCurrency={rows[0]?.currency ?? "INR"} /> : null}
      {noteFor ? <NoteDialog row={noteFor} onClose={() => setNoteFor(null)} onSave={(note) => patch(noteFor, { note })} /> : null}
    </div>
  );
}

function AddRecord({ onClose, onAdded, lastCurrency }: { onClose: () => void; onAdded: (r: BusinessRecord) => void; lastCurrency: string }) {
  const [kind, setKind] = useState<string>("brand_income");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(lastCurrency);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState("");
  const [settled, setSettled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const income = BUSINESS_KINDS.find((k) => k.value === kind)?.direction === "in";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add a record">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await api<{ record: BusinessRecord }>("/api/v1/business/records", { method: "POST", json: { kind, amount, currency, occurredOn: date, counterparty, description, settled } });
              onAdded(r.record);
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="What is it?" htmlFor="biz-kind">
            <Select id="biz-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {BUSINESS_KINDS.filter((k) => k.value !== "license_income").map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <Field label="Amount" htmlFor="biz-amount">
              <Input id="biz-amount" type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Currency" htmlFor="biz-currency">
              <Input id="biz-currency" required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" htmlFor="biz-date">
              <Input id="biz-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={income ? "From (optional)" : "To (optional)"} htmlFor="biz-party">
              <Input id="biz-party" maxLength={120} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="biz-desc">
            <Input id="biz-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm text-ink">{income ? "Already received" : "Already paid"}</span>
            <Switch checked={settled} onCheckedChange={setSettled} label={income ? "Already received" : "Already paid"} />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={busy}>
              Add record
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ row, onClose, onSave }: { row: Row; onClose: () => void; onSave: (note: string | null) => Promise<void> }) {
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Note">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onSave(note.trim() || null);
            setBusy(false);
            onClose();
          }}
        >
          <Field label={`${kindLabel(row.kind)} · ${formatMoney(Number(row.amount), row.currency)}`} htmlFor="biz-note">
            <Textarea id="biz-note" rows={3} className="min-h-0" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. invoice #104, paid to savings" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={busy}>
              Save note
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
