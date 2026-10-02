# Deploying database migrations

Migrations in `supabase/migrations/` are applied to production by the **Database migrations** GitHub workflow
(`.github/workflows/migrations.yml`) whenever they reach `main` (or when run by hand from the Actions tab).

- Each file production hasn't seen is applied in filename order, in one transaction, and recorded in
  `app.applied_migrations` (filename, time, SHA-256). Files already recorded are skipped, so re-runs are safe.
- A failing migration stops the run and nothing from that file is kept; fix it in a new migration (migrations are
  append-only).
- The ledger was seeded on 2 Oct 2026 with every file up to `20261002000072` (they were applied earlier through the
  dashboard). `20261002000073_retention_job` was the first file applied by the workflow.

## Setup (owner, once)
GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**:

- Name: `SUPABASE_DB_URL`
- Value: the **Session pooler** connection string from Supabase → **Connect** (top bar) → *Session pooler*, with your
  database password filled in. It looks like
  `postgresql://postgres.dgyjzyyhayctcdrpgyji:<password>@aws-…-ap-south-1.pooler.supabase.com:5432/postgres`.
  Use the pooler, not `db.dgyjzyyhayctcdrpgyji.supabase.co`: that direct address is IPv6-only and GitHub's runners
  can't reach it.

Without the secret the workflow logs a warning and applies nothing. Nothing else (Vercel, the app) needs the database
password.
