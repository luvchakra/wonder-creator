-- P0.1-10 Publishing setup & governed publish action.
-- A creator prepares a publication of a piece for a destination (their Wonder Creator profile, or a webhook
-- they own: their site, Zapier, Make…), reviews it and approves it. Approval fixes the exact version and copy.
-- The attempt is carried out by the server; a publication is marked published only after the destination
-- confirms it (the profile update commits, or the webhook answers 2xx), with its external id/URL recorded.
-- Failures are per destination and retryable with the same idempotency key. Creators can edit drafts and
-- approve or cancel, never set outcomes: status changes go through the functions below or the server.

-- 1. Destinations the creator has connected --------------------------------------------------------------
create table public.publishing_destinations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('webhook')),
  name text not null check (char_length(name) between 1 and 60),
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  signing_secret text not null check (char_length(signing_secret) between 32 and 128),
  status text not null default 'active' check (status in ('active', 'disconnected')),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index publishing_destinations_creator_idx on public.publishing_destinations(creator_id, created_at desc);
alter table public.publishing_destinations enable row level security;
create policy publishing_destinations_own on public.publishing_destinations for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id());

-- 2. Publications -------------------------------------------------------------------------------------------
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  destination_kind text not null check (destination_kind in ('profile', 'webhook')),
  destination_id uuid references public.publishing_destinations(id) on delete set null,
  destination_name text not null check (char_length(destination_name) between 1 and 60),
  version_id uuid references public.artifact_versions(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  caption text check (caption is null or char_length(caption) <= 2200),
  description text check (description is null or char_length(description) <= 5000),
  scheduled_for timestamptz,
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  idempotency_key uuid not null unique default gen_random_uuid(),
  approved_at timestamptz,
  published_at timestamptz,
  external_id text check (external_id is null or char_length(external_id) <= 200),
  external_url text check (external_url is null or (char_length(external_url) <= 2000 and external_url ~ '^(https://|/)')),
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500),
  attempts int not null default 0,
  prepared_by text not null default 'creator' check (prepared_by in ('creator', 'creatorbrain')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (destination_kind <> 'profile' or destination_id is null)
);
create index publications_artifact_idx on public.publications(artifact_id, created_at desc);
create index publications_creator_idx on public.publications(creator_id, created_at desc);
create index publications_due_idx on public.publications(scheduled_for) where status = 'scheduled';
create index publications_destination_id_fk_idx on public.publications(destination_id);
create index publications_version_id_fk_idx on public.publications(version_id);
create trigger publications_touch before update on public.publications
  for each row execute function app.touch_updated_at();

alter table public.publications enable row level security;
create policy publications_read on public.publications for select to authenticated
  using (creator_id = app.current_creator_id());
create policy publications_insert on public.publications for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and app.owns_artifact(artifact_id)
    and status = 'draft' and approved_at is null and published_at is null and external_id is null and external_url is null
    and failure_reason is null and attempts = 0
    and (destination_id is null or exists (select 1 from public.publishing_destinations d where d.id = destination_id and d.creator_id = app.current_creator_id() and d.status = 'active'))
  );
create policy publications_update on public.publications for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy publications_delete on public.publications for delete to authenticated
  using (creator_id = app.current_creator_id() and status in ('draft', 'cancelled'));

-- Creators edit drafts; only the functions below (and the server) move status or record outcomes.
create or replace function app.guard_publication_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.artifact_id is distinct from old.artifact_id or new.creator_id is distinct from old.creator_id
     or new.status is distinct from old.status or new.idempotency_key is distinct from old.idempotency_key
     or new.approved_at is distinct from old.approved_at or new.published_at is distinct from old.published_at
     or new.external_id is distinct from old.external_id or new.external_url is distinct from old.external_url
     or new.failure_reason is distinct from old.failure_reason or new.attempts is distinct from old.attempts
     or new.version_id is distinct from old.version_id or new.prepared_by is distinct from old.prepared_by then
    raise exception 'Publishing outcomes are recorded by Wonder Creator, not edited.' using errcode = '42501';
  end if;
  if old.status <> 'draft' then
    raise exception 'This publication was already approved. Cancel it and prepare a new one to change it.' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger publications_guard before update on public.publications
  for each row execute function app.guard_publication_update();

