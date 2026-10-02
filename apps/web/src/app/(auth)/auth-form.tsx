"use client";
import { passwordProblem } from "@wonder/core";
import { Button, Field, Input } from "@wonder/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (mode === "sign-up") {
      const problem = passwordProblem(password, { email });
      if (problem) {
        setError(problem);
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Check your email to confirm your account, then come back to sign in.");
      else {
        await recordSecurityEvent("signed_up");
        router.replace("/onboarding");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("That email and password don't match. Try again.");
      else {
        await recordSecurityEvent("signed_in");
        const next = params.get("next");
        const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
        // Two-step verification set up: the code comes next.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
          router.replace(`/sign-in/verify?next=${encodeURIComponent(safeNext)}`);
          return;
        }
        router.replace(safeNext);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="font-display text-3xl text-ink">{mode === "sign-in" ? "Welcome back" : "Welcome to Wonder Creator"}</h1>
        <p className="mt-1.5 text-ink-muted">{mode === "sign-in" ? "Pick up where you left off." : "A place to think, create and bring your creative ideas to life."}</p>
      </div>
      {mode === "sign-up" ? (
        <Field label="Your name" htmlFor="name">
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </Field>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" htmlFor="password" hint={mode === "sign-up" ? "At least 10 characters, with letters and numbers." : undefined}>
        <Input id="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {mode === "sign-in" ? (
        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-xl bg-accent-softer p-3 text-sm text-ink">
          {notice}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {mode === "sign-in" ? "Sign in" : "Let's begin →"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        {mode === "sign-in" ? (
          <>
            New here?{" "}
            <Link href="/sign-up" className="font-medium text-accent-ink underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-accent-ink underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

/** Adds the sign-in to the creator's security history; never blocks signing in. */
async function recordSecurityEvent(event: "signed_in" | "signed_up") {
  await fetch("/api/v1/account/security-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event }) }).catch(() => undefined);
}
