"use client";
import type { ShareView } from "@wonder/creator-studio";
import { Badge, Button, ConfirmDialog, Field, Input, Select, Switch } from "@wonder/ui";
import { Check, Copy, Link2, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";

type Version = { id: string; number: number; label: string; current: boolean };
const EXPIRY = [
  { value: "", label: "Never" },
  { value: "1", label: "In 1 day" },
  { value: "7", label: "In 7 days" },
  { value: "30", label: "In 30 days" },
] as const;

function expiresAt(days: string): string | null {
  return days ? new Date(Date.now() + Number(days) * 86400_000).toISOString() : null;
}

export function ShareManager({ artifact, versions, initialShares }: { artifact: { id: string; title: string; isPublic: boolean; archived: boolean }; versions: Version[]; initialShares: ShareView[] }) {
  const [shares, setShares] = useState(initialShares);
  const [revoking, setRevoking] = useState<ShareView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = shares.filter((s) => s.state === "live");
  const past = shares.filter((s) => s.state !== "live");

  async function reload() {
    setShares((await api<{ shares: ShareView[] }>(`/api/v1/artifacts/${artifact.id}/shares`)).shares);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/artifacts/${artifact.id}`} className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
        ← {artifact.title}
      </Link>
      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">Share</h1>
      <p className="mt-1 text-[15px] text-ink-muted">
        {artifact.isPublic ? "This Creation is public on your profile." : "This Creation is private."} Links and shares below show only the Creation itself, never your source material.
      </p>
      {artifact.archived ? <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-[15px] text-warning-ink">This Creation is archived, so its shares don&apos;t open until you restore it.</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      <LinkForm artifactId={artifact.id} versions={versions} onCreated={reload} onError={setError} />
      <PersonForm artifactId={artifact.id} versions={versions} onCreated={reload} onError={setError} />

      <section aria-labelledby="live-h" className="mt-8">
        <h2 id="live-h" className="text-lg font-semibold text-ink">
          Shared now
        </h2>
        {live.length ? (
          <ul className="mt-3 divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {live.map((s) => (
              <ShareRow key={s.id} s={s} action={<Button size="sm" variant="ghost" onClick={() => setRevoking(s)}>Revoke</Button>} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-ink-muted">Nothing is shared yet.</p>
        )}
      </section>

      {past.length ? (
        <details className="mt-6">
          <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-medium text-accent-ink">Ended shares ({past.length})</summary>
          <ul className="mt-2 divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {past.map((s) => (
              <ShareRow key={s.id} s={s} />
            ))}
          </ul>
        </details>
      ) : null}

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this share?"
        body={revoking?.kind === "link" ? "The link stops working right away for everyone who has it. You can make a new link later." : `${revoking?.recipient?.name ?? "They"} will no longer be able to open this Creation.`}
        confirmLabel="Revoke"
        destructive
        busy={busy === "revoke"}
        onConfirm={async () => {
          if (!revoking) return;
          setBusy("revoke");
          setError(null);
          try {
            await api(`/api/v1/shares/${revoking.id}`, { method: "DELETE" });
            await reload();
            setRevoking(null);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(null);
          }
        }}
      />
    </div>
  );
}

function ShareRow({ s, action }: { s: ShareView; action?: React.ReactNode }) {
  const who = s.kind === "link" ? (s.label ?? "Private link") : `${s.recipient?.name ?? "A creator"}${s.recipient?.handle ? ` (@${s.recipient.handle})` : ""}`;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {s.kind === "link" ? <Link2 className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden /> : <UserRound className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-ink">{who}</p>
        <p className="text-sm text-ink-muted">
          {s.versionNumber ? `Version ${s.versionNumber}` : "Latest version"} · {s.allowDownload ? "can download" : "view only"}
          {s.allowEmbed ? " · embeddable" : ""}
          {" · "}
          {s.state === "revoked" ? "revoked" : s.state === "expired" ? "expired" : s.expiresAt ? (
            <>
              ends <RelativeTime iso={s.expiresAt} />
            </>
          ) : (
            "no end date"
          )}
          {s.lastAccessedAt ? (
            <>
              {" · opened "}
              <RelativeTime iso={s.lastAccessedAt} />
            </>
          ) : null}
        </p>
      </div>
      {s.state !== "live" ? <Badge>{s.state === "revoked" ? "Revoked" : "Expired"}</Badge> : null}
      {action}
    </li>
  );
}

function VersionSelect({ id, versions, value, onChange }: { id: string; versions: Version[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Version" htmlFor={id} hint="“Latest” follows your edits; a numbered version stays as it is.">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Latest</option>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            Version {v.number}
            {v.current ? " (current)" : ""} · {v.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function LinkForm({ artifactId, versions, onCreated, onError }: { artifactId: string; versions: Version[]; onCreated: () => Promise<void>; onError: (e: string | null) => void }) {
  const [versionId, setVersionId] = useState("");
  const [days, setDays] = useState("7");
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowEmbed, setAllowEmbed] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ url: string; embedUrl: string | null } | null>(null);
  return (
    <section aria-labelledby="link-h" className="mt-6 rounded-2xl border border-border-soft bg-surface p-5">
      <h2 id="link-h" className="text-lg font-semibold text-ink">
        Private link
      </h2>
      <p className="mt-1 text-[15px] text-ink-muted">Anyone with the link can read the Creation, without signing in. It isn&apos;t listed anywhere.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <VersionSelect id="link-version" versions={versions} value={versionId} onChange={setVersionId} />
        <Field label="Link ends" htmlFor="link-expiry">
          <Select id="link-expiry" value={days} onChange={(e) => setDays(e.target.value)}>
            {EXPIRY.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name (optional)" htmlFor="link-label" hint="Only you see this, e.g. “For the editor”." className="sm:col-span-2">
          <Input id="link-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <Toggle id="link-download" checked={allowDownload} onChange={setAllowDownload} label="Allow downloads" />
        <Toggle id="link-embed" checked={allowEmbed} onChange={setAllowEmbed} label="Allow embedding on other sites" />
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            onError(null);
            try {
              const r = await api<{ url: string; embedUrl: string | null }>(`/api/v1/artifacts/${artifactId}/shares`, {
                method: "POST",
                json: { kind: "link", versionId: versionId || null, allowDownload, allowEmbed, label: label.trim() || null, expiresAt: expiresAt(days) },
              });
              setMade(r);
              await onCreated();
            } catch (e) {
              onError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Create link
        </Button>
      </div>
      {made ? (
        <div className="mt-4 space-y-3 rounded-xl bg-accent-softer p-4" role="status">
          <p className="text-sm text-ink">Copy it now: for your security, the full link is shown only once.</p>
          <CopyField label="Link" value={made.url} />
          {made.embedUrl ? <CopyField label="Embed code" value={`<iframe src="${made.embedUrl}" width="100%" height="480" style="border:0" title="Shared Creation"></iframe>`} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const id = `copy-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <Input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="secondary"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* the field stays selectable for manual copy */
            }
          }}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function PersonForm({ artifactId, versions, onCreated, onError }: { artifactId: string; versions: Version[]; onCreated: () => Promise<void>; onError: (e: string | null) => void }) {
  const [handle, setHandle] = useState("");
  const [versionId, setVersionId] = useState("");
  const [days, setDays] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <section aria-labelledby="person-h" className="mt-6 rounded-2xl border border-border-soft bg-surface p-5">
      <h2 id="person-h" className="text-lg font-semibold text-ink">
        Share with a creator
      </h2>
      <p className="mt-1 text-[15px] text-ink-muted">They&apos;ll find it under Shared with you. They can read it, not edit it.</p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setDone(null);
          onError(null);
          try {
            await api(`/api/v1/artifacts/${artifactId}/shares`, { method: "POST", json: { kind: "creator", handle, versionId: versionId || null, allowDownload, expiresAt: expiresAt(days) } });
            setDone(`Shared with @${handle.replace(/^@/, "")}.`);
            setHandle("");
            await onCreated();
          } catch (err) {
            onError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Creator's handle" htmlFor="person-handle" className="sm:col-span-2">
          <Input id="person-handle" value={handle} placeholder="@handle" autoComplete="off" onChange={(e) => setHandle(e.target.value)} required />
        </Field>
        <VersionSelect id="person-version" versions={versions} value={versionId} onChange={setVersionId} />
        <Field label="Access ends" htmlFor="person-expiry">
          <Select id="person-expiry" value={days} onChange={(e) => setDays(e.target.value)}>
            {EXPIRY.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Toggle id="person-download" checked={allowDownload} onChange={setAllowDownload} label="Allow downloads" />
        </div>
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {done ? (
            <p role="status" className="text-sm text-success-ink">
              {done}
            </p>
          ) : null}
          <Button type="submit" loading={busy} disabled={!handle.trim()}>
            Share
          </Button>
        </div>
      </form>
    </section>
  );
}

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <label htmlFor={id} className="text-[15px] text-ink">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}
