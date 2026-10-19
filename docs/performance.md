# Performance — where the time goes, and the plan

Owner, 6 Oct 2026: "the app is running quite slow, check and find the causes … look deep to make the app speed faster,
plan the optimization properly". This is the contract for that work: what was measured, what costs what, and the
order things are fixed in. Status lives in `docs/progress.md`.

## What was measured (6 Oct 2026)

**The servers are not the problem.** Vercel functions run in Mumbai (`bom1`) and the Supabase project is in
`ap-south-1`; sessions are verified from the JWT locally (no auth round trip); the database cache hit rate is 99.99%;
there are three creators' worth of data; the database answers the typical query in 5 ms.

**Each request to the database costs ~90 ms, whatever it asks.** Supabase edge logs for the function's requests: mean
88 ms, p50 23 ms, p95 333 ms per request at Supabase's edge, of which PostgREST itself is 60 ms mean / 153 ms p95. The
project runs on a small (Micro) compute instance, and PostgREST, auth, storage and the gateway share it. So the cost of
a page is **how many requests it makes, and how many of them wait for one another**, not what the queries do.

**A page load fires everything at once, and the instance queues it.** Live, right after a page lands, the bell's
`/api/v1/notifications` (≈20 queries) took 1.6 s and `/api/v1/messages/unread` 1.2 s, while the same calls a second
later took 0.2–0.35 s. Vercel runs the project as classic functions ("LAMBDAS", not Fluid Compute), so each of those
concurrent calls may also start its own instance.

