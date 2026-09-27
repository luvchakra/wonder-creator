"use client";
import { Badge, Button, ConfirmDialog, Field, Input, Select, Switch } from "@wonder/ui";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";

type Provider = { id: "gemini" | "anthropic"; name: string; keyLabel: string; keyHelp: string; dataUse: string };
type Key = { provider: string; hint: string; status: "valid" | "unverified" | "invalid"; models: string[]; defaultModel: string | null; useForBrain: boolean; validatedAt: string | null; lastError: string | null; connectedAt: string; rotatedAt: string | null };

const STATUS: Record<Key["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
  valid: { label: "Working", tone: "success" },
  unverified: { label: "Not checked yet", tone: "warning" },
  invalid: { label: "Not accepted", tone: "danger" },
};
const FAILURE: Record<string, string> = {
  provider_unavailable: "The AI service wasn't available",
  provider_failed: "The AI service didn't return a usable answer",
  rate_limited: "The AI service asked us to slow down",
};

export function AiProviders(props: {
  providers: Provider[];
  initialKeys: Key[];
  platform: { live: boolean; note: string };
  inUse: { source: "own_key" | "platform"; provider: string | null };
  lastFailure: { code: string; at: string | null } | null;
  byokAvailable: boolean;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(props.initialKeys);
  const byProvider = new Map(keys.map((k) => [k.provider, k]));
  const inUseName = props.inUse.source === "own_key" ? `your ${props.providers.find((p) => p.id === props.inUse.provider)?.name ?? ""} key` : "Wonder Creator's provider";

  function upsert(k: Key) {
    setKeys((ks) => [...ks.filter((x) => x.provider !== k.provider).map((x) => (k.useForBrain ? { ...x, useForBrain: false } : x)), k]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section aria-label="Status" className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border-soft bg-surface p-4">
          <p className="text-sm text-ink-muted">CreativeMind uses</p>
          <p className="mt-1 text-lg font-semibold text-ink">{inUseName.charAt(0).toUpperCase() + inUseName.slice(1)}</p>
        </div>
        <div className="rounded-2xl border border-border-soft bg-surface p-4">
          <p className="text-sm text-ink-muted">Wonder Creator&apos;s provider</p>
          <p className="mt-1 flex items-center gap-2 text-[15px] text-ink">
            <Badge tone={props.platform.live ? "success" : "warning"}>{props.platform.live ? "Connected" : "Not connected"}</Badge>
          </p>
          <p className="mt-1 text-sm text-ink-muted">{props.platform.note}</p>
        </div>
        {props.lastFailure ? (
          <div className="rounded-2xl border border-warning bg-warning-soft p-4 sm:col-span-2" role="status">
            <p className="text-[15px] font-medium text-ink">Recent problem: {FAILURE[props.lastFailure.code] ?? "The AI service had a problem"}</p>
            <p className="text-sm text-ink-muted">{props.lastFailure.at ? <RelativeTime iso={props.lastFailure.at} /> : null} Your material was kept; you can retry the run.</p>
          </div>
        ) : null}
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-surface-muted p-4 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Keys are stored encrypted and are never shown again after you save them — only their last four characters. They&apos;re used only to run CreativeMind for you, never
        logged, and you can rotate or remove them any time. Search indexing always uses Wonder Creator&apos;s provider.
      </p>

      {!props.byokAvailable ? <p className="rounded-xl bg-warning-soft px-4 py-3 text-[15px] text-warning-ink">Connecting your own key isn&apos;t set up on this server yet.</p> : null}

      {props.providers.map((p) => (
        <ProviderCard key={p.id} p={p} k={byProvider.get(p.id) ?? null} disabled={!props.byokAvailable} onSaved={upsert} onRemoved={() => (setKeys((ks) => ks.filter((x) => x.provider !== p.id)), router.refresh())} />
      ))}
    </div>
  );
}

function ProviderCard({ p, k, disabled, onSaved, onRemoved }: { p: Provider; k: Key | null; disabled: boolean; onSaved: (k: Key) => void; onRemoved: () => void }) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [editing, setEditing] = useState(!k);

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={`p-${p.id}`} className="rounded-2xl border border-border-soft bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`p-${p.id}`} className="flex items-center gap-2 text-lg font-semibold text-ink">
          <KeyRound className="size-5 text-ink-muted" aria-hidden /> {p.name}
        </h2>
        {k ? <Badge tone={STATUS[k.status].tone}>{STATUS[k.status].label}</Badge> : <Badge>Not connected</Badge>}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{p.dataUse}</p>

      {k ? (
        <dl className="mt-4 grid gap-2 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">Key</dt>
            <dd className="font-mono text-ink">{k.hint}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Last checked</dt>
            <dd className="text-ink">{k.validatedAt ? <RelativeTime iso={k.validatedAt} /> : "Not yet"}</dd>
          </div>
          {k.lastError ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-ink-muted">Last problem</dt>
              <dd className="text-danger">{k.lastError}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {k ? (
        <div className="mt-4 space-y-3">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <label htmlFor={`use-${p.id}`} className="text-[15px] text-ink">
              Use this key for CreativeMind
            </label>
            <Switch
              id={`use-${p.id}`}
              checked={k.useForBrain}
              disabled={!!busy || k.status === "invalid"}
              onCheckedChange={(v) => act("use", async () => onSaved((await api<{ key: Key }>(`/api/v1/ai/keys/${p.id}`, { method: "PATCH", json: { useForBrain: v } })).key))}
              label="Use this key for CreativeMind"
            />
          </div>
          {k.models.length ? (
            <Field label="Model" htmlFor={`model-${p.id}`} hint="Models your key can use. “Recommended” lets Wonder Creator pick.">
              <Select
                id={`model-${p.id}`}
                value={k.defaultModel ?? ""}
                disabled={!!busy}
                onChange={(e) => act("model", async () => onSaved((await api<{ key: Key }>(`/api/v1/ai/keys/${p.id}`, { method: "PATCH", json: { defaultModel: e.target.value || null } })).key))}
              >
                <option value="">Recommended</option>
                {k.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "check"}
              onClick={() =>
                act("check", async () => {
                  const r = await api<{ key: Key; check: { status: string; message?: string } }>(`/api/v1/ai/keys/${p.id}/validate`, { method: "POST" });
                  onSaved(r.key);
                  setNotice(r.check.status === "valid" ? "The key works." : (r.check.message ?? "Checked."));
                })
              }
            >
              Check again
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing((x) => !x)}>
              {editing ? "Keep current key" : "Replace key"}
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setRemoveOpen(true)}>
              Remove
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <form
          className="mt-4 space-y-3"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            void act("save", async () => {
              const r = await api<{ key: Key; check: { status: string; message?: string } }>("/api/v1/ai/keys", { method: "POST", json: { provider: p.id, key: secret } });
              setSecret("");
              setEditing(false);
              onSaved(r.key);
              setNotice(r.check.status === "valid" ? "Connected. The key works." : `Saved, but not checked yet: ${r.check.message ?? ""}`);
            });
          }}
        >
          <Field label={k ? `New ${p.keyLabel}` : p.keyLabel} htmlFor={`key-${p.id}`} hint={p.keyHelp}>
            <Input id={`key-${p.id}`} type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(e) => setSecret(e.target.value)} disabled={disabled} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={busy === "save"} disabled={disabled || secret.trim().length < 10}>
              {k ? "Check and replace" : "Check and connect"}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-3 text-sm text-ink">
          {notice}
        </p>
      ) : null}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        destructive
        title={`Remove your ${p.name} key?`}
        body="The key is deleted from Wonder Creator. CreativeMind goes back to Wonder Creator's provider."
        confirmLabel="Remove key"
        busy={busy === "remove"}
        onConfirm={() =>
          act("remove", async () => {
            await api(`/api/v1/ai/keys/${p.id}`, { method: "DELETE" });
            setRemoveOpen(false);
            setEditing(true);
            onRemoved();
          })
        }
      />
    </section>
  );
}
