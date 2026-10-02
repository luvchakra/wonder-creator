"use client";
import { passwordProblem } from "@wonder/core";
import { Button, Field, Input } from "@wonder/ui";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string | null; status: string; created_at: string };

/**
 * Sign-in & security: change password (current one required) and two-step verification with an authenticator app
 * (TOTP). Turning two-step verification off needs a verified session (aal2), which the auth server enforces.
 */
export function SecurityPanel({ email }: { email: string | null }) {
  return (
    <section aria-labelledby="signin-security" className="space-y-3">
      <h3 id="signin-security" className="text-sm font-medium text-ink">
        Sign-in & security
      </h3>
      <TwoStep />
      <ChangePassword email={email} />
    </section>
  );
}

function TwoStep() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  };
  useEffect(() => {
    let live = true;
    void createClient()
      .auth.mfa.listFactors()
      .then(({ data }) => live && setFactors((data?.totp ?? []) as Factor[]));
    return () => {
      live = false;
    };
  }, []);
  const verified = (factors ?? []).filter((f) => f.status === "verified");

  async function start() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    // Leftover unverified factors (an abandoned setup) are cleared first.
    for (const f of (factors ?? []).filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) return setMsg(error?.message ?? "Two-step verification isn't available right now.");
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function confirm() {
    if (!enrolling) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) return setMsg("That code isn't right. Try the latest one from your app.");
    await fetch("/api/v1/account/security-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "mfa_enrolled" }) }).catch(() => undefined);
    setEnrolling(null);
    setCode("");
    setMsg("Two-step verification is on. You'll be asked for a code when you sign in.");
    await load();
  }
  async function remove(id: string) {
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) return setMsg("To turn this off, sign in again with your code first.");
    await fetch("/api/v1/account/security-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "mfa_removed" }) }).catch(() => undefined);
    setMsg("Two-step verification is off.");
    await load();
  }

  return (
    <div className="rounded-xl border border-border-soft p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <ShieldCheck className="size-4 text-accent-ink" aria-hidden /> Two-step verification
        <span className={verified.length ? "rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] text-success-ink" : "rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] text-ink-muted"}>{verified.length ? "On" : "Off"}</span>
      </p>
      <p className="mt-0.5 text-[13px] text-ink-muted">A code from an authenticator app each time you sign in, so a password alone isn&rsquo;t enough.</p>
      {enrolling ? (
        <div className="mt-2 space-y-2">
          <p className="text-[13px] text-ink">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          {/* The QR is an SVG data URL from the auth server. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code to add Wonder Creator to your authenticator app" className="size-40 rounded-lg border border-border-soft bg-white p-2" />
          <p className="text-[12px] text-ink-subtle">
            Can&rsquo;t scan? Enter this key: <code className="select-all break-all rounded bg-surface-muted px-1">{enrolling.secret}</code>
          </p>
          <Field label="Code from your app" htmlFor="totp-code">
            <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void confirm()} disabled={code.replace(/\s/g, "").length !== 6}>
              Turn on
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEnrolling(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : verified.length ? (
        <ul className="mt-2 divide-y divide-border-soft">
          {verified.map((f) => (
            <li key={f.id} className="flex min-h-11 items-center justify-between gap-2 text-[13px] text-ink">
              {f.friendly_name || "Authenticator app"}
              <Button size="sm" variant="ghost" loading={busy} onClick={() => void remove(f.id)}>
                Turn off
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Button size="sm" variant="secondary" className="mt-2" loading={busy} onClick={() => void start()} disabled={factors === null}>
          Set up two-step verification
        </Button>
      )}
      {msg ? (
        <p role="status" className="mt-2 text-[13px] text-ink-muted">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

function ChangePassword({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    const problem = passwordProblem(next, { email });
    if (problem) return setMsg({ ok: false, text: problem });
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/v1/account/password", { method: "POST", json: { current, next } });
      setMsg({ ok: true, text: "Password changed." });
      setCurrent("");
      setNext("");
      setOpen(false);
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-border-soft p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <KeyRound className="size-4 text-accent-ink" aria-hidden /> Password
      </p>
      {open ? (
        <div className="mt-2 space-y-2">
          <Field label="Current password" htmlFor="pw-current">
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" htmlFor="pw-next" hint="At least 10 characters, with letters and numbers.">
            <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void save()} disabled={!current || !next}>
              Change password
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => setOpen(true)}>
          Change password
        </Button>
      )}
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-2 text-[13px] text-success-ink" : "mt-2 text-[13px] text-danger"}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
