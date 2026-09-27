"use client";
import { ARTIFACT_TYPES } from "@wonder/creator-studio/types";
import { Button, Dialog, DialogContent, Field, Input, Select } from "@wonder/ui";
import { Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export function SpaceSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className="relative w-full lg:w-80"
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams(params.toString());
        if (q.trim()) p.set("q", q.trim());
        else p.delete("q");
        router.push(`/space?${p.toString()}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <label htmlFor="space-q" className="sr-only">
        Search your space
      </label>
      <Input id="space-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your material and creations…" className="pl-10" />
    </form>
  );
}

/** Start from a blank page (creator-authored; CreatorBrain is optional). */
export function NewPieceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("poem");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> New
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Start a new Creation" description="Begin from a blank page. You can bring CreativeMind in anytime.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ artifact: { id: string } }>("/api/v1/artifacts", { method: "POST", json: { artifactType: type, title: title.trim() || "Untitled" } });
                router.push(`/artifacts/${r.artifact.id}/studio`);
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            <Field label="Kind of Creation" htmlFor="kind">
              <Select id="kind" value={type} onChange={(e) => setType(e.target.value)}>
                {ARTIFACT_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="new-title">
              <Input id="new-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" maxLength={200} />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Open Creative Studio
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
