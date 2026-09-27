"use client";
import { Badge, Button, ConfirmDialog, Field, Input, StickyActions, Textarea, cn } from "@wonder/ui";
import { ArrowUpRight, Check, CircleAlert, Globe, Loader, Sparkles, Webhook } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LocalTime, RelativeTime } from "@/components/client-time";
import { ConnectWebhookDialog as ConnectDialog } from "@/components/connect-webhook-dialog";
import { api, errorMessage } from "@/lib/client";

type Destination = { id: string; name: string; url: string; secret: string };
type Attempt = { attempt_no: number; started_at: string; finished_at: string | null; outcome: string | null; http_status: number | null; error: string | null };
type Publication = {
  id: string;
  destination_kind: string;
  destination_name: string;
  title: string;
  caption: string | null;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  external_url: string | null;
  failure_reason: string | null;
  attempts: number;
  created_at: string;
  publication_attempts: Attempt[];
};

const STEPS = ["Where", "Details", "Review & schedule", "Publish"] as const;
const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  draft: { label: "Draft, not approved", tone: "neutral" },
  approved: { label: "Approved", tone: "accent" },
  scheduled: { label: "Scheduled", tone: "accent" },
  publishing: { label: "Publishing…", tone: "accent" },
  published: { label: "Published", tone: "success" },
  failed: { label: "Didn't go through", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function PublishFlow(props: {
  artifact: { id: string; title: string; description: string | null; archived: boolean; hasContent: boolean };
  handle: string | null;
  destinations: Destination[];
  unconnected: string[];
  initialPublications: Publication[];
  available: boolean;
  preferences: { defaultDestinations: string[]; defaultTags: string[] };
}) {
  const { artifact } = props;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [destinations, setDestinations] = useState(props.destinations);
  // "profile" or destination ids; your default destinations are preselected.
  const [chosen, setChosen] = useState<string[]>(() => props.preferences.defaultDestinations.filter((k) => k === "profile" || props.destinations.some((d) => d.id === k)));
  const [tags, setTags] = useState(props.preferences.defaultTags.join(", "));
  const [perDest, setPerDest] = useState<Record<string, { caption?: string; tags?: string[]; at?: string | null }>>({});
  const [plan, setPlan] = useState<{ reasons: Array<{ key: string; why: string }>; notes: string[]; offline: boolean; timed: boolean } | null>(null);
  const [title, setTitle] = useState(artifact.title);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState(artifact.description ?? "");
  const [when, setWhen] = useState<"now" | "later" | "suggested">("now");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<string | null>(null);
  const [results, setResults] = useState<Publication[] | null>(null);
  const [publications, setPublications] = useState(props.initialPublications);
  const [connectOpen, setConnectOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const dirty = step > 0 && !results;

  // Leaving mid-flow loses the unsaved draft: warn first.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  async function reload() {
    setPublications((await api<{ publications: Publication[] }>(`/api/v1/artifacts/${artifact.id}/publications`)).publications);
  }

  const scheduledFor = when === "later" && at ? new Date(at).toISOString() : null;
  const canNext = step === 0 ? chosen.length > 0 : step === 1 ? !!title.trim() : step === 2 ? when !== "later" || !!at : false;
  const nameOf = (k: string) => (k === "profile" ? "Your Wonder Creator profile" : (destinations.find((d) => d.id === k)?.name ?? "A destination"));
  const parseTags = (t: string) => t.split(",").map((x) => x.replace(/^#+/, "").trim()).filter(Boolean).slice(0, 10);

  async function planWithBrain() {
    setBusy("plan");
    setError(null);
    try {
      const r = await api<{
        destinations: Array<{ key: string; why: string }>;
        adaptations: Array<{ key: string; caption?: string | null; tags?: string[] }>;
        schedule: Array<{ key: string; at: string | null; why?: string }>;
        notes: string[];
        offline: boolean;
      }>(`/api/v1/artifacts/${artifact.id}/publications/plan`, { method: "POST" });
      if (r.destinations.length) setChosen(r.destinations.map((d) => d.key));
      const next: Record<string, { caption?: string; tags?: string[]; at?: string | null }> = {};
      for (const a of r.adaptations) next[a.key] = { ...next[a.key], ...(a.caption ? { caption: a.caption } : {}), ...(a.tags?.length ? { tags: a.tags } : {}) };
      for (const x of r.schedule) next[x.key] = { ...next[x.key], at: x.at };
      setPerDest(next);
      const timed = r.schedule.some((x) => x.at);
      if (timed) setWhen("suggested");
      setPlan({ reasons: [...r.destinations, ...r.schedule.filter((x) => x.why).map((x) => ({ key: x.key, why: x.why! }))], notes: r.notes, offline: r.offline, timed });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setError(null);
    try {
      const { publications: drafts } = await api<{ publications: Publication[] }>(`/api/v1/artifacts/${artifact.id}/publications`, {
        method: "POST",
        json: {
          destinations: chosen.map((c) => (c === "profile" ? { kind: "profile" } : { kind: "webhook", id: c })),
          title,
          caption,
          description,
          scheduledFor,
          preparedBy: drafted || plan ? "creatorbrain" : "creator",
          metadata: parseTags(tags).length ? { tags: parseTags(tags) } : {},
          perDestination: Object.fromEntries(
            chosen.map((k) => {
              const o = perDest[k] ?? {};
              return [
                k,
                {
                  ...(o.caption?.trim() ? { caption: o.caption.trim() } : {}),
                  ...(o.tags?.length ? { metadata: { tags: o.tags } } : {}),
                  ...(when === "suggested" && o.at ? { scheduledFor: o.at } : {}),
                },
              ];
            }),
          ),
        },
      });
      setStep(3);
      // Each destination is approved and attempted on its own: one failing doesn't stop the others.
      const out: Publication[] = [];
      for (const d of drafts) {
        try {
          out.push((await api<{ publication: Publication }>(`/api/v1/publications/${d.id}`, { method: "POST", json: { action: "approve" } })).publication);
        } catch (e) {
          out.push({ ...d, status: "failed", failure_reason: errorMessage(e) });
        }
        setResults([...out]);
      }
      await reload();
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, action: "approve" | "retry" | "cancel") {
    setBusy(`${action}:${id}`);
    setError(null);
    try {
      const { publication } = await api<{ publication: Publication }>(`/api/v1/publications/${id}`, { method: "POST", json: { action } });
      setResults((r) => (r ? r.map((x) => (x.id === id ? { ...x, ...publication } : x)) : r));
      await reload();
    } catch (e) {
      setError(errorMessage(e));
      await reload().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  const blocked = artifact.archived ? "This Creation is archived. Restore it to publish." : !artifact.hasContent ? "Write something first — there's nothing to publish yet." : !props.available ? "Publishing isn't set up on this server yet." : null;

  return (
    <div className="mx-auto max-w-2xl">
      {dirty ? (
        <button type="button" onClick={() => setLeaveOpen(true)} className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
          ← {artifact.title}
        </button>
      ) : (
        <Link href={`/artifacts/${artifact.id}`} className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
          ← {artifact.title}
        </Link>
      )}
      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">Publish</h1>
      <p className="mt-1 text-[15px] text-ink-muted">Nothing goes out until you approve it, and it&apos;s shown as published only once the destination confirms.</p>

      {blocked ? <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-[15px] text-warning-ink">{blocked}</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {!blocked ? (
        <section aria-labelledby="flow-h" className="mt-6 rounded-2xl border border-border-soft bg-surface p-5">
          <ol className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined} className={cn(i === step ? "font-semibold text-accent-ink" : i < step ? "text-ink" : "text-ink-subtle")}>
                {i + 1}. {s}
              </li>
            ))}
          </ol>
          <h2 id="flow-h" className="text-lg font-semibold text-ink">
            {STEPS[step]}
          </h2>

          {step === 0 ? (
            <div className="mt-3 space-y-2">
              <Button variant="soft" size="sm" loading={busy === "plan"} onClick={planWithBrain}>
                <Sparkles className="size-4" aria-hidden /> Plan with CreativeMind
              </Button>
              {plan ? (
                <div role="status" className="rounded-xl bg-accent-softer p-3 text-sm text-ink">
                  <p className="font-medium">CreativeMind suggests — nothing is prepared or sent until you approve.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {plan.reasons.map((r, i) => (
                      <li key={`${r.key}-${i}`}>
                        {nameOf(r.key)}: {r.why}
                      </li>
                    ))}
                    {plan.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Choice id="profile" checked={chosen.includes("profile")} onChange={(on) => setChosen((c) => (on ? [...c, "profile"] : c.filter((x) => x !== "profile")))} icon={<Globe className="size-5" aria-hidden />} label="Your Wonder Creator profile" note="Public, shown on your profile to people who can see it." />
              {destinations.map((d) => (
                <Choice key={d.id} id={d.id} checked={chosen.includes(d.id)} onChange={(on) => setChosen((c) => (on ? [...c, d.id] : c.filter((x) => x !== d.id)))} icon={<Webhook className="size-5" aria-hidden />} label={d.name} note={new URL(d.url).host} />
              ))}
              <Button variant="secondary" size="sm" onClick={() => setConnectOpen(true)}>
                Connect a webhook
              </Button>
              <div className="mt-4 rounded-xl bg-black/[0.03] p-3">
                <p className="text-sm font-medium text-ink">Not connected</p>
                <p className="mt-1 text-sm text-ink-muted">{props.unconnected.join(" · ")}: posting to these directly needs a platform connection that isn&apos;t set up yet. A webhook (your site, Zapier or Make) can forward to them.</p>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="mt-3 space-y-4">
              <Button
                variant="soft"
                size="sm"
                loading={busy === "copy"}
                onClick={async () => {
                  setBusy("copy");
                  setError(null);
                  try {
                    const c = await api<{ title: string; caption: string; description: string; offline: boolean }>(`/api/v1/artifacts/${artifact.id}/publications/copy`, { method: "POST" });
                    setTitle(c.title);
                    setCaption(c.caption);
                    setDescription(c.description);
                    setDrafted(c.offline ? "CreativeMind drafted this in offline development mode. Edit it before you publish." : "CreativeMind drafted this. Edit anything before you publish.");
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Sparkles className="size-4" aria-hidden /> Draft with CreativeMind
              </Button>
              {drafted ? (
                <p role="status" className="text-sm text-ink-muted">
                  {drafted}
                </p>
              ) : null}
              <Field label="Title" htmlFor="pub-title">
                <Input id="pub-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Caption" htmlFor="pub-caption" hint="A line or two to go with it.">
                <Textarea id="pub-caption" value={caption} maxLength={2200} rows={3} onChange={(e) => setCaption(e.target.value)} />
              </Field>
              <Field label="Description" htmlFor="pub-description">
                <Textarea id="pub-description" value={description} maxLength={5000} rows={4} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Tags" htmlFor="pub-tags" hint="Comma-separated, without #. Sent to each destination.">
                <Input id="pub-tags" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={400} />
              </Field>
              {chosen.length > 1 ? (
                <details className="rounded-xl border border-border-soft px-3" open={Object.values(perDest).some((o) => o.caption)}>
                  <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-medium text-ink">Customize for each destination</summary>
                  <div className="space-y-3 pb-3">
                    {chosen.map((k) => (
                      <Field key={k} label={`Caption for ${nameOf(k)}`} htmlFor={`pub-caption-${k}`} hint="Leave empty to use the caption above.">
                        <Textarea
                          id={`pub-caption-${k}`}
                          value={perDest[k]?.caption ?? ""}
                          maxLength={2200}
                          rows={2}
                          onChange={(e) => setPerDest((p) => ({ ...p, [k]: { ...p[k], caption: e.target.value } }))}
                        />
                      </Field>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-3 space-y-4">
              <dl className="space-y-3 rounded-xl bg-black/[0.03] p-4 text-[15px]">
                <div>
                  <dt className="text-sm text-ink-muted">Going to</dt>
                  <dd className="text-ink">{chosen.map((c) => (c === "profile" ? "Your Wonder Creator profile" : destinations.find((d) => d.id === c)?.name)).join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Title</dt>
                  <dd className="text-ink">{title}</dd>
                </div>
                {caption ? (
                  <div>
                    <dt className="text-sm text-ink-muted">Caption</dt>
                    <dd className="whitespace-pre-wrap text-ink">{caption}</dd>
                  </div>
                ) : null}
                {chosen.includes("profile") ? (
                  <div>
                    <dt className="text-sm text-ink-muted">On your profile</dt>
                    <dd className="text-ink">The Creation becomes public and marked published{props.handle ? ` on @${props.handle}` : ""}. Your source material stays private.</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-sm text-ink-muted">Version</dt>
                  <dd className="text-ink">The current version, fixed when you approve.</dd>
                </div>
              </dl>
              <fieldset>
                <legend className="text-sm font-medium text-ink">When</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex min-h-11 items-center gap-2 text-[15px]">
                    <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="size-5 accent-[var(--color-accent)]" /> Now
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-[15px]">
                    <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="size-5 accent-[var(--color-accent)]" /> Later
                  </label>
                  {plan?.timed ? (
                    <label className="flex min-h-11 items-center gap-2 text-[15px]">
                      <input type="radio" name="when" checked={when === "suggested"} onChange={() => setWhen("suggested")} className="size-5 accent-[var(--color-accent)]" /> As CreativeMind suggested
                    </label>
                  ) : null}
                </div>
              </fieldset>
              {when === "suggested" ? (
                <ul className="space-y-1 text-[15px] text-ink">
                  {chosen.map((k) => (
                    <li key={k}>
                      {nameOf(k)}: {perDest[k]?.at ? <LocalTime iso={perDest[k]!.at!} options={{ dateStyle: "medium", timeStyle: "short" }} /> : "now"}
                    </li>
                  ))}
                </ul>
              ) : null}
              {when === "later" ? (
                <Field label="Publish at" htmlFor="pub-at" hint="Scheduled publications are sent by our publishing run once this time has passed; it runs daily, so allow up to a day.">
                  <Input id="pub-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <ul className="mt-3 space-y-3" aria-live="polite">
              {(results ?? []).map((p) => (
                <ResultRow key={p.id} p={p} busy={busy} onRetry={() => act(p.id, "retry")} onApprove={() => act(p.id, "approve")} />
              ))}
              {busy === "publish" ? (
                <li className="flex items-center gap-2 text-[15px] text-ink-muted">
                  <Loader className="size-4 motion-safe:animate-spin" aria-hidden /> Publishing…
                </li>
              ) : null}
            </ul>
          ) : null}

          {step < 3 ? (
            <StickyActions className="mt-6 flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Back
              </Button>
              {step < 2 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={publish} loading={busy === "publish"} disabled={!canNext}>
                  {when === "now" ? "Approve and publish" : "Approve and schedule"}
                </Button>
              )}
            </StickyActions>
          ) : !busy ? (
            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setResults(null);
                  setChosen([]);
                  setDrafted(null);
                  setPlan(null);
                  setPerDest({});
                  setStep(0);
                }}
              >
                Publish somewhere else
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="history-h" className="mt-8">
        <h2 id="history-h" className="text-lg font-semibold text-ink">
          Publication history
        </h2>
        <p className="text-sm text-ink-muted">
          Everything you&rsquo;re publishing, across Creations, is in{" "}
          <Link href="/publishing" className="font-medium text-accent-ink hover:underline">
            Publishing
          </Link>
          .
        </p>
        {publications.length ? (
          <ul className="mt-3 space-y-3">
            {publications.map((p) => (
              <ResultRow key={p.id} p={p} busy={busy} history onRetry={() => act(p.id, "retry")} onApprove={() => act(p.id, "approve")} onCancel={() => act(p.id, "cancel")} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-ink-muted">This Creation hasn&apos;t been published anywhere yet.</p>
        )}
      </section>

      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={(d) => {
          setDestinations((x) => [d, ...x]);
          setChosen((c) => [...c, d.id]);
        }}
      />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave without publishing?"
        body="What you've set up here isn't saved yet."
        confirmLabel="Leave"
        destructive
        onConfirm={() => router.push(`/artifacts/${artifact.id}`)}
      />
    </div>
  );
}

function Choice({ id, checked, onChange, icon, label, note }: { id: string; checked: boolean; onChange: (on: boolean) => void; icon: React.ReactNode; label: string; note: string }) {
  return (
    <label htmlFor={`dest-${id}`} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3", checked ? "border-accent bg-accent-softer" : "border-border-soft hover:bg-black/[0.02]")}>
      <input id={`dest-${id}`} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
      <span className="text-ink-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        <span className="block truncate text-sm text-ink-muted">{note}</span>
      </span>
    </label>
  );
}

function ResultRow({ p, busy, history, onRetry, onApprove, onCancel }: { p: Publication; busy: string | null; history?: boolean; onRetry: () => void; onApprove: () => void; onCancel?: () => void }) {
  const s = STATUS[p.status] ?? STATUS.draft;
  const icon = p.status === "published" ? <Check className="size-4" aria-hidden /> : p.status === "failed" ? <CircleAlert className="size-4" aria-hidden /> : null;
  return (
    <li className="rounded-2xl border border-border-soft bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink">{p.destination_name}</p>
          <p className="text-sm text-ink-muted">
            {p.title}
            {history ? (
              <>
                {" · "}
                <RelativeTime iso={p.published_at ?? p.created_at} />
              </>
            ) : null}
          </p>
        </div>
        <Badge tone={s.tone}>
          {icon}
          {s.label}
        </Badge>
      </div>
      {p.status === "scheduled" && p.scheduled_for ? (
        <p className="mt-2 text-sm text-ink-muted">
          Goes out after <LocalTime iso={p.scheduled_for} />.
        </p>
      ) : null}
      {p.status === "failed" && p.failure_reason ? <p className="mt-2 text-sm text-danger">{p.failure_reason}</p> : null}
      {p.status === "published" && p.external_url ? (
        <a href={p.external_url} target={p.external_url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
          See it <ArrowUpRight className="size-4" aria-hidden />
        </a>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {p.status === "failed" ? (
          <Button size="sm" variant="secondary" onClick={onRetry} loading={busy === `retry:${p.id}`} disabled={!!busy}>
            Try again
          </Button>
        ) : null}
        {history && p.status === "draft" ? (
          <Button size="sm" variant="secondary" onClick={onApprove} loading={busy === `approve:${p.id}`} disabled={!!busy}>
            Approve and publish
          </Button>
        ) : null}
        {history && onCancel && ["draft", "scheduled", "failed"].includes(p.status) ? (
          <Button size="sm" variant="ghost" onClick={onCancel} loading={busy === `cancel:${p.id}`} disabled={!!busy}>
            Cancel
          </Button>
        ) : null}
      </div>
      {history && p.publication_attempts?.length ? (
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-muted">
            {p.publication_attempts.length} attempt{p.publication_attempts.length === 1 ? "" : "s"}
          </summary>
          <ul className="space-y-1 text-sm text-ink-muted">
            {p.publication_attempts.map((a) => (
              <li key={a.attempt_no}>
                #{a.attempt_no} · {a.outcome === "succeeded" ? "confirmed" : a.outcome === "failed" ? `failed${a.error ? `: ${a.error}` : ""}` : "in progress"} · <RelativeTime iso={a.started_at} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
