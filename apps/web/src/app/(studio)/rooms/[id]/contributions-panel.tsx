"use client";
import { ATTRIBUTION_LABEL, CONTRIBUTION_KINDS, CONTRIBUTION_KIND_LABEL, RIGHTS_RELATIONSHIP_LABEL, type ContributionKind } from "@wonder/creator-projects/options";
import { Badge, Button, Dialog, DialogContent, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Segmented, Select, Textarea, buttonClasses, cn, EmptyNote, KIT } from "@wonder/ui";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LocalTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";

type Rights = keyof typeof RIGHTS_RELATIONSHIP_LABEL;
type Attribution = keyof typeof ATTRIBUTION_LABEL;

export interface Entry {
  id: string;
  contributor: { id: string; name: string; handle: string | null };
  kind: ContributionKind;
  kindLabel: string;
  source: "version" | "shared_item" | "task" | "manual";
  description: string;
  attribution: Attribution;
  creditLine: string | null;
  rights: Rights;
  compensation: string | null;
  sharePercent: number | null;
  related: { artifact: { id: string; title: string } | null; versionNumber: number | null; material: string | null };
  recordedBy: string | null;
  retracted: { at: string; reason: string | null } | null;
  edited: number;
  at: string;
  mine: boolean;
}

export interface Summary {
  total: number;
  people: Array<{ id: string; name: string; count: number; kinds: string[]; definedShare: number | null }>;
}

const SOURCE_LABEL: Record<Entry["source"], string> = {
  version: "From a version they wrote",
  shared_item: "Shared into the Creative Room",
  task: "Completed a task",
  manual: "Recorded",
};

