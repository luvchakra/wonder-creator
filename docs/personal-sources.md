# Personal Sources — overload-safe creative context

Owner spec "Personal Sources — Overload-Safe Creative Context Import & Synchronization" and boards "Personal Sources"
(parts 1–2), 2 Oct 2026. **Sync discovers. The creator decides what becomes creative material.**

## Shape

```text
CONNECT            DISCOVER                        REVIEW                  BRING IN
source_connections → source_sync_jobs (bounded)   → context_candidates   → Materials (provenance
(+ Vault secret)     → source_context_records       (1–5, references)       'personal_source') or
                       + source_sync_cursors                                 /create?materials=…
```

| Piece | Where |
| --- | --- |
| Schema, RLS, Vault credential functions, retention | `supabase/migrations/20261002000074_personal_sources.sql` |
| Engine: request, run, checkpoint, cancel, regroup, import | `packages/creator-sources/src/server.ts` |
| Budgets (env-tunable ceilings) | `packages/creator-sources/src/budgets.ts` |
| Redaction and sensitive-mail filter | `packages/creator-sources/src/redact.ts` |
| Cheap deterministic grouping | `packages/creator-sources/src/grouping.ts` |
| Connectors | `packages/creator-sources/src/connectors/` (native notes) |
| App deps, views | `apps/web/src/lib/sources.ts` |
| API | `/api/v1/personal-sources/{connections, sync, candidates}` |
| Screens | `/sources` (Connect your world), `/sources/:id` (manage), `/sources/candidates/:id` (review); Home › From your world |
| Tests | `packages/creator-sources/src/sources.test.ts`, `tests/db/personal-sources.test.ts`, `e2e/personal-sources.spec.ts` |

## Guarantees

* **Never inside a request.** `POST /sync` records the job(s) and returns `202` at once; the work runs after the response
  (`after()`), in slices of at most `sliceMs`, and the job worker (`/api/v1/jobs/run`) picks up what's left.
* **Bounded.** Per job: records (`quickRecordCap`), pages (`pageCap`), bytes (`byteCap`), wall time per slice, a timeout
  per provider call. Hitting a ceiling ends the job `partially_complete` (phase `limit`) — never "everything scanned".
* **Checkpointed.** Records are upserted on `(connection_id, provider_item_id)`, then the cursor is committed. A crash
  (a `running` job without a heartbeat for `staleMs`) resumes from the last committed cursor; replays never duplicate.
* **Deduplicated.** A partial unique index allows one active job per idempotency key
  (`creator:connection:scopeHash:mode`) and one per connection; a repeated tap gets the same job back.
* **Isolated.** One running job per creator, `globalRunning` across the system, `creatorHourly` new syncs per creator.
  A connector's failure stays with it: rate limits pause with backoff + jitter (honouring Retry-After), revoked access
  marks only that source `needs_reconnect`, other sources and the app carry on. Sync has the lowest priority (P3).
* **Minimum safe context.** The engine — not each connector — drops security/sign-in/statement items and redacts
  links, card numbers, emails, phone numbers, booking references and codes from titles and excerpts. Records stay at
  hydration L1/L2 and expire after `recordDays`; full content (L4) is fetched only for an item the creator imports.
* **Nothing without a choice.** Candidates reference records; only the records a creator selects from that candidate
  become private Materials (provenance `personal_source`, with provider and item id). Nothing reaches Community,
  Moments, Scrapbook or CreatorPublish without a separate, explicit action.
* **Disconnect** deletes the connection, its Vault secret, cursors, jobs, index and the suggestions built from it.
  Materials the creator brought in stay (they're the creator's).
* **No fake providers.** Mail, calendar and photos show "Not set up yet" until their connector ships.

## Phases (spec §14)

| Phase | Scope | Status |
| --- | --- | --- |
| A Foundation | Models, manual Sync, queue isolation, budgets, dedupe, checkpoints, cancel, Home card, native Notes connector | Done |
| B Gmail | Separate least-privilege read-only OAuth, bounded first scan, metadata-first, history cursor, review/import | Next |
| C Calendar + Notes | Bounded date windows, cross-source grouping; external notes only via documented APIs or import | |
| D Photos | PWA file picker/share first; thumbnails/metadata, clusters; no bulk originals | |
| E CreativeMind | Shortlist-only enrichment, one concise suggestion, targeted "look further back" | |
| F Hardening | Provider failure, expiry, rate limits, huge mailbox, large photo sets, congestion, load tests | |

## Tuning

`WONDERCREATOR_SOURCES_<NAME>` overrides any ceiling (`PAGE_SIZE`, `QUICK_RECORD_CAP`, `PAGE_CAP`, `BYTE_CAP`,
`SLICE_MS`, `CALL_TIMEOUT_MS`, `MAX_ATTEMPTS`, `GLOBAL_RUNNING`, `CREATOR_RUNNING`, `CREATOR_HOURLY`, `STALE_MS`,
`RECORD_DAYS`, `INITIAL_LOOKBACK_DAYS`). Kill switch: `WONDERCREATOR_FLAG_PERSONAL_SOURCES_ENABLED=off` (API 404s, Home
card and screens disappear). Telemetry (`sources.sync_requested`, `sources.sync_finished`, `sources.sync_error`,
`sources.imported`) records counts, pages, bytes and outcomes — never content.
