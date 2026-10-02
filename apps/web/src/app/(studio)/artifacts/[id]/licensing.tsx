"use client";
import { channelLabels, describeTerms, isConsequential, LICENSE_MODES, LICENSE_USES, licenseTermsSchema, USAGE_CHANNELS, type LicenseTerms } from "@wonder/creator-studio/licensing";
import { Badge, Button, Dialog, DialogContent, Field, Input, Switch, Textarea, chipBase, cn } from "@wonder/ui";
import { ArrowLeft, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LicencePayment } from "@/components/payments/licence-payment";
import { stepUpErrorMessage, useStepUp } from "@/components/step-up";
import { api, errorMessage } from "@/lib/client";

export interface LicenseRequestView {
  id: string;
  status: "pending" | "approved" | "declined" | "countered" | "withdrawn";
  proposedUse: string;
  terms: LicenseTerms;
  counterTerms: LicenseTerms | null;
  summary: string[];
  counterSummary: string[] | null;
  consequential: boolean;
  counterConsequential: boolean;
  responseNote: string | null;
  licenseId?: string | null;
  requester: { id: string; name: string; handle: string | null };
  createdAt: string;
}

const DEFAULT_TERMS: LicenseTerms = {
  licenseType: "editorial",
  mode: "free_license",
  territory: "Worldwide",
  startsOn: null,
  endsOn: null,
  modificationAllowed: false,
  derivativesAllowed: false,
  resaleAllowed: false,
  attributionRequired: true,
  feeAmount: null,
  feeCurrency: null,
  editionSize: null,
  usageChannels: [],
};

