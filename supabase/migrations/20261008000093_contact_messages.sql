-- "Send us a message" on /contact (owner, 8 Oct 2026: "implement similar to WonderJobs"). A message anyone can send, signed in
-- or not: name, the address to reply to, what it's about, the words. Written by the server with the service role only —
-- the browser can neither read nor write this table — and kept for 12 months (run_retention below). Not tied to an
-- account: the sender types their own address, so account erasure doesn't need to reach it; a request to delete one is
-- answered from the operator runbook (docs/compliance/privacy.md).
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- Made on the sender's device when the form opens, so a double tap or a retry lands once and mails once.
  client_id uuid not null unique,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  topic text not null default 'general' check (topic in ('general', 'support', 'feedback', 'partnership', 'privacy', 'security')),
  message text not null check (char_length(message) between 10 and 4000),
  page text check (char_length(page) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  -- Set once the team was emailed (when a mailbox is connected); the row is the record either way.
  notified_at timestamptz,
  -- Set by the operator when it has been answered.
  handled_at timestamptz
);
create index contact_messages_created_idx on public.contact_messages(created_at desc);
alter table public.contact_messages enable row level security;
-- No policies and no grants: only the service role (which bypasses RLS) reaches it.
revoke all on public.contact_messages from anon, authenticated;

-- Retention: contact messages go after 12 months. (Same function as before, plus that one line.)
create or replace function app.run_retention()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
  n bigint;
begin
  delete from public.ai_proposals where status in ('expired', 'rejected', 'cancelled', 'failed', 'executed') and created_at < now() - interval '90 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('ai_proposals', n);
  delete from public.ai_proposals where status = 'pending' and expires_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('ai_proposals_expired', n);
  delete from public.artifact_shares where expires_at is not null and expires_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('artifact_shares', n);
  delete from public.open_conversation_replies where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('conversation_replies_deleted', n);
  delete from public.moment_references where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('moment_references_deleted', n);
  delete from public.moment_connections where expires_at is not null and expires_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('moment_connections', n);
  delete from public.jobs where status in ('succeeded', 'dead') and updated_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('jobs', n);
  delete from public.capture_receipts where created_at < now() - interval '90 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('capture_receipts', n);
  delete from public.rate_limit_counters where window_start < now() - interval '1 day';
  get diagnostics n = row_count; result := result || jsonb_build_object('rate_limit_counters', n);
  delete from public.privacy_requests where closed_at is not null and closed_at < now() - interval '3 years';
  get diagnostics n = row_count; result := result || jsonb_build_object('privacy_requests', n);
  delete from public.source_context_records where expires_at is not null and expires_at < now();
  get diagnostics n = row_count; result := result || jsonb_build_object('source_context_records', n);
  delete from public.context_candidates where expires_at < now() and state <> 'imported';
  get diagnostics n = row_count; result := result || jsonb_build_object('context_candidates', n);
  delete from public.source_sync_jobs where status in ('completed', 'partially_complete', 'cancelled', 'failed') and updated_at < now() - interval '30 days';
  get diagnostics n = row_count; result := result || jsonb_build_object('source_sync_jobs', n);
  delete from public.contact_messages where created_at < now() - interval '12 months';
  get diagnostics n = row_count; result := result || jsonb_build_object('contact_messages', n);
  perform app.record_audit('retention.run', 'system', null, result, null);
  return result;
end $$;
revoke execute on function app.run_retention() from public, anon, authenticated;