export function ContributionsPanel({ projectId, manages, entries, summary, people }: { projectId: string; manages: boolean; entries: Entry[]; summary: Summary; people: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [person, setPerson] = useState("");
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [retracting, setRetracting] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const shown = person ? entries.filter((e) => e.contributor.id === person) : entries;
  // All activity · By version · By people (UI redesign §28): the same entries, grouped — never estimated.
  const [mode, setMode] = useState<"all" | "version" | "people">("all");
  const groups = mode === "all" ? [{ key: "all", title: null as string | null, list: shown }] : groupEntries(shown, mode);

  return (
    <div className="space-y-8">
      <section aria-label="Summary" className="rounded-2xl border border-border-soft bg-surface px-5 py-4">
        <p className="text-[15px] text-ink">
          {summary.total ? `${summary.total} ${summary.total === 1 ? "contribution" : "contributions"} by ${summary.people.length} ${summary.people.length === 1 ? "person" : "people"}` : "No contributions recorded yet."}
        </p>
        {summary.people.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {summary.people.map((p) => (
              <li key={p.id} className="rounded-full border border-border-soft bg-cream px-3 py-1.5 text-sm text-ink">
                <span className="font-medium">{p.name}</span> · {p.count} · {p.kinds.slice(0, 3).join(", ")}
                {p.definedShare !== null ? <span className="text-accent-ink"> · {p.definedShare}% (agreed)</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-sm text-ink-muted">Shares appear only where someone recorded one — nothing is estimated. This is a record of contributions, not a legal agreement.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {manages ? (
            <Button onClick={() => setRecording(true)}>
              <Plus className="size-4" aria-hidden /> Record a contribution
            </Button>
          ) : null}
          <a href={`/api/v1/projects/${projectId}/credits`} className={buttonClasses({ variant: "secondary" })}>
            <Download className="size-4" aria-hidden /> Export credits
          </a>
          <a href={`/api/v1/projects/${projectId}/credits?format=csv`} className={buttonClasses({ variant: "ghost" })}>
            Ledger (CSV)
          </a>
        </div>
      </section>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}

      <section aria-label="Contributions">
        <SectionHeader
          title="Contributions"
          action={
            summary.people.length > 1 ? (
              <>
                <label htmlFor="ledger-person" className="sr-only">
                  Show contributions by
                </label>
                <Select id="ledger-person" value={person} onChange={(e) => setPerson(e.target.value)} className="w-auto">
                  <option value="">Everyone</option>
                  {summary.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </>
            ) : undefined
          }
        />
        {shown.length ? (
          <div className="space-y-5">
            {summary.people.length ? (
              <Segmented
                label="Show contributions"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "all", label: "All activity" },
                  { value: "version", label: "By version" },
                  { value: "people", label: "By people" },
                ]}
              />
            ) : null}
            {groups.map((g) => (
              <div key={g.key}>
                {g.title ? <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-ink-subtle">{g.title}</h3> : null}
          <ol className="space-y-2">
            {g.list.map((e) => (
              <li key={e.id} className={cn("flex items-start gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3", e.retracted && "opacity-70")}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-medium text-ink", e.retracted && "line-through")}>{e.mine ? "You" : e.contributor.name}</span>
                    <Badge tone="accent">{e.kindLabel}</Badge>
                    {e.sharePercent !== null ? <Badge tone="neutral">{e.sharePercent}% agreed</Badge> : null}
                    {e.retracted ? <Badge tone="warning">Retracted</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-[15px] text-ink">{e.description}</p>
                  <p className="text-sm text-ink-muted">
                    {SOURCE_LABEL[e.source]}
                    {e.source === "manual" && e.recordedBy ? ` by ${e.recordedBy}` : ""}
                    {e.related.artifact ? (
                      <>
                        {" · "}
                        <Link href={`/creations/${e.related.artifact.id}`} className="hover:underline">
                          {e.related.artifact.title}
                          {e.related.versionNumber ? ` v${e.related.versionNumber}` : ""}
                        </Link>
                      </>
                    ) : e.related.material ? (
                      ` · ${e.related.material}`
                    ) : null}
                    {" · "}
                    <LocalTime iso={e.at} options={{ dateStyle: "medium" }} />
                  </p>
                  <p className="text-sm text-ink-muted">
                    {ATTRIBUTION_LABEL[e.attribution]}
                    {e.creditLine ? ` as “${e.creditLine}”` : ""} · {RIGHTS_RELATIONSHIP_LABEL[e.rights]}
                    {e.compensation ? ` · ${e.compensation}` : ""}
                    {e.edited ? ` · edited ${e.edited}×` : ""}
                  </p>
                  {e.retracted?.reason ? <p className="text-sm text-danger">Retracted: {e.retracted.reason}</p> : null}
                </div>
                <Menu>
                  <MenuTrigger aria-label={`Options for ${e.contributor.name}'s contribution`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05]">
                    <MoreHorizontal className="size-5" aria-hidden />
                  </MenuTrigger>
                  <MenuContent>
                    {!e.retracted && (manages || e.mine) ? <MenuItem onSelect={() => setEditing(e)}>{manages ? "Edit details" : "Edit description"}</MenuItem> : null}
                    <MenuItem onSelect={() => setHistory(e)}>History</MenuItem>
                    {!e.retracted && manages ? (
                      <MenuItem destructive onSelect={() => setRetracting(e)}>
                        Retract
                      </MenuItem>
                    ) : null}
                  </MenuContent>
                </Menu>
              </li>
            ))}
          </ol>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote art={KIT.painted.flowerBranch}>
            Contributions appear here as people write versions, share work and finish tasks{manages ? " — or record them yourself" : ""}.
          </EmptyNote>
        )}
      </section>

      {recording ? <EditDialog projectId={projectId} people={people} manages onOpenChange={setRecording} onSaved={() => (setRecording(false), setMsg("Contribution recorded."), router.refresh())} /> : null}
      {editing ? <EditDialog projectId={projectId} entry={editing} people={people} manages={manages} onOpenChange={(o) => !o && setEditing(null)} onSaved={() => (setEditing(null), setMsg("Contribution updated."), router.refresh())} /> : null}
      {retracting ? <RetractDialog entry={retracting} onOpenChange={(o) => !o && setRetracting(null)} onDone={() => (setRetracting(null), setMsg("Contribution retracted — it stays on record."), router.refresh())} /> : null}
      {history ? <HistoryDialog entry={history} onOpenChange={(o) => !o && setHistory(null)} /> : null}
    </div>
  );
}

function EditDialog({ projectId, entry, people, manages, onOpenChange, onSaved }: { projectId: string; entry?: Entry; people: Array<{ id: string; name: string }>; manages: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [contributorId, setContributorId] = useState(entry?.contributor.id ?? people[0]?.id ?? "");
  const [kind, setKind] = useState<ContributionKind>(entry?.kind ?? "writing");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [attribution, setAttribution] = useState<Attribution>(entry?.attribution ?? "required");
  const [creditLine, setCreditLine] = useState(entry?.creditLine ?? "");
  const [rights, setRights] = useState<Rights>(entry?.rights ?? "contributor");
  const [compensation, setCompensation] = useState(entry?.compensation ?? "");
  const [share, setShare] = useState(entry?.sharePercent != null ? String(entry.sharePercent) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={entry ? "Contribution" : "Record a contribution"} description={entry ? `${entry.contributor.name} · ${entry.kindLabel}` : "For someone in this Creative Room."} wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const sharePercent = share.trim() ? Number(share) : null;
              if (entry) {
                const json = manages ? { description, attribution, creditLine, rights, compensation, sharePercent } : { description };
                await api(`/api/v1/contributions/${entry.id}`, { method: "PATCH", json });
              } else {
                await api(`/api/v1/projects/${projectId}/contributions`, { method: "POST", json: { contributorId, kind, description, attribution, creditLine: creditLine || undefined, rights, compensation: compensation || undefined, sharePercent: sharePercent ?? undefined } });
              }
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          {!entry ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who" htmlFor="c-who">
                <Select id="c-who" value={contributorId} onChange={(e) => setContributorId(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kind of contribution" htmlFor="c-kind">
                <Select id="c-kind" value={kind} onChange={(e) => setKind(e.target.value as ContributionKind)}>
                  {CONTRIBUTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {CONTRIBUTION_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
          <Field label="What they contributed" htmlFor="c-description">
            <Textarea id="c-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} required className="min-h-20" />
          </Field>
          {manages ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Credit" htmlFor="c-attribution">
                  <Select id="c-attribution" value={attribution} onChange={(e) => setAttribution(e.target.value as Attribution)}>
                    {(Object.keys(ATTRIBUTION_LABEL) as Attribution[]).map((a) => (
                      <option key={a} value={a}>
                        {ATTRIBUTION_LABEL[a]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Credit line" htmlFor="c-credit" hint="How they're credited, e.g. “Sound recordist”.">
                  <Input id="c-credit" value={creditLine} onChange={(e) => setCreditLine(e.target.value)} maxLength={200} />
                </Field>
                <Field label="Rights relationship" htmlFor="c-rights">
                  <Select id="c-rights" value={rights} onChange={(e) => setRights(e.target.value as Rights)}>
                    {(Object.keys(RIGHTS_RELATIONSHIP_LABEL) as Rights[]).map((r) => (
                      <option key={r} value={r}>
                        {RIGHTS_RELATIONSHIP_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Agreed share (%)" htmlFor="c-share" hint="Only if you've actually agreed one. Leave empty otherwise.">
                  <Input id="c-share" inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value.replace(/[^0-9.]/g, ""))} />
                </Field>
              </div>
              <Field label="Compensation" htmlFor="c-compensation" hint="Optional. What was agreed, if anything.">
                <Input id="c-compensation" value={compensation} onChange={(e) => setCompensation(e.target.value)} maxLength={500} />
              </Field>
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!description.trim() || (!entry && !contributorId)}>
              {entry ? "Save" : "Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RetractDialog({ entry, onOpenChange, onDone }: { entry: Entry; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Retract this contribution?" description="It stays in the ledger, marked retracted with your reason. Nothing is deleted.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/api/v1/contributions/${entry.id}/retract`, { method: "POST", json: { reason } });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Reason" htmlFor="retract-reason" error={error}>
            <Input id="retract-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!reason.trim()}>
              Retract
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ entry, onOpenChange }: { entry: Entry; onOpenChange: (o: boolean) => void }) {
  const [list, setList] = useState<Array<{ id: string; changes: Record<string, unknown>; at: string; editor: string }> | null>(null);
  useEffect(() => {
    let live = true;
    api<{ history: Array<{ id: string; changes: Record<string, unknown>; at: string; editor: string }> }>(`/api/v1/contributions/${entry.id}/history`)
      .then((r) => live && setList(r.history))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [entry.id]);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="History" description={`Recorded ${new Date(entry.at).toISOString().slice(0, 10)}. Facts don't change; edits are listed here.`}>
        {list === null ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : list.length ? (
          <ol className="space-y-2">
            {list.map((h) => (
              <li key={h.id} className="rounded-xl bg-accent-softer px-3 py-2 text-sm">
                <p className="text-ink-subtle">
                  {h.editor} · <LocalTime iso={h.at} options={{ dateStyle: "medium", timeStyle: "short" }} />
                </p>
                <p className="text-ink">{Object.keys(h.changes).join(", ")} changed</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-muted">No edits.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function groupEntries(list: Entry[], mode: "version" | "people"): Array<{ key: string; title: string | null; list: Entry[] }> {
  const groups = new Map<string, { key: string; title: string | null; list: Entry[] }>();
  for (const e of list) {
    const key = mode === "people" ? e.contributor.id : e.related.artifact ? `${e.related.artifact.id}:${e.related.versionNumber ?? ""}` : "none";
    const title = mode === "people" ? (e.mine ? "You" : e.contributor.name) : e.related.artifact ? `${e.related.artifact.title}${e.related.versionNumber ? ` · v${e.related.versionNumber}` : ""}` : "Not tied to a version";
    const g = groups.get(key) ?? { key, title, list: [] };
    g.list.push(e);
    groups.set(key, g);
  }
  return [...groups.values()];
}
