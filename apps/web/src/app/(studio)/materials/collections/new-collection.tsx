"use client";
import { COLLECTION_SUGGESTIONS } from "@wonder/creator-library/suggestions";
import { Button, Dialog, DialogContent, Field, Input, Textarea } from "@wonder/ui";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** Create a collection, then open it to add material. */
export function NewCollectionButton({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const suggestions = COLLECTION_SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));
  return (
    <>
      <Button
        onClick={() => {
          setName("");
          setDescription("");
          setError(null);
          setOpen(true);
        }}
      >
        <FolderPlus className="size-4" aria-hidden /> New collection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New collection" description="Group material any way you like. Material stays where it is; a collection only points to it.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ collection: { id: string } }>("/api/v1/collections", { method: "POST", json: { name, description } });
                router.push(`/space/collections/${r.collection.id}`);
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            <Field label="Name" htmlFor="collection-name">
              <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            </Field>
            {suggestions.length ? (
              <div>
                <p className="text-sm text-ink-subtle" id="collection-suggestions">
                  Or start from one of these
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-labelledby="collection-suggestions">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => setName(s)}
                        aria-pressed={name === s}
                        className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm text-ink-muted hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-ink"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Field label="Description" htmlFor="collection-description" hint="Optional. What ties these together?">
              <Textarea id="collection-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-20" />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!name.trim()}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
