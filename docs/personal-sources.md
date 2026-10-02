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
| B Gmail | Separate least-privilege read-only OAuth, bounded first scan, metadata-first, history cursor, review/import | Done (needs owner Google setup) |
| C Calendar + Notes | Bounded date windows, cross-source grouping; external notes only via documented APIs or import | Calendar + cross-source grouping done; external notes via import (D) |
| D Photos | PWA file picker/share first; thumbnails/metadata, clusters; no bulk originals | Done (device picker; cloud pickers later) |
| E CreativeMind | Shortlist-only enrichment, one concise suggestion, targeted "look further back" | Done |
| F Hardening | Provider failure, expiry, rate limits, huge mailbox, large photo sets, congestion, load tests | |

## Tuning

`WONDERCREATOR_SOURCES_<NAME>` overrides any ceiling (`PAGE_SIZE`, `QUICK_RECORD_CAP`, `PAGE_CAP`, `BYTE_CAP`,
`SLICE_MS`, `CALL_TIMEOUT_MS`, `MAX_ATTEMPTS`, `GLOBAL_RUNNING`, `CREATOR_RUNNING`, `CREATOR_HOURLY`, `STALE_MS`,
`RECORD_DAYS`, `INITIAL_LOOKBACK_DAYS`). Kill switch: `WONDERCREATOR_FLAG_PERSONAL_SOURCES_ENABLED=off` (API 404s, Home
card and screens disappear). Telemetry (`sources.sync_requested`, `sources.sync_finished`, `sources.sync_error`,
`sources.imported`) records counts, pages, bytes and outcomes — never content.

## Gmail (phase B)

Connector: `packages/creator-sources/src/connectors/gmail.ts` (OAuth helpers in `google.ts`); routes
`/api/v1/personal-sources/google/{connect,callback}` (one callback for every Google source).

* **Own consent, read-only.** `gmail.readonly` only, `include_granted_scopes=false`, offline access, PKCE (S256), a
  random `state`; the state and verifier travel in an AES-GCM-sealed, httpOnly cookie scoped to the callback path for
  10 minutes. Google sign-in grants nothing here. A grant without the Gmail scope or without a refresh token is refused.
* **Credential.** The refresh token goes straight into Vault (`source_secret_store`); access tokens are minted per
  slice and never stored. Disconnect revokes the grant at Google (best effort) and destroys the Vault secret.
* **First sync.** A bounded recent window (30 days by default; 7 or 90 by choice), inbox (sent mail optional), never
  spam, trash, promotions, social or forums; bulk mail (`List-Unsubscribe`, `Precedence: bulk`) skipped. Metadata only:
  Subject, date and Gmail's own snippet (then redacted). The profile `historyId` is captured first.
* **Next syncs.** `users.history.list` from the cursor's `historyId` (messages added). An expired history (404) recovers
  with a window since the last successful sync (at most the chosen look-back) — never a full-mailbox rebuild.
* **Import.** Only for a message the creator selects: `format=full`, the text/plain part, quoted replies and signatures
  dropped, redacted, capped at 20k characters, as a private Material with provenance.
* **Failures.** `invalid_grant`/401 → `needs_reconnect` (Reconnect on the manage page); 429/403 → paused with
  Retry-After; 5xx/timeouts → retried with backoff, then failed. Other sources carry on.

### Owner setup

1. Google Cloud console → the project used for sign-in (or a new one) → **APIs & Services → Library**: enable the
   **Gmail API** and the **Google Calendar API**.
2. **OAuth consent screen**: add the scopes `https://www.googleapis.com/auth/gmail.readonly` and
   `https://www.googleapis.com/auth/calendar.events.readonly` (sensitive). Gmail's is a *restricted*
   scope: while the app is in **Testing**, add test users; for public use Google requires verification and an annual
   security assessment (CASA).
3. **Credentials → Create OAuth client ID → Web application** (or reuse the sign-in client): authorised redirect URI
   `https://<your-domain>/api/v1/personal-sources/google/callback` (and `http://localhost:3000/...` for local). The same
   URI serves Calendar.
4. Vercel → Environment Variables: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (Production + Preview).
   Until both are set, Gmail and Calendar show "Not set up yet".

## Calendar (phase C)

Connector: `packages/creator-sources/src/connectors/calendar.ts`. Its own consent (`calendar.events.readonly`). A
bounded window of the primary calendar (30 days back / 60 ahead by default; 7–90 back, 0–60 ahead by choice), then
Calendar's `syncToken`; an expired token (410) restarts the bounded window. Kept: title, date and the **town** only
(`placeOf` reduces an address to its town, never the street). Never attendees, descriptions, conference links or
addresses; declined, cancelled, out-of-office/focus/working-location and online meetings are skipped.

Cross-source grouping: a mail or note without a place joins a place's group when it names that place and falls within
three days of it ("a travel email near a calendar event").

## Photos (phase D)

No background access to a camera roll: the creator chooses photos in the browser's own picker (`Select photos`, up to
200 at a time). On the device (`apps/web/src/components/sources/local-photos.ts`) each photo gives its SHA-256, when it
was taken (EXIF `DateTimeOriginal`, else the file date) and a ≤12 KB JPEG thumbnail; only that is sent, 25 per request,
500 an hour (`POST /api/v1/personal-sources/photos`). The server content-checks every thumbnail and keeps it inside the
record (migration 075), so it is private by RLS and disappears with the record — expiry, disconnect or erasure — with
nothing left in storage. A day the creator photographed a lot (4+) becomes a group led by their own photo.

Originals stay in the browser's memory for that visit. Bringing a photo in uploads **only the chosen originals** through
the normal upload checks (`/api/v1/send`); the import accepts it only when the uploaded file's SHA-256 matches the
photo that was discovered. On a later visit the creator is asked to choose those photos again — the originals never
left the device. Cloud photo libraries need their providers' own pickers and consent; not built yet.

## CreativeMind and search (phase E)

* **Shortlist only** (`packages/creator-sources/src/enrich.ts`, migration 076). After grouping, at most
  `aiGroupCap` (≤ the 5 shown) groups get one concise possibility ("A short photo essay about the quiet streets of
  Pune") and a suggested format — only with a live model (the creator's own key or the platform's; never a
  placeholder), only from the already-redacted titles and excerpts, fenced as untrusted, and only when the group's
  content hash changed. The server stores the line; creators can't write it. "Bring to Studio" opens a new Creation
  with the chosen Materials and that possibility as its prompt.
* **Search your world** (`/sources/search`): searches the creator's own index (titles, previews, places) as they type —
  nothing is fetched. **Look further back** starts a *targeted* job per source (`mode = 'targeted'`, priority P4,
  plain search terms only, its own cursor): Gmail a year back, Calendar a year back, notes three years — still bounded
  by the same budgets, and it never moves the source's regular sync. Found items can be brought in directly
  (`/api/v1/personal-sources/records/import`) with the same checks as from a candidate.
