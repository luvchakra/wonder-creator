-- P1-07 Contribution & Attribution Ledger: a durable record of who contributed what.
-- - Facts are immutable: who, what kind, what it relates to (project, piece, version, material), where it came from
--   and when. Entries are never deleted; the owner can retract one with a reason (it stays on record).
-- - Descriptive fields can be refined with a history of every change: the contributor edits their own description;
--   the project's or piece's owner edits attribution, credit line, rights and compensation relationships, and an
--   optional share — a percentage exists only when someone explicitly records it (never inferred), and a project's
--   or piece's defined shares can't exceed 100%.
-- - Recorded automatically: versions written by someone other than the piece's owner (edits and accepted
--   proposals), work a crew member shares into a project, and tasks completed by their assignees. The owner and
--   crew admins record anything else by hand.

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  version_id uuid references public.artifact_versions(id) on delete set null,
  material_id uuid references public.creative_materials(id) on delete set null,
  contributor_creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('writing', 'editing', 'idea', 'material', 'direction', 'design', 'sound', 'performance', 'research', 'production', 'review', 'task', 'other')),
  source text not null check (source in ('version', 'shared_item', 'task', 'manual')),
  source_id uuid,
  description text not null default '' check (char_length(description) <= 1000),
  attribution text not null default 'required' check (attribution in ('required', 'optional', 'none')),
  credit_line text check (credit_line is null or char_length(credit_line) <= 200),
  rights_relationship text not null default 'contributor' check (rights_relationship in ('contributor', 'co_owner', 'licensed', 'work_for_hire', 'none')),
  compensation_note text check (compensation_note is null or char_length(compensation_note) <= 500),
  share_percent numeric(5, 2) check (share_percent is null or (share_percent > 0 and share_percent <= 100)),
  recorded_by uuid references public.creators(id) on delete set null,
  retracted_at timestamptz,
  retracted_reason text check (retracted_reason is null or char_length(retracted_reason) <= 500),
  created_at timestamptz not null default now(),
  check (project_id is not null or artifact_id is not null)
);
create unique index contributions_source_unique on public.contributions(source, source_id, contributor_creator_id) where source <> 'manual';
create index contributions_project_idx on public.contributions(project_id, created_at desc);
create index contributions_artifact_idx on public.contributions(artifact_id, created_at desc);
create index contributions_contributor_idx on public.contributions(contributor_creator_id, created_at desc);
create index contributions_version_id_fk_idx on public.contributions(version_id);
create index contributions_material_id_fk_idx on public.contributions(material_id);
create index contributions_recorded_by_fk_idx on public.contributions(recorded_by);

create table public.contribution_edits (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  editor_creator_id uuid references public.creators(id) on delete set null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index contribution_edits_contribution_idx on public.contribution_edits(contribution_id, created_at);
create index contribution_edits_editor_fk_idx on public.contribution_edits(editor_creator_id);

-- Who manages a contribution's descriptive fields: the project's owner/admins, or the piece's owner.
create or replace function app.manages_contribution(c public.contributions)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (c.project_id is not null and app.project_role(c.project_id) in ('owner', 'admin'))
      or (c.artifact_id is not null and app.owns_artifact(c.artifact_id))
$$;

create or replace function app.can_see_contribution(c public.contributions)
returns boolean language sql stable security definer set search_path = ''
as $$
  select c.contributor_creator_id = app.current_creator_id()
      or (c.project_id is not null and app.can_read_project(c.project_id))
      or (c.artifact_id is not null and app.artifact_access(c.artifact_id) is not null)
$$;

alter table public.contributions enable row level security;
create policy contributions_read on public.contributions for select to authenticated using (app.can_see_contribution(contributions));
-- Manual entries: the project's owner/admins or the piece's owner, for people involved.
create policy contributions_insert on public.contributions for insert to authenticated
  with check (
    source = 'manual' and recorded_by = app.current_creator_id() and retracted_at is null
    and app.manages_contribution(contributions)
    and ((project_id is not null and app.is_project_person(project_id, contributor_creator_id))
         or (artifact_id is not null and (exists (select 1 from public.artifacts a where a.id = artifact_id and a.creator_id = contributor_creator_id)
                                          or exists (select 1 from public.artifact_contributors ac where ac.artifact_id = contributions.artifact_id and ac.contributor_creator_id = contributions.contributor_creator_id))))
    and (version_id is null or exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = contributions.artifact_id))
  );
