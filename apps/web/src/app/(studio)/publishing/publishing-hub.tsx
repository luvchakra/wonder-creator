"use client";
import { Badge, Button, ConfirmDialog, Dialog, DialogContent, Field, Input, PageTitle, Segmented, Select, Textarea, buttonClasses } from "@wonder/ui";
import { ArrowUpRight, Globe, Webhook } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LocalTime, RelativeTime } from "@/components/client-time";
import { ConnectWebhookDialog } from "@/components/connect-webhook-dialog";
import { api, errorMessage } from "@/lib/client";

interface Item {
  id: string;
  artifact: { id: string; title: string } | null;
  destinationName: string;
  destinationKind: string;
  title: string;
  caption: string | null;
  description: string | null;
  tags: string[];
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  failureReason: string | null;
  attempts: number;
  updatedAt: string;
}

interface Preferences {
  defaultDestinations: string[];
  defaultTags: string[];
  preferredTime: string | null;
  timeZone: string | null;
  captionStyle: string | null;
}

const TIME_ZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  draft: { label: "Draft — waiting for your approval", tone: "neutral" },
  approved: { label: "Approved", tone: "accent" },
  scheduled: { label: "Scheduled", tone: "accent" },
  publishing: { label: "Publishing…", tone: "accent" },
  published: { label: "Published (confirmed)", tone: "success" },
  failed: { label: "Didn't go through", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function PublishingHub({
  queue,
  history,
  destinations,
  unconnected,
  preferences,
  available,
}: {
  queue: Item[];
  history: Item[];
  destinations: Array<{ id: string; name: string; host: string; status: string; lastUsedAt: string | null }>;
  unconnected: string[];
  preferences: Preferences;
  available: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Queue · Drafts · Published (UI redesign §35).
  const [view, setView] = useState<"queue" | "drafts" | "published">("queue");
  const drafts = queue.filter((p) => p.status === "draft");
  const waiting = queue.filter((p) => p.status !== "draft");
  const [disconnecting, setDisconnecting] = useState<{ id: string; name: string } | null>(null);
  const active = destinations.filter((d) => d.status === "active");

  async function act(p: Item, action: "approve" | "retry" | "cancel") {
    setBusy(`${action}:${p.id}`);
    setError(null);
    try {
      const r = await api<{ publication: { status: string; failure_reason: string | null } }>(`/api/v1/publications/${p.id}`, { method: "POST", json: { action } });
      setMsg(
        r.publication.status === "published"
          ? `Published to ${p.destinationName}.`
          : r.publication.status === "failed"
            ? `${p.destinationName}: ${r.publication.failure_reason ?? "it didn't go through."}`
            : r.publication.status === "scheduled"
              ? `Scheduled for ${p.destinationName}.`
              : action === "cancel"
                ? "Cancelled."
                : "Updated.",
      );
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageTitle title="Publishing" subtitle="What's waiting, what went out, and where it can go. Nothing is published without your approval, and nothing is marked published until the destination confirms it." />

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
      {!available ? <p className="rounded-2xl border border-border-soft bg-surface px-4 py-3 text-[15px] text-ink-muted">Publishing isn&rsquo;t set up on this server yet, so approvals can&rsquo;t be sent.</p> : null}

      <Segmented
        label="Publishing view"
        value={view}
        onChange={setView}
        options={[
          { value: "queue", label: `Queue (${waiting.length})` },
          { value: "drafts", label: `Drafts (${drafts.length})` },
          { value: "published", label: `Published (${history.length})` },
        ]}
      />

      {view !== "published" ? (
      <section aria-label={view === "queue" ? "Queue" : "Drafts"}>
        <h2 className="mb-3 text-lg font-semibold text-ink">{view === "queue" ? "Queue" : "Drafts"}</h2>
        {(view === "queue" ? waiting : drafts).length ? (
          <ul className="space-y-3">
            {(view === "queue" ? waiting : drafts).map((p) => (
              <li key={p.id} className="rounded-2xl border border-border-soft bg-surface px-4 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {p.artifact ? (
                        <Link href={`/artifacts/${p.artifact.id}/publish`} className="hover:underline">
                          {p.artifact.title}
                        </Link>
                      ) : (
                        p.title
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                      {p.destinationKind === "profile" ? <Globe className="size-4" aria-hidden /> : <Webhook className="size-4" aria-hidden />} {p.destinationName}
                      {p.scheduledFor ? (
                        <>
                          {" · "}
                          <LocalTime iso={p.scheduledFor} options={{ dateStyle: "medium", timeStyle: "short" }} />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Badge tone={STATUS[p.status]?.tone ?? "neutral"}>{STATUS[p.status]?.label ?? p.status}</Badge>
                </div>
                {p.caption ? <p className="mt-1 line-clamp-2 text-[15px] text-ink">{p.caption}</p> : null}
                {p.tags.length ? <p className="text-sm text-ink-muted">{p.tags.map((t) => `#${t}`).join(" ")}</p> : null}
                {p.failureReason ? <p className="mt-1 text-sm text-danger">{p.failureReason}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.status === "draft" ? (
                    <>
                      <Button variant="secondary" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      <Button onClick={() => act(p, "approve")} loading={busy === `approve:${p.id}`} disabled={!available}>
                        {p.scheduledFor ? "Approve and schedule" : "Approve and publish"}
                      </Button>
                    </>
                  ) : null}
                  {p.status === "failed" ? (
                    <Button onClick={() => act(p, "retry")} loading={busy === `retry:${p.id}`} disabled={!available}>
                      Try again
                    </Button>
                  ) : null}
                  {["draft", "approved", "scheduled", "failed"].includes(p.status) ? (
                    <Button variant="ghost" onClick={() => act(p, "cancel")} loading={busy === `cancel:${p.id}`}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">
            {view === "queue" ? "Nothing waiting. Approved and scheduled publications appear here." : "No drafts. Publish a Creation from its page (Publish) to start."}
          </p>
        )}
      </section>
      ) : null}

      {view === "published" ? (
      <section aria-label="Published">
        <h2 className="mb-3 text-lg font-semibold text-ink">Published</h2>
        {history.length ? (
          <ul className="space-y-2">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-2 text-[15px] text-ink">
                <span className="min-w-0 flex-1">
                  {p.artifact?.title ?? p.title} <span className="text-ink-muted">→ {p.destinationName}</span>
                  <span className="block text-sm text-ink-muted">
                    <RelativeTime iso={p.publishedAt ?? p.updatedAt} />
                  </span>
                </span>
                <Badge tone={STATUS[p.status]?.tone ?? "neutral"}>{STATUS[p.status]?.label ?? p.status}</Badge>
                {p.externalUrl ? (
                  <a href={p.externalUrl} className={buttonClasses({ variant: "ghost", size: "sm" })} target={p.externalUrl.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
                    View <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Nothing published yet.</p>
        )}
      </section>
      ) : null}

      <section aria-label="Destinations">
        <h2 className="mb-3 text-lg font-semibold text-ink">Destinations</h2>
        <ul className="space-y-2">
          <li className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3">
            <Globe className="size-5 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 text-[15px] text-ink">
              Your Wonder Creator profile <span className="block text-sm text-ink-muted">Always available</span>
            </span>
            <Badge tone="success">Connected</Badge>
          </li>
          {destinations.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3">
              <Webhook className="size-5 text-accent" aria-hidden />
              <span className="min-w-0 flex-1 text-[15px] text-ink">
                {d.name}
                <span className="block text-sm text-ink-muted">
                  {d.host}
                  {d.lastUsedAt ? (
                    <>
                      {" · last used "}
                      <RelativeTime iso={d.lastUsedAt} />
                    </>
                  ) : null}
                </span>
              </span>
              <Badge tone={d.status === "active" ? "success" : "neutral"}>{d.status === "active" ? "Connected" : "Disconnected"}</Badge>
              {d.status === "active" ? (
                <Button variant="ghost" onClick={() => setDisconnecting({ id: d.id, name: d.name })}>
                  Disconnect
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="mt-3" onClick={() => setConnecting(true)}>
          Connect a webhook
        </Button>
        <div className="mt-4 rounded-xl bg-black/[0.03] p-3">
          <p className="text-sm font-medium text-ink">Not connected</p>
          <p className="mt-1 text-sm text-ink-muted">{unconnected.join(" · ")}: posting to these directly needs a platform connection that isn&rsquo;t set up yet. A webhook (your site, Zapier or Make) can forward to them.</p>
        </div>
      </section>

      <PreferencesForm preferences={preferences} destinations={active} onSaved={() => (setMsg("Publishing preferences saved."), router.refresh())} />

      {editing ? <EditDialog item={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={() => (setEditing(null), setMsg("Draft updated."), router.refresh())} /> : null}
      <ConnectWebhookDialog open={connecting} onOpenChange={setConnecting} onConnected={() => router.refresh()} />
      <ConfirmDialog
        open={!!disconnecting}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title={`Disconnect ${disconnecting?.name ?? "this destination"}?`}
        body="Nothing more will be sent to it. Its publishing history stays."
        confirmLabel="Disconnect"
        destructive
        onConfirm={async () => {
          if (!disconnecting) return;
          try {
            await api(`/api/v1/publishing/destinations/${disconnecting.id}`, { method: "DELETE" });
            setMsg(`${disconnecting.name} disconnected.`);
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
          }
          setDisconnecting(null);
        }}
      />
    </div>
  );
}

function PreferencesForm({ preferences, destinations, onSaved }: { preferences: Preferences; destinations: Array<{ id: string; name: string }>; onSaved: () => void }) {
  const [chosen, setChosen] = useState(preferences.defaultDestinations);
  const [tags, setTags] = useState(preferences.defaultTags.join(", "));
  const [time, setTime] = useState(preferences.preferredTime ?? "");
  const [tz, setTz] = useState(preferences.timeZone ?? "");
  const [style, setStyle] = useState(preferences.captionStyle ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A fixed list (the same on server and browser), plus whatever was saved.
  const zones = useMemo(() => [...new Set([...(preferences.timeZone ? [preferences.timeZone] : []), ...TIME_ZONES])], [preferences.timeZone]);
  const options = [{ id: "profile", name: "Your Wonder Creator profile" }, ...destinations];
  return (
    <section aria-label="Publishing preferences" className="rounded-2xl border border-border-soft bg-surface px-4 py-4 sm:px-5">
      <h2 className="text-lg font-semibold text-ink">Preferences</h2>
      <p className="text-sm text-ink-muted">These prefill each publication and guide CreativeMind&rsquo;s suggestions. They never approve or publish anything.</p>
      <form
        className="mt-3 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("/api/v1/publishing/preferences", {
              method: "PUT",
              json: { defaultDestinations: chosen, defaultTags: tags.split(",").map((t) => t.trim()).filter(Boolean), preferredTime: time || null, timeZone: tz || null, captionStyle: style || null },
            });
            onSaved();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset>
          <legend className="text-sm font-medium text-ink">Default destinations</legend>
          {options.map((o) => (
            <label key={o.id} className="flex min-h-11 items-center gap-2 text-[15px] text-ink">
              <input type="checkbox" checked={chosen.includes(o.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, o.id] : c.filter((x) => x !== o.id)))} className="size-5 accent-[var(--color-accent)]" />
              {o.name}
            </label>
          ))}
        </fieldset>
        <Field label="Default tags" htmlFor="pref-tags" hint="Comma-separated, without #.">
          <Input id="pref-tags" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={400} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred time" htmlFor="pref-time" hint="Used when CreativeMind suggests a schedule.">
            <Input id="pref-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Time zone" htmlFor="pref-tz">
            <Select id="pref-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
              <option value="">Not set</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Caption style" htmlFor="pref-style" hint="Notes for CreativeMind, e.g. “short, no emojis, always credit collaborators”.">
          <Textarea id="pref-style" value={style} onChange={(e) => setStyle(e.target.value)} maxLength={500} className="min-h-16" />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={busy}>
          Save preferences
        </Button>
      </form>
    </section>
  );
}

function EditDialog({ item, onOpenChange, onSaved }: { item: Item; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={`Edit for ${item.destinationName}`} description="Changes apply to this destination only. Approving fixes the copy and the current version." wide>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/publications/${item.id}`, {
                method: "PATCH",
                json: { title, caption: caption || null, description: description || null, metadata: { tags: tags.split(",").map((t) => t.trim()).filter(Boolean) } },
              });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Title" htmlFor="edit-title">
            <Input id="edit-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Caption" htmlFor="edit-caption">
            <Textarea id="edit-caption" value={caption} maxLength={2200} rows={3} onChange={(e) => setCaption(e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="edit-description">
            <Textarea id="edit-description" value={description} maxLength={5000} rows={4} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Tags" htmlFor="edit-tags" hint="Comma-separated, without #.">
            <Input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={400} />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save draft
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
