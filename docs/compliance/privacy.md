# Privacy compliance — GDPR and India's DPDP Act 2023

Status: built to support GDPR (EU/UK) and the Digital Personal Data Protection Act, 2023 (India) and its Rules.
**Not legal advice.** The public texts (`/legal/privacy`, `/legal/terms`) are plain-language drafts that must be
reviewed by counsel before launch, and the controller details below must be completed by the owner.

## Owner actions before launch
- Name the legal entity, registered address and (if needed) EU/UK representative in `/legal/privacy`.
- Appoint a Grievance Officer (DPDP §8(10)) and, if required, a DPO; set `WONDERCREATOR_GRIEVANCE_OFFICER` and
  `WONDERCREATOR_PRIVACY_CONTACT`.
- Sign DPAs with every subprocessor (`apps/web/src/app/legal/subprocessors/data.ts`), with SCCs where data leaves the EU/UK.
- Decide whether Wonder Creator could be notified as a Significant Data Fiduciary (DPDP §10): if so, DPIA + audit.
- Counsel review of the notice, terms, retention periods and the 18+ age policy.

## How the product implements it

| Requirement | GDPR | DPDP | Implementation |
|---|---|---|---|
| Notice before collection | Arts. 12–14 | §5 | `/legal/privacy`, versioned (`NOTICE_VERSION`); linked at sign-up and on `/consent` |
| Consent: free, specific, informed, unambiguous; provable | Art. 7 | §6 | `consent_records` (append-only, per purpose, notice version, method); required consents gate every signed-in page (`requireSession` → `/consent`); re-asked when the notice version changes |
| Withdrawal as easy as giving | Art. 7(3) | §6(4) | Settings › Privacy switches write a `granted: false` row; telemetry checks the latest choice on every event |
| Optional purposes off by default | Art. 25 | §6 | Usage measures and product emails are opt-in |
| Children | Art. 8 | §9 | Service is 18+: declaration at sign-up (`age_confirmation`); no tracking or targeted advertising of anyone |
| Access / portability | Arts. 15, 20 | §11 | `GET /api/v1/account/export` — every table holding the creator's rows (`EXPORT_TABLES`), with a DB test that fails when a new `creator_id` table is neither exported nor excluded with a reason |
| Correction | Art. 16 | §12 | Direct editing; `privacy_requests` kind `correction` for anything else |
| Erasure | Art. 17 | §12 | Per-item delete everywhere; account deletion with step-up cascades all creator data and storage objects |
| Objection / restriction | Arts. 18, 21 | — | `privacy_requests` kind `objection` |
| Nomination | — | §14 | `privacy_requests` kind `nomination` |
| Grievance redressal | Art. 77 (complaint to SA) | §§8(10), 13 | `privacy_requests` kind `grievance`; Grievance Officer in the notice; Data Protection Board / supervisory authority named |
| Deadlines | Art. 12(3): 1 month | Rules | `privacy_requests.due_at` = filed + 30 days; open requests indexed by due date |
| Evidence of handling | Art. 5(2) | §8(1) | Server-written audit (`privacy_request.received`, `privacy_request.<status>`); clients can't write the `privacy_request.*` or `consent.*` audit namespaces |
| Storage limitation | Art. 5(1)(e) | §8(7) | `app.run_retention()` daily from the job worker; each run audited as `retention.run` |
| Security of processing | Art. 32 | §8(5) | `docs/security.md`, `/legal/security` |
| Processors | Art. 28 | §8(2) | Subprocessor list; AI providers receive only the material the creator chooses, never for training |
| Transfers | Arts. 44–49 | §16 | Adequacy/SCCs; no transfer to countries restricted by notification |
| Cookies / ePrivacy | ePrivacy Art. 5(3) | — | Only strictly necessary auth cookies; no banner needed |
| No solely automated decisions with legal effect | Art. 22 | — | AI never decides rights, commerce or account status (governance ceilings) |

## Record of processing activities (Art. 30)

