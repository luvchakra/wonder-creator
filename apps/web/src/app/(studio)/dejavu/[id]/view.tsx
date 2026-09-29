"use client";
import { MOMENT_FILTERS, MOMENT_FILTER_LABEL, momentHref, periodOf, type DejaVu, type MomentFilter } from "@wonder/creator-moments/shared";
import { Button, Dialog, DialogContent, EmptyState, Input, KIT, Menu, MenuContent, MenuItem, MenuTrigger, buttonClasses, cn } from "@wonder/ui";
import { Archive, FileText, Image as ImageIcon, Mic, MoreHorizontal, PenLine, SlidersHorizontal, Sparkles, Video, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";
import type { MomentView } from "@/lib/moments";

type Page = { items: MomentView[]; nextCursor: string | null };

const MATERIAL_LABEL: Record<string, string> = {
  image: "Photo", sketch: "Sketch", voice: "Voice note", audio: "Audio", video: "Video", note: "Note", text: "Note", idea: "Idea",
  inspiration: "Inspiration", research: "Research", conversation: "Conversation", document: "Document", pdf: "PDF", url: "Link", reference: "Reference",
};
const kindLabel = (m: MomentView) => (m.entityType === "creation" ? "Creation" : m.entityType === "material" ? (MATERIAL_LABEL[m.subtype ?? ""] ?? "Material") : "Moment");
const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
};
const titleOf = (m: MomentView) => m.title?.trim() || m.excerpt?.split("\n")[0]?.trim().slice(0, 80) || `Untitled ${kindLabel(m).toLowerCase()}`;

export function DejaVuView({
  dejavu,
  filter,
  range,
  initial,
}: {
  dejavu: DejaVu & { total: number; counts: Record<MomentFilter, number> };
  filter: MomentFilter | null;
  range: { from: string | null; to: string | null };
  initial: Page;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(dejavu.name);
  const [archived, setArchived] = useState(dejavu.archived);
  const [total, setTotal] = useState(dejavu.total);
  const [removed, setRemoved] = useState<MomentView | null>(null);
  const [sheet, setSheet] = useState<null | "filter" | "rename">(null);
  const [error, setError] = useState<string | null>(null);

  const present = MOMENT_FILTERS.filter((f) => dejavu.counts[f] > 0);
  const query = (next: { filter?: MomentFilter | null; from?: string | null; to?: string | null }) => {
    const p = new URLSearchParams();
    const f = next.filter !== undefined ? next.filter : filter;
    const from = next.from !== undefined ? next.from : range.from;
    const to = next.to !== undefined ? next.to : range.to;
    if (f) p.set("filter", f);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const s = p.toString();
    return `/dejavu/${dejavu.id}${s ? `?${s}` : ""}`;
  };

  async function more() {
    if (!cursor) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ cursor });
      if (filter) p.set("filter", filter);
      if (range.from) p.set("from", range.from);
      if (range.to) p.set("to", range.to);
      const r = await api<Page>(`/api/v1/dejavus/${dejavu.id}/moments?${p}`);
      setItems((all) => [...all, ...r.items.filter((m) => !all.some((x) => x.id === m.id))]);
      setCursor(r.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function remove(m: MomentView) {
    setError(null);
    try {
      await api(`/api/v1/dejavus/${dejavu.id}/moments/${m.id}`, { method: "DELETE" });
      setItems((all) => all.filter((x) => x.id !== m.id));
      setTotal((t) => Math.max(0, t - 1));
      setRemoved(m);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function undo() {
    if (!removed) return;
    try {
      await api(`/api/v1/dejavus/${dejavu.id}/moments`, { method: "POST", json: { momentId: removed.id } });
      setItems((all) => [...all, removed].sort((a, b) => (a.occurredAt === b.occurredAt ? b.id.localeCompare(a.id) : b.occurredAt.localeCompare(a.occurredAt))));
      setTotal((t) => t + 1);
      setRemoved(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function setArchive(value: boolean) {
    setError(null);
    try {
      await api(`/api/v1/dejavus/${dejavu.id}`, { method: "PATCH", json: { archived: value } });
      setArchived(value);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // Newest first, under Today / Yesterday / month / year.
  const groups: Array<{ label: string; items: MomentView[] }> = [];
  for (const m of items) {
    const label = periodOf(m.occurredAt);
    const g = groups.at(-1);
    if (g?.label === label) g.items.push(m);
    else groups.push({ label, items: [m] });
  }
  const filtered = !!(filter || range.from || range.to);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-display text-[22px] leading-tight text-ink">{name}</h1>
          <p className="text-[13px] text-ink-muted">
            {total} {total === 1 ? "Moment" : "Moments"}
            {archived ? " · Archived" : ""}
          </p>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label={`More for ${name}`} className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setSheet("rename")}>
              <PenLine className="size-4" aria-hidden /> Rename
            </MenuItem>
            <MenuItem onSelect={() => void setArchive(!archived)}>
              <Archive className="size-4" aria-hidden /> {archived ? "Bring back" : "Archive"}
            </MenuItem>
            <MenuItem onSelect={() => router.push("/dejavu")}>
              <Sparkles className="size-4" aria-hidden /> All DejaVus
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      {archived ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-surface-muted px-3 py-1 text-[13px] text-ink-muted">
          <span className="flex-1">Archived — it&apos;s kept, just out of your lists.</span>
          <button type="button" onClick={() => setArchive(false)} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
            Bring back
          </button>
        </p>
      ) : null}

      {total > 0 || filtered ? (
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {present.length > 1 ? (
            <nav aria-label="Types" className="flex shrink-0 items-center gap-1.5">
              {[null, ...present].map((f) => (
                <Link key={f ?? "all"} href={query({ filter: f })} aria-current={filter === f ? "page" : undefined} className="inline-flex min-h-11 shrink-0 items-center">
                  <span className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium", filter === f ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>
                    {f ? MOMENT_FILTER_LABEL[f] : "All"}
                    {f ? <span className="text-[11.5px] opacity-70">{dejavu.counts[f]}</span> : null}
                  </span>
                </Link>
              ))}
            </nav>
          ) : null}
          <span className="flex-1" />
          {range.from || range.to ? (
            <Link href={query({ from: null, to: null })} aria-label="Clear dates" className="inline-flex min-h-11 shrink-0 items-center">
              <span className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-softer px-3 text-[12.5px] font-medium text-accent-ink">
                {range.from ? dateLabel(range.from) : "…"} – {range.to ? dateLabel(range.to) : "now"} <X className="size-3.5" aria-hidden />
              </span>
            </Link>
          ) : null}
          <button type="button" onClick={() => setSheet("filter")} aria-haspopup="dialog" className="inline-flex min-h-11 shrink-0 items-center">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink">
              <SlidersHorizontal className="size-4" aria-hidden /> Filter
            </span>
          </button>
        </div>
      ) : null}

      {items.length ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label} className="space-y-1">
              <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">{g.label}</h2>
              <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface">
                {g.items.map((m) => (
                  <MomentRow key={m.id} m={m} dejavuName={name} onRemove={() => remove(m)} />
                ))}
              </ul>
            </section>
          ))}
          {cursor ? (
            <Button variant="secondary" size="sm" loading={loading} onClick={more}>
              Show more
            </Button>
          ) : null}
        </div>
      ) : filtered ? (
        <EmptyState
          title="Nothing here for this filter"
          body="Try another type or other dates."
          action={
            <Link href={`/dejavu/${dejavu.id}`} className={buttonClasses({ size: "md", variant: "secondary" })}>
              Show everything
            </Link>
          }
        />
      ) : (
        <EmptyState
          title="Nothing carries this DejaVu yet"
          body="Add it from any Material or Creation with + DejaVu."
          action={
            <Link href="/space?tab=ideas" className={buttonClasses({ size: "md" })}>
              Open Materials
            </Link>
          }
        />
      )}

      <p role="status" className="text-[13px] text-ink-muted">
        {removed ? (
          <>
            Took “{titleOf(removed)}” off {name}.{" "}
            <button type="button" onClick={undo} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
              Undo
            </button>
          </>
        ) : null}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <FilterSheet open={sheet === "filter"} onOpenChange={(o) => !o && setSheet(null)} range={range} onApply={(r) => router.push(query(r))} />
      <RenameSheet
        open={sheet === "rename"}
        onOpenChange={(o) => !o && setSheet(null)}
        id={dejavu.id}
        name={name}
        onRenamed={(n) => {
          setName(n);
          setSheet(null);
        }}
      />
    </div>
  );
}

