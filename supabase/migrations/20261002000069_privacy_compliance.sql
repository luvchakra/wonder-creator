-- Privacy compliance (GDPR / India DPDP Act 2023), 2 Oct 2026 — docs/compliance/privacy.md.
-- Consent records (proof of notice and consent, per purpose and notice version), data-principal requests with
-- statutory deadlines, and a retention job that purges what has outlived its purpose.

-- ------------------------------------------------------------------------------------------------ Consent
-- Append-only: a change of mind is a new row (granted = false), never an edit. The latest row per purpose wins.
create table public.consent_records (
  id bigint generated always as identity primary key,
  creator_id uuid not null references public.creators(id) on delete cascade,
  purpose text not null check (purpose in ('terms', 'privacy_notice', 'age_confirmation', 'product_analytics', 'product_emails')),
  notice_version text not null check (char_length(notice_version) between 1 and 40),
  granted boolean not null,
  method text not null check (method in ('sign_up', 'onboarding', 'consent_prompt', 'settings')),
  created_at timestamptz not null default now()
);
create index consent_records_creator_idx on public.consent_records(creator_id, purpose, created_at desc);
alter table public.consent_records enable row level security;
create policy consent_own_read on public.consent_records for select to authenticated using (creator_id = app.current_creator_id());
create policy consent_own_insert on public.consent_records for insert to authenticated with check (creator_id = app.current_creator_id());
revoke update, delete, truncate on public.consent_records from authenticated, anon;

-- The current state per purpose, for the signed-in creator.
create or replace function public.my_consents()
returns table (purpose text, notice_version text, granted boolean, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select distinct on (c.purpose) c.purpose, c.notice_version, c.granted, c.created_at
  from public.consent_records c where c.creator_id = app.current_creator_id()
  order by c.purpose, c.created_at desc, c.id desc
$$;
revoke execute on function public.my_consents() from public, anon;
grant execute on function public.my_consents() to authenticated;

-- ------------------------------------------------------------------------------------------- Requests
-- Data-principal requests (GDPR Art. 12–22; DPDP §§11–14): access, correction, erasure, portability, objection,
-- consent withdrawal, nomination and grievances. The creator files; staff (service role) respond. Kept when the
-- account is erased (creator_id set null) as evidence the request was handled.
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete set null,
  kind text not null check (kind in ('access', 'correction', 'erasure', 'portability', 'objection', 'consent_withdrawal', 'nomination', 'grievance')),
  details text not null default '' check (char_length(details) <= 4000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  response text check (response is null or char_length(response) <= 4000),
  -- GDPR: one month; DPDP grievance redressal within the period the Rules prescribe — the shorter wins (30 days).
  due_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index privacy_requests_creator_idx on public.privacy_requests(creator_id, created_at desc);
create index privacy_requests_open_idx on public.privacy_requests(due_at) where status in ('received', 'in_progress');
create trigger privacy_requests_touch before update on public.privacy_requests for each row execute function app.touch_updated_at();
alter table public.privacy_requests enable row level security;
create policy privacy_requests_own_read on public.privacy_requests for select to authenticated using (creator_id = app.current_creator_id());
create policy privacy_requests_own_insert on public.privacy_requests for insert to authenticated with check (creator_id = app.current_creator_id());
revoke insert, update, delete, truncate on public.privacy_requests from authenticated, anon;
grant insert (creator_id, kind, details) on public.privacy_requests to authenticated;

-- Every request is evidence: filed and closed are audited by the server, never by the client.
create or replace function app.privacy_request_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit('privacy_request.received', 'privacy_request', new.id, jsonb_build_object('kind', new.kind, 'due_at', new.due_at), null);
  elsif new.status is distinct from old.status then
    perform app.record_audit('privacy_request.' || new.status, 'privacy_request', new.id, jsonb_build_object('kind', new.kind, 'from', old.status), null);
    if new.status in ('completed', 'rejected') and new.closed_at is null then new.closed_at := now(); end if;
  end if;
  return new;
end $$;
create trigger privacy_requests_audit_ins after insert on public.privacy_requests for each row execute function app.privacy_request_audit();
create trigger privacy_requests_audit_upd before update on public.privacy_requests for each row execute function app.privacy_request_audit();

-- ------------------------------------------------------------------------------------------- Retention
-- Storage limitation (GDPR Art. 5(1)(e); DPDP §8(7)): purge what has outlived its purpose. Run daily by the job
-- worker (service role). Windows are documented in docs/compliance/privacy.md (Retention schedule).
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
  -- Evidence that a request was handled is kept three years after it closed (limitation periods), then removed.
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
