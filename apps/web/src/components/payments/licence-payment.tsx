"use client";
import { currencyExponent, formatMinor, PAYMENT_STATUS_LABEL, toMinor, type PaymentStatus } from "@wonder/creator-payments/money";
import { Badge, Button, Dialog, DialogContent, Field, Input, Textarea } from "@wonder/ui";
import { useEffect, useState } from "react";
import { stepUpErrorMessage, useStepUp } from "@/components/step-up";
import { api, errorMessage } from "@/lib/client";

type Payment = { id: string; status: PaymentStatus; amount_minor: number; currency: string; refunded_minor: number; paid_at: string | null; provider: "stripe" | "razorpay" | null };

const PROVIDER = { stripe: "Stripe", razorpay: "Razorpay" } as const;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * A licence fee's payment, in place: the licensee pays on Stripe's or Razorpay's own page; the owner can copy a link
 * for a licensee who isn't on Wonder Creator, and refund (password asked again). Status is what the provider confirmed.
 */
export function LicencePayment({ licenseId, role, fee }: { licenseId: string; role: "owner" | "licensee"; fee: { amount: number; currency: string } }) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const load = () => api<{ payments: Payment[] }>(`/api/v1/payments?licenseId=${licenseId}`).then((r) => setPayments(r.payments)).catch(() => setPayments([]));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseId]);

  const settled = payments?.find((p) => p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded");
  const amount = settled ? formatMinor(settled.amount_minor, settled.currency) : formatMinor(toMinor(fee.amount, fee.currency), fee.currency);

  async function checkout(): Promise<string | null> {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api<{ checkoutUrl: string }>("/api/v1/payments/checkout", { method: "POST", json: { licenseId } });
      return r.checkoutUrl;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!payments) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]" aria-label="Licence fee">
      <span className="text-ink">{amount}</span>
      {settled ? (
        <Badge tone={settled.status === "paid" ? "success" : "neutral"}>
          {PAYMENT_STATUS_LABEL[settled.status]}
          {settled.paid_at && settled.status === "paid" ? ` · ${day(settled.paid_at)}` : ""}
        </Badge>
      ) : (
        <span className="text-ink-muted">Not paid yet</span>
      )}
      {settled?.provider ? <span className="text-ink-subtle">via {PROVIDER[settled.provider]}</span> : null}
      {!settled && role === "licensee" ? (
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            const url = await checkout();
            if (url) window.location.assign(url);
          }}
        >
          Pay {amount}
        </Button>
      ) : null}
      {!settled && role === "owner" ? (
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={async () => {
            const url = await checkout();
            if (!url) return;
            await navigator.clipboard?.writeText(url).catch(() => undefined);
            setMsg("Payment link copied. Send it to your licensee — it expires in 24 hours.");
          }}
        >
          Copy payment link
        </Button>
      ) : null}
      {settled && role === "owner" && settled.refunded_minor < settled.amount_minor ? (
        <Button size="sm" variant="ghost" onClick={() => setRefundOpen(true)}>
          Refund…
        </Button>
      ) : null}
      {msg ? (
        <span role="status" className="basis-full text-ink-muted">
          {msg}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="basis-full text-danger">
          {error}
        </span>
      ) : null}
      {refundOpen && settled ? (
        <RefundDialog
          payment={settled}
          onClose={(done) => {
            setRefundOpen(false);
            if (done) {
              setMsg("Refund sent to the payment provider. It shows here once they confirm it.");
              void load();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RefundDialog({ payment, onClose }: { payment: Payment; onClose: (done: boolean) => void }) {
  const left = payment.amount_minor - payment.refunded_minor;
  const [value, setValue] = useState(String(left / 10 ** currencyExponent(payment.currency)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stepUp = useStepUp();
  return (
    <>
    <Dialog open onOpenChange={(o) => (!o ? onClose(false) : undefined)}>
      <DialogContent title="Refund this payment" description={`Up to ${formatMinor(left, payment.currency)}, back to the original payment method. You'll be asked for your password.`}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const amountMinor = toMinor(Number(value), payment.currency);
              await stepUp.run((password) => api(`/api/v1/payments/${payment.id}/refunds`, { method: "POST", json: { amountMinor, reason, password } }).then(() => undefined));
              onClose(true);
            } catch (err) {
              setError(stepUpErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={`Amount (${payment.currency})`} htmlFor="refund-amount">
            <Input id="refund-amount" type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
          </Field>
          <Field label="Reason" htmlFor="refund-reason">
            <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-16" required />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={reason.trim().length < 3 || !(Number(value) > 0)}>
              Refund
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    {stepUp.dialog}
    </>
  );
}