**Requests per page load** (local production build, zero network latency; before → after #153):

| Page | Before | After #153 | Server HTML done (local) |
|---|---|---|---|
| Home | 120 | 94 | 0.9 s |
| Creations | 55 | 34 | 0.2 s |
| Rooms | 28 | 9 | 0.4 s |
| Materials | 30 | 11 | 0.2 s |
| Me | 66 | 28 | 0.2 s |
| Pulse | 52 | 50 | 0.4 s |
| Creation page | 58 | 38 | 0.4–0.6 s |
| Writing page | 58 | 54 | 0.1–1.5 s |

Every page pays a baseline before its own work: the session (creator row, then consents — two round trips in
sequence), the layout's avatar (two more), then the bell and the unread count from the browser once the page is up.

**The page waits for all of it.** Home's HTML arrives at ~0.9 s locally in one piece; the skeleton from
`loading.tsx` shows until then. Live, with ~90 ms a round trip and queueing, that is 3–5 s of skeleton.

**JavaScript on every page: 335 KB gzipped (1.2 MB parsed)**; the Creation page 461 KB; the Writing page 497 KB.
On a phone that is 0.3–0.6 s of parsing and running before anything is interactive, on top of the download.

## The rules

* **Count round trips, not queries.** A round trip is ~90 ms live. Sequential ones add; parallel ones queue.
  A page's data must come in **at most three dependent stages**: session → the object → everything about it.
* **One call per browser poll.** Anything the browser asks on every page (the bell, unread) is one database call.
* **Show the page before it is all there.** The shell (header, the one dominant action, Quick Capture) streams
  first; sections that need their own queries stream in behind calm fallbacks of the same height. Never a spinner.
* **Nothing twice.** A request's session, consents and avatar are read once (`cache`/`WeakMap` memoisation) and
  shared by the layout, the page and every analytics event.
* **Ship less JavaScript.** Sheets, canvases and panels that a page may never open load when opened
  (`next/dynamic`). A list page should be ≤ 200 KB gzipped.
* **Measure before and after.** Every performance PR records requests per page and server HTML time from the local
  production build (the probe in the PR description), and the live p95 from Supabase's edge logs once deployed.

## Plan

| Phase | What | Status |
|---|---|---|
| 0 | Notifications shared between Home and the bell; the bell refreshes less; API wrapper runs creator lookup ∥ rate limit; consent once per request; Home's independent sections in parallel (#153) | Done |
| 1a | Session: creator row ∥ consents; the layout's avatar from the creator row (no lookups). Every page's first byte 230 → 100 ms (60 ms per request, local) | Done |
| 1b | Writing/Studio screen and the Creation page in three or four dependent stages (were 9 and 6); the Room page's parts data in one stage (was 5) | Done |
| 2 | Home streams: greeting + Quick Capture at once, Scrapbook and the rest each behind a quiet placeholder; Pulse's two Home helpers (signals, glance) in parallel branches instead of ~13 sequential requests each; Home's chain shortened. Home first paint 420 → 300 ms, everything 2.1 → 1.1 s; Continue links straight to each Creation's page (no forwarding page load) | Done |
| 3 | The bell: one database function (`notifications_feed`, migration 091, SECURITY INVOKER so RLS decides exactly as before) instead of ~19 queries; the app maps its rows with the same code, and falls back to the separate queries if the function isn't there (mid-deploy). Each bell refresh: 19 → 2 database requests | Done |
| 4 | Less JavaScript (gzip): the Supabase browser client only for big uploads (it rode on every page); the Palette's meTalk and Create sheets on first open; the Studio's picture/deck/storyboard readers on `zod/mini`; the license vocabulary split from its form schemas, the license panels on demand. Home 335 → 269 KB, lists 326 → 258 KB, Creation page 461 → 302 KB, Writing page 497 → 368 KB | Done |
| 5 | Profile (Me): every read starts after the profile lookup and overlaps (was seven stages in a row): 0.87 → 0.55 s with 60 ms per request; the avatar menu links to the profile directly (no `/me` redirect). Pulse streams: its tabs, title and filters at once, the feed behind a quiet placeholder | Done |
| — | Owner settings, not code: **Vercel → Project → Settings → Functions → Fluid Compute** (one instance serves the page's concurrent calls; far fewer cold starts). If pages still queue after phases 1–4, the Supabase compute size (Micro → Small) is the next lever; measure first | Owner |

### Measured after phases 1–2 (local production build, 60 ms added to every database request)

| Page | First byte | First paint | Whole page | was (first byte / whole) |
|---|---|---|---|---|
| Home | 0.10 s | 0.30 s (greeting, Quick Capture) | 1.07 s | 0.23 / 2.06 s |
| Creation page | 0.11 s | 0.36 s | 0.51 s | 0.23 / 0.77 s |
| Writing page | 0.10 s | 0.26 s | 0.32 s | 0.22 / 0.37 s |
| Rooms | 0.10 s | 0.22 s | 0.27 s | 0.24 / 0.41 s |
| Materials | 0.09 s | 0.18 s | 0.17 s | 0.23 / 0.24 s |
| Me | 0.13 s | 0.22 s | 0.87 s | 0.30 / 0.83 s (phase 5) |
| Pulse | 0.09 s | 0.26 s | 0.62 s | 0.23 / 0.60 s (phase 5) |

The 60 ms is added with a PostgREST pre-request function on the *local* stack only (`pg_sleep(0.06)`), which models
the live per-request cost far better than a zero-latency local run.

## How to measure

Local: `npm run build -w @wonder/web`, start the app, then a Playwright probe that for each page records
`performance.getEntriesByType("navigation")` (TTFB, HTML done), the chunk files loaded (sizes from
`apps/web/.next/static/chunks`), and the PostgREST call count from `pg_stat_statements`
(`select sum(calls) … where query like 'select set_config(''search_path''%'`) before and after the navigation.

Live: Supabase → Logs, or the MCP `query_logs` on `edge_logs`: `response.origin_time` per `request.path`, and
`response.headers.x_envoy_upstream_service_time` for PostgREST's own share.

## Full review (owner, 19 Oct 2026)

Owner: "run a full review of the app and see where the performance can be optimised … queries, cache instead of direct
queries, indexes … make the application fast and snappier." Three read-only audits (server loaders, browser fetching and
caching, the database) plus the live project's own statistics (Supabase advisors, `pg_stat_statements`, a timed
`notifications_feed()` as a real creator under RLS).

**What the live database says.** Five creators, tiny tables: the typical query is under 1 ms and the cache hit rate is
99.99 %, so the planner's choices (sequential scans) tell nothing yet. The advisors report no `auth_rls_initplan`
findings, 61 unindexed foreign keys, 122 "unused" indexes (meaningless at this size: don't drop any) and two doubled
policies. The slowest app query was `notifications_feed()` at a 158 ms mean — measured again as a real creator it takes
**46 ms on a connection's first call and 10 ms after**, so the mean is connection warm-up, not the queries (each branch
is under 10 ms). It was *not* rewritten. 5,495 rate-limit writes and 104,000 `set_config` calls a day confirm what the
rules below already say: the cost is **requests**, not queries.

### Done (this review)

