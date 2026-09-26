"use client";
import { relativeTime } from "@wonder/core";
import { Button, ConfirmDialog, Dialog, DialogContent, EmptyState, Field, IconButton, Select, Tab, TabList, TabPanel, Tabs, Textarea, BACKGROUNDS } from "@wonder/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

interface Memory {
  id: string;
  category: string;
  statement: string;
  sourceKind: string;
  sourceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const GROUPS = [
  { key: "about", label: "About Me", categories: ["creative_fact"] },
  { key: "preferences", label: "Creative Preferences", categories: ["creative_preference", "style_preference", "creative_voice"] },
  { key: "past", label: "Past Work", categories: ["creative_history", "project_context"] },
  { key: "themes", label: "Key Themes", categories: ["recurring_theme"] },
  { key: "people", label: "People", categories: ["relationship_context"] },
];

const CATEGORY_OPTIONS = [
  { value: "creative_fact", label: "About me" },
  { value: "creative_voice", label: "My voice" },
  { value: "style_preference", label: "Style preference" },
  { value: "creative_preference", label: "Creative preference" },
  { value: "recurring_theme", label: "Recurring theme" },
  { value: "creative_history", label: "Past work" },
  { value: "project_context", label: "Project" },
  { value: "relationship_context", label: "People" },
];

const SOURCE: Record<string, string> = {
  onboarding: "From your onboarding answers",
  conversation: "Learned in a conversation",
  artifact: "Learned from your work",
  material: "Learned from your material",
  creator: "Added by you",
  huddle: "From a Huddle",
};

export function MemoryView({ initial }: { initial: Memory[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = (cats?: string[]) => initial.filter((m) => !cats || cats.includes(m.category));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabList label="Memory categories">
            <Tab value="all">All ({initial.length})</Tab>
            {GROUPS.map((g) => (
              <Tab key={g.key} value={g.key}>
                {g.label}
              </Tab>
            ))}
          </TabList>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
        {[{ key: "all", categories: undefined as string[] | undefined }, ...GROUPS].map((g) => (
          <TabPanel key={g.key} value={g.key} className="mt-0">
            {list(g.categories).length ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list(g.categories).map((m) => (
                  <li key={m.id} className="flex flex-col rounded-2xl border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]">
                    <p className="text-[15px] leading-relaxed text-ink">{m.statement}</p>
                    <p className="mt-3 text-xs text-ink-subtle">
                      {m.sourceLabel ?? SOURCE[m.sourceKind] ?? "Source unknown"} · {relativeTime(m.createdAt)}
                      {m.lastUsedAt ? ` · last used ${relativeTime(m.lastUsedAt)}` : ""}
                    </p>
                    <div className="mt-auto flex justify-end gap-1 pt-2">
                      <IconButton label="Edit memory" onClick={() => setEditing(m)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconButton>
                      <IconButton label="Remove memory" onClick={() => setRemoving(m)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState image={BACKGROUNDS.pastelClouds} title="Nothing remembered here yet" body="As you create and talk with CreatorBrain, what matters about your practice will appear here — always editable." />
            )}
          </TabPanel>
        ))}

      <MemoryDialog
        key={editing?.id ?? (adding ? "new" : "closed")}
        open={adding || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        memory={editing}
        onSaved={() => {
          setAdding(false);
          setEditing(null);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this memory?"
        body={`CreatorBrain will stop using: “${removing?.statement ?? ""}”`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          try {
            await api(`/api/v1/memories/${removing!.id}`, { method: "DELETE" });
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
          }
          setRemoving(null);
        }}
      />
    </Tabs>
  );
}

function MemoryDialog({ open, onOpenChange, memory, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; memory: Memory | null; onSaved: () => void }) {
  const [statement, setStatement] = useState(memory?.statement ?? "");
  const [category, setCategory] = useState(memory?.category ?? "creative_preference");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={memory ? "Edit memory" : "Add a memory"} description="Write it the way you'd like CreatorBrain to understand it.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              if (memory) await api(`/api/v1/memories/${memory.id}`, { method: "PATCH", json: { statement, category } });
              else await api("/api/v1/memories", { method: "POST", json: { statement, category } });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Memory" htmlFor="mem-statement" error={error}>
            <Textarea id="mem-statement" value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="You prefer conversational writing with strong visual imagery." maxLength={500} />
          </Field>
          <Field label="Kind" htmlFor="mem-cat">
            <Select id="mem-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
