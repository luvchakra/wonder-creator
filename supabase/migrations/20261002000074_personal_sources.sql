-- Personal Sources (owner spec "Overload-Safe Creative Context Import & Synchronization", 2 Oct 2026) —
-- docs/personal-sources.md. Connect, Discover, Review and Bring In stay separate:
--   source_connections        what the creator connected, with which scope (no credentials here)
--   source_connection_secrets the provider credential, in Vault — server only
--   source_sync_cursors       opaque provider cursor + last committed checkpoint per connection and scope
--   source_sync_jobs          bounded, resumable, cancellable discovery runs (never inside a request)
--   source_context_records    the small index: metadata and a safe excerpt (hydration L0–L2), never full content
--   context_candidates        1–5 groups worth exploring; references to records, never Materials themselves
-- A candidate becomes a Material or a Studio source only when the creator imports it (provenance 'personal_source').

-- ------------------------------------------------------------------------------------------- connections
create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'google_calendar', 'native_notes', 'external_notes', 'phone_photos', 'cloud_photos')),
  status text not null default 'connected'
    check (status in ('not_connected', 'connected', 'queued', 'syncing', 'partially_synced', 'paused', 'needs_reconnect', 'error')),
  account_display_name text check (account_display_name is null or char_length(account_display_name) <= 200),
  granted_scopes text[] not null default '{}',
  scope_settings jsonb not null default '{}'::jsonb check (pg_column_size(scope_settings) <= 4096),
  sync_mode text not null default 'manual' check (sync_mode in ('manual', 'scheduled_opt_in')),
  last_successful_sync_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, provider)
);
create trigger source_connections_touch before update on public.source_connections for each row execute function app.touch_updated_at();
alter table public.source_connections enable row level security;
create policy source_connections_own_read on public.source_connections for select to authenticated using (creator_id = app.current_creator_id());
-- Only sources that need no credential can be connected by the creator directly; OAuth sources are connected by the
-- server after the provider's consent screen.
create policy source_connections_own_insert on public.source_connections for insert to authenticated
  with check (creator_id = app.current_creator_id() and provider in ('native_notes', 'phone_photos') and status = 'connected');
create policy source_connections_own_update on public.source_connections for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy source_connections_own_delete on public.source_connections for delete to authenticated using (creator_id = app.current_creator_id());
revoke all on public.source_connections from authenticated, anon;
grant select, delete on public.source_connections to authenticated;
grant insert (creator_id, provider, scope_settings) on public.source_connections to authenticated;
grant update (scope_settings, sync_mode) on public.source_connections to authenticated;
revoke truncate on public.source_connections from service_role;

create or replace function app.source_connection_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit_for(new.creator_id, 'personal_source.connected', 'source_connection', new.id, jsonb_build_object('provider', new.provider));
    return new;
  end if;
  perform app.record_audit_for(old.creator_id, 'personal_source.disconnected', 'source_connection', old.id, jsonb_build_object('provider', old.provider));
  return old;
end $$;
revoke execute on function app.source_connection_audit() from public, anon, authenticated;
create trigger source_connections_audit_ins after insert on public.source_connections for each row execute function app.source_connection_audit();
create trigger source_connections_audit_del after delete on public.source_connections for each row execute function app.source_connection_audit();

