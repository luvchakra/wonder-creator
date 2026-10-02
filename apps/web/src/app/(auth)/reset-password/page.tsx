"use client";
import { passwordProblem } from "@wonder/core";
import { Button, Field, Input } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Choosing a new password after following a reset link (the link signed the creator in for this one purpose). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setError("This reset link has expired. Ask for a new one.");
    const problem = passwordProblem(password, { email: data.user.email }) ?? (password !== confirm ? "The two passwords don't match." : null);
    if (problem) return setError(problem);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    await fetch("/api/v1/account/security-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "password_reset" }) }).catch(() => undefined);
    router.replace("/");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="font-display text-3xl text-ink">Choose a new password</h1>
        <p className="mt-1.5 text-ink-muted">At least 10 characters, with letters and numbers.</p>
      </div>
      <Field label="New password" htmlFor="password">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Save new password
      </Button>
    </form>
  );
}
