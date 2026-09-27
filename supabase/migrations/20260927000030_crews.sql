-- P1-02 CreatorCrew Core: a temporary team around one project.
-- - One crew per project, started by the project's owner. Name, purpose, status (forming → active → completed).
-- - Members have a flexible role title (director, sound, "whoever holds the boom" — anything) and an access level:
--   owner (the project owner), admin (can invite and manage members) or member.
-- - Membership rows are never deleted: invited → active | declined | cancelled, active → left | removed. History,
--   contributions and rights stay attributable after someone leaves.
-- - All membership changes go through security-definer functions that authorize the caller; clients can't write
--   crews' member rows directly. Every change is written to the crew's activity (visible to its members) and audited.
-- - Active members can read the project (brief, goals, linked items list). Linked work still follows its own rules:
--   membership never widens access to anyone's private material or pieces.

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  purpose text not null default '' check (char_length(purpose) <= 2000),
  status text not null default 'forming' check (status in ('forming', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crews_creator_id_fk_idx on public.crews(creator_id);
create trigger crews_touch before update on public.crews
  for each row execute function app.touch_updated_at();

create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  access text not null default 'member' check (access in ('owner', 'admin', 'member')),
  role_title text check (role_title is null or char_length(role_title) between 1 and 60),
  status text not null check (status in ('invited', 'active', 'declined', 'cancelled', 'left', 'removed')),
  invited_by uuid references public.creators(id) on delete set null,
  invite_note text check (invite_note is null or char_length(invite_note) <= 500),
  invited_at timestamptz,
  joined_at timestamptz,
  ended_at timestamptz,
  primary key (crew_id, creator_id)
);
create index crew_members_creator_idx on public.crew_members(creator_id, status);
create index crew_members_invited_by_fk_idx on public.crew_members(invited_by);

create table public.crew_activity (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  actor_creator_id uuid references public.creators(id) on delete set null,
  subject_creator_id uuid references public.creators(id) on delete set null,
  kind text not null check (kind in ('crew_created', 'crew_updated', 'invited', 'invite_cancelled', 'joined', 'declined', 'role_changed', 'left', 'removed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index crew_activity_crew_idx on public.crew_activity(crew_id, created_at desc);
create index crew_activity_actor_fk_idx on public.crew_activity(actor_creator_id);
create index crew_activity_subject_fk_idx on public.crew_activity(subject_creator_id);

-- Helpers -------------------------------------------------------------------------------------------------------
create or replace function app.crew_access(p_crew uuid)
returns text language sql stable security definer set search_path = ''
as $$ select m.access from public.crew_members m where m.crew_id = p_crew and m.creator_id = app.current_creator_id() and m.status = 'active' $$;

-- Active members and people with a pending invitation can see the crew (the invitee needs to know what it is).
create or replace function app.can_see_crew(p_crew uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.crew_members m where m.crew_id = p_crew and m.creator_id = app.current_creator_id() and m.status in ('active', 'invited')) $$;

-- Projects: the owner, and the active members of its crew.
create or replace function app.can_read_project(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.owns_project(p_project) or exists (
    select 1 from public.crews c join public.crew_members m on m.crew_id = c.id
    where c.project_id = p_project and m.creator_id = app.current_creator_id() and m.status = 'active'
  )
$$;

create or replace function app.crew_log(p_crew uuid, p_kind text, p_subject uuid default null, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.crew_activity(crew_id, actor_creator_id, subject_creator_id, kind, detail)
  values (p_crew, app.current_creator_id(), p_subject, p_kind, coalesce(p_detail, '{}'::jsonb));
  perform app.record_audit('crew.' || p_kind, 'crew', p_crew, coalesce(p_detail, '{}'::jsonb) || case when p_subject is null then '{}'::jsonb else jsonb_build_object('member', p_subject) end, null);
end $$;
revoke execute on function app.crew_log(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- RLS -----------------------------------------------------------------------------------------------------------
alter table public.crews enable row level security;
create policy crews_read on public.crews for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_see_crew(id));
create policy crews_insert on public.crews for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.owns_project(project_id));
create policy crews_update on public.crews for update to authenticated
  using (app.crew_access(id) in ('owner', 'admin')) with check (app.crew_access(id) in ('owner', 'admin'));
-- No delete policy: a crew ends by completing (dissolution arrives with P1-09); it goes with its project.
revoke update on public.crews from authenticated;
grant update (name, purpose, status) on public.crews to authenticated;

alter table public.crew_members enable row level security;
-- Your own rows always; other members' rows while you're active or invited.
create policy crew_members_read on public.crew_members for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_see_crew(crew_id));
revoke insert, update, delete on public.crew_members from anon, authenticated;

alter table public.crew_activity enable row level security;
create policy crew_activity_read on public.crew_activity for select to authenticated
  using (app.crew_access(crew_id) is not null);
revoke insert, update, delete on public.crew_activity from anon, authenticated;

-- The project owner becomes the crew's owner; creating and updating is logged.
create or replace function app.crew_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.crew_members(crew_id, creator_id, access, status, joined_at) values (new.id, new.creator_id, 'owner', 'active', now());
  perform app.crew_log(new.id, 'crew_created', null, jsonb_build_object('name', new.name));
  return new;
end $$;
create trigger crews_created after insert on public.crews
  for each row execute function app.crew_created();
revoke execute on function app.crew_created() from public, anon, authenticated;

create or replace function app.crew_updated()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.name is distinct from old.name or new.purpose is distinct from old.purpose or new.status is distinct from old.status then
    perform app.crew_log(new.id, 'crew_updated', null, jsonb_strip_nulls(jsonb_build_object(
      'name', case when new.name is distinct from old.name then new.name end,
      'purpose', case when new.purpose is distinct from old.purpose then true end,
      'status', case when new.status is distinct from old.status then new.status end)));
  end if;
  return new;
end $$;
create trigger crews_updated after update on public.crews
  for each row execute function app.crew_updated();
revoke execute on function app.crew_updated() from public, anon, authenticated;

-- A project with other people in its crew can't be deleted out from under them.
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
  return old;
end $$;
create trigger projects_guard_delete before delete on public.projects
  for each row execute function app.guard_project_delete();
revoke execute on function app.guard_project_delete() from public, anon, authenticated;

-- Membership functions -------------------------------------------------------------------------------------------
create or replace function public.crew_invite(p_crew uuid, p_creator uuid, p_access text default 'member', p_role_title text default null, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_access text := app.crew_access(p_crew); existing public.crew_members;
begin
  if v_access is null or v_access not in ('owner', 'admin') then raise exception 'only the crew''s owner or admins can invite' using errcode = '42501'; end if;
  if p_access not in ('admin', 'member') then raise exception 'invalid access' using errcode = '22023'; end if;
  if p_access = 'admin' and v_access <> 'owner' then raise exception 'only the owner can invite admins' using errcode = '42501'; end if;
  if p_creator = v_me then raise exception 'you''re already in this crew' using errcode = '22023'; end if;
  if not app.can_view_creator(p_creator) or app.blocked_between(v_me, p_creator) then raise exception 'creator not found' using errcode = 'P0002'; end if;
  if (select status from public.crews where id = p_crew) = 'completed' then raise exception 'this crew has completed its work' using errcode = '55000'; end if;
  select * into existing from public.crew_members where crew_id = p_crew and creator_id = p_creator for update;
  if existing.status in ('active', 'invited') then raise exception 'already invited or in the crew' using errcode = '23505'; end if;
  insert into public.crew_members(crew_id, creator_id, access, role_title, status, invited_by, invite_note, invited_at, joined_at, ended_at)
  values (p_crew, p_creator, p_access, nullif(trim(p_role_title), ''), 'invited', v_me, nullif(trim(p_note), ''), now(), null, null)
  on conflict (crew_id, creator_id) do update set access = excluded.access, role_title = excluded.role_title, status = 'invited', invited_by = v_me,
    invite_note = excluded.invite_note, invited_at = now(), joined_at = null, ended_at = null;
  perform app.crew_log(p_crew, 'invited', p_creator, jsonb_strip_nulls(jsonb_build_object('access', p_access, 'role', nullif(trim(p_role_title), ''))));
end $$;

create or replace function public.crew_respond(p_crew uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  update public.crew_members set status = case when p_accept then 'active' else 'declined' end,
    joined_at = case when p_accept then now() end, ended_at = case when p_accept then null else now() end
  where crew_id = p_crew and creator_id = v_me and status = 'invited';
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  perform app.crew_log(p_crew, case when p_accept then 'joined' else 'declined' end, v_me);
  -- The first person to join makes a forming crew active.
  if p_accept then update public.crews set status = 'active' where id = p_crew and status = 'forming'; end if;
end $$;

-- Owners change anyone's access (except their own) and titles; admins change titles; everyone can set their own title.
create or replace function public.crew_set_role(p_crew uuid, p_creator uuid, p_access text default null, p_role_title text default null, p_clear_title boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_access text := app.crew_access(p_crew); target public.crew_members;
begin
  select * into target from public.crew_members where crew_id = p_crew and creator_id = p_creator and status in ('active', 'invited') for update;
  if target.creator_id is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if v_access is null then raise exception 'not a member' using errcode = '42501'; end if;
  if p_access is not null then
    if v_access <> 'owner' or p_creator = v_me then raise exception 'only the owner can change access' using errcode = '42501'; end if;
    if p_access not in ('admin', 'member') then raise exception 'invalid access' using errcode = '22023'; end if;
  end if;
  if (p_role_title is not null or p_clear_title) and p_creator <> v_me and v_access not in ('owner', 'admin') then
    raise exception 'only the owner or admins can change someone else''s role' using errcode = '42501';
  end if;
  update public.crew_members set
    access = coalesce(p_access, access),
    role_title = case when p_clear_title then null when p_role_title is not null then nullif(trim(p_role_title), '') else role_title end
  where crew_id = p_crew and creator_id = p_creator;
  perform app.crew_log(p_crew, 'role_changed', p_creator, jsonb_strip_nulls(jsonb_build_object('access', p_access, 'role', case when p_clear_title then '' else nullif(trim(p_role_title), '') end)));
end $$;

-- Remove a member or cancel an invitation. Owners remove anyone else; admins remove members.
create or replace function public.crew_remove(p_crew uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_access text := app.crew_access(p_crew); target public.crew_members;
begin
  select * into target from public.crew_members where crew_id = p_crew and creator_id = p_creator and status in ('active', 'invited') for update;
  if target.creator_id is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if p_creator = v_me or target.access = 'owner' then raise exception 'use Leave instead' using errcode = '42501'; end if;
  if v_access is null or v_access = 'member' or (v_access = 'admin' and target.access <> 'member') then
    raise exception 'you can''t remove this person' using errcode = '42501';
  end if;
  update public.crew_members set status = case when target.status = 'invited' then 'cancelled' else 'removed' end, ended_at = now()
  where crew_id = p_crew and creator_id = p_creator;
  perform app.crew_log(p_crew, case when target.status = 'invited' then 'invite_cancelled' else 'removed' end, p_creator);
end $$;

create or replace function public.crew_leave(p_crew uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  if app.crew_access(p_crew) = 'owner' then raise exception 'the owner can''t leave their own crew' using errcode = '42501'; end if;
  update public.crew_members set status = 'left', ended_at = now() where crew_id = p_crew and creator_id = v_me and status = 'active';
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  perform app.crew_log(p_crew, 'left', v_me);
end $$;

-- What an invitee (or member) sees of the crew's project: its title and brief, and who invited them.
create or replace function public.crew_overview(p_crew uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('projectId', p.id, 'projectTitle', p.title, 'projectBrief', left(p.brief, 2000), 'projectStatus', p.status)
  from public.crews c join public.projects p on p.id = c.project_id
  where c.id = p_crew and (app.can_see_crew(c.id) or app.owns_project(p.id))
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.crew_invite(uuid, uuid, text, text, text)', 'public.crew_respond(uuid, boolean)',
    'public.crew_set_role(uuid, uuid, text, text, boolean)', 'public.crew_remove(uuid, uuid)', 'public.crew_leave(uuid)', 'public.crew_overview(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- People in a crew together (active or invited) can see each other's profiles, whatever their profile visibility.
-- Blocks still apply.
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
        or exists (
          select 1 from public.crew_members mine join public.crew_members theirs on theirs.crew_id = mine.crew_id
          where mine.creator_id = app.current_creator_id() and mine.status in ('active', 'invited')
            and theirs.creator_id = c.id and theirs.status in ('active', 'invited')
        )
      )
      and not exists (
        select 1 from public.creator_blocks b
        where b.blocker_creator_id = c.id and b.blocked_creator_id = app.current_creator_id()
      )
  )
$$;
