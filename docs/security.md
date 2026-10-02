# Security & privacy

## Authorization
- Every creator-owned table has RLS keyed on `app.current_creator_id()` (resolved from the JWT, never from input).
- Cross-row references are ownership-checked in policies (provenance, storage objects, conversations, AI runs,
  memories, versions, lineage sources of every type).
- Worker-owned state (storage registration, intake/job state, scan & processing status) is writable only by the
  service role; a trigger silently preserves these columns on client writes.
- Huddle transitions are security-definer RPCs implementing the authorization matrix (join requests need approval
  by a joined participant other than the requester; host-only remove/end fail closed).
- `app.*` internal functions are not executable by clients (default privileges revoked).
- `tests/db` (278 tests) covers isolation, ID tampering, cross-tenant reads/writes, huddle access, dissolution,
  stale presence, storage, events and audit immutability.

## Input handling
- **Uploads**: content-detected MIME allow-list (extension ignored), per-kind size limits, SHA-256, filename
  sanitisation, private bucket, opaque paths, short-lived signed URLs. At `security_review`, before anything is
  stored, an optional `MalwareScanner` checks the file's SHA-256 reputation (VirusTotal, enabled with
  `WONDERCREATOR_MALWARE_SCAN_PROVIDER` + `_API_KEY`); files flagged by 3+ engines are quarantined and never kept.
  Only the hash leaves the platform (private work is never uploaded), so novel malware isn't detected; lookup
  failures don't block uploads. Files are only ever served back to their owner via signed URLs, never executed.
- **URLs**: `safeFetch` blocks non-http(s), credentials, non-standard ports, private/reserved/link-local/metadata
  addresses (IPv4 + IPv6, DNS-rebinding check on every redirect hop), with timeout and byte caps. Residual
  TOCTOU between DNS check and connect: deploy behind an egress proxy that blocks private ranges.
- **Prompt injection**: all external material is fenced as data with an explicit policy; fences can't be closed from
  inside; imported material cannot trigger governed tools (autonomy + governance are deterministic).

## Accounts (IT security pass, 2 Oct 2026)
- **Password policy**: ≥10 characters with letters and digits, not a common password, not containing the email —
  `passwordProblem` (`@wonder/core`), checked in the browser and again on the server (`/api/v1/account/password`).
  The auth server enforces its own floor (`supabase/config.toml`: `minimum_password_length = 10`,
  `password_requirements = "letters_digits"`). **Hosted project**: set the same in the Supabase dashboard and turn on
  leaked-password protection (HaveIBeenPwned), session time-box / inactivity timeout and email confirmation.
- **Two-step verification (TOTP)**: Settings → Privacy & Security. Once enrolled, a session that has only passed the
  password (`aal1` with a verified factor) is sent to `/sign-in/verify` by `requireSession`, and every API route
  answers 401 until the code is entered (`mfaPending`, `withApi`). Turning it off needs a verified (`aal2`) session.
- **Password change / reset**: change needs the current password (step-up) and is audited; reset uses a single-use
  email link and answers identically whether or not the email has an account (no account enumeration).
- **Step-up** (password re-entry) for account deletion, ownership transfer, commercial licences, password change and
  refunds.

## Platform
- CSP (`object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` in production), HSTS with preload,
  X-Frame-Options DENY, nosniff, strict referrer, minimal permissions policy, COOP `same-origin`, CORP `same-site`,
  `X-Permitted-Cross-Domain-Policies: none`, `Origin-Agent-Cluster` (`next.config.ts`). Known gap: scripts still allow
  `'unsafe-inline'` (Next.js inline bootstrap); moving to per-request nonces is tracked in docs/progress.md.
- Cross-site mutation protection in `withApi`: a foreign `Origin`, or Fetch Metadata `Sec-Fetch-Site` other than
  `same-origin`/`none`, is refused (signed webhooks, which send neither, are unaffected). Rate limits are keyed by
  user, else by the platform-set client address (`x-vercel-forwarded-for`, not the spoofable first hop); per-user rate limits shared across instances
  (`rate_limit_hit` RPC over an unlogged counter table, service role only, so callers can't spend another user's
  limit; an in-memory limiter rejects bursts first and is the fallback if the database is unreachable).
- Structured logs redact tokens, secrets, prompts and content.
- **Audit integrity**: `audit_logs` / `domain_events` are append-only (update/delete triggers; TRUNCATE revoked).
  A signed-in session may record only its own ordinary events (marked `via: session`); the financial, privacy-request,
  consent, retention and admin namespaces are reserved for the server (migration `…068`).
- **Disclosure**: `/legal/security` (policy) and `/.well-known/security.txt` (RFC 9116; contact from
  `WONDERCREATOR_SECURITY_CONTACT`).

## Supply chain & CI
- `.github/workflows/security.yml`: `npm audit --omit=dev --audit-level=high`, gitleaks secret scanning (full
  history), CodeQL (`security-extended`), weekly as well as on every push and PR. Dependabot for npm and GitHub
  Actions (`.github/dependabot.yml`). Workflow tokens are `contents: read` by default.

## Privacy
- Private by default; artifacts become visible only when final **and** public.
- AI context minimisation per intent; privacy classes enforced before retrieval.
- Huddles leave no transcript, recording or participant history; only explicitly preserved outcomes persist.
- Data export (`/api/v1/account/export`) and permanent deletion (cascade + storage cleanup).
