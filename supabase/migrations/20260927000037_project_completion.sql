-- P1-09 Crew Dissolution / Project Completion: closing a project safely.
-- - A guided review (open tasks, change proposals, ownership claims, licence requests, CreatorBrain approvals) and an
--   explicit completion: the owner types the project's name, and anything still open must be acknowledged. No
--   one-tap dissolution: for a project with a crew, completing/archiving (and reopening) goes through these RPCs, and
--   a crew can only be marked completed by completing its project.
-- - Nothing is deleted. The project, its pieces and material links, contributions, rights, approvals and audit
--   history stay; a dissolved crew keeps its members (read access to the history) but takes no new invitations.
-- - Each completion is recorded with a snapshot of what was open, and a project with other people's contributions or
--   claims can't be deleted (archive it instead).

create table public.project_completions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  completed_by uuid references public.creators(id) on delete set null,
  outcome text not null check (outcome in ('completed', 'archived')),
  crew_dissolved boolean not null default false,
  open_items jsonb not null default '{}'::jsonb,
  acknowledged_open boolean not null default false,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  reopened_at timestamptz,
  reopened_by uuid references public.creators(id) on delete set null
);
create index project_completions_project_idx on public.project_completions(project_id, created_at desc);
create index project_completions_completed_by_fk_idx on public.project_completions(completed_by);
create index project_completions_reopened_by_fk_idx on public.project_completions(reopened_by);
alter table public.project_completions enable row level security;
create policy project_completions_read on public.project_completions for select to authenticated using (app.can_read_project(project_id));
revoke insert, update, delete on public.project_completions from authenticated;

-- What's still open in a project (things that would otherwise be left hanging).
create or replace function app.project_open_items(p_project uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'tasks', (select count(*) from public.project_tasks t where t.project_id = p_project and t.status <> 'done'),
    'proposals', (select count(*) from public.artifact_change_proposals cp join public.project_items i on i.artifact_id = cp.artifact_id
                  where i.project_id = p_project and cp.status = 'open'),
    'claims', (select count(*) from public.ownership_assertions a where a.project_id = p_project and a.status in ('asserted', 'disputed')),
    'licence_requests', (select count(*) from public.license_requests lr join public.project_items i on i.artifact_id = lr.artifact_id
                         where i.project_id = p_project and lr.status in ('pending', 'countered')),
    'approvals', (select count(*) from public.ai_proposals ap join public.conversations c on c.id = ap.conversation_id
                  where c.project_id = p_project and ap.status = 'pending' and ap.expires_at > now())
  )
$$;
revoke execute on function app.project_open_items(uuid) from public, anon, authenticated;

