"use client";
import { Button, ConfirmDialog, Dialog, DialogContent, EmptyState, Field, IconButton, Input, PageTitle, Select, TagInput, Textarea, buttonClasses, cn, BACKGROUNDS } from "@wonder/ui";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";
import { api, errorMessage } from "@/lib/client";
import { sendToCreator } from "@/lib/send";

interface Item {
  id: string;
  note: string | null;
  tags: string[];
  shelfId: string | null;
  material: MaterialCardData;
}

export function ReferenceShelf({ shelves, activeShelf, items }: { shelves: Array<{ id: string; name: string; count: number }>; activeShelf: string | null; items: Item[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Item | null>(items[0] ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [deleteShelf, setDeleteShelf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = shelves.reduce((s, x) => s + x.count, 0);
  const active = shelves.find((s) => s.id === activeShelf);

  return (
    <div>
      <PageTitle
        title="Reference Shelf"
        subtitle="Save and use inspiration."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShelfOpen(true)}>
              New shelf
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" aria-hidden /> Add
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[220px_1fr_300px]">
        <nav aria-label="Shelves" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:px-0">
          <Link href="/space/references" aria-current={!activeShelf ? "page" : undefined} className={cn("flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-xl px-3 text-sm", !activeShelf ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-muted hover:bg-black/[0.04]")}>
            All References <span className="text-xs">{total}</span>
          </Link>
          {shelves.map((s) => (
            <Link key={s.id} href={`/space/references?shelf=${s.id}`} aria-current={s.id === activeShelf ? "page" : undefined} className={cn("flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-xl px-3 text-sm", s.id === activeShelf ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-muted hover:bg-black/[0.04]")}>
              {s.name} <span className="text-xs">{s.count}</span>
            </Link>
          ))}
          {active ? (
            <button type="button" onClick={() => setDeleteShelf(true)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm text-ink-subtle hover:text-danger">
              <Trash2 className="size-4" aria-hidden /> Delete “{active.name}”
            </button>
          ) : null}
        </nav>

        <section aria-label="References">
          {items.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setSelected(i)} aria-pressed={selected?.id === i.id} className={cn("block w-full rounded-2xl text-left", selected?.id === i.id && "ring-2 ring-accent ring-offset-2 ring-offset-cream")}>
                    <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border-soft bg-surface">
                      <MaterialVisual m={i.material} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-ink">{i.material.title || "Untitled"}</p>
                    <p className="text-xs text-ink-subtle">{shelves.find((s) => s.id === i.shelfId)?.name ?? "Unsorted"}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState image={BACKGROUNDS.leafShadow} title="Nothing on this shelf yet" body="Add films, images, music, notes or links that inspire you. You can attach them when you create." action={<Button onClick={() => setAddOpen(true)}>Add a reference</Button>} />
          )}
        </section>

        <aside aria-label="Reference details">
          {selected ? <ReferenceDetail key={selected.id} item={selected} shelves={shelves} onChanged={() => router.refresh()} onError={setError} /> : null}
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </aside>
      </div>

      <AddReferenceDialog open={addOpen} onOpenChange={setAddOpen} shelves={shelves} defaultShelf={activeShelf} />
      <NewShelfDialog open={shelfOpen} onOpenChange={setShelfOpen} />
      {active ? (
        <ConfirmDialog
          open={deleteShelf}
          onOpenChange={setDeleteShelf}
          destructive
          title={`Delete the “${active.name}” shelf?`}
          body="The shelf is removed; its references move to Unsorted. Your material is not deleted."
          confirmLabel="Delete shelf"
          onConfirm={async () => {
            try {
              await api(`/api/v1/references/shelves/${active.id}`, { method: "DELETE" });
              router.replace("/space/references");
              router.refresh();
            } catch (e) {
              setError(errorMessage(e));
            }
            setDeleteShelf(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ReferenceDetail({ item, shelves, onChanged, onError }: { item: Item; shelves: Array<{ id: string; name: string }>; onChanged: () => void; onError: (e: string | null) => void }) {
  const [note, setNote] = useState(item.note ?? "");
  const [tags, setTags] = useState(item.tags);
  const [shelf, setShelf] = useState(item.shelfId ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-3xl border border-border-soft bg-surface p-4 lg:sticky lg:top-24">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl">
        <MaterialVisual m={item.material} />
      </div>
      <h2 className="mt-3 font-semibold text-ink">{item.material.title || "Untitled"}</h2>
      <div className="mt-3 space-y-3">
        <Field label="Shelf" htmlFor="ref-shelf">
          <Select id="ref-shelf" value={shelf} onChange={(e) => setShelf(e.target.value)}>
            <option value="">Unsorted</option>
            {shelves.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="ref-tags">
          <TagInput id="ref-tags" value={tags} onChange={setTags} placeholder="Goa, sunset…" />
        </Field>
        <Field label="Notes" htmlFor="ref-note">
          <Textarea id="ref-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What do you love about it?" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              onError(null);
              try {
                await api(`/api/v1/references/items/${item.id}`, { method: "PATCH", json: { note, tags, shelfId: shelf || null } });
                onChanged();
              } catch (e) {
                onError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
          <Link href={`/create?material=${item.material.id}`} className={buttonClasses({ size: "sm", variant: "soft" })}>
            Use in creation →
          </Link>
          <IconButton
            label="Remove from shelf"
            onClick={async () => {
              try {
                await api(`/api/v1/references/items/${item.id}`, { method: "DELETE" });
                onChanged();
              } catch (e) {
                onError(errorMessage(e));
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function AddReferenceDialog({ open, onOpenChange, shelves, defaultShelf }: { open: boolean; onOpenChange: (o: boolean) => void; shelves: Array<{ id: string; name: string }>; defaultShelf: string | null }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [shelf, setShelf] = useState(defaultShelf ?? shelves[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a reference" description="Links, images, videos, audio, PDFs or a note.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await sendToCreator({ files, urls: link.trim() ? [link.trim()] : [], text: !files.length && !link.trim() ? note : undefined });
              if (r.rejected.length && !r.accepted.length) throw new Error(r.rejected[0].message);
              for (const a of r.accepted) if (a.materialId) await api("/api/v1/references/items", { method: "POST", json: { materialId: a.materialId, shelfId: shelf || null, note: files.length || link.trim() ? note : undefined } });
              onOpenChange(false);
              setLink("");
              setNote("");
              setFiles([]);
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Link" htmlFor="ref-link">
            <Input id="ref-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
          </Field>
          <Field label="Files" htmlFor="ref-files">
            <input id="ref-files" type="file" multiple accept="image/*,audio/*,video/*,application/pdf,.txt,.md" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="block text-sm file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:text-accent-ink" />
          </Field>
          <Field label="Note" htmlFor="ref-add-note">
            <Textarea id="ref-add-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this inspires you (or a written reference)" />
          </Field>
          <Field label="Shelf" htmlFor="ref-add-shelf">
            <Select id="ref-add-shelf" value={shelf} onChange={(e) => setShelf(e.target.value)}>
              <option value="">Unsorted</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!link.trim() && !files.length && !note.trim()}>
              Add reference
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewShelfDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New shelf">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api<{ shelf: { id: string } }>("/api/v1/references/shelves", { method: "POST", json: { name } });
              onOpenChange(false);
              setName("");
              router.push(`/space/references?shelf=${r.shelf.id}`);
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label="Name" htmlFor="shelf-name" error={error}>
            <Input id="shelf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Locations" maxLength={80} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create shelf
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
