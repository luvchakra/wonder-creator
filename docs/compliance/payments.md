# Payments — Stripe and Razorpay

Licence fees are collected through **Razorpay** (INR: UPI, Indian cards, netbanking, wallets) and **Stripe** (every
other currency, and INR when Razorpay isn't connected). Implementation: `packages/creator-payments`, migration 070,
`/api/v1/payments/**`. Card and bank details are entered only on the provider's hosted page.

## Setup (owner)
| Variable | Where |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (use a **restricted key** with Checkout Sessions + Refunds write) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint `https://<app>/api/v1/payments/webhooks/stripe`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, `refund.failed` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Account & Settings → API keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay → Webhooks → `https://<app>/api/v1/payments/webhooks/razorpay`, events `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `refund.processed`, `refund.failed` |

A provider counts as connected only when all of its variables are set. Unconnected: "Payments aren't connected" (503),
Settings shows "Not connected" — never a simulated payment.

## Flow
1. **Open** — the licence owner ("Copy payment link") or licensee ("Pay ₹…") calls `POST /api/v1/payments/checkout`.
   `payment_order_open` checks the licence is active and has a fee and the caller is its owner or licensee, and takes
   amount, currency and payee **from the licence**. One live order per licence (unique index): asking again reuses it.
2. **Checkout** — the server creates a Stripe Checkout Session (idempotency key `order-<id>`) or Razorpay Payment Link
   (`reference_id = order id`, so a retry finds the same link) and records it with the service role.
3. **Confirm** — only a webhook with a valid signature settles money (Stripe: HMAC-SHA256 of `t.body`, 5-minute window;
   Razorpay: HMAC-SHA256 of the body). Returning to `/payments/<id>` never marks anything paid.
4. **Apply** — `payment_apply_event` (one transaction): dedupes on the provider event id, checks the amount and currency
   against the order (a mismatch is never settled: `payment.amount_mismatch`), refuses a second settlement for the same
   licence (`payment.duplicate_charge`), marks the order paid, posts a balanced journal and settles the creator's
   expected licence income in Business (`payment_order_id` set).
5. **Refund** — the payee only, password re-checked, never more than paid minus in-flight refunds. The provider's
   refund webhook reverses the journal; a full refund cancels the income record. Refunds made in the provider dashboard
   are recorded too, so the books match the provider.

## Ledger
Append-only double entry (`ledger_entries`, immutable even for the service role; truncate revoked). Each journal is
balanced per currency at posting time (`app.post_journal`).

| Event | Debit | Credit |
|---|---|---|
| Fee received | `provider_clearing:<provider>` | `creator_payable` |
| Refund | `creator_payable` | `provider_clearing:<provider>` |

## Security & PCI DSS
- Hosted payment pages only: Wonder Creator never receives, stores or transmits card data → PCI DSS **SAQ A** scope
  (owner completes the SAQ annually with the providers' attestation).
- Provider keys are server-only environment variables; the browser never sees them.
- Webhooks: signature + timestamp checks, body size limit, per-IP rate limit, idempotent application, raw payloads not
  stored (only ids, amounts, status and a SHA-256 of the body).
- Every money step is audited server-side in reserved namespaces (`payment.*`, `refund.*`) that clients can't write.
- Financial records outlive an erased account (statutory retention) but no longer link to it.

## Open decisions for the owner (regulatory)
- **Who is the merchant of record.** Today fees settle to the platform's Stripe/Razorpay account and are owed to the
  creator (`creator_payable`). Paying creators out automatically needs **Stripe Connect** / **Razorpay Route** onboarding
  (KYC per creator) — and in India, collecting on behalf of others may require RBI Payment Aggregator authorisation or
  using the provider's marketplace product. Until decided, payouts are recorded in Business by the operator.
- GST/VAT on platform fees and invoices (no platform fee is charged today).
