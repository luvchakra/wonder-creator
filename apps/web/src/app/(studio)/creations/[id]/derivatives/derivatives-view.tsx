"use client";
import type { DerivativeView, PublicationDerivativePreset } from "@wonder/creator-studio";
import { Badge, Button, PageTitle, buttonClasses, EmptyNote, KIT } from "@wonder/ui";
import { GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";
import { BackLink } from "@/components/back-link";

const PUB_STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  approved: { label: "Approved", tone: "accent" },
  scheduled: { label: "Scheduled", tone: "accent" },
  publishing: { label: "Publishing…", tone: "accent" },
  published: { label: "Published", tone: "success" },
  failed: { label: "Didn't go through", tone: "danger" },
};

export function DerivativesView({
  source,
  presets,
  derivatives,
}: {
  source: { id: string; title: string; typeLabel: string; version: number | null; hasContent: boolean; attributionRequired: boolean };
  presets: PublicationDerivativePreset[];
  derivatives: DerivativeView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink home={`/creations/${source.id}`} homeLabel={source.title} />
      <PageTitle art={KIT.painted.coralLeaves} title="Derivatives" subtitle="Platform adaptations are Creations in their own right: each keeps a link to the version it came from, inherits its rights, and is published only after you approve it." />

      <section aria-label="Source" className="rounded-2xl border border-border-soft bg-surface px-4 py-3">
        <p className="text-sm text-ink-subtle">Source</p>
        <p className="font-medium text-ink">
          {source.title} <span className="text-ink-muted">· {source.typeLabel}</span>
          {source.version ? <span className="text-ink-muted"> · v{source.version}</span> : null}
        </p>
        <p className="text-sm text-ink-muted">New derivatives are made from the current version.{source.attributionRequired ? " Credit is required, and carries over." : ""}</p>
      </section>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? (
        <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">
          {msg} {offline ? "AI isn't connected, so the draft is a placeholder to edit." : ""}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      <section aria-label="Make a derivative">
        <h2 className="mb-3 text-lg font-semibold text-ink">Make one for a platform</h2>
        {presets.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {presets.map((p) => (
              <li key={p.key} className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-3">
                <p className="font-medium text-ink">
                  {p.label} <Badge tone="neutral">{p.madeFor}</Badge>
                </p>
                <p className="text-sm text-ink-muted">{p.instruction}</p>
                <Button
                  variant="secondary"
                  className="mt-auto self-start"
                  loading={busy === p.key}
                  disabled={!source.hasContent || !!busy}
                  onClick={async () => {
                    setBusy(p.key);
                    setError(null);
                    try {
                      const r = await api<{ artifact: { id: string; title: string }; offline: boolean }>(`/api/v1/artifacts/${source.id}/transform`, {
                        method: "POST",
                        json: { targetType: p.targetType, instruction: p.instruction, madeFor: p.madeFor },
                      });
                      setOffline(r.offline);
                      setMsg(`Made “${r.artifact.title}” for ${p.madeFor}. Review it before publishing.`);
                      router.refresh();
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Sparkles className="size-4" aria-hidden /> Make {p.label.toLowerCase()}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No platform adaptations suit this kind of Creation yet.</p>
        )}
      </section>

      <section aria-label="Derivatives of this Creation">
        <h2 className="mb-3 text-lg font-semibold text-ink">Made from this Creation</h2>
        {derivatives.length ? (
          <ul className="space-y-3">
            {derivatives.map((d) => (
              <li key={d.id} className="rounded-2xl border border-border-soft bg-surface px-4 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{d.title}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
                      <GitBranch className="size-4" aria-hidden /> {d.typeLabel}
                      {d.sourceVersion ? ` · from v${d.sourceVersion}` : ""} · <RelativeTime iso={d.createdAt} />
                    </p>
                  </div>
                  {d.madeFor ? <Badge tone="accent">For {d.madeFor}</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {d.rights?.attributionRequired ? "Credit required (inherited)" : "Credit optional"} · {d.rights?.derivativesAllowed ? "Further derivatives allowed" : "No further derivatives by others"}
                </p>
                {d.publications.length ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={`Where ${d.title} is published`}>
                    {d.publications.map((p) => (
                      <li key={p.id}>
                        <Badge tone={PUB_STATUS[p.status]?.tone ?? "neutral"}>
                          {p.destination}: {PUB_STATUS[p.status]?.label ?? p.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">Not published yet.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={`/creations/${d.id}`} className={buttonClasses({ variant: "secondary" })} aria-label={`Review ${d.title}`}>
                    Review
                  </Link>
                  <Link href={`/creations/${d.id}/publish`} className={buttonClasses({ variant: "ghost" })} aria-label={`Publish ${d.title}`}>
                    Publish
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote art={KIT.painted.coralLeaves}>Nothing made from this Creation yet.</EmptyNote>
        )}
      </section>
    </div>
  );
}
