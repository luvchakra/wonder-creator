"use client";
import { Button, Field, Input } from "@wonder/ui";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Forgotten password: always the same answer whether or not the email has an account, so the page can't be used to
 * find out who's registered.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await createClient()
      .auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` })
      .catch(() => undefined);
    setSent(true);
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="font-display text-3xl text-ink">Reset your password</h1>
        <p className="mt-1.5 text-ink-muted">We&rsquo;ll email you a link to choose a new one.</p>
      </div>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      {sent ? (
        <p role="status" className="rounded-xl bg-accent-softer p-3 text-sm text-ink">
          If there&rsquo;s an account for that email, a reset link is on its way. It works once and expires soon.
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email.includes("@")}>
        Send reset link
      </Button>
      <p className="text-center text-sm text-ink-muted">
        <Link href="/sign-in" className="font-medium text-accent-ink underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