create or replace function public.project_open_items_of(p_project uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when app.can_read_project(p_project) then app.project_open_items(p_project) end
$$;

create or replace function app.in_completion()
returns boolean language sql stable set search_path = ''
as $$ select coalesce(current_setting('app.completion', true), '') = 'on' $$;

-- Completing or archiving a project that has a crew goes through complete_project().
create or replace function app.guard_project_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and (new.status in ('completed', 'archived') or old.status in ('completed', 'archived'))
     and exists (select 1 from public.crews c where c.project_id = new.id)
     and not app.in_completion() then
    raise exception 'use the completion checklist' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger projects_guard_status before update of status on public.projects
  for each row execute function app.guard_project_status();
revoke execute on function app.guard_project_status() from public, anon, authenticated;

-- A crew is dissolved (and revived) only with its project.
create or replace function app.guard_crew_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status and (new.status = 'completed' or old.status = 'completed') and not app.in_completion() then
    raise exception 'use the completion checklist' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger crews_guard_status before update of status on public.crews
  for each row execute function app.guard_crew_status();
revoke execute on function app.guard_crew_status() from public, anon, authenticated;

create or replace function public.complete_project(p_project uuid, p_outcome text, p_dissolve_crew boolean, p_confirm_title text, p_acknowledge_open boolean default false, p_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare pr public.projects; v_open jsonb; v_total int; v_crew uuid; v_dissolved boolean := false; v_id uuid;
begin
  select * into pr from public.projects where id = p_project for update;
  if pr.id is null or not app.owns_project(p_project) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_outcome not in ('completed', 'archived') then raise exception 'invalid outcome' using errcode = '22023'; end if;
  if pr.status = p_outcome then raise exception 'already %', p_outcome using errcode = '55000'; end if;
  if lower(trim(coalesce(p_confirm_title, ''))) <> lower(trim(pr.title)) then raise exception 'confirmation mismatch' using errcode = '22023'; end if;
  v_open := app.project_open_items(p_project);
  select coalesce(sum(value::int), 0) into v_total from jsonb_each_text(v_open);
  if v_total > 0 and not coalesce(p_acknowledge_open, false) then raise exception 'open items' using errcode = '55000'; end if;

  perform set_config('app.completion', 'on', true);
  update public.projects set status = p_outcome where id = p_project;
  select id into v_crew from public.crews where project_id = p_project;
  if v_crew is not null and coalesce(p_dissolve_crew, false) then
    -- Pending invitations lapse; members stay (they keep the project's history), the crew takes no one new.
    update public.crew_members set status = 'cancelled', ended_at = now() where crew_id = v_crew and status = 'invited';
    update public.crews set status = 'completed' where id = v_crew and status <> 'completed';
    v_dissolved := true;
  end if;
  perform set_config('app.completion', 'off', true);

  insert into public.project_completions(project_id, completed_by, outcome, crew_dissolved, open_items, acknowledged_open, note)
  values (p_project, app.current_creator_id(), p_outcome, v_dissolved, v_open, v_total > 0, nullif(trim(p_note), ''))
  returning id into v_id;
  perform app.record_audit('project.' || p_outcome, 'project', p_project, jsonb_build_object('crew_dissolved', v_dissolved, 'open_items', v_open), null);
  return v_id;
end $$;

create or replace function public.reopen_project(p_project uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare pr public.projects; v_last public.project_completions;
begin
  select * into pr from public.projects where id = p_project for update;
  if pr.id is null or not app.owns_project(p_project) then raise exception 'not allowed' using errcode = '42501'; end if;
  if pr.status not in ('completed', 'archived') then raise exception 'not closed' using errcode = '55000'; end if;
  select * into v_last from public.project_completions where project_id = p_project and reopened_at is null order by created_at desc limit 1;
  perform set_config('app.completion', 'on', true);
  update public.projects set status = 'active' where id = p_project;
  if v_last.crew_dissolved then
    update public.crews set status = 'active' where project_id = p_project and status = 'completed';
  end if;
  perform set_config('app.completion', 'off', true);
  if v_last.id is not null then
    update public.project_completions set reopened_at = now(), reopened_by = app.current_creator_id() where id = v_last.id;
  end if;
  perform app.record_audit('project.reopened', 'project', p_project, '{}'::jsonb, null);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.project_open_items_of(uuid)', 'public.complete_project(uuid, text, boolean, text, boolean, text)', 'public.reopen_project(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Deleting: besides crew members, other people's contributions and claims keep a project from being deleted.
create or replace function app.guard_project_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Deleting an account cascades through its projects; only a direct delete is guarded.
  if pg_trigger_depth() > 1 then return old; end if;
  if exists (select 1 from public.crews c join public.crew_members m on m.crew_id = c.id
             where c.project_id = old.id and m.access <> 'owner' and m.status in ('active', 'invited')) then
    raise exception 'This project has a crew. Remove its members (or cancel invitations) first.' using errcode = '55000';
  end if;
  if exists (select 1 from public.contributions c where c.project_id = old.id and c.contributor_creator_id <> old.creator_id)
     or exists (select 1 from public.ownership_assertions a where a.project_id = old.id) then
    raise exception 'Other people''s contributions are recorded in this project. Archive it instead.' using errcode = '55000';
  end if;
  return old;
end $$;
