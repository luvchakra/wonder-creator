"use client";
import { formatMinor, PAYMENT_STATUS_LABEL, type PaymentStatus } from "@wonder/creator-payments/money";
import { KIT, KitArt } from "@wonder/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Payment = { id: string; status: string; amount_minor: number; currency: string; description: string; artifact_id: string | null; provider: string | null; paid_at: string | null };

/** Waits (briefly) for the provider's confirmation, then says plainly what happened. */
export function PaymentStatusView({ initial, cancelled }: { initial: Payment; cancelled: boolean }) {
  const [p, setP] = useState(initial);
  const [waited, setWaited] = useState(0);
  const waiting = p.status === "open" || p.status === "created";
  useEffect(() => {
    if (!waiting || cancelled || waited >= 20) return;
    const t = setTimeout(() => {
      void api<{ payment: Payment }>(`/api/v1/payments/${p.id}`).then((r) => setP(r.payment)).catch(() => undefined);
      setWaited((w) => w + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [waiting, cancelled, waited, p.id]);

  const amount = formatMinor(Number(p.amount_minor), p.currency);
  const heading = p.status === "paid" ? "Payment received" : cancelled && waiting ? "Payment not completed" : waiting ? "Confirming your payment…" : PAYMENT_STATUS_LABEL[p.status as PaymentStatus];
  return (
    <section className="relative isolate mx-auto mt-6 max-w-md overflow-hidden rounded-3xl border border-border-soft bg-surface p-6 shadow-[var(--shadow-card)]" aria-live="polite">
      <KitArt art={KIT.botanical.botanicalSprig2} sizes="8rem" className="pointer-events-none absolute -right-6 -top-6 -z-10 h-auto w-28 opacity-70" />
      <h1 className="font-display text-[26px] leading-tight text-ink">{heading}</h1>
      <p className="mt-2 text-sm text-ink">
        {p.description} · <span className="font-medium">{amount}</span>
      </p>
      <p role="status" className="mt-2 text-[13px] text-ink-muted">
        {p.status === "paid"
          ? `Confirmed by ${p.provider === "razorpay" ? "Razorpay" : "Stripe"}. A receipt comes from them by email.`
          : cancelled && waiting
            ? "Nothing was charged. You can pay any time from the licence."
            : waiting && waited >= 20
              ? "We haven't heard from the payment provider yet. If you paid, this updates by itself — there's no need to pay again."
              : waiting
                ? "This takes a few seconds."
                : "Nothing more to do here."}
      </p>
      {p.artifact_id ? (
        <Link href={`/artifacts/${p.artifact_id}?tab=rights`} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          Back to the Creation
        </Link>
      ) : null}
    </section>
  );
}
