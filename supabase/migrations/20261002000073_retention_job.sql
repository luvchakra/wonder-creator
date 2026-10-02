-- Retention job (part of the privacy work in 20261002000069): production got 069's tables before this function could
-- be applied, so it ships on its own. Same definition as 069 — `create or replace`, so it's a no-op where 069 ran whole.
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
  perform app.record_audit('retention.run', 'system', null, result, null);
  return result;
end $$;
revoke execute on function app.run_retention() from public, anon, authenticated;

create or replace function public.run_retention()
returns jsonb language sql security definer set search_path = ''
as $$ select app.run_retention() $$;
revoke execute on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;
