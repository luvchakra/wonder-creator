"use client";
import { Button, Field, Input } from "@wonder/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The second step of sign-in: a 6-digit code from the creator's authenticator app. */
export function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (listError || !factor) {
      setError("We couldn't find your authenticator. Sign in again.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
    if (error) {
      setError("That code isn't right, or it expired. Try the latest one.");
      setBusy(false);
      return;
    }
    await fetch("/api/v1/account/security-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "mfa_verified" }) }).catch(() => undefined);
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="font-display text-3xl text-ink">Two-step verification</h1>
        <p className="mt-1.5 text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
      </div>
      <Field label="Code" htmlFor="code">
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Verify
      </Button>
      <button type="button" onClick={() => void signOut()} className="mx-auto flex min-h-11 items-center text-sm text-ink-muted underline-offset-4 hover:underline">
        Use a different account
      </button>
    </form>
  );
}
