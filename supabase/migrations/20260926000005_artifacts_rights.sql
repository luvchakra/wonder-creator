-- Artifacts, immutable versions, lineage (Creative Graph), contributors, quality, rights foundation.

create type public.artifact_status as enum ('draft', 'in_review', 'final', 'published', 'archived');
create type public.lineage_relationship as enum (
  'created_from', 'derived_from', 'adapted_from', 'references', 'contains_material', 'inspired_by', 'version_of'
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  artifact_type text not null check (artifact_type ~ '^[a-z_]{2,40}$'),
  category text not null check (category in ('writing', 'visual', 'audio', 'video', 'social')),
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  status public.artifact_status not null default 'draft',
  current_version_id uuid,
  provenance_id uuid not null references public.provenance_records(id),
  cover_material_id uuid references public.creative_materials(id) on delete set null,
  privacy public.privacy_class not null default 'creator_private',
  featured_on_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored
);
create index artifacts_creator_idx on public.artifacts(creator_id, updated_at desc);
create index artifacts_search_idx on public.artifacts using gin(search);
create trigger artifacts_touch before update on public.artifacts
  for each row execute function app.touch_updated_at();

create table public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  version_number int not null check (version_number > 0),
  parent_version_id uuid references public.artifact_versions(id) on delete set null,
  label text not null default 'Draft' check (char_length(label) <= 80),
  content text not null default '' check (char_length(content) <= 500000),
  structured_content jsonb,
  generation_metadata jsonb,
  change_summary text check (change_summary is null or char_length(change_summary) <= 500),
  author_kind text not null check (author_kind in ('creator', 'ai', 'restore')),
  created_by_creator_id uuid references public.creators(id) on delete set null,
  created_by_ai_run_id uuid references public.ai_runs(id) on delete set null,
  restored_from_version_id uuid references public.artifact_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (artifact_id, version_number)
);
create index artifact_versions_artifact_idx on public.artifact_versions(artifact_id, version_number desc);

alter table public.artifacts
  add constraint artifacts_current_version_fk foreign key (current_version_id)
  references public.artifact_versions(id) on delete set null;

-- Versions are history: never rewritten. Restore creates a new version.
create trigger artifact_versions_immutable before update on public.artifact_versions
  for each row execute function app.prevent_mutation();

create table public.lineage_edges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  source_type text not null check (source_type in ('material', 'artifact', 'artifact_version', 'reference', 'conversation', 'huddle')),
  source_id uuid not null,
  target_type text not null check (target_type in ('artifact', 'artifact_version', 'material')),
  target_id uuid not null,
  relationship public.lineage_relationship not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id, relationship),
  check (not (source_type = target_type and source_id = target_id))
);
create index lineage_target_idx on public.lineage_edges(target_type, target_id);
create index lineage_source_idx on public.lineage_edges(source_type, source_id);

create table public.artifact_contributors (
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  contributor_creator_id uuid not null references public.creators(id) on delete cascade,
  role text not null check (char_length(role) between 1 and 60),
  added_by_creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (artifact_id, contributor_creator_id)
);