-- Edits go through contribution_update(); nothing is deleted.
revoke update, delete on public.contributions from authenticated;

alter table public.contribution_edits enable row level security;
create policy contribution_edits_read on public.contribution_edits for select to authenticated
  using (exists (select 1 from public.contributions c where c.id = contribution_id and app.can_see_contribution(c)));
revoke insert, update, delete on public.contribution_edits from authenticated;

-- Defined shares for a project or piece can't exceed 100%.
create or replace function app.check_contribution_shares()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare total numeric;
begin
  if new.share_percent is null or new.retracted_at is not null then return new; end if;
  select coalesce(sum(share_percent), 0) into total from public.contributions c
  where c.id <> new.id and c.retracted_at is null and c.share_percent is not null
    and ((new.project_id is not null and c.project_id = new.project_id) or (new.project_id is null and c.project_id is null and c.artifact_id = new.artifact_id));
  if total + new.share_percent > 100 then raise exception 'shares exceed 100' using errcode = '22023'; end if;
  return new;
end $$;
create trigger contributions_shares before insert or update on public.contributions
  for each row execute function app.check_contribution_shares();
revoke execute on function app.check_contribution_shares() from public, anon, authenticated;

-- Refine descriptive fields (with history). The contributor edits their own description; managers edit the rest.
create or replace function public.contribution_update(
  p_id uuid, p_description text default null, p_attribution text default null, p_credit_line text default null,
  p_rights text default null, p_compensation text default null, p_share numeric default null, p_clear_share boolean default false
) returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contributions; v_me uuid := app.require_creator(); manages boolean; changes jsonb := '{}'::jsonb;
begin
  select * into c from public.contributions where id = p_id for update;
  if c.id is null or not app.can_see_contribution(c) then raise exception 'contribution not found' using errcode = 'P0002'; end if;
  if c.retracted_at is not null then raise exception 'contribution retracted' using errcode = '55000'; end if;
  manages := app.manages_contribution(c);
  if p_description is not null then
    if not (manages or c.contributor_creator_id = v_me) then raise exception 'not allowed' using errcode = '42501'; end if;
    changes := changes || jsonb_build_object('description', jsonb_build_object('from', c.description, 'to', left(trim(p_description), 1000)));
    c.description := left(trim(p_description), 1000);
  end if;
  if p_attribution is not null or p_credit_line is not null or p_rights is not null or p_compensation is not null or p_share is not null or p_clear_share then
    if not manages then raise exception 'not allowed' using errcode = '42501'; end if;
    if p_attribution is not null then changes := changes || jsonb_build_object('attribution', jsonb_build_object('from', c.attribution, 'to', p_attribution)); c.attribution := p_attribution; end if;
    if p_credit_line is not null then changes := changes || jsonb_build_object('credit_line', jsonb_build_object('from', c.credit_line, 'to', nullif(trim(p_credit_line), ''))); c.credit_line := nullif(trim(p_credit_line), ''); end if;
    if p_rights is not null then changes := changes || jsonb_build_object('rights', jsonb_build_object('from', c.rights_relationship, 'to', p_rights)); c.rights_relationship := p_rights; end if;
    if p_compensation is not null then changes := changes || jsonb_build_object('compensation', jsonb_build_object('from', c.compensation_note, 'to', nullif(trim(p_compensation), ''))); c.compensation_note := nullif(trim(p_compensation), ''); end if;
    if p_share is not null or p_clear_share then
      changes := changes || jsonb_build_object('share', jsonb_build_object('from', c.share_percent, 'to', case when p_clear_share then null else p_share end));
      c.share_percent := case when p_clear_share then null else p_share end;
    end if;
  end if;
  if changes = '{}'::jsonb then return; end if;
  update public.contributions set description = c.description, attribution = c.attribution, credit_line = c.credit_line, rights_relationship = c.rights_relationship,
    compensation_note = c.compensation_note, share_percent = c.share_percent where id = p_id;
  insert into public.contribution_edits(contribution_id, editor_creator_id, changes) values (p_id, v_me, changes);
  perform app.record_audit('contribution.edited', 'contribution', p_id, changes, null);
