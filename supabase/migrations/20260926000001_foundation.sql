-- Wonder Creator foundation: tenancy, creators, audit, domain events, jobs, storage objects.
-- Every creator-owned table has RLS. UI visibility is never the authorization boundary.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.privacy_class as enum (
  'public', 'creator_private', 'shared', 'collaborator_only', 'huddle_ephemeral', 'system_restricted'
);
create type public.profile_visibility as enum ('public', 'creators_only', 'private');
create type public.tenant_role as enum ('owner', 'admin', 'member');
create type public.job_status as enum ('pending', 'running', 'succeeded', 'failed', 'dead');

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'personal' check (kind in ('personal', 'team')),
  created_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_memberships_user_idx on public.tenant_memberships(user_id);

-- ---------------------------------------------------------------------------
-- Creators (one creator identity per auth user in P0)
-- ---------------------------------------------------------------------------
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  handle citext unique check (handle is null or handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text check (bio is null or char_length(bio) <= 300),
  location text check (location is null or char_length(location) <= 120),
  show_location boolean not null default false,
  avatar_object_id uuid,
  visibility public.profile_visibility not null default 'creators_only',
  collaboration_availability text not null default 'open'
    check (collaboration_availability in ('open', 'selective', 'closed')),
  onboarding_step text not null default 'welcome'
    check (onboarding_step in ('welcome', 'about', 'identity', 'style', 'boundaries', 'ready', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creators_tenant_idx on public.creators(tenant_id);

-- Resolve the calling creator deterministically from the JWT. Never trust a client-sent creator id.
create or replace function app.current_creator_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select c.id from public.creators c where c.user_id = auth.uid() $$;

create or replace function app.current_tenant_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select c.tenant_id from public.creators c where c.user_id = auth.uid() $$;

create or replace function app.is_tenant_member(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.tenant_memberships m where m.tenant_id = p_tenant and m.user_id = auth.uid()) $$;

create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger creators_touch before update on public.creators
  for each row execute function app.touch_updated_at();

-- Blocks (moderation; durable)
create table public.creator_blocks (
  blocker_creator_id uuid not null references public.creators(id) on delete cascade,
  blocked_creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_creator_id, blocked_creator_id),
  check (blocker_creator_id <> blocked_creator_id)
);

-- Can the caller see this creator's profile?
create or replace function app.can_view_creator(p_creator uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.creators c
    where c.id = p_creator
      and (
        c.user_id = auth.uid()
        or c.visibility = 'public'
        or (c.visibility = 'creators_only' and auth.uid() is not null)
      )
      and not exists (
        select 1 from public.creator_blocks b
        where b.blocker_creator_id = c.id and b.blocked_creator_id = app.current_creator_id()
      )
  )
$$;

-- New auth user => personal tenant + membership + creator shell.
create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, ''), '@', 1), '');
begin
  insert into public.tenants(name, kind) values (coalesce(nullif(v_name, ''), 'Creator'), 'personal') returning id into v_tenant;
  insert into public.tenant_memberships(tenant_id, user_id, role) values (v_tenant, new.id, 'owner');
  insert into public.creators(user_id, tenant_id, display_name) values (new.id, v_tenant, left(v_name, 80));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit log & domain events (immutable, insert via definer functions only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid,
  actor_user_id uuid,
  actor_creator_id uuid,
  action text not null,
  object_type text not null,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_logs_creator_idx on public.audit_logs(actor_creator_id, created_at desc);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[A-Z][A-Za-z]+$'),
  aggregate_type text not null,
  aggregate_id uuid,
  tenant_id uuid,
  creator_id uuid,
  payload jsonb not null default '{}'::jsonb,
  correlation_id text,
  occurred_at timestamptz not null default now()
);
create index domain_events_type_idx on public.domain_events(event_type, occurred_at);
create index domain_events_creator_idx on public.domain_events(creator_id, occurred_at desc);

-- Idempotent consumers record what they have processed.
create table public.event_consumptions (
  consumer text not null,
  event_id uuid not null references public.domain_events(id) on delete cascade,
  processed_at timestamptz not null default now(),
  primary key (consumer, event_id)
);

create or replace function app.prevent_mutation()
returns trigger language plpgsql as $$
begin raise exception 'immutable record' using errcode = '42501'; end $$;

