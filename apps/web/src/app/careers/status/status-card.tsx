"use client";
import { Button, ConfirmDialog } from "@wonder/ui";
import { useState } from "react";
import type { ApplicationStatus } from "@/lib/careers/client";

const dateOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

/** The applicant's application, and Withdraw (asked first). The token goes to this app's server in a request body. */
export function StatusCard({ token, initial }: { token: string; initial: ApplicationStatus }) {
  const [app, setApp] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/careers/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action: "withdraw" }) });
      const body = (await res.json().catch(() => ({}))) as { application?: ApplicationStatus; error?: { message?: string } };
      if (res.ok && body.application) setApp(body.application);
      else setError(body.error?.message ?? "Your application couldn't be withdrawn right now. Please try again later.");
    } catch {
      setError("Your application couldn't be withdrawn right now. Check your connection and try again.");
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <section aria-labelledby="status-title" className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm sm:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink">Your application</p>
      <h1 id="status-title" className="mt-2 font-display text-[30px] leading-tight [overflow-wrap:anywhere]">
        {app.jobTitle}
      </h1>
      {app.company ? <p className="mt-1 text-[15px] text-ink-muted">{app.company}</p> : null}
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[15px]">
        <dt className="text-ink-subtle">Status</dt>
        <dd role="status" className="font-medium text-ink">
          {app.statusLabel}
        </dd>
        <dt className="text-ink-subtle">Applied</dt>
        <dd className="text-ink">{dateOf(app.appliedAt)}</dd>
        <dt className="text-ink-subtle">Last update</dt>
        <dd className="text-ink">{dateOf(app.updatedAt)}</dd>
      </dl>
      {error ? (
        <p role="alert" className="mt-4 text-[14px] text-danger">
          {error}
        </p>
      ) : null}
      {app.canWithdraw ? (
        <Button type="button" variant="ghost" className="mt-5 text-danger" onClick={() => setAsking(true)}>
          Withdraw application
        </Button>
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        destructive
        busy={busy}
        title="Withdraw your application?"
        body="The hiring team will no longer consider it for this position. This can't be undone."
        confirmLabel="Withdraw"
        onConfirm={() => void withdraw()}
      />
    </section>
  );
}
