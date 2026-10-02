"use client";
import { CONSENT_HINT, CONSENT_LABEL, REQUEST_KINDS, REQUEST_LABEL, REQUEST_STATUS_LABEL, type PrivacyRequestKind } from "@wonder/creator-identity/privacy-options";
import { Button, Field, Switch, Textarea } from "@wonder/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Optional = "product_analytics" | "product_emails";
type Request = { id: string; kind: PrivacyRequestKind; status: keyof typeof REQUEST_STATUS_LABEL; response: string | null; due_at: string; created_at: string; closed_at: string | null };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Your data rights (GDPR Arts. 7, 15–22; DPDP §§6, 11–14): optional consents you can change any time, and requests we
 * answer within 30 days — each one tracked here with its status and due date.
 */
export function PrivacyPanel() {
  const [choices, setChoices] = useState<Record<Optional, boolean> | null>(null);
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void api<{ consents: Array<{ purpose: string; granted: boolean }> }>("/api/v1/privacy/consents").then((r) => {
      if (!live) return;
      const on = (p: Optional) => r.consents.some((c) => c.purpose === p && c.granted);
      setChoices({ product_analytics: on("product_analytics"), product_emails: on("product_emails") });
    }).catch(() => live && setChoices({ product_analytics: false, product_emails: false }));
    void api<{ requests: Request[] }>("/api/v1/privacy/requests").then((r) => live && setRequests(r.requests)).catch(() => live && setRequests([]));
    return () => {
      live = false;
    };
  }, []);

  async function choose(p: Optional, granted: boolean) {
    setChoices((c) => (c ? { ...c, [p]: granted } : c));
    try {
      await api("/api/v1/privacy/consents", { method: "POST", json: { method: "settings", choices: [{ purpose: p, granted }] } });
      setMsg(granted ? "Turned on." : "Turned off.");
    } catch (e) {
      setChoices((c) => (c ? { ...c, [p]: !granted } : c));
      setMsg(errorMessage(e));
    }
  }

  return (
    <section aria-labelledby="data-rights" className="space-y-3">
      <h3 id="data-rights" className="text-sm font-medium text-ink">
        Your data & choices
      </h3>
      <ul className="divide-y divide-border-soft rounded-xl border border-border-soft">
        {(["product_analytics", "product_emails"] as const).map((p) => (
          <li key={p} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 text-sm">
              <span className="block text-ink">{CONSENT_LABEL[p]}</span>
              <span className="text-[13px] text-ink-muted">{CONSENT_HINT[p]}</span>
            </span>
            {choices ? <Switch checked={choices[p]} onCheckedChange={(v) => void choose(p, v)} label={CONSENT_LABEL[p]} /> : null}
          </li>
        ))}
      </ul>
      {msg ? (
        <p role="status" className="text-[13px] text-ink-muted">
          {msg}
        </p>
      ) : null}
      <RequestForm onFiled={(r) => setRequests((x) => [r, ...(x ?? [])])} />
      {requests?.length ? (
        <ul aria-label="Your privacy requests" className="divide-y divide-border-soft rounded-xl border border-border-soft text-sm">
          {requests.map((r) => (
            <li key={r.id} className="px-3 py-2">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-ink">{REQUEST_LABEL[r.kind]}</span>
                <span className="text-[12.5px] text-ink-muted">
                  {REQUEST_STATUS_LABEL[r.status]} · {r.closed_at ? `closed ${day(r.closed_at)}` : `answer by ${day(r.due_at)}`}
                </span>
              </span>
              {r.response ? <span className="mt-0.5 block text-[13px] text-ink-muted">{r.response}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[12.5px] text-ink-subtle">
        <Link href="/legal/privacy" className="underline underline-offset-2">
          Privacy notice
        </Link>{" "}
        — what we collect, why, for how long, who processes it, and how to reach our Grievance Officer or your data-protection authority.
      </p>
    </section>
  );
}

function RequestForm({ onFiled }: { onFiled: (r: Request) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PrivacyRequestKind>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Make a privacy request
        </Button>
        {done ? (
          <span role="status" className="text-[13px] text-ink-muted">
            {done}
          </span>
        ) : null}
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ request: Request }>("/api/v1/privacy/requests", { method: "POST", json: { kind, details } });
      onFiled({ ...r.request, response: null, closed_at: null });
      setDone(`Received. We'll answer by ${day(r.request.due_at)}.`);
      setOpen(false);
      setDetails("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border-soft p-3">
      <Field label="What would you like?" htmlFor="privacy-kind">
        <select id="privacy-kind" value={kind} onChange={(e) => setKind(e.target.value as PrivacyRequestKind)} className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-[14px]">
          {REQUEST_KINDS.map((k) => (
            <option key={k} value={k}>
              {REQUEST_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-[12.5px] text-ink-muted">
        {kind === "access" || kind === "portability"
          ? "You can also download everything right now with Export my data below."
          : kind === "erasure"
            ? "To erase everything, use Delete account below. For specific data, tell us what."
            : kind === "nomination"
              ? "Name the person and how to reach them; they can act for you if you can't (DPDP §14)."
              : "Tell us what it's about."}
      </p>
      <Field label="Details" htmlFor="privacy-details">
        <Textarea id="privacy-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={4000} className="min-h-20" />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>
          Send request
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