-- 3. Attempts (history; written by the server) --------------------------------------------------------------
create table public.publication_attempts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  attempt_no int not null check (attempt_no > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text check (outcome in ('succeeded', 'failed')),
  http_status int,
  error text check (error is null or char_length(error) <= 500),
  external_id text,
  external_url text,
  unique (publication_id, attempt_no)
);
create index publication_attempts_creator_id_fk_idx on public.publication_attempts(creator_id);
alter table public.publication_attempts enable row level security;
create policy publication_attempts_read on public.publication_attempts for select to authenticated
  using (creator_id = app.current_creator_id());

-- 4. Approve / cancel -----------------------------------------------------------------------------------------
-- Approval is the creator's, for exactly this version and copy: 'approved' (the server attempts it now) or
-- 'scheduled' (attempted once the time comes). 'publishing' is set by the server when an attempt starts.
create or replace function public.approve_publication(p_publication uuid)
returns public.publications language plpgsql security definer set search_path = ''
as $$
declare p public.publications; v uuid;
begin
  select * into p from public.publications where id = p_publication and creator_id = app.current_creator_id() for update;
  if p.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p.status <> 'draft' then raise exception 'This publication was already approved or closed.' using errcode = '55000'; end if;
  if p.destination_kind = 'webhook' and not exists (select 1 from public.publishing_destinations d where d.id = p.destination_id and d.status = 'active') then
    raise exception 'That destination is no longer connected.' using errcode = '55000';
  end if;
  select current_version_id into v from public.artifacts where id = p.artifact_id and status <> 'archived';
  if v is null then raise exception 'This piece has nothing to publish yet.' using errcode = '55000'; end if;
  update public.publications
    set approved_at = now(), version_id = v,
        status = case when scheduled_for is not null and scheduled_for > now() then 'scheduled' else 'approved' end
  where id = p.id returning * into p;
  perform app.record_audit('publication.approved', 'publication', p.id,
    jsonb_build_object('artifact_id', p.artifact_id, 'destination', p.destination_kind, 'scheduled_for', p.scheduled_for), null);
  return p;
end $$;
revoke execute on function public.approve_publication(uuid) from public, anon;
grant execute on function public.approve_publication(uuid) to authenticated;

create or replace function public.cancel_publication(p_publication uuid)
returns public.publications language plpgsql security definer set search_path = ''
as $$
declare p public.publications;
begin
  update public.publications set status = 'cancelled'
  where id = p_publication and creator_id = app.current_creator_id() and status in ('draft', 'approved', 'scheduled', 'failed')
  returning * into p;
  if p.id is null then
    if exists (select 1 from public.publications where id = p_publication and creator_id = app.current_creator_id()) then
      raise exception 'This publication can''t be cancelled now.' using errcode = '55000';
    end if;
    raise exception 'not found' using errcode = 'P0002';
  end if;
  perform app.record_audit('publication.cancelled', 'publication', p.id, jsonb_build_object('artifact_id', p.artifact_id), null);
  return p;
end $$;
revoke execute on function public.cancel_publication(uuid) from public, anon;
grant execute on function public.cancel_publication(uuid) to authenticated;

-- Outcomes in the audit log.
create or replace function app.audit_publication_outcome()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('published', 'failed') then
    insert into public.audit_logs(tenant_id, actor_user_id, actor_creator_id, action, object_type, object_id, metadata)
    select c.tenant_id, c.user_id, c.id, 'publication.' || new.status, 'publication', new.id,
           jsonb_build_object('artifact_id', new.artifact_id, 'destination', new.destination_kind, 'external_url', new.external_url, 'attempts', new.attempts)
    from public.creators c where c.id = new.creator_id;
  end if;
  return new;
end $$;
create trigger publications_audit after update of status on public.publications
  for each row execute function app.audit_publication_outcome();
revoke execute on function app.audit_publication_outcome() from public, anon, authenticated;