-- ------------------------------------------------------------------------------------------- credentials (Vault)
create table public.source_connection_secrets (
  connection_id uuid primary key references public.source_connections(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  vault_secret_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.source_connection_secrets enable row level security;
revoke all on public.source_connection_secrets from authenticated, anon;
revoke truncate on public.source_connection_secrets from service_role;

create or replace function app.source_secret_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end $$;
revoke execute on function app.source_secret_cleanup() from public, anon, authenticated;
create trigger source_connection_secrets_cleanup after delete on public.source_connection_secrets
  for each row execute function app.source_secret_cleanup();

-- Store or replace a connection's credential (service role only, scoped by the server-resolved creator).
create or replace function public.source_secret_store(p_creator uuid, p_connection uuid, p_secret text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_existing uuid;
begin
  if not exists (select 1 from public.source_connections where id = p_connection and creator_id = p_creator) then
    raise exception 'connection not found' using errcode = 'P0002';
  end if;
  select vault_secret_id into v_existing from public.source_connection_secrets where connection_id = p_connection;
  if v_existing is null then
    insert into public.source_connection_secrets(connection_id, creator_id, vault_secret_id)
    values (p_connection, p_creator, vault.create_secret(p_secret, 'source:' || p_connection::text));
  else
    perform vault.update_secret(v_existing, p_secret);
    update public.source_connection_secrets set updated_at = now() where connection_id = p_connection;
  end if;
end $$;
revoke execute on function public.source_secret_store(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.source_secret_store(uuid, uuid, text) to service_role;

create or replace function public.source_secret_read(p_creator uuid, p_connection uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select d.decrypted_secret from public.source_connection_secrets s join vault.decrypted_secrets d on d.id = s.vault_secret_id
  where s.connection_id = p_connection and s.creator_id = p_creator
$$;
revoke execute on function public.source_secret_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.source_secret_read(uuid, uuid) to service_role;

-- ------------------------------------------------------------------------------------------- cursors
create table public.source_sync_cursors (
  connection_id uuid not null references public.source_connections(id) on delete cascade,
  scope_hash text not null check (char_length(scope_hash) <= 80),
  creator_id uuid not null references public.creators(id) on delete cascade,
  provider_cursor text check (provider_cursor is null or char_length(provider_cursor) <= 4000),
  checkpoint jsonb not null default '{}'::jsonb check (pg_column_size(checkpoint) <= 8192),
  last_committed_at timestamptz,
  last_successful_sync_at timestamptz,
  primary key (connection_id, scope_hash)
);
alter table public.source_sync_cursors enable row level security;
create policy source_sync_cursors_own_read on public.source_sync_cursors for select to authenticated using (creator_id = app.current_creator_id());
revoke all on public.source_sync_cursors from authenticated, anon;
grant select on public.source_sync_cursors to authenticated;

-- ------------------------------------------------------------------------------------------- jobs
create table public.source_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  connection_id uuid references public.source_connections(id) on delete cascade,
  parent_id uuid references public.source_sync_jobs(id) on delete cascade,
  scope_hash text not null default '' check (char_length(scope_hash) <= 80),
  mode text not null default 'quick' check (mode in ('quick', 'targeted', 'deeper')),
  status text not null default 'queued' check (status in ('queued', 'running', 'partially_complete', 'paused', 'completed', 'cancelled', 'failed')),
  phase text not null default 'queued' check (char_length(phase) <= 40),
  priority smallint not null default 3 check (priority between 0 and 4),
  idempotency_key text not null check (char_length(idempotency_key) <= 300),
  cancel_requested boolean not null default false,
  scanned_count int not null default 0,
  indexed_count int not null default 0,
  candidate_count int not null default 0,
  pages_fetched int not null default 0,
  transferred_bytes bigint not null default 0,
  ai_calls int not null default 0,
  attempts int not null default 0,
  error_code text check (error_code is null or char_length(error_code) <= 60),
  run_after timestamptz not null default now(),
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A repeated Sync tap returns the active job instead of starting another (spec §9).
create unique index source_sync_jobs_active_key on public.source_sync_jobs(idempotency_key) where status in ('queued', 'running', 'paused');
-- One active job per connection.
create unique index source_sync_jobs_active_connection on public.source_sync_jobs(connection_id) where status in ('queued', 'running') and connection_id is not null;
create index source_sync_jobs_creator_idx on public.source_sync_jobs(creator_id, created_at desc);
create index source_sync_jobs_runnable_idx on public.source_sync_jobs(priority, run_after) where status in ('queued', 'paused');
create trigger source_sync_jobs_touch before update on public.source_sync_jobs for each row execute function app.touch_updated_at();
alter table public.source_sync_jobs enable row level security;
create policy source_sync_jobs_own_read on public.source_sync_jobs for select to authenticated using (creator_id = app.current_creator_id());
-- The creator can ask to cancel; the worker stops at its next checkpoint.
create policy source_sync_jobs_own_cancel on public.source_sync_jobs for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
revoke all on public.source_sync_jobs from authenticated, anon;
grant select on public.source_sync_jobs to authenticated;
grant update (cancel_requested) on public.source_sync_jobs to authenticated;

-- ------------------------------------------------------------------------------------------- context index
create table public.source_context_records (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  connection_id uuid not null references public.source_connections(id) on delete cascade,
  provider_item_id text not null check (char_length(provider_item_id) between 1 and 500),
  source_type text not null check (source_type in ('email', 'event', 'note', 'photo', 'file')),
  occurred_at timestamptz,
  safe_title text check (safe_title is null or char_length(safe_title) <= 200),
  safe_excerpt text check (safe_excerpt is null or char_length(safe_excerpt) <= 600),
  place text check (place is null or char_length(place) <= 200),
  preview_ref text check (preview_ref is null or char_length(preview_ref) <= 2048),
  hydration_level smallint not null default 1 check (hydration_level between 0 and 4),
  fingerprint text check (fingerprint is null or char_length(fingerprint) <= 128),
  signals jsonb not null default '{}'::jsonb check (pg_column_size(signals) <= 2048),
  material_id uuid references public.creative_materials(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Retries and replays never duplicate a record.
  unique (connection_id, provider_item_id)
);
create index source_context_records_creator_idx on public.source_context_records(creator_id, occurred_at desc);
create trigger source_context_records_touch before update on public.source_context_records for each row execute function app.touch_updated_at();
alter table public.source_context_records enable row level security;
create policy source_context_records_own_read on public.source_context_records for select to authenticated using (creator_id = app.current_creator_id());
create policy source_context_records_own_delete on public.source_context_records for delete to authenticated using (creator_id = app.current_creator_id());
revoke all on public.source_context_records from authenticated, anon;
grant select, delete on public.source_context_records to authenticated;

-- ------------------------------------------------------------------------------------------- candidates
create table public.context_candidates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  signature text not null check (char_length(signature) <= 128),
  title text not null check (char_length(title) between 1 and 120),
  explanation text not null default '' check (char_length(explanation) <= 400),
  quote text check (quote is null or char_length(quote) <= 240),
  record_ids uuid[] not null default '{}' check (cardinality(record_ids) <= 200),
  counts jsonb not null default '{}'::jsonb,
  score real not null default 0,
  state text not null default 'new' check (state in ('new', 'reviewed', 'dismissed', 'imported', 'expired')),
  imported_material_ids uuid[] not null default '{}',
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, signature)
);
create index context_candidates_creator_idx on public.context_candidates(creator_id, state, score desc);
create trigger context_candidates_touch before update on public.context_candidates for each row execute function app.touch_updated_at();
alter table public.context_candidates enable row level security;
create policy context_candidates_own_read on public.context_candidates for select to authenticated using (creator_id = app.current_creator_id());
-- The creator can mark one reviewed or dismiss it; "imported" is set by the server after a deliberate import.
create policy context_candidates_own_update on public.context_candidates for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id() and state in ('new', 'reviewed', 'dismissed'));
revoke all on public.context_candidates from authenticated, anon;
grant select on public.context_candidates to authenticated;
grant update (state) on public.context_candidates to authenticated;

-- ------------------------------------------------------------------------------------------- provenance
alter table public.provenance_records drop constraint provenance_records_origin_check;
alter table public.provenance_records add constraint provenance_records_origin_check check (origin in (
  'upload', 'camera', 'voice_recording', 'paste', 'typed', 'url', 'youtube',
  'huddle', 'conversation', 'ai_generated', 'derived', 'import', 'personal_source'
));

-- ------------------------------------------------------------------------------------------- retention
-- Discovery data is temporary (spec §11): expired previews and candidates go; finished sync runs after 30 days.
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
  perform app.record_audit('retention.run', 'system', null, result, null);
  return result;
end $$;
revoke execute on function app.run_retention() from public, anon, authenticated;
