"use client";
import { BACKGROUNDS, BrandBackground, Button, Field, Input, Logo } from "@wonder/ui";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";

/**
 * Onboarding, one screen (owner, 8 Oct 2026: "shorten the onboarding"; docs/ui-redesign/start-small.md): what to call
 * you and a handle so people can find you — then the studio. Nothing else is asked here. Who you are as a creator
 * (disciplines, languages, tone, what to preserve) is asked in Settings when it matters, and CreativeMind learns from
 * it there; photo, bio and location live on the profile.
 */
export function OnboardingWizard({ initial }: { initial: { displayName: string; handle: string } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleStatus, setHandleStatus] = useState<{ ok: boolean; msg?: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shown = handle.length >= 3 ? handleStatus : null;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (handle.length < 3) return;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ available: boolean; reason?: string }>(`/api/v1/creators/handle-available?handle=${encodeURIComponent(handle)}`);
        setHandleStatus({ ok: r.available, msg: r.reason });
      } catch {
        setHandleStatus(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [handle]);

  const ready = !!name.trim() && handle.length >= 3 && shown?.ok !== false;

  async function enter() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/creators/onboarding/about", { method: "POST", json: { displayName: name, handle } });
      router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <main id="main" className="min-h-dvh bg-cream">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-6 inline-block rounded-xl bg-white px-2 py-1">
          <Logo height={44} />
        </div>
        <BrandBackground src={BACKGROUNDS.archesSea} overlay="cream" className="rounded-3xl border border-border-soft" position="70% center">
          <form
            onSubmit={(e) => (e.preventDefault(), void enter())}
            aria-labelledby="welcome-title"
            className="max-w-lg space-y-5 px-6 py-10 sm:px-10 sm:py-14"
          >
            <div>
              <h1 id="welcome-title" ref={headingRef} tabIndex={-1} className="font-display text-4xl leading-tight text-ink sm:text-5xl focus:outline-none">
                Welcome to
                <br />
                Wonder Creator
              </h1>
              <p className="mt-3 text-lg text-ink-muted">A place to think, create and bring your ideas to life. Two things, and you&rsquo;re in.</p>
            </div>
            <Field label="Name" htmlFor="displayName" hint="What people will call you.">
              <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required />
            </Field>
            <Field
              label="Handle"
              htmlFor="handle"
              error={shown && !shown.ok ? (shown.msg ?? "That handle isn\u2019t available.") : null}
              hint={shown?.ok ? "Available \u2713" : "Letters, numbers and underscores \u2014 so people can find you."}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle">@</span>
                <Input
                  id="handle"
                  className="pl-8"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30))}
                  aria-invalid={shown?.ok === false}
                  autoComplete="username"
                  required
                />
              </div>
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" loading={busy} disabled={!ready}>
              Enter your studio <ArrowRight className="size-4" aria-hidden />
            </Button>
            <p className="text-[13px] text-ink-muted">Everything else &mdash; what you make, your voice, a photo &mdash; can wait until it matters. You&rsquo;ll find it in Settings.</p>
          </form>
        </BrandBackground>
      </div>
    </main>
  );
}
