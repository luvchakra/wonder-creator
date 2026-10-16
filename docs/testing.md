# Testing: what runs where, and why

Owner, 16 Oct 2026: "make merges fast by moving slow testing to a nightly end-to-end run." A pull request's checks finish
in about a minute; the full end-to-end suite runs every night instead of on every merge.

## At a glance

| When | What runs | Why |
|---|---|---|
| **Pull request** (`ci.yml`) | In parallel: **typecheck** (whole project) · **lint on the changed files** · **unit tests related to the changed files** (`vitest related`) · **build** · dependency audit, secret scan and CodeQL (`security.yml`) | Fast feedback on exactly what changed |
| Pull request that changes dependencies, config or CI | The **whole lint** and **every unit test** instead of the changed-files versions | These changes can affect every file, so a partial run would miss things |
| Pull request that changes the database (`supabase/`, `tests/db/`, `packages/db/`, or `ci.yml`) | Also the **RLS tests** and the generated-types check (~5 min) | Migrations go to production on merge, so a broken policy has to be caught first |
| Pull request, docs/Markdown only | Nothing | Nothing to build or test |
| **Push to `main`** | Whole lint, every unit test, typecheck, build; RLS tests if the database changed | Catches anything a partial PR run could have missed |
| **Every night** (`e2e-nightly.yml`, 03:11 IST) | The **whole end-to-end suite** against a fresh build, in parts, plus the whole RLS suite | Too slow (~28 min of tests) to run on every merge |
| **By hand** | The nightly with an optional list of spec files | Check a fix, or a risky change |
| **Your machine** | `npm run e2e:local -- <spec files>` | Before merging anything risky (see below) |

**No end-to-end on pull requests or merges.** The check named "End-to-end (Playwright)" still appears on PRs and passes at
once, so branch rules that require it keep working. It says where end-to-end runs now.

### What counts as "dependencies, config or CI"

`package.json` and `package-lock.json` (root, `apps/*`, `packages/*`), any `tsconfig*.json`, `vitest.config.*`,
`eslint.config.*`, `apps/web/next.config.*`, `playwright.config.ts`, `tests/stubs/` and anything under `.github/`. The list
lives in `ci.yml` › What changed. A change there means a partial lint or test run could miss something.

### Before and after (measured on GitHub Actions)