| Activity | Data subjects | Categories | Purpose | Basis | Recipients | Retention |
|---|---|---|---|---|---|---|
| Accounts & sign-in | Creators | Email, password hash, name, handle, MFA factors | Provide the service | Contract | Supabase | Life of account |
| Creative workspace | Creators, people in their material | Materials, Creations, notes, voice, images, documents | Provide the service | Contract / consent | Supabase, Vercel | Until deleted |
| CreativeMind | Creators | Chosen material, prompts, outputs | AI assistance on request | Contract / consent | Gemini or Anthropic (when configured) | Provider: per DPA (no training); ours: runs kept with the account, proposals 90 days |
| Huddles | Creators | Live audio/video, chat, presence | Live collaboration | Contract | LiveKit (when configured) | Ephemeral; preserved items until deleted |
| Community & messaging | Creators | Posts, replies, DMs, follows | Social features | Contract | Supabase | Until deleted (soft-deleted replies purged after 30 days) |
| Payments & licensing | Creators, licensees | Amounts, status, provider ids, payer email | Licences, payouts, refunds, accounting | Contract, legal obligation | Stripe, Razorpay | Statutory (8 years India / up to 10 EU) |
| Security & audit | Creators | IP, device, sign-ins, actions | Security, fraud prevention, accountability | Legitimate interests / §7(i) | — | Immutable; de-linked on account deletion |
| Product analytics | Creators who opted in | Named outcome events, counts, timings | Product improvement | Consent | Vercel logs | Log retention of the host |
| Privacy requests | Creators | Request kind, details, outcome | Rights handling | Legal obligation | — | 3 years after closure |

## Retention schedule (`app.run_retention`)

| Data | Purged when |
|---|---|
| AI proposals (decided, expired, failed) | 90 days after creation |
| AI proposals pending past expiry | 30 days after expiry |
| Share links | 30 days after expiry |
| Deleted conversation replies, Moment references | 30 days after deletion |
| Moment connections | 30 days after expiry |
| Background jobs (succeeded/dead) | 30 days |
| Capture receipts (idempotency) | 90 days |
| Rate-limit counters | 1 day |
| Privacy requests | 3 years after closure |
| Payment/ledger records | Statutory period (handled by the financial controls, not this job) |
| Backups (hosted) | Rolling, per Supabase plan (≤30 days) |

## Handling a privacy request (operator runbook)
1. Requests appear in `privacy_requests` (status `received`, `due_at` set). Query open ones ordered by `due_at`.
2. Verify the requester is the account holder (they filed it signed in; for nominations, verify the nominee's identity
   and authority out of band).
3. Set `status = 'in_progress'` (service role); act; set `status = 'completed'` or `'rejected'` with a plain `response`.
   Status changes are audited automatically and `closed_at` is stamped.
4. Rejections must give the reason and how to complain (Data Protection Board / supervisory authority).

## Personal data breach procedure
1. **Detect & contain** — revoke keys, rotate secrets, block the vector; preserve logs (audit logs are immutable).
2. **Assess** within 24 hours — what data, whose, how many, likely consequences; record everything in an incident log.
3. **Notify**:
   - GDPR: the lead supervisory authority **within 72 hours** of becoming aware unless unlikely to result in a risk
     (Art. 33); affected people without undue delay when high risk (Art. 34).
   - DPDP: the **Data Protection Board** and **each affected Data Principal** for every breach, in the form and time the
     Rules prescribe (intimation without delay, detailed report within 72 hours) (§8(6)).
   - CERT-In: cyber incidents within **6 hours** of noticing (CERT-In Directions, 2022).
4. **Remediate & review** — root cause, fixes, tests; update `docs/security.md` and this file.

## Changing the notice
Bump `NOTICE_VERSION` in `packages/creator-identity/src/privacy-options.ts` when the Terms or Privacy notice change
materially. Every creator is then shown `/consent` ("We've updated our terms") before continuing; their prior optional
choices are kept.
