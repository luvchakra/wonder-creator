-- P0.1-04 Creation run progress: cancellation and duplicate-safe retry.
-- - cancel_requested_at: the creator asked to stop. The pipeline checks it before each stage; once saving
--   (render) has begun the run completes, so cancellation is deterministic: nothing half-saved.
-- - request: what the run was asked to do (the creator's own request and chosen material ids), so a failed
--   or cancelled run can be retried exactly. Owner-only via RLS, like the conversation it came from.
-- - retry_of: the run a retry replaces. Unique, so double-clicking Retry can't start two runs.
alter table public.ai_runs drop constraint ai_runs_status_check;
alter table public.ai_runs add constraint ai_runs_status_check check (status in ('running', 'succeeded', 'failed', 'cancelled'));
alter table public.ai_runs
  add column cancel_requested_at timestamptz,
  add column request jsonb check (request is null or (jsonb_typeof(request) = 'object' and pg_column_size(request) <= 32768)),
  add column retry_of uuid unique references public.ai_runs(id) on delete set null;
create index ai_runs_status_idx on public.ai_runs(creator_id, status, started_at desc);
