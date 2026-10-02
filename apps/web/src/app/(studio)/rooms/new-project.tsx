"use client";
import { Button, Dialog, DialogContent, Field, Input, Textarea, KIT } from "@wonder/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** Start a project with a name and (optionally) a brief, then open it to add work. */
export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        onClick={() => {
          setTitle("");
          setBrief("");
          setStarted(false);
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="size-4" aria-hidden /> New Creative Room
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent art={KIT.painted.flowerBranch} title="New Creative Room" description="A Creative Room points to your work; nothing is moved or copied into it.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ project: { id: string } }>("/api/v1/projects", { method: "POST", json: { title, brief, status: started ? "active" : "idea" } });
                router.push(`/rooms/${r.project.id}`);
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            <Field label="Name" htmlFor="project-title">
              <Input id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus placeholder="A Life in Moments" />
            </Field>
            <Field label="Brief" htmlFor="project-brief" hint="Optional. What is it, and what should it feel like? CreativeMind uses this when you create inside the Creative Room.">
              <Textarea id="project-brief" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={5000} className="min-h-28" />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Where is it?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { v: false, label: "Just an idea" },
                  { v: true, label: "Already underway" },
                ].map((o) => (
                  <label key={o.label} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                    <input type="radio" name="project-started" checked={started === o.v} onChange={() => setStarted(o.v)} className="accent-[var(--color-accent)]" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!title.trim()}>
                Create Creative Room
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
