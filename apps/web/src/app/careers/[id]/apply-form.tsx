"use client";
import { Button, Field, Input, Textarea } from "@wonder/ui";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { LIMITS, type FieldErrors } from "@/lib/careers/apply";
import { consentText } from "@/lib/careers/format";

type Key = "name" | "email" | "phone" | "location" | "linkedinUrl" | "resumeUrl" | "coverNote";

/**
 * Apply (docs/careers.md › Apply): sent to this app's own server, which checks it and forwards it to WonderJobs. The
 * browser never calls WonderJobs. "Sent" only after the server says 200; WonderJobs' own 400/409 words as they are; a
 * closed position leads back to the list; anything else is a plain "try again".
 */
export function ApplyForm({ jobId, retentionMonths }: { jobId: string; retentionMonths: number | null }) {
  const [values, setValues] = useState<Record<Key, string>>({ name: "", email: "", phone: "", location: "", linkedinUrl: "", resumeUrl: "", coverNote: "" });
  const [consent, setConsent] = useState(false);
  const website = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ tone: "error" | "gone"; text: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const res = await fetch(`/api/v1/careers/jobs/${encodeURIComponent(jobId)}/applications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, consent, website: website.current?.value ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string | { message?: string; details?: unknown }; fields?: FieldErrors; gone?: boolean };
      if (res.status === 200 && body.ok) {
        setSent(body.message ?? "Application sent. Check your email for a confirmation and a link to follow it.");
        return;
      }
      const text = typeof body.error === "string" ? body.error : body.error?.message;
      if (res.status === 404 && body.gone) setMessage({ tone: "gone", text: text ?? "This position is no longer open." });
      else if ((res.status === 400 || res.status === 409 || res.status === 429) && text) {
        setErrors(body.fields ?? {});
        setMessage({ tone: "error", text });
      } else setMessage({ tone: "error", text: "Your application couldn't be sent just now. Please try again in a few minutes." });
    } catch {
      setMessage({ tone: "error", text: "Your application couldn't be sent just now. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div role="status" className="mt-4 flex items-start gap-3 rounded-3xl border border-white/80 bg-white/80 p-5 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)]">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
        <p className="text-[15.5px] leading-relaxed text-ink">{sent}</p>
      </div>
    );

  const field = (k: Key, label: string, opts: { type?: string; required?: boolean; hint?: string; autoComplete?: string; max: number; placeholder?: string }) => (
    <Field label={opts.required ? label : `${label} (optional)`} htmlFor={`apply-${k}`} error={errors[k]} hint={opts.hint}>
      <Input
        id={`apply-${k}`}
        name={k}
        type={opts.type ?? "text"}
        value={values[k]}
        onChange={set(k)}
        required={opts.required}
        maxLength={opts.max}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `apply-${k}-error` : opts.hint ? `apply-${k}-hint` : undefined}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="mt-4 space-y-4 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm sm:p-6">
      {field("name", "Full name", { required: true, autoComplete: "name", max: LIMITS.name })}
      {field("email", "Email", { type: "email", required: true, autoComplete: "email", max: LIMITS.email })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("phone", "Phone", { type: "tel", autoComplete: "tel", max: LIMITS.phone })}
        {field("location", "Location", { autoComplete: "address-level2", max: LIMITS.location, placeholder: "City, country" })}
      </div>
      {field("linkedinUrl", "LinkedIn or portfolio", { type: "url", max: LIMITS.url, placeholder: "https://", hint: "A link that starts with https://." })}
      {field("resumeUrl", "Résumé link", { type: "url", required: true, max: LIMITS.url, placeholder: "https://", hint: "A https link anyone with it can open: Google Drive, Dropbox, LinkedIn or your own site." })}
      <Field label="Cover note (optional)" htmlFor="apply-coverNote" error={errors.coverNote} counter={`${values.coverNote.length} / ${LIMITS.coverNote}`}>
        <Textarea
          id="apply-coverNote"
          name="coverNote"
          value={values.coverNote}
          onChange={set("coverNote")}
          maxLength={LIMITS.coverNote}
          className="min-h-32"
          aria-invalid={errors.coverNote ? true : undefined}
          aria-describedby={errors.coverNote ? "apply-coverNote-error" : undefined}
        />
      </Field>
      {/* A field people never see or reach: only bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="apply-website">Website</label>
        <input ref={website} id="apply-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="flex items-start gap-3 text-[14px] leading-snug text-ink">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "apply-consent-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>{consentText(retentionMonths)}</span>
        </label>
        {errors.consent ? (
          <p id="apply-consent-error" role="alert" className="mt-1 pl-8 text-sm text-danger">
            {errors.consent}
          </p>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="rounded-2xl bg-danger/5 px-3 py-2 text-[14px] text-danger">
          {message.text}
          {message.tone === "gone" ? (
            <>
              {" "}
              <Link href="/careers" className="font-medium underline underline-offset-2">
                See open positions
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" className="w-full sm:w-auto" loading={busy} disabled={busy}>
        {busy ? "Sending…" : "Send application"}
      </Button>
    </form>
  );
}