end $$;

-- Retract (managers only): the entry stays on record, marked retracted with a reason.
create or replace function public.contribution_retract(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.contributions;
begin
  select * into c from public.contributions where id = p_id for update;
  if c.id is null or not app.manages_contribution(c) then raise exception 'not allowed' using errcode = '42501'; end if;
  if c.retracted_at is not null then return; end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'reason required' using errcode = '22023'; end if;
  update public.contributions set retracted_at = now(), retracted_reason = left(trim(p_reason), 500) where id = p_id;
  insert into public.contribution_edits(contribution_id, editor_creator_id, changes) values (p_id, app.current_creator_id(), jsonb_build_object('retracted', left(trim(p_reason), 500)));
  perform app.record_audit('contribution.retracted', 'contribution', p_id, jsonb_build_object('reason', left(trim(p_reason), 500)), null);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.contribution_update(uuid, text, text, text, text, text, numeric, boolean)', 'public.contribution_retract(uuid, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Automatic entries -----------------------------------------------------------------------------------------------
-- Versions written by someone other than the piece's owner (collaborator edits and accepted proposals).
create or replace function app.contribution_from_version()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.author_kind = 'creator' and new.created_by_creator_id is not null and new.created_by_creator_id <> new.creator_id then
    insert into public.contributions(artifact_id, version_id, contributor_creator_id, kind, source, source_id, description, recorded_by)
    values (new.artifact_id, new.id, new.created_by_creator_id, 'writing', 'version', new.id, coalesce(new.change_summary, 'Wrote v' || new.version_number), null)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger artifact_versions_contribution after insert on public.artifact_versions
  for each row execute function app.contribution_from_version();
revoke execute on function app.contribution_from_version() from public, anon, authenticated;

-- Work a crew member shares into a project (not the project owner's own links).
create or replace function app.contribution_from_share()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare title text;
begin
  if new.shared and (tg_op = 'INSERT' or not old.shared)
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.creator_id = new.creator_id) then
    select coalesce(m.title, a.title, 'Shared work') into title
    from (select 1) x left join public.creative_materials m on m.id = new.material_id left join public.artifacts a on a.id = new.artifact_id;
    insert into public.contributions(project_id, artifact_id, material_id, contributor_creator_id, kind, source, source_id, description, recorded_by)
    values (new.project_id, null, new.material_id, new.creator_id, case when new.artifact_id is not null then 'writing' else 'material' end, 'shared_item', new.id, 'Shared “' || title || '”', null)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger project_items_contribution after insert or update of shared on public.project_items
  for each row execute function app.contribution_from_share();
revoke execute on function app.contribution_from_share() from public, anon, authenticated;

-- Tasks completed: each assignee is credited.
create or replace function app.contribution_from_task()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    insert into public.contributions(project_id, contributor_creator_id, kind, source, source_id, description, recorded_by)
    select new.project_id, a.creator_id, 'task', 'task', new.id, 'Completed: ' || new.title, null
    from public.project_task_assignees a where a.task_id = new.id
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger project_tasks_contribution after update of status on public.project_tasks
  for each row execute function app.contribution_from_task();
revoke execute on function app.contribution_from_task() from public, anon, authenticated;
