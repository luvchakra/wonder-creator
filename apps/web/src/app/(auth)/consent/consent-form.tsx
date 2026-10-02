"use client";
import { CONSENT_HINT, CONSENT_LABEL } from "@wonder/creator-identity/privacy-options";
import { Button } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Optional = "product_analytics" | "product_emails";

/** Required: Terms + Privacy notice + 18+ declaration (one explicit tick). Optional purposes: separate, off by default. */
export function ConsentForm({ returning, initial }: { returning: boolean; initial: Record<Optional, boolean> }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [optional, setOptional] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return setError("Tick the box to continue.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/privacy/consents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method: "consent_prompt",
        choices: [
          { purpose: "terms", granted: true },
          { purpose: "privacy_notice", granted: true },
          { purpose: "age_confirmation", granted: true },
          { purpose: "product_analytics", granted: optional.product_analytics },
          { purpose: "product_emails", granted: optional.product_emails },
        ],
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("We couldn't save that. Try again.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h1 className="font-display text-3xl text-ink">{returning ? "We've updated our terms" : "Before you begin"}</h1>
        <p className="mt-1.5 text-ink-muted">
          {returning ? "Please read what changed and agree to continue." : "Your work stays yours. Here's how we look after it."}
        </p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-surface/90 p-3 text-sm text-ink shadow-[var(--shadow-card)]">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
        <span>
          I&rsquo;m 18 or older and I agree to the{" "}
          <a href="/legal/terms" target="_blank" className="font-medium text-accent-ink underline underline-offset-2">Terms of Service</a> and the{" "}
          <a href="/legal/privacy" target="_blank" className="font-medium text-accent-ink underline underline-offset-2">Privacy notice</a>.
        </span>
      </label>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-[13px] font-medium text-ink-muted">Optional — off unless you choose</legend>
        {(["product_analytics", "product_emails"] as const).map((p) => (
          <label key={p} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-sm text-ink">
            <input type="checkbox" checked={optional[p]} onChange={(e) => setOptional((o) => ({ ...o, [p]: e.target.checked }))} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
            <span>
              {CONSENT_LABEL[p]}
              <span className="mt-0.5 block text-[12.5px] text-ink-muted">{CONSENT_HINT[p]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Continue
      </Button>
      <p className="text-center text-[12.5px] text-ink-muted">You can change the optional choices, download your data or ask us anything about it in Settings › Privacy.</p>
      <button type="button" onClick={() => void signOut()} className="mx-auto -mt-2 flex min-h-11 items-center text-[13px] text-ink-muted underline underline-offset-2">
        Not now — sign out
      </button>
    </form>
  );
}
