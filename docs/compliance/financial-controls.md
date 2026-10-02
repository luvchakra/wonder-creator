# Financial controls — SOX-style controls matrix

Wonder Creator collects licence fees (docs/compliance/payments.md). This document maps the controls built into the
product and its delivery process to the areas a SOX 404 / ICFR review, an Indian statutory auditor (Companies Act 2013
§143(3)(i), Rule 3(1) audit-trail requirement of the Companies (Accounts) Rules) or an ISAE 3402 / SOC 1 examination
would test. **It supports those reviews; it is not a certification.** Management owns the control environment
(entity-level controls, policies, sign-offs) listed under *Owner responsibilities*.

## Application controls

| # | Control | Objective | How it works | Evidence / test |
|---|---|---|---|---|
| AC-1 | Amount from source | Accuracy | An order's amount, currency and payee come from the active licence (`payment_order_open`), never from the request | `tests/db/payments.test.ts` "takes the amount…" |
| AC-2 | No client writes to money | Authorisation | Orders, refunds, ledger and provider events are written only by security-definer functions; clients have no insert/update/delete | DB tests "clients can't write orders", "append-only" |
| AC-3 | Provider-confirmed settlement | Occurrence | Only a webhook with a valid signature (and fresh timestamp for Stripe) settles; returning from checkout changes nothing | `payments.test.ts` (unit), `e2e/payments.spec.ts` forged-event refusal |
| AC-4 | Exactly once | Completeness / accuracy | Provider event ids are unique; replays return `duplicate`; repeated state changes are `duplicate_state` | DB + e2e replay tests |
| AC-5 | Amount check | Accuracy | A confirmation whose amount or currency differs from the order is not settled and is audited (`payment.amount_mismatch`) | DB test "different amount is never settled" |
| AC-6 | No double settlement | Accuracy | One live and one paid order per licence (unique indexes); a second charge is flagged (`payment.duplicate_charge`) | migration 070 |
| AC-7 | Balanced double entry | Accuracy | `app.post_journal` refuses unbalanced journals; ledger rows are immutable (update/delete/truncate blocked, even for the service role) | DB "append-only", reconciliation C1 |
| AC-8 | Refund authorisation | Authorisation | Only the payee; password re-checked (step-up); never more than paid minus in-flight refunds; settled only by provider confirmation | DB "only the payee refunds", e2e refund step-up |
| AC-9 | Settled records locked | Integrity | A business record settled by a payment can't be re-marked by the creator (refund instead) | `tests/db/financial-controls.test.ts` |
| AC-10 | Daily reconciliation | Completeness / accuracy | `run_reconciliation()` (job worker): C1 journals balance; C2 order vs ledger; C3 paid order ↔ one business record; C4 unapplied provider events; C5 refunds unconfirmed after 7 days; stale checkouts expired. Exceptions are immutable and reviewed | reconciliation tests; `reconciliation_runs`, `reconciliation_exceptions` |
| AC-11 | Audit trail | Accountability | Every money step is audited server-side (`payment.*`, `refund.*`, `reconciliation.*`) in namespaces clients can't write; audit logs are append-only and can't be truncated | migration 068 tests |
| AC-12 | Statements | Reporting | Creators download their ledger lines (CSV, formula-injection safe); downloads are audited | `/api/v1/payments/statement` |

## IT general controls (ITGC)

| Area | Control | Implementation |
|---|---|---|
| Access — authentication | Strong passwords, optional TOTP 2FA, step-up for high-impact actions | `docs/security.md` |
| Access — least privilege | RLS on every table; service key server-only and used only for pipeline state; provider keys server-only | invariants in `CLAUDE.md`, `tests/db` |
| Access — privileged | Operator actions run with the service role, are audited, and can't edit the ledger, audit log or reconciliation evidence | migrations 068, 070, 071 |
| Change management | Every change through a PR with CI (lint, types, unit, RLS suite, e2e, CodeQL, secret scan, dependency audit); owner review via `CODEOWNERS` on money/privacy/security/schema paths; migrations append-only | `.github/` |
| Operations | Daily job (retention, reconciliation) with logged failures; idempotent webhooks with provider retries | `api/v1/jobs/run` |
| Data integrity / backup | Managed Postgres with point-in-time recovery (hosted plan); immutable evidence tables | Supabase plan |
| Incident response | Breach and incident runbook (GDPR 72 h, DPDP Board, CERT-In 6 h) | `docs/compliance/privacy.md` |

## Retention
Payment orders, refunds, provider events, ledger entries, reconciliation evidence and their audit entries are **not**
purged by the retention job. Keep for at least 8 years (Companies Act §128(5)); erased accounts are de-linked (`creator_id`
set null on orders/refunds; ledger keeps an id that no longer resolves).

## Other financial regulation (pointers, owner to confirm with counsel)
- **PCI DSS** — hosted checkout only → SAQ A (docs/compliance/payments.md).
- **RBI** — payment aggregation for third parties requires authorisation or the provider's marketplace product (Razorpay Route / Stripe Connect) — see payments.md "Open decisions".
- **FEMA / cross-border** — international payments to an Indian entity: purpose codes and FIRC/e-FIRA through the provider.
- **GST / VAT** — not charged today (no platform fee); revisit before charging fees.
- **PSD2 / SCA** — handled by Stripe Checkout (3-D Secure).

## Owner responsibilities (entity level)
- Approve this matrix; assign a control owner per row; review reconciliation exceptions daily and sign off monthly.
- Turn on branch protection for `main` (required checks + code-owner review) and restrict who can merge.
- Restrict production database and provider dashboard access; review access quarterly; enforce 2FA on GitHub,
  Supabase, Vercel, Stripe and Razorpay accounts.
- Keep provider keys in the hosting secret store; rotate on staff change or suspected exposure.