create table public.quality_reports (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_id uuid not null references public.artifact_versions(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  checks jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index quality_reports_artifact_idx on public.quality_reports(artifact_id, created_at desc);

-- Rights foundation. Records preserve evidence and contractual state; they are not, alone, legal proof of ownership.
create table public.rights_records (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null unique references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  ownership_kind text not null default 'sole' check (ownership_kind in ('sole', 'joint', 'transferred')),
  copyright_holder text not null check (char_length(copyright_holder) between 1 and 200),
  copyright_registration text check (copyright_registration is null or char_length(copyright_registration) <= 200),
  attribution_required boolean not null default true,
  derivatives_allowed boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger rights_touch before update on public.rights_records
  for each row execute function app.touch_updated_at();

create table public.rights_owners (
  id uuid primary key default gen_random_uuid(),
  rights_id uuid not null references public.rights_records(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  owner_creator_id uuid references public.creators(id) on delete set null,
  owner_name text not null check (char_length(owner_name) between 1 and 200),
  share_percent numeric(5, 2) not null check (share_percent > 0 and share_percent <= 100),
  created_at timestamptz not null default now()
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  rights_id uuid not null references public.rights_records(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  license_type text not null check (license_type in ('personal', 'commercial', 'editorial', 'promotional', 'educational', 'internal')),
  licensee_name text check (licensee_name is null or char_length(licensee_name) <= 200),
  exclusive boolean not null default false,
  territory text not null default 'Worldwide' check (char_length(territory) <= 120),
  starts_on date,
  ends_on date,
  modification_allowed boolean not null default false,
  derivatives_allowed boolean not null default false,
  resale_allowed boolean not null default false,
  attribution_required boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'active', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.rights_events (
  id uuid primary key default gen_random_uuid(),
  rights_id uuid not null references public.rights_records(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create trigger rights_events_immutable before update on public.rights_events
  for each row execute function app.prevent_mutation();

-- Helpers --------------------------------------------------------------------
create or replace function app.owns_artifact(p_artifact uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.artifacts a where a.id = p_artifact and a.creator_id = app.current_creator_id()) $$;

create or replace function app.can_read_artifact(p_artifact uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.artifacts a
    where a.id = p_artifact and (
      a.creator_id = app.current_creator_id()
      or exists (select 1 from public.artifact_contributors ac where ac.artifact_id = a.id and ac.contributor_creator_id = app.current_creator_id())
      or (a.privacy = 'public' and a.status in ('final', 'published') and app.can_view_creator(a.creator_id))
    )
  )
$$;

-- Atomic version creation: numbers are assigned under a row lock; the artifact pointer moves forward.
create or replace function public.create_artifact_version(
  p_artifact_id uuid,
  p_content text,
  p_label text,
  p_author_kind text,
  p_change_summary text default null,
  p_structured_content jsonb default null,
  p_generation_metadata jsonb default null,
  p_ai_run_id uuid default null,
  p_restored_from uuid default null
) returns public.artifact_versions
language plpgsql security invoker set search_path = ''
as $$
declare
  v_artifact public.artifacts;
  v_next int;
  v_row public.artifact_versions;
begin
  select * into v_artifact from public.artifacts where id = p_artifact_id for update;
  if not found or v_artifact.creator_id <> app.current_creator_id() then
    raise exception 'artifact not found' using errcode = 'P0002';
  end if;
  if v_artifact.status = 'archived' then
    raise exception 'artifact is archived' using errcode = '22023';
  end if;
  if p_restored_from is not null and not exists (
    select 1 from public.artifact_versions v where v.id = p_restored_from and v.artifact_id = p_artifact_id
  ) then
    raise exception 'restore source is not a version of this artifact' using errcode = '22023';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next from public.artifact_versions where artifact_id = p_artifact_id;

  insert into public.artifact_versions(
    artifact_id, creator_id, version_number, parent_version_id, label, content, structured_content,
    generation_metadata, change_summary, author_kind, created_by_creator_id, created_by_ai_run_id, restored_from_version_id
  ) values (
    p_artifact_id, v_artifact.creator_id, v_next, v_artifact.current_version_id, coalesce(nullif(p_label, ''), 'Draft'),
    coalesce(p_content, ''), p_structured_content, p_generation_metadata, p_change_summary, p_author_kind,
    case when p_author_kind = 'ai' then null else v_artifact.creator_id end, p_ai_run_id, p_restored_from
  ) returning * into v_row;

  update public.artifacts set current_version_id = v_row.id where id = p_artifact_id;
  perform app.record_event('ArtifactVersionCreated', 'artifact', p_artifact_id,
    jsonb_build_object('versionId', v_row.id, 'versionNumber', v_next, 'authorKind', p_author_kind));
  return v_row;
end $$;
revoke execute on function public.create_artifact_version(uuid, text, text, text, text, jsonb, jsonb, uuid, uuid) from anon, public;
grant execute on function public.create_artifact_version(uuid, text, text, text, text, jsonb, jsonb, uuid, uuid) to authenticated;

-- Rights history is written automatically for every change to the rights record or its licenses.
create or replace function app.log_rights_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid; v_creator uuid;
begin
  if tg_table_name = 'rights_records' then
    v_rights := coalesce(new.id, old.id); v_creator := coalesce(new.creator_id, old.creator_id);
  else
    v_rights := coalesce(new.rights_id, old.rights_id); v_creator := coalesce(new.creator_id, old.creator_id);
  end if;
  if tg_op = 'DELETE' and tg_table_name = 'rights_records' then
    return old;
  end if;
  insert into public.rights_events(rights_id, creator_id, event, details)
  values (v_rights, v_creator, lower(tg_table_name) || '.' || lower(tg_op),
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  perform app.record_audit('rights.' || lower(tg_op), tg_table_name, coalesce(new.id, old.id), '{}'::jsonb, null);
  return coalesce(new, old);
end $$;
create trigger rights_records_log after insert or update on public.rights_records
  for each row execute function app.log_rights_change();
create trigger licenses_log after insert or update or delete on public.licenses
  for each row execute function app.log_rights_change();
create trigger rights_owners_log after insert or update or delete on public.rights_owners
  for each row execute function app.log_rights_change();

-- RLS ------------------------------------------------------------------------
alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.lineage_edges enable row level security;
alter table public.artifact_contributors enable row level security;
alter table public.quality_reports enable row level security;
alter table public.rights_records enable row level security;
alter table public.rights_owners enable row level security;
alter table public.licenses enable row level security;
alter table public.rights_events enable row level security;

create policy artifacts_read on public.artifacts for select to authenticated using (app.can_read_artifact(id));
create policy artifacts_anon_read on public.artifacts for select to anon
  using (privacy = 'public' and status in ('final', 'published') and app.can_view_creator(creator_id));
create policy artifacts_insert on public.artifacts for insert to authenticated
  with check (creator_id = app.current_creator_id());
create policy artifacts_update on public.artifacts for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy artifacts_delete on public.artifacts for delete to authenticated
  using (creator_id = app.current_creator_id());

create policy versions_read on public.artifact_versions for select to authenticated using (app.can_read_artifact(artifact_id));
create policy versions_anon_read on public.artifact_versions for select to anon
  using (exists (select 1 from public.artifacts a where a.id = artifact_id and a.current_version_id = artifact_versions.id
                 and a.privacy = 'public' and a.status in ('final', 'published') and app.can_view_creator(a.creator_id)));
-- Inserts go through create_artifact_version (security invoker) which enforces ownership.
create policy versions_insert on public.artifact_versions for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id));

create policy lineage_read on public.lineage_edges for select to authenticated
  using (creator_id = app.current_creator_id()
         or (target_type = 'artifact' and app.can_read_artifact(target_id) and source_type = 'artifact' and app.can_read_artifact(source_id)));
create policy lineage_write on public.lineage_edges for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and case target_type
      when 'artifact' then app.owns_artifact(target_id)
      when 'material' then app.owns_material(target_id)
      else exists (select 1 from public.artifact_versions v where v.id = target_id and app.owns_artifact(v.artifact_id))
    end
    and case source_type
      when 'artifact' then app.can_read_artifact(source_id)
      when 'material' then app.owns_material(source_id)
      when 'artifact_version' then exists (select 1 from public.artifact_versions v where v.id = source_id and app.can_read_artifact(v.artifact_id))
      else true
    end
  );
create policy lineage_delete on public.lineage_edges for delete to authenticated using (creator_id = app.current_creator_id());

create policy contributors_read on public.artifact_contributors for select to authenticated using (app.can_read_artifact(artifact_id));
create policy contributors_write on public.artifact_contributors for all to authenticated
  using (app.owns_artifact(artifact_id))
  with check (app.owns_artifact(artifact_id) and added_by_creator_id = app.current_creator_id());

create policy quality_own on public.quality_reports for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id));

create policy rights_read on public.rights_records for select to authenticated using (app.can_read_artifact(artifact_id));
create policy rights_write on public.rights_records for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id));
create policy rights_update on public.rights_records for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy rights_owners_read on public.rights_owners for select to authenticated
  using (exists (select 1 from public.rights_records r where r.id = rights_id and app.can_read_artifact(r.artifact_id)));
create policy rights_owners_write on public.rights_owners for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id()
              and exists (select 1 from public.rights_records r where r.id = rights_id and r.creator_id = app.current_creator_id()));

create policy licenses_read on public.licenses for select to authenticated
  using (exists (select 1 from public.rights_records r where r.id = rights_id and app.can_read_artifact(r.artifact_id)));
create policy licenses_write on public.licenses for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id()
              and exists (select 1 from public.rights_records r where r.id = rights_id and r.creator_id = app.current_creator_id()));

create policy rights_events_read on public.rights_events for select to authenticated using (creator_id = app.current_creator_id());

alter table public.conversation_attachments
  add constraint conversation_attachments_artifact_fk foreign key (artifact_id) references public.artifacts(id) on delete set null;
alter table public.ai_runs
  add constraint ai_runs_artifact_fk foreign key (artifact_id) references public.artifacts(id) on delete set null;