/** Channel toggles (P1-17): compact chips in one scrolling row. */
export function ChannelChips({ value, onChange, label }: { value: readonly string[]; onChange: (v: LicenseTerms["usageChannels"]) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        {USAGE_CHANNELS.map((c) => {
          const on = value.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange((on ? value.filter((v) => v !== c.value) : [...value, c.value]) as LicenseTerms["usageChannels"])}
              className={cn(chipBase, on ? "bg-navy text-white" : "bg-surface-muted text-ink-muted hover:text-ink")}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const STEPS = ["Use", "What's allowed", "Where & when", "Review"] as const;

/** A readable terms summary (no dense legal table). */
export function TermsSummary({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-0.5 text-sm text-ink-muted", className)}>
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

/**
 * License terms as four short steps: use & mode → what's allowed → where & when → review.
 * Going back keeps everything entered. `before` renders fields shown on the first step (e.g. proposed use).
 */
function TermsSteps({
  initial,
  before,
  canContinue = true,
  review,
  children,
  commercialOffered = true,
}: {
  commercialOffered?: boolean;
  initial?: LicenseTerms;
  before?: React.ReactNode;
  canContinue?: boolean;
  review?: React.ReactNode;
  children: (terms: LicenseTerms | null, error: string | null) => React.ReactNode;
}) {
  const [step, setStep] = useState(0);
  const [t, setT] = useState<LicenseTerms>(initial ?? DEFAULT_TERMS);
  const set = (patch: Partial<LicenseTerms>) => setT((x) => ({ ...x, ...patch }));
  const parsed = licenseTermsSchema.safeParse(t);
  const error = parsed.success ? null : parsed.error.issues[0]?.message ?? "Check the terms.";
  const needsFee = t.mode === "paid_nonexclusive" || t.mode === "exclusive" || t.mode === "limited_edition";

  return (
    <div>
      <ol className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn(i === step ? "font-semibold text-accent-ink" : i < step ? "text-ink-muted" : "text-ink-subtle")}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="space-y-4">
          {before}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Permitted use</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LICENSE_USES.filter((u) => commercialOffered || u.value !== "commercial").map((u) => (
                <button key={u.value} type="button" aria-pressed={t.licenseType === u.value} onClick={() => set({ licenseType: u.value })} className={cn("min-h-14 rounded-2xl border px-3 py-2 text-left text-sm", t.licenseType === u.value ? "border-accent bg-accent-soft text-accent-ink" : "border-border text-ink")}>
                  <span className="block font-medium">{u.label}</span>
                  <span className="block text-xs text-ink-subtle">{u.note}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Kind of license</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {LICENSE_MODES.map((m) => (
                <button key={m.value} type="button" aria-pressed={t.mode === m.value} onClick={() => set({ mode: m.value })} className={cn("min-h-14 rounded-2xl border px-3 py-2 text-left text-sm", t.mode === m.value ? "border-accent bg-accent-soft text-accent-ink" : "border-border text-ink")}>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-ink-subtle">{m.note}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          {(
            [
              ["modificationAllowed", "Changes allowed", "They may edit or adapt it"],
              ["derivativesAllowed", "Derivative works allowed", "They may make new works from it"],
              ["resaleAllowed", "Resale allowed", "They may sell it on"],
              ["attributionRequired", "Credit required", "They must credit you"],
            ] as const
          ).map(([k, label, note]) => (
            <div key={k} className="flex min-h-11 items-center justify-between gap-3">
              <span>
                <span className="block text-sm text-ink">{label}</span>
                <span className="block text-xs text-ink-subtle">{note}</span>
              </span>
              <Switch checked={t[k]} onCheckedChange={(v) => set({ [k]: v } as Partial<LicenseTerms>)} label={label} />
            </div>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Territory" htmlFor="terr" className="sm:col-span-2">
            <Input id="terr" value={t.territory} onChange={(e) => set({ territory: e.target.value })} maxLength={120} />
          </Field>
          <div className="sm:col-span-2">
            <ChannelChips label="Channels (optional)" value={t.usageChannels} onChange={(usageChannels) => set({ usageChannels })} />
          </div>
          <Field label="Starts (optional)" htmlFor="starts">
            <Input id="starts" type="date" value={t.startsOn ?? ""} onChange={(e) => set({ startsOn: e.target.value || null })} />
          </Field>
          <Field label="Ends (optional)" htmlFor="ends">
            <Input id="ends" type="date" value={t.endsOn ?? ""} onChange={(e) => set({ endsOn: e.target.value || null })} />
          </Field>
          {needsFee ? (
            <>
              <Field label={t.mode === "paid_nonexclusive" ? "Fee" : "Fee (optional)"} htmlFor="fee" hint="Recorded as terms. Wonder Creator doesn't take payments.">
                <Input id="fee" type="number" min={0} step="0.01" value={t.feeAmount ?? ""} onChange={(e) => set({ feeAmount: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Input id="currency" value={t.feeCurrency ?? ""} onChange={(e) => set({ feeCurrency: e.target.value.toUpperCase() || null })} maxLength={3} placeholder="INR" />
              </Field>
            </>
          ) : null}
          {t.mode === "limited_edition" ? (
            <Field label="Edition size" htmlFor="edition">
              <Input id="edition" type="number" min={1} value={t.editionSize ?? ""} onChange={(e) => set({ editionSize: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          {review}
          {parsed.success ? (
            <div className="rounded-2xl bg-surface-muted p-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
                <Scale className="size-4" aria-hidden /> Terms
                {isConsequential(parsed.data) ? <Badge tone="warning">Needs your password to grant</Badge> : null}
              </p>
              <TermsSummary lines={describeTerms(parsed.data)} />
            </div>
          ) : (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <p className="text-xs text-ink-subtle">A license records terms between you. It doesn&apos;t by itself establish legal rights; legal effect depends on your agreement and the law where you are.</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={!canContinue || (step === 2 && !!error)} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">{children(parsed.success ? parsed.data : null, error)}</div>
        )}
      </div>
    </div>
  );
}

/** The creator records a license: save as a draft, or activate it now. */
export function CreateLicenseDialog({ open, onOpenChange, artifactId }: { open: boolean; onOpenChange: (o: boolean) => void; artifactId: string }) {
  const router = useRouter();
  const stepUp = useStepUp();
  const [licensee, setLicensee] = useState("");
  const [use, setUse] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = (terms: LicenseTerms, status: "draft" | "active") => async () => {
    setBusy(status);
    setError(null);
    try {
      await stepUp.run((password) => api(`/api/v1/artifacts/${artifactId}/licenses`, { method: "POST", json: { ...terms, licenseeName: licensee || null, permittedUse: use || null, status, password } }).then(() => undefined));
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setError(stepUpErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {stepUp.dialog}
      <DialogContent title="Create a license" description="Set the terms you're granting. Commercial, paid, limited-edition and exclusive licenses need your password to activate.">
        <TermsSteps
          before={
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Licensee (optional)" htmlFor="licensee">
                <Input id="licensee" value={licensee} onChange={(e) => setLicensee(e.target.value)} maxLength={200} />
              </Field>
              <Field label="What it's for (optional)" htmlFor="purpose">
                <Input id="purpose" value={use} onChange={(e) => setUse(e.target.value)} maxLength={1000} />
              </Field>
            </div>
          }
        >
          {(terms) => (
            <>
              {error ? (
                <p role="alert" className="w-full text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Button type="button" variant="secondary" disabled={!terms} loading={busy === "draft"} onClick={terms ? save(terms, "draft") : undefined}>
                Save as draft
              </Button>
              <Button type="button" disabled={!terms} loading={busy === "active"} onClick={terms ? save(terms, "active") : undefined}>
                Activate
              </Button>
            </>
          )}
        </TermsSteps>
      </DialogContent>
    </Dialog>
  );
}

/** Another creator asks for a license: proposed use + terms, reviewed before sending. */
export function RequestLicenseDialog({ open, onOpenChange, artifactId, title, commercialOffered = true }: { open: boolean; onOpenChange: (o: boolean) => void; artifactId: string; title: string; commercialOffered?: boolean }) {
  const router = useRouter();
  const [use, setUse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Request a license" description={`Ask the creator of “${title}” for permission. They'll approve, decline or suggest different terms.`}>
        <TermsSteps
          commercialOffered={commercialOffered}
          canContinue={use.trim().length > 0}
          before={
            <Field label="How would you like to use it?" htmlFor="proposed-use">
              <Textarea id="proposed-use" value={use} onChange={(e) => setUse(e.target.value)} maxLength={2000} className="min-h-24" placeholder="For the cover of our spring newsletter, credited to you." />
            </Field>
          }
          review={
            <div className="rounded-2xl border border-border-soft p-3 text-sm">
              <p className="font-medium text-ink">Proposed use</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-muted">{use}</p>
            </div>
          }
        >
          {(terms) => (
            <>
              {error ? (
                <p role="alert" className="w-full text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Button
                type="button"
                disabled={!terms}
                loading={busy}
                onClick={async () => {
                  if (!terms) return;
                  setBusy(true);
                  setError(null);
                  try {
                    await api(`/api/v1/artifacts/${artifactId}/license-requests`, { method: "POST", json: { proposedUse: use, terms } });
                    onOpenChange(false);
                    router.refresh();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send request
              </Button>
            </>
          )}
        </TermsSteps>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TEXT: Record<LicenseRequestView["status"], string> = { pending: "Waiting for a reply", approved: "Approved", declined: "Declined", countered: "Counter-offer", withdrawn: "Withdrawn" };

/** Owner: requests for this piece, with approve / decline / counter. */
export function OwnerLicenseRequests({ requests }: { requests: LicenseRequestView[] }) {
  const router = useRouter();
  const stepUp = useStepUp();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<LicenseRequestView | null>(null);
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});
  if (!requests.length) return null;
  const open = requests.filter((r) => r.status === "pending" || r.status === "countered");
  const closed = requests.filter((r) => !open.includes(r));

  const act = async (r: LicenseRequestView, action: "approve" | "decline") => {
    setBusy(`${action}:${r.id}`);
    setError(null);
    try {
      await stepUp.run((password) => api(`/api/v1/license-requests/${r.id}`, { method: "POST", json: { action, note: noteFor[r.id] || undefined, password } }).then(() => undefined));
      router.refresh();
    } catch (e) {
      setError(stepUpErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-5 lg:col-span-full" aria-labelledby="license-requests">
      {stepUp.dialog}
      <h2 id="license-requests" className="font-semibold text-ink">
        License requests
      </h2>
      {open.length ? (
        <ul className="mt-3 space-y-3">
          {open.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">{r.requester.name}</p>
                <Badge tone={r.status === "countered" ? "accent" : "neutral"}>{STATUS_TEXT[r.status]}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{r.proposedUse}</p>
              <TermsSummary className="mt-2" lines={r.status === "countered" && r.counterSummary ? r.counterSummary : r.summary} />
              {r.status === "pending" ? (
                <>
                  <Field label="Note to them (optional)" htmlFor={`note-${r.id}`} className="mt-3">
                    <Input id={`note-${r.id}`} value={noteFor[r.id] ?? ""} onChange={(e) => setNoteFor((n) => ({ ...n, [r.id]: e.target.value }))} maxLength={1000} />
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === `approve:${r.id}`} disabled={!!busy} onClick={() => act(r, "approve")}>
                      Approve{r.consequential ? " (password)" : ""}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => setCounterFor(r)}>
                      Suggest other terms
                    </Button>
                    <Button size="sm" variant="ghost" loading={busy === `decline:${r.id}`} disabled={!!busy} onClick={() => act(r, "decline")}>
                      Decline
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs text-ink-subtle">Waiting for {r.requester.name} to accept your counter-offer.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">No open requests.</p>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {closed.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted">Answered ({closed.length})</summary>
          <ul className="mt-2 space-y-1 text-ink-muted">
            {closed.map((r) => (
              <li key={r.id}>
                {r.requester.name} · {STATUS_TEXT[r.status]}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {counterFor ? <CounterDialog request={counterFor} onOpenChange={(o) => !o && setCounterFor(null)} /> : null}
    </section>
  );
}

function CounterDialog({ request, onOpenChange }: { request: LicenseRequestView; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const stepUp = useStepUp();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      {stepUp.dialog}
      <DialogContent title="Suggest other terms" description={`${request.requester.name} can accept your terms or withdraw.`}>
        <TermsSteps
          initial={request.terms}
          before={
            <Field label="Note to them (optional)" htmlFor="counter-note">
              <Input id="counter-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            </Field>
          }
        >
          {(terms) => (
            <>
              {error ? (
                <p role="alert" className="w-full text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Button
                type="button"
                disabled={!terms}
                loading={busy}
                onClick={async () => {
                  if (!terms) return;
                  setBusy(true);
                  setError(null);
                  try {
                    await stepUp.run((password) => api(`/api/v1/license-requests/${request.id}`, { method: "POST", json: { action: "counter", counter: terms, note: note || undefined, password } }).then(() => undefined));
                    onOpenChange(false);
                    router.refresh();
                  } catch (e) {
                    setError(stepUpErrorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send counter-offer
              </Button>
            </>
          )}
        </TermsSteps>
      </DialogContent>
    </Dialog>
  );
}

/** Requester: ask for a license, and follow your requests (accept a counter, withdraw). */
export function RequesterLicensing({ artifactId, title, requests, stance }: { artifactId: string; title: string; requests: LicenseRequestView[]; stance?: { commercialUse: string; commercialChannels: string[] } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasOpen = requests.some((r) => r.status === "pending" || r.status === "countered");
  const act = async (id: string, action: "accept_counter" | "withdraw") => {
    setBusy(`${action}:${id}`);
    setError(null);
    try {
      await api(`/api/v1/license-requests/${id}`, { method: "POST", json: { action } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-5 lg:col-span-full" aria-labelledby="your-license">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="your-license" className="font-semibold text-ink">
          Licensing
        </h2>
        {!hasOpen ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Scale className="size-4" aria-hidden /> Request a license
          </Button>
        ) : null}
      </div>
      {requests.length ? (
        <ul className="mt-3 space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border-soft p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink">Your request</p>
                <Badge tone={r.status === "approved" ? "success" : r.status === "declined" ? "danger" : r.status === "countered" ? "accent" : "neutral"}>{STATUS_TEXT[r.status]}</Badge>
              </div>
              <TermsSummary className="mt-2" lines={r.summary} />
              {r.responseNote ? <p className="mt-2 text-ink">“{r.responseNote}”</p> : null}
              {r.status === "approved" && r.licenseId ? <ApprovedFee licenseId={r.licenseId} terms={r.counterTerms ?? r.terms} /> : null}
              {r.status === "countered" && r.counterSummary ? (
                <div className="mt-3 rounded-xl bg-accent-softer p-3">
                  <p className="font-medium text-ink">Their terms</p>
                  <TermsSummary lines={r.counterSummary} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === `accept_counter:${r.id}`} disabled={!!busy} onClick={() => act(r.id, "accept_counter")}>
                      Accept these terms
                    </Button>
                    <Button size="sm" variant="ghost" loading={busy === `withdraw:${r.id}`} disabled={!!busy} onClick={() => act(r.id, "withdraw")}>
                      Withdraw
                    </Button>
                  </div>
                </div>
              ) : r.status === "pending" ? (
                <Button size="sm" variant="ghost" className="mt-2" loading={busy === `withdraw:${r.id}`} disabled={!!busy} onClick={() => act(r.id, "withdraw")}>
                  Withdraw
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Want to use this Creation? Ask its creator for a license — they decide the terms.</p>
      )}
      {stance ? (
        <p className="mt-2 text-[13px] text-ink-subtle">
          {stance.commercialUse === "not_offered"
            ? "The creator doesn't offer commercial use of this Creation."
            : stance.commercialUse === "open"
              ? `Open to commercial licensing${stance.commercialChannels.length ? ` · ${channelLabels(stance.commercialChannels).join(", ")}` : ""}.`
              : "Commercial use: on request."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {open ? <RequestLicenseDialog open onOpenChange={setOpen} artifactId={artifactId} title={title} commercialOffered={stance?.commercialUse !== "not_offered"} /> : null}
    </section>
  );
}

/** The licensee's side of a paid licence: pay its fee on the provider's page. */
function ApprovedFee({ licenseId, terms }: { licenseId: string; terms: LicenseTerms }) {
  if (!terms.feeAmount || !terms.feeCurrency) return null;
  return <LicencePayment licenseId={licenseId} role="licensee" fee={{ amount: terms.feeAmount, currency: terms.feeCurrency }} />;
}