function MomentRow({ m, dejavuName, onRemove }: { m: MomentView; dejavuName: string; onRemove: () => void }) {
  const href = momentHref(m);
  const Icon = m.entityType === "creation" ? Sparkles : m.previewKind === "image" ? ImageIcon : m.previewKind === "audio" ? Mic : m.previewKind === "video" ? Video : FileText;
  const body = (
    <>
      {m.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.thumbUrl} alt="" className="size-11 shrink-0 rounded-xl border border-border-soft object-cover" />
      ) : (
        <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-accent-ink">
          <Icon className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{titleOf(m)}</span>
        <span className="block truncate text-[12.5px] text-ink-subtle">
          {kindLabel(m)} · {dateLabel(m.occurredAt)}
        </span>
      </span>
    </>
  );
  return (
    <li className="flex items-center">
      {href ? (
        <Link href={href} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-1.5 hover:bg-surface-muted">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-1.5">{body}</div>
      )}
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`More for ${titleOf(m)}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5">
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onRemove}>
            <X className="size-4" aria-hidden /> Take off {dejavuName}
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

/** Advanced filters live behind Filter (§9); in this phase, dates. */
function FilterSheet({ open, onOpenChange, range, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; range: { from: string | null; to: string | null }; onApply: (r: { from: string | null; to: string | null }) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Filter" art={KIT.painted.leafSprigSage}>
        {open ? <FilterBody range={range} onApply={onApply} /> : null}
      </DialogContent>
    </Dialog>
  );
}
function FilterBody({ range, onApply }: { range: { from: string | null; to: string | null }; onApply: (r: { from: string | null; to: string | null }) => void }) {
  const [from, setFrom] = useState(range.from ?? "");
  const [to, setTo] = useState(range.to ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ from: from || null, to: to || null });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[13px] text-ink-muted">
          <span className="block">From</span>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1 text-[13px] text-ink-muted">
          <span className="block">To</span>
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Show
        </Button>
        <Button type="button" variant="secondary" onClick={() => onApply({ from: null, to: null })}>
          Clear
        </Button>
      </div>
    </form>
  );
}

function RenameSheet({ open, onOpenChange, id, name, onRenamed }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; name: string; onRenamed: (n: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Rename" art={KIT.painted.leafSprigSage}>
        {open ? <RenameBody id={id} name={name} onRenamed={onRenamed} /> : null}
      </DialogContent>
    </Dialog>
  );
}
function RenameBody({ id, name, onRenamed }: { id: string; name: string; onRenamed: (n: string) => void }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ dejavu: DejaVu }>(`/api/v1/dejavus/${id}`, { method: "PATCH", json: { name: value } });
          onRenamed(r.dejavu.name);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="dejavu-name" className="sr-only">
        Name
      </label>
      <Input id="dejavu-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} autoFocus />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={busy} disabled={!value.trim()}>
        Save
      </Button>
    </form>
  );
}
