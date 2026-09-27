"use client";
import { Badge, Button, ConfirmDialog, Dialog, DialogContent, EmptyState, ErrorState, Field, Input, Textarea, buttonClasses, cn } from "@wonder/ui";
import { Archive, ArrowDown, ArrowUp, ImageIcon, Lock, MessageCircle, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";
import { api, errorMessage } from "@/lib/client";

type Item = MaterialCardData & { status: string; storage_object_id: string | null };

const TYPE_LABEL: Record<string, string> = { image: "Image", sketch: "Sketch", audio: "Audio", voice: "Voice note", video: "Video", pdf: "PDF", document: "Document", url: "Link", idea: "Idea", note: "Note", text: "Text" };

export function CollectionDetail({
  c,
  items,
}: {
  c: { id: string; name: string; description: string | null; status: string; coverMaterialId: string | null };
  items: Item[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archived = c.status === "archived";
  const needle = filter.trim().toLowerCase();
  const shown = needle ? items.filter((m) => `${m.title ?? ""} ${m.text_content ?? ""} ${TYPE_LABEL[m.type] ?? m.type}`.toLowerCase().includes(needle)) : items;
  const askPrompt = `What ties my "${c.name.slice(0, 60)}" collection together, and what could I make from it?`;

  async function run(key: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const remove = (ids: string[], done: string) =>
    run("remove", async () => {
      await api(`/api/v1/collections/${c.id}/items`, { method: "DELETE", json: { materialIds: ids } });
      setSelected((s) => s.filter((x) => !ids.includes(x)));
    }, done);

  function move(id: string, by: -1 | 1) {
    const order = items.map((m) => m.id);
    const i = order.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const name = items[i].title || TYPE_LABEL[items[i].type] || "Item";
    void run(`move:${id}`, () => api(`/api/v1/collections/${c.id}/items`, { method: "PUT", json: { order } }), `Moved “${name}” ${by < 0 ? "earlier" : "later"}.`);
  }

  return (
    <div>
      <Link href="/space?tab=collections" className="text-sm text-accent-ink hover:underline">
        ← Collections
      </Link>
      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{c.name}</h1>
          {c.description ? <p className="mt-1 max-w-2xl text-ink-muted">{c.description}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
            {items.length} item{items.length === 1 ? "" : "s"}
            <span className="inline-flex items-center gap-1">
              · <Lock className="size-3.5" aria-hidden /> Private to you
            </span>
            {archived ? <Badge tone="neutral">Archived</Badge> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length ? (
            <>
              <Link href={`/create?collection=${c.id}`} prefetch={false} className={buttonClasses({})}>
                <Sparkles className="size-4" aria-hidden /> Use in creation
              </Link>
              <Link href={`/create?collection=${c.id}&prompt=${encodeURIComponent(askPrompt)}`} prefetch={false} className={buttonClasses({ variant: "secondary" })}>
                <MessageCircle className="size-4" aria-hidden /> Ask CreativeMind
              </Link>
            </>
          ) : null}
          <Button variant="soft" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add material
          </Button>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {items.length ? (
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <label htmlFor="collection-filter" className="sr-only">
              Search this collection
            </label>
            <Input id="collection-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search this collection…" className="pl-10" />
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> Rename
          </Button>
          <Button variant="ghost" size="sm" loading={busy === "archive"} onClick={() => run("archive", () => api(`/api/v1/collections/${c.id}`, { method: "PATCH", json: { status: archived ? "active" : "archived" } }), archived ? "Collection restored." : "Collection archived.")}>
            <Archive className="size-4" aria-hidden /> {archived ? "Unarchive" : "Archive"}
          </Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      </div>

      {msg ? (
        <p role="status" className="mt-3 text-sm text-success-ink">
          {msg}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <ErrorState title="That didn't work" body={error} />
        </div>
      ) : null}

      {selected.length ? (
        <div className="sticky top-2 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-2 shadow-[var(--shadow-card)]">
          <p className="text-sm text-ink">
            {selected.length} selected
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button variant="secondary" size="sm" loading={busy === "remove"} onClick={() => remove(selected, `Removed ${selected.length} from the collection. They're still in your Creative Space.`)}>
              Remove from collection
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing in this collection yet" body="Add material from your Creative Space. It stays where it is — the collection only points to it." action={<Button onClick={() => setAdding(true)}>Add material</Button>} />
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-ink-muted">Nothing in this collection matches “{filter}”.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Collection items">
          {shown.map((m) => {
            const index = items.findIndex((x) => x.id === m.id);
            const name = m.title || TYPE_LABEL[m.type] || "Untitled";
            const isCover = c.coverMaterialId === m.id;
            const canCover = (m.type === "image" || m.type === "sketch") && !!m.storage_object_id;
            return (
              <li key={m.id} className="min-w-0">
                <div className="relative">
                  <Link href={`/space/materials/${m.id}`} className="group block rounded-2xl focus-visible:outline-2">
                    <div className={cn("aspect-[4/3] overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-card)]", selected.includes(m.id) ? "border-accent ring-2 ring-accent" : "border-border-soft")}>
                      <MaterialVisual m={m} />
                    </div>
                  </Link>
                  <label className="absolute left-1 top-1 inline-flex size-11 cursor-pointer items-center justify-center rounded-full">
                    <span className="sr-only">Select {name}</span>
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-accent)]"
                      checked={selected.includes(m.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))}
                    />
                  </label>
                  {isCover ? (
                    <span className="absolute right-2 top-2">
                      <Badge tone="accent">Cover</Badge>
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 px-0.5 text-[15px] font-medium leading-snug text-ink">{name}</p>
                <p className="px-0.5 text-xs text-ink-subtle">
                  {TYPE_LABEL[m.type] ?? m.type}
                  {m.status === "archived" ? " · Archived" : ""}
                </p>
                <div className="mt-1 flex flex-wrap">
                  {!needle ? (
                    <>
                      <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-ink-subtle hover:bg-black/[0.05] hover:text-ink disabled:opacity-40" aria-label={`Move ${name} earlier`} disabled={index === 0 || !!busy} onClick={() => move(m.id, -1)}>
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-ink-subtle hover:bg-black/[0.05] hover:text-ink disabled:opacity-40" aria-label={`Move ${name} later`} disabled={index === items.length - 1 || !!busy} onClick={() => move(m.id, 1)}>
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                    </>
                  ) : null}
                  {canCover && !isCover ? (
                    <button
                      type="button"
                      className="inline-flex size-11 items-center justify-center rounded-full text-ink-subtle hover:bg-black/[0.05] hover:text-ink"
                      aria-label={`Use ${name} as the cover`}
                      disabled={!!busy}
                      onClick={() => run("cover", () => api(`/api/v1/collections/${c.id}`, { method: "PATCH", json: { coverMaterialId: m.id } }), "Cover updated.")}
                    >
                      <ImageIcon className="size-4" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-full text-ink-subtle hover:bg-black/[0.05] hover:text-ink"
                    aria-label={`Remove ${name} from this collection`}
                    disabled={!!busy}
                    onClick={() => remove([m.id], `Removed “${name}” from the collection. It's still in your Creative Space.`)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Mounted only while open, so each opening starts fresh. */}
      {editing ? <EditDialog onOpenChange={setEditing} c={c} onSaved={() => (setMsg("Saved."), router.refresh())} /> : null}
      {adding ? <AddDialog onOpenChange={setAdding} collectionId={c.id} present={items.map((m) => m.id)} onAdded={(n) => (setMsg(n ? `Added ${n} to ${c.name}.` : "Those were already here."), router.refresh())} /> : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        busy={busy === "delete"}
        title="Delete this collection?"
        body="The collection goes away. Everything in it stays in your Creative Space, and anything you made from it keeps its sources."
        confirmLabel="Delete collection"
        onConfirm={() =>
          run("delete", async () => {
            await api(`/api/v1/collections/${c.id}?confirm=true`, { method: "DELETE" });
            router.replace("/space?tab=collections");
          })
        }
      />
    </div>
  );
}

function EditDialog({ onOpenChange, c, onSaved }: { onOpenChange: (o: boolean) => void; c: { id: string; name: string; description: string | null }; onSaved: () => void }) {
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Edit collection">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/collections/${c.id}`, { method: "PATCH", json: { name, description } });
              onOpenChange(false);
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Name" htmlFor="edit-collection-name">
            <Input id="edit-collection-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </Field>
          <Field label="Description" htmlFor="edit-collection-description">
            <Textarea id="edit-collection-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-20" />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Candidate = MaterialCardData & { previewUrl?: string | null };

/** Multi-select from the creator's Creative Space; already-present material is marked, not offered twice. */
function AddDialog({ onOpenChange, collectionId, present, onAdded }: { onOpenChange: (o: boolean) => void; collectionId: string; present: string[]; onAdded: (n: number) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (query: string) => api<{ items: Candidate[] }>(`/api/v1/materials${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  async function search(query: string) {
    setError(null);
    try {
      setResults((await load(query)).items);
    } catch (e) {
      setError(errorMessage(e));
      setResults([]);
    }
  }
  // Show the most recent material as soon as the dialog opens.
  useEffect(() => {
    let active = true;
    load("")
      .then((r) => active && setResults(r.items))
      .catch((e) => active && (setError(errorMessage(e)), setResults([])));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Add material" description="Choose from your Creative Space. Nothing is copied or moved.">
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            void search(q);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <label htmlFor="add-material-q" className="sr-only">
            Search your material
          </label>
          <Input id="add-material-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your material…" className="pl-10" />
        </form>
        <div className="mt-3 max-h-[50vh] overflow-y-auto">
          {results === null ? (
            <p className="py-6 text-center text-sm text-ink-muted" role="status">
              Loading your material…
            </p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">{error ?? "Nothing found."}</p>
          ) : (
            <ul className="space-y-1" aria-label="Your material">
              {results.map((m) => {
                const already = present.includes(m.id);
                const name = m.title || TYPE_LABEL[m.type] || "Untitled";
                return (
                  <li key={m.id}>
                    <label className={cn("flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5", already ? "opacity-60" : "cursor-pointer hover:bg-black/[0.03]")}>
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-[var(--color-accent)]"
                        checked={already || picked.includes(m.id)}
                        disabled={already}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))}
                      />
                      <span className="size-12 shrink-0 overflow-hidden rounded-lg border border-border-soft">
                        <MaterialVisual m={m} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{name}</span>
                        <span className="block text-xs text-ink-subtle">{already ? "Already in this collection" : (TYPE_LABEL[m.type] ?? m.type)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {error && results?.length ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!picked.length}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ added: number }>(`/api/v1/collections/${collectionId}/items`, { method: "POST", json: { materialIds: picked } });
                onOpenChange(false);
                onAdded(r.added);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Add {picked.length || ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
