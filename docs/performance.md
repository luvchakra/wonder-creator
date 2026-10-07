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

### What runs when (owner, 7 Oct 2026: "i don't need e2e tests everytime" · "skip e2e after merge too, only nightly")

| Event | Lint · typecheck · unit · build | RLS tests | End-to-end |
|---|---|---|---|
| Pull request, code | ✓ | only if `supabase/`, `tests/db/` or `packages/db/` changed | only with the `e2e` label |
| Pull request, docs/Markdown only | — | — | — |
| Pull request changing `.github/workflows/ci.yml` | ✓ | ✓ | only with the `e2e` label |
| Merge to `main` | ✓ | if the database changed | — |
| Nightly (03:11 IST) and manual runs | ✓ | ✓ | ✓ — the only automatic end-to-end run |

* A job that isn't needed is **skipped**, which counts as passing, so required checks keep working. If what changed
  can't be worked out, everything runs.
* **End-to-end on demand:** add the `e2e` label to a PR (it's read on the next push), or Actions › CI › Run workflow on
  the branch. Use it for risky changes: sign-in, payments, rights, uploads, the Palette.
* **When end-to-end fails on `main`** (overnight or a manual run), CI opens one issue, "End-to-end tests failing on
  main", and comments on it while it keeps failing. Fix forward, or roll back in Vercel (the previous production
  deployment stays a rollback candidate).
* Typical change → live: ~2–2.5 min of CI + under 1 min Vercel, instead of ~12 + 1. The trade-off: a regression only
  end-to-end would catch can reach production until the nightly run reports it (up to a day) — use the `e2e` label
  on risky changes.