create trigger domain_events_immutable before update or delete on public.domain_events
  for each row execute function app.prevent_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function app.prevent_mutation();

create or replace function app.record_event(
  p_event_type text, p_aggregate_type text, p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.domain_events(event_type, aggregate_type, aggregate_id, tenant_id, creator_id, payload, correlation_id)
  values (p_event_type, p_aggregate_type, p_aggregate_id, app.current_tenant_id(), app.current_creator_id(),
          coalesce(p_payload, '{}'::jsonb), p_correlation_id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function app.record_audit(
  p_action text, p_object_type text, p_object_id uuid,
  p_metadata jsonb default '{}'::jsonb, p_request_id text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs(tenant_id, actor_user_id, actor_creator_id, action, object_type, object_id, metadata, request_id)
  values (app.current_tenant_id(), auth.uid(), app.current_creator_id(), p_action, p_object_type, p_object_id,
          coalesce(p_metadata, '{}'::jsonb), p_request_id);
end $$;

-- Public RPC wrappers (PostgREST exposes the public schema only).
create or replace function public.record_domain_event(
  p_event_type text, p_aggregate_type text, p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb, p_correlation_id text default null
) returns uuid
language sql security definer set search_path = ''
as $$ select app.record_event(p_event_type, p_aggregate_type, p_aggregate_id, p_payload, p_correlation_id) $$;

create or replace function public.record_audit_log(
  p_action text, p_object_type text, p_object_id uuid,
  p_metadata jsonb default '{}'::jsonb, p_request_id text default null
) returns void
language sql security definer set search_path = ''
as $$ select app.record_audit(p_action, p_object_type, p_object_id, p_metadata, p_request_id) $$;

revoke execute on function public.record_domain_event(text, text, uuid, jsonb, text) from anon, public;
revoke execute on function public.record_audit_log(text, text, uuid, jsonb, text) from anon, public;
grant execute on function public.record_domain_event(text, text, uuid, jsonb, text) to authenticated;
grant execute on function public.record_audit_log(text, text, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Durable background jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  last_error text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_pending_idx on public.jobs(status, run_after) where status in ('pending', 'failed');
create trigger jobs_touch before update on public.jobs for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage object registry (never expose raw provider paths to clients)
-- ---------------------------------------------------------------------------
create table public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  bucket text not null,
  path text not null,
  mime_type text not null,
  declared_mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  original_filename text,
  security_status text not null default 'pending'
    check (security_status in ('pending', 'clean', 'quarantined', 'rejected')),
  privacy public.privacy_class not null default 'creator_private',
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index storage_objects_creator_idx on public.storage_objects(creator_id);

alter table public.creators
  add constraint creators_avatar_fk foreign key (avatar_object_id) references public.storage_objects(id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.creators enable row level security;
alter table public.creator_blocks enable row level security;
alter table public.audit_logs enable row level security;
alter table public.domain_events enable row level security;
alter table public.event_consumptions enable row level security;
alter table public.jobs enable row level security;
alter table public.storage_objects enable row level security;

create policy tenants_member_read on public.tenants for select to authenticated
  using (app.is_tenant_member(id));

create policy memberships_self_read on public.tenant_memberships for select to authenticated
  using (user_id = auth.uid());

create policy creators_read on public.creators for select to authenticated
  using (app.can_view_creator(id));
create policy creators_public_read on public.creators for select to anon
  using (visibility = 'public');
-- Only the creator themselves can update; tenant/user bindings are protected by a trigger.
create policy creators_update_self on public.creators for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function app.protect_creator_bindings()
returns trigger language plpgsql as $$
begin
  if new.user_id <> old.user_id or new.tenant_id <> old.tenant_id or new.id <> old.id then
    raise exception 'creator bindings are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger creators_protect_bindings before update on public.creators
  for each row execute function app.protect_creator_bindings();

create policy blocks_own on public.creator_blocks for all to authenticated
  using (blocker_creator_id = app.current_creator_id())
  with check (blocker_creator_id = app.current_creator_id());

create policy audit_own_read on public.audit_logs for select to authenticated
  using (actor_creator_id = app.current_creator_id());

create policy events_own_read on public.domain_events for select to authenticated
  using (creator_id = app.current_creator_id());

create policy jobs_own on public.jobs for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id());

create policy storage_objects_own on public.storage_objects for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id());
