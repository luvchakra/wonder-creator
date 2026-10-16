#!/usr/bin/env bash
# Run chosen end-to-end specs on your machine against a local build (docs/testing.md › Running specs locally).
#
#   npm run e2e:local -- e2e/auth.spec.ts e2e/payments.spec.ts     # chosen specs
#   npm run e2e:local                                               # the whole suite (~30 min)
#   E2E_SKIP_BUILD=1 npm run e2e:local -- e2e/auth.spec.ts          # reuse the last local build
#
# What it does: reads the local Supabase stack (start it first: npx supabase start), builds the app against it, starts
# `next start` on :3000, runs Playwright with the arguments you give, and stops the app when done.
#
# Never production: the app and the tests get the local stack's URL and keys from `supabase status`, and every other key
# in apps/web/.env.local is blanked for this run (process environment wins over Next's env files; nothing is written to
# your .env.local). AI runs offline, payments use a key Stripe refuses, no mail is sent. Playwright's global setup also
# refuses a non-local app or database.
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! status="$(npx --no-install supabase status -o json 2>/dev/null)"; then
  echo "The local Supabase stack isn't running. Start it with: npx supabase start" >&2
  exit 1
fi
read_status() { node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d[process.argv[2]]??"")' "$status" "$1"; }
api_url="$(read_status API_URL)"
publishable="$(read_status PUBLISHABLE_KEY)"
secret="$(read_status SECRET_KEY)"
case "$api_url" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing: the Supabase API is not local ($api_url)." >&2; exit 1 ;;
esac

# Blank every key your apps/web/.env.local sets, then set only what a local run needs.
if [ -f apps/web/.env.local ]; then
  while IFS= read -r key; do export "$key="; done < <(grep -oE '^[[:space:]]*[A-Z0-9_]+[[:space:]]*=' apps/web/.env.local | tr -d ' =\t')
fi
export NEXT_PUBLIC_SUPABASE_URL="$api_url" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$publishable" SUPABASE_SECRET_KEY="$secret"
export CRON_SECRET="local-e2e-cron-secret-000000000000" WONDERCREATOR_AI_PROVIDER=offline
export STRIPE_SECRET_KEY="e2e-not-a-real-key" STRIPE_WEBHOOK_SECRET="e2e-webhook-secret"
export E2E_SUPABASE_URL="$api_url" E2E_SUPABASE_SECRET_KEY="$secret" E2E_BASE_URL="http://localhost:3000"

if curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  echo "Something is already listening on :3000 (a dev server?). Stop it first — the tests need the local build there." >&2
  exit 1
fi

if [ "${E2E_SKIP_BUILD:-}" != "1" ]; then
  npm run build
fi

mkdir -p e2e-results
(cd apps/web && exec node ../../node_modules/next/dist/bin/next start -p 3000 > ../../e2e-results/next.log 2>&1) &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
npx --no-install wait-on http://localhost:3000/sign-in --timeout 120000

npx --no-install playwright test "$@"