| Area | Change | Saves |
|---|---|---|
| Every API call | The creator row id is remembered on the instance for 5 minutes (`withApi`; it never changes, found ids only, forgotten on account deletion). Every query after it still runs as the user under RLS | 1 round trip on every API call; the only database trip before the handler on a poll |
| Messages | Thread and its messages asked together (every open and poll); the Messages page asks `unread_messages()` once, not twice; the thread page marks read after the response | 1–2 round trips per open and per poll |
| Huddle room state | 5 stages → 2 (everything that needs only the Huddle's id together; the related piece with it) | 3 round trips per poll for everyone in a room |
| Creative Room page | Parts start with the Room; `listParts` 5 → 3 stages; `getProject` project ∥ items; next steps and the cover's picture join existing batches | ≈ 5 round trips |
| Material page | 6 dependent stages → 2 (Creations-it's-used-in, similar Materials and their thumbnails chained inside their own branch) | ≈ 4 round trips |
| Pulse conversation | 6 stages → 1 after the conversation; communities looked up together | ≈ 4 round trips |
| Quick note | Plain text goes straight to "normalizing" in two parallel writes (ten sequential before); the creator's own AI key is looked up after the response; receipt and Moment together | ≈ 10 round trips (about 1 s) |
| Lists and Creation reads | `select("*")` on Materials and Creations also sent the full-text index (`search`, about as big as the text again) with every row: columns are named now (`MATERIAL_COLUMNS`, `ARTIFACT_COLUMNS`, each checked against the table by a test); the share and transform pages read version names only | payload, PostgREST and JSON time of every list |
| Home | "Has a Room?" and "has Materials?" stop at the first row instead of counting all of them | a count per Home load |
| Search | Typing cancels the request still in flight; shelf items and semantic rows asked together | 1 round trip, no out-of-order results |
| Telemetry | The beacon's consent check and log line run after the answer | the beacon's wait |
| Database | 19 indexes (migration 095): queries the app runs, delete/cascade paths that would scan whole tables, the daily retention job; two doubled policies split by command; Home's visit marker doesn't wait for the disk flush; rate-limit counters vacuumed sooner | scale: tables are tiny today, these keep pages flat as they grow |

**After migration 095 (production, 19 Oct 2026):** unindexed foreign keys 61 → 48 (the rest are audit columns, left on
purpose), doubled policies 2 → 0. "Unused index" rose 122 → 141: the new indexes haven't been used yet, which is expected
with five creators — judge them by `pg_stat_user_indexes.idx_scan` once there is real traffic, not before.

### Not done, on purpose (and why)

* **`notifications_feed()` / `live_huddle_cards()` rewrites** (suggested by the audit): measured at 10 ms warm; the risk of
  changing RLS-sensitive SQL outweighs a gain nobody can feel. Revisit with `explain (analyze, buffers)` when a creator
  has hundreds of Rooms and invitations. Same for the `crew_threads` `OR` policy shape.
* **The other ~40 foreign-key indexes** the advisor lists: audit columns (`created_by`, `updated_by`, …) are never
  queried; indexing them only slows writes. Add one when a query filters by it.
* **`experimental.staleTimes` / `cacheComponents`**: would make navigation instant but shows stale lists after a write
  made through an API call. Needs one app-wide rule for invalidation first; owner decision.
* **A Postgres function for `materialCounts` and `topTags`** (they count rows in JavaScript, capped at 1,000): needs the
  generated types regenerated against a local database; do it with the next migration that can run `npm run db:types`.
* **Removing `api/v1` from the session-refresh proxy**: a long-lived tab that only polls would stop refreshing its
  session. Needs a test with an expiring token first.

### Done (part 2: the browser)

| Area | Change |
|---|---|
| Polling | One helper, `usePoll` (`lib/use-poll.ts`, tested): runs only while the tab is visible, catches up the moment it returns, and can slow itself down (×1.5 up to a cap) for jobs that take a while. The bell, Messages, the Huddle room, the send inbox, image/carousel/slide jobs and creation runs all use it; they used to poll hidden tabs every 2.5–6 s |
| Chats | A poll marks a thread (or the crew chat) read only when a newer message has arrived — it was a write on every tick; Messages' count also skips the fetch on navigation within 15 s, like the bell |
| Repeated GETs | `apiCached` (`lib/client.ts`): the soundtrack catalogue (asked by the player and again by the Music sheet) and "your pictures" (asked by two sheets) are asked once for 5 min / 30 s, concurrent askers share one request, and any change this tab makes drops them |
| Clocks | The shared clock behind every "5 min ago" ticked every second for the whole session; labels change at most every 45 s, so it ticks every 15 s (every second only for the Huddle stopwatch) and stops while the tab is hidden. The mini player's layout check runs every 2.5 s, not each second |
| Images | `loading="lazy" decoding="async"` on card and list pictures (not heroes, canvases or share images); the published work's hero and the Material's picture are `fetchPriority="high"` |

### Next

* **Thumbnails.** Cards and avatars still load the stored original through `/api/v1/media/…`; storage image transformation
  needs a paid plan, so the real fix is a small derivative made when a picture is brought in (sharp is already used for
  the album) and linked from the Material. A migration plus the intake pipeline; its own piece of work.
* **The bell's first data from the server** (Home already renders it) and one combined shell poll instead of two.
* **`Cache-Control: private` on low-churn GETs** (settings, destinations, consents) once an invalidation rule exists.
* **More round trips** the audit listed and this review left: `createArtifact` (≈ 9 in a row), the song, complete, People,
  Community and Context pages, `workingSetView`, `listConversations`' per-card Material counts, the `materialCounts`/
  `topTags` functions above.

### Database: how to check it

* Advisors: Supabase MCP `get_advisors performance`, or Dashboard › Advisors. Run after any migration.
* Slowest queries: `select left(query,160), calls, round(total_exec_time), round(mean_exec_time::numeric,2) from
  pg_stat_statements order by total_exec_time desc limit 25`. Ignore PostgREST/auth/realtime internals.
* A function as a creator: in one transaction `set local role authenticated; select set_config('request.jwt.claims',
  '{"sub":"<auth user id>","role":"authenticated"}', true);` then time it twice (the first call on a connection is cold).
  Roll back. Never `drop policy` or DDL through the MCP tool: it waits for a confirmation nobody sees.

## Build and deploy (7 Oct 2026)

Owner: "optimize the build and deploy time. it takes very long now." Measured on the merge of #161:

| Step | Before | Where the time went |
|---|---|---|
| CI › End-to-end | 31–33 min | ~3 min setup, then 189 tests (86 files, 27 min) one after another on one machine |
| CI › Lint, typecheck, unit, build | ~3.5 min | the build checked types again (41 s) after `npm run typecheck`, from a cold cache |
| Vercel build | ~93 s to live | clone + cache 20 s · compile 14 s · **TypeScript 22 s** · pages 7 s · deploy 20 s |
| Vercel after live | +82 s | saving a 1.49 GB build cache keeps the build slot busy, so a queued build waits |
| Vercel per merge | 2 builds | production from `main`, plus a preview of the same commit when the work branch is reset and pushed |

What changed:
* **End-to-end in four parts at once** (`--shard=n/4`), each with its own database and app; tests within a part still
  run one at a time. Each part is 6–8 min of tests + ~3 min setup, so the check takes ~11 min instead of ~31, for about
  the same CI minutes. A summary job keeps the check name "End-to-end (Playwright)".
* **Types are checked once.** `npm run typecheck` in CI is the gate (nothing merges without it), so `next build` skips
  its own check when `CI` or `VERCEL` is set (`typescript.ignoreBuildErrors` in `next.config.ts`). Local `next build`
  still checks.
* **CI keeps the build cache** (`apps/web/.next/cache`: Turbopack's filesystem cache, on by default in Next 16):
  restored on every run, saved from `main`. An unchanged build compiles in ~2 s instead of ~20 s.
* **No preview deployments** (owner, 7 Oct 2026: "i dont want preview"): Vercel builds production from `main` only.
  Other branches don't deploy (`git.deploymentEnabled` in `apps/web/vercel.json`), and the Ignored Build Step skips
  anything else that arrives as a preview (`apps/web/scripts/vercel-ignore-build.sh`). CI still builds and tests every
  PR; a merge to `main` is the one build that deploys.

Not changed: the Vercel build cache upload happens after the deployment is live; with no previews nothing queues behind it.

### Learned from WonderJobs (owner, 9 Oct 2026: "the build and deploy time are really good for wonderjobs, learn from it")

Compared on each project's latest merge. Vercel was already level — WonderJobs' production deploy went build start →
live in 66 s, ours in 60 s (both skip the TypeScript pass; we build no previews at all). The difference was the CI gate:
ours ran lint, typecheck, unit tests and build **one after another in one job**:

| Our gate before (merge of #173) | |
|---|---|
| `npm ci` | 17 s |
| lint | 41 s |
| typecheck (`next typegen` + two `tsc`) | 51 s |
| unit tests | 9 s |
| build (Turbopack cache warm) | 8 s |
| **Whole job** | **2 min 31 s** |

WonderJobs runs those as four parallel jobs with a cache per tool and measures 46–54 s warm. Adopted the same:
* **Four jobs at once** (Lint, Typecheck, Unit tests, Build); the gate takes as long as the slowest. A summary job keeps
  the name "Lint, typecheck, unit tests, build" so any branch rule still finds it.
* **ESLint's cache** (content strategy, `apps/web/.next/cache/eslint`) and **tsc's incremental state** for both
  projects (`tsconfig.tsbuildinfo`, root `tsconfig.json` is `incremental` now), restored every run, saved from `main`.
* **Concurrency:** a new push cancels only that PR's older run; merges to `main` never cancel each other.
* **Vercel skips a production merge that changes only docs, CI files or tests** (`vercel-ignore-build.sh`).

What the caches are worth, measured on the same machine (one run cold, one run with the cache in place):

| Tool | Cold | Warm |
|---|---|---|
| ESLint (content cache) | 68 s | 2 s |
| `tsc` root project (incremental) | 30 s | 4 s |
| `tsc` apps/web (incremental) | 41 s | 4 s |

Measured after on CI (the gate is "What changed" starting → the summary job finishing):

| Run | Lint | Typecheck | Unit tests | Build | **Gate** |
|---|---|---|---|---|---|
| PR #175 (nothing cached yet) | 76 s | 77 s | 28 s | 30 s | **1 min 30 s** |
| Merge of #175 to `main` (Turbopack cache warm, ESLint/tsc cold) | 50 s | 53 s | 33 s | 48 s | **1 min 06 s** |

Each job's time includes its own checkout and `npm ci` (about 20 s). `main` saved the ESLint and tsc caches on that
merge, so the next code PR is the first run that restores them — WonderJobs lands at 46–54 s on the same shape. The
production deploy for the merge went build start → live in 55 s.

### Build-slot budget (owner, 10 Oct 2026)

Vercel counts every deployment it creates against the plan's daily cap — 100 a day on the free plan — including one the
ignored build step cancels. The rules are in `CLAUDE.md` › Build-slot budget; this is where Wonder Creator stands.

| | |
|---|---|
| When `main` changes | when a Claude PR is green and conflict-free it is squash-merged automatically, one per finished piece of work (`CLAUDE.md` › Build-slot budget › Merge automatically when green, owner, 15 Oct 2026; replaces the "merge now" / "build now" gate of 10 Oct) |
| Branches that deploy | `main` only (`vercel.json` › `git.deploymentEnabled`: `*` and `**` off, `main` on); no previews |
| Deployments a merge creates | one (production), skipped by `vercel-ignore-build.sh` when only docs, CI files or tests changed — the slot is still spent |
| Tests on the platform | none: unit, RLS and end-to-end all run on GitHub Actions against a local app |
| Nightly suite | 03:00 IST (`e2e-nightly.yml`); skipped when `main` is the commit the last scheduled run already tested (`docs/testing.md`) |
| Merges to `main`, 3–10 Oct 2026 | 1 · 11 · 11 · 7 · 9 · 2 · 5 · 1 a day — the peak is 11 % of the cap |

Counting: each merge to `main` is one deployment, so `git log origin/main --since='24 hours ago' --oneline | wc -l` is
the day's count without opening Vercel. Lesson already paid for: #176 (docs only) created and cancelled a deployment —
record numbers in the PR that produced them instead.

### What runs when

Moved to **[`docs/testing.md`](testing.md)** (owner, 16 Oct 2026: fast pull requests, end-to-end nightly). In short: a pull
request runs typecheck, lint on the changed files, the unit tests related to them, and build — about a minute; `main` runs
the whole lint and every unit test; the full end-to-end suite runs every night (`e2e-nightly.yml`), never on PRs or merges,
and risky changes run their specs locally first (`npm run e2e:local`). The earlier `e2e` label is gone.
