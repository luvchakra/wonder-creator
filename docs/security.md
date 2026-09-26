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
  sanitisation, private bucket, opaque paths, short-lived signed URLs. *No malware scanner is configured*: files
  passing validation are marked `clean`; integrate a scanner at `security_review` before production if required.
- **URLs**: `safeFetch` blocks non-http(s), credentials, non-standard ports, private/reserved/link-local/metadata
  addresses (IPv4 + IPv6, DNS-rebinding check on every redirect hop), with timeout and byte caps. Residual
  TOCTOU between DNS check and connect: deploy behind an egress proxy that blocks private ranges.
- **Prompt injection**: all external material is fenced as data with an explicit policy; fences can't be closed from
  inside; imported material cannot trigger governed tools (autonomy + governance are deterministic).

## Platform
- CSP, HSTS, X-Frame-Options DENY, nosniff, strict referrer, minimal permissions policy (`next.config.ts`).
- Cross-site mutation protection (Origin check) in `withApi`; per-user rate limits (in-memory per instance —
  swap for a shared store for multi-instance deployments).
- Step-up authentication (password re-entry) for account deletion.
- Structured logs redact tokens, secrets, prompts and content.

## Privacy
- Private by default; artifacts become visible only when final **and** public.
- AI context minimisation per intent; privacy classes enforced before retrieval.
- Huddles leave no transcript, recording or participant history; only explicitly preserved outcomes persist.
- Data export (`/api/v1/account/export`) and permanent deletion (cascade + storage cleanup).