| | Before (16 Oct 2026) | After |
|---|---|---|
| Typical code PR (#186) | 64 s wall. Lint 37 s, typecheck 45 s, unit tests 42 s (11 s of tests), build 43 s, in parallel. CodeQL ~2 min alongside in `security.yml` | Same jobs, but lint and unit tests cover only the changed files. The gate is still bounded by `npm ci` (~20 s) and typecheck, so expect ~1 min. CodeQL is unchanged at ~2 min |
| PR touching the database (#185) | 5 min 24 s (RLS: Supabase start 77 s + tests 172 s) | Unchanged on purpose (see the table above) |
| PR with the old `e2e` label | ~11 min (four end-to-end shards) | Not possible any more. Run the specs locally, or the nightly by hand |
| Nightly end-to-end | Four shards by file count: 5.3 · 7.7 · 7.7 · 7.9 min of tests (10.5 min wall) | Four parts balanced by measured time: 7.1 · 7.1 · 7.0 · 7.0 min. Builds fresh (no build cache), so each part adds a minute or two of build |

The fixed cost of each job (checkout, `npm ci`, ~25 s) is most of a PR run now. Changed-files lint and related tests
matter most as the codebase grows: the whole lint is 68 s cold and the whole unit run grows with every test.

## Nightly end-to-end

`.github/workflows/e2e-nightly.yml`:

* **When:** every night at 03:11 IST (21:41 UTC). It's skipped when `main` is still the commit the last scheduled run tested,
  because there is nothing new to learn; a failure is root-caused, never re-run hoping it passes. **By hand:** Actions ›
  **Nightly end-to-end** › **Run workflow**, choose the branch, and optionally fill in **specs**. Leave it empty for the whole
  suite, or give a space-separated list (`e2e/auth.spec.ts e2e/payments.spec.ts`).
* **Fresh:** each part checks out the commit, starts a fresh local Supabase stack, builds the app without a build cache and
  runs it with `next start`. It never touches production data.
* **Parts:** `scripts/e2e/plan.mjs` splits the chosen specs into parts balanced by **measured time** (`e2e/timings.json`),
  slowest file first, each into the part with the least time so far. A file long enough to fill a part gets one of its
  own. There is one part per ~8 min of measured tests (`E2E_TARGET_MINUTES`), at most 6, and they run in parallel. Try
  it with `npm run e2e:plan`. A spec with no measurement yet counts as the median.
* **Time budget:** each part gets `E2E_BUDGET_MINUTES` (25, about 3× its measured time) through Playwright's
  `globalTimeout`. When the budget runs out, the run stops cleanly: the tests that didn't start are reported as **not run**,
  and the reports are still written. The job's own 45-minute timeout is only a backstop.
* **Retries:** one, on CI. A test that fails and then passes on retry counts as passing for the run, but is reported as
  **flaky** in the summary and in the "Flaky end-to-end tests" issue, so it gets a root cause.
* **Summary:** each part, and then the whole run, writes **passed / failed / flaky / skipped / not run** with the test
  names (`scripts/e2e/summary.mjs`) to the run's summary page.
* **Artifacts** (14 days): per part, the HTML report (`playwright-report/`), traces and screenshots of failed attempts,
  flaky ones included (`test-results/`), the JSON results and the app log (`e2e-results/`). A full run also uploads
  `e2e-timings` (30 days). When the parts drift out of balance, replace `e2e/timings.json` with it.
* **Alerts:** a failing run on `main` opens or comments on the issue **"End-to-end tests failing on main"**. Flaky tests
  go to **"Flaky end-to-end tests"**.

### A red nightly

**A red nightly is fixed before other work merges.** Find the root cause from the report, traces and app log; "flaky" is
not a root cause. Fix forward, or roll back in Vercel (the previous production deployment stays a rollback candidate).
Never skip, disable or delete a test to make it green.

## Keeping runs repeatable

`e2e/global-setup.ts` runs before every end-to-end run, on CI and locally:

* **Never production.** It refuses to start unless both the app and the database are on a local address (localhost,
  127.0.0.1, ::1, host.docker.internal). There is no override; a shared test environment would be added there on
  purpose, in review.
* **Throwaway data from earlier runs is deleted** when it is older than `E2E_CLEANUP_HOURS` (default 2), so a run going on
  at the same time is never touched. Only what tests make is recognisable and removed: accounts and contact messages on
  the reserved `example.com` domain (`e2e-…@example.com`, `visitor-…@example.com`; RFC 2606 means no real person has
  one). Deleting an account removes its creator and everything it owns. On CI every part has a fresh database anyway;
  this matters for a local stack that lives for weeks.
* **Shared settings:** there are none to reset. Feature flags come from the environment, not the database, and tests
  change only rows that belong to the accounts they created. A run killed halfway therefore leaves nothing the next run
  depends on. A test that ever changes something shared must restore it in its own teardown **and** in the global setup.

## Running specs locally

One command builds the app against your local Supabase stack, starts it on :3000 and runs the specs you name:

```bash
npx supabase start                                            # once; leave it running
npm run e2e:local -- e2e/auth.spec.ts e2e/payments.spec.ts    # chosen specs
npm run e2e:local                                             # the whole suite (~30 min)
E2E_SKIP_BUILD=1 npm run e2e:local -- e2e/auth.spec.ts        # reuse the last build
```

It uses only the local stack's URL and keys (from `supabase status`). Every other key in `apps/web/.env.local` is blanked
for the run, and nothing is written to that file. AI runs offline, payments use a key Stripe refuses, and no mail is
sent. Stop any dev server on :3000 first. The app's log goes to `e2e-results/next.log`; open the report with
`npx playwright show-report`.

**Before merging something risky, run the affected specs this way.** Risky means sign-in or accounts, permissions or
rights, database migrations or policies, payments, uploads, or a new flow that crosses features. For example:

| Change | Specs |
|---|---|
| Sign-in, sign-up, sessions | `auth`, `account-security`, `google-sign-in`, `onboarding`, `privacy` |
| Permissions, sharing, rights | `rights`, `sharing`, `collaboration`, `crew-rights`, `projects`, `communities` |
| Migrations and policies | the specs for the tables touched, plus `npm run test:db` |
| Payments, licensing | `payments`, `licensing`, `business` |
| Uploads, materials | `materials`, `photo-album`, `home-capture` |

## Rules

* Never skip, disable or delete a test to make CI green.
* A red nightly is fixed before other work merges. "Flaky" is not a root cause.
* CI, test setup and scripts are changed here; application code isn't changed to make a check pass.
* End-to-end and RLS suites run on GitHub Actions or your machine against a local app, never against a deployment, so
  tests never spend a Vercel build slot (`docs/performance.md` › Build-slot budget).
