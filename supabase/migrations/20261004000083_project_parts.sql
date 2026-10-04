-- Parts (docs/creative-room-parts.md): what a joint Creation is made of — Lyrics · Tune · Voice — each a Creation of
-- its own, with one or more people on it. Parts are peers: none waits on another and none is locked; "final" is said
-- by the people on it. Someone invited to a part alone sees the Room's name and its parts — not its items, tasks or
-- chat. Membership changes go through security-definer functions, as crews do; rows are never deleted, only ended.

create table public.project_parts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  kind text not null default 'writing' check (kind in ('writing', 'audio', 'image', 'video', 'other')),
  -- The Creation a part produces, when it's started: its type decides which page it opens on.
  artifact_type text not null default 'prose' check (char_length(artifact_type) between 1 and 60),
  position integer not null default 0,
  status text not null default 'open' check (status in ('open', 'in_rounds', 'final')),
  artifact_id uuid unique references public.artifacts(id) on delete set null,
  created_by uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  final_at timestamptz,
  final_by uuid references public.creators(id) on delete set null
);
create index project_parts_project_idx on public.project_parts(project_id, position);
create trigger project_parts_touch before update on public.project_parts
  for each row execute function app.touch_updated_at();

create table public.project_part_members (
  part_id uuid not null references public.project_parts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  status text not null check (status in ('invited', 'active', 'declined', 'cancelled', 'left', 'removed')),
  invited_by uuid references public.creators(id) on delete set null,
  invite_note text check (invite_note is null or char_length(invite_note) <= 500),
  invited_at timestamptz,
  joined_at timestamptz,
  ended_at timestamptz,
  primary key (part_id, creator_id)
);
create index project_part_members_creator_idx on public.project_part_members(creator_id) where status in ('invited', 'active');

-- The Room's timeline: what happened to each part, by whom. Versions of a part's Creation are read alongside.
create table public.project_part_events (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.project_parts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_creator_id uuid references public.creators(id) on delete set null,
  subject_creator_id uuid references public.creators(id) on delete set null,
  kind text not null check (char_length(kind) between 1 and 40),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index project_part_events_project_idx on public.project_part_events(project_id, created_at desc);

-- Helpers ---------------------------------------------------------------------------------------------------------
create or replace function app.part_project(p_part uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select project_id from public.project_parts where id = p_part $$;

create or replace function app.is_part_member(p_part uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.project_part_members where part_id = p_part and creator_id = app.current_creator_id() and status = 'active')
$$;

-- On any part of the Room (invited counts unless p_active); the way in for someone who isn't in the crew.
create or replace function app.on_a_part_of(p_project uuid, p_active boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_parts pp join public.project_part_members m on m.part_id = pp.id
    where pp.project_id = p_project and m.creator_id = app.current_creator_id()
      and (m.status = 'active' or (not p_active and m.status = 'invited'))
  )
$$;

-- Who may open the Room at all: its owner and crew (can_read_project), and anyone on one of its parts.
create or replace function app.can_see_project(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_read_project(p_project) or app.on_a_part_of(p_project) $$;

-- Who may shape the Room's parts: its owner and crew admins. Never null, so a refusal can't slip through an outsider.
create or replace function app.manages_project(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(app.project_role(p_project) in ('owner', 'admin'), false) $$;

create or replace function app.part_log(p_part uuid, p_kind text, p_subject uuid default null, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.project_part_events(part_id, project_id, actor_creator_id, subject_creator_id, kind, detail)
  values (p_part, app.part_project(p_part), app.current_creator_id(), p_subject, p_kind, coalesce(p_detail, '{}'::jsonb));
  perform app.record_audit('part.' || p_kind, 'project_part', p_part,
    coalesce(p_detail, '{}'::jsonb) || case when p_subject is null then '{}'::jsonb else jsonb_build_object('member', p_subject) end, null);
end $$;
revoke execute on function app.part_log(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- Everyone on a part edits its Creation once there is one; leaving takes that back.
create or replace function app.part_grant_edit(p_part uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_artifact uuid; v_owner uuid; v_title text;
begin
  select artifact_id, title into v_artifact, v_title from public.project_parts where id = p_part;
  if v_artifact is null then return; end if;
  select creator_id into v_owner from public.artifacts where id = v_artifact;
  if v_owner is null or v_owner = p_creator then return; end if;
  insert into public.artifact_contributors(artifact_id, contributor_creator_id, role, access, added_by_creator_id)
  values (v_artifact, p_creator, left('Part: ' || v_title, 60), 'edit', v_owner)
  on conflict (artifact_id, contributor_creator_id) do update set access = 'edit';
end $$;
revoke execute on function app.part_grant_edit(uuid, uuid) from public, anon, authenticated;

create or replace function app.part_revoke_edit(p_part uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.artifact_contributors ac using public.project_parts pp
  where pp.id = p_part and ac.artifact_id = pp.artifact_id and ac.contributor_creator_id = p_creator and ac.role like 'Part: %';
end $$;
revoke execute on function app.part_revoke_edit(uuid, uuid) from public, anon, authenticated;

-- A part with no one left on it is open again.
create or replace function app.part_settle(p_part uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.project_parts set status = 'open'
  where id = p_part and status = 'in_rounds'
    and not exists (select 1 from public.project_part_members where part_id = p_part and status = 'active');
end $$;
revoke execute on function app.part_settle(uuid) from public, anon, authenticated;

create or replace function app.part_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform app.part_log(new.id, 'added', null, jsonb_build_object('title', new.title, 'kind', new.kind));
  return new;
end $$;
create trigger project_parts_created after insert on public.project_parts
  for each row execute function app.part_created();
revoke execute on function app.part_created() from public, anon, authenticated;

-- A part's Creation is read by everyone making the joint work: the Room's owner and crew, and whoever is on any of
-- its parts. Everything else about who reads a Creation is unchanged.
create or replace function app.can_read_artifact(p_artifact uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.artifacts a
    where a.id = p_artifact and (
      a.creator_id = app.current_creator_id()
      or exists (select 1 from public.artifact_contributors ac where ac.artifact_id = a.id and ac.contributor_creator_id = app.current_creator_id())
      or (a.privacy = 'public' and a.status in ('final', 'published') and app.can_view_creator(a.creator_id))
      or exists (select 1 from public.project_parts pp where pp.artifact_id = a.id and (app.can_read_project(pp.project_id) or app.on_a_part_of(pp.project_id, true)))
    )
  )
$$;

-- RLS ---------------------------------------------------------------------------------------------------------------
alter table public.project_parts enable row level security;
create policy project_parts_read on public.project_parts for select to authenticated
  using (app.can_see_project(project_id));
create policy project_parts_insert on public.project_parts for insert to authenticated
  with check (created_by = app.current_creator_id() and app.manages_project(project_id));
create policy project_parts_update on public.project_parts for update to authenticated
  using (app.manages_project(project_id)) with check (app.manages_project(project_id));
create policy project_parts_delete on public.project_parts for delete to authenticated
  using (app.manages_project(project_id));
-- Status, the Creation and finality move through the functions below.
revoke update on public.project_parts from authenticated;
grant update (title, kind, artifact_type, position, updated_at) on public.project_parts to authenticated;

-- A part-only member opens the Room: its name and brief, and the parts. Items, tasks and chat keep their own policies.
drop policy projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_see_project(id));

alter table public.project_part_members enable row level security;
create policy project_part_members_read on public.project_part_members for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_see_project(app.part_project(part_id)));
revoke insert, update, delete on public.project_part_members from anon, authenticated;

alter table public.project_part_events enable row level security;
create policy project_part_events_read on public.project_part_events for select to authenticated
  using (app.can_see_project(project_id));
revoke insert, update, delete on public.project_part_events from anon, authenticated;

-- Membership functions -------------------------------------------------------------------------------------------
-- Join a part: anyone in the Room's crew (the owner too). Two or more people may share a part.
create or replace function public.part_claim(p_part uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid := app.part_project(p_part); v_status text; existing public.project_part_members;
begin
  if v_project is null then raise exception 'part not found' using errcode = 'P0002'; end if;
  if app.project_role(v_project) is null then raise exception 'join the Room''s crew first, or ask to be invited to this part' using errcode = '42501'; end if;
  select status into v_status from public.project_parts where id = p_part for update;
  if v_status = 'final' then raise exception 'this part is final' using errcode = '55000'; end if;
  select * into existing from public.project_part_members where part_id = p_part and creator_id = v_me for update;
  if existing.status = 'active' then raise exception 'you''re already on this part' using errcode = '23505'; end if;
  insert into public.project_part_members(part_id, creator_id, status, joined_at, ended_at)
  values (p_part, v_me, 'active', now(), null)
  on conflict (part_id, creator_id) do update set status = 'active', joined_at = now(), ended_at = null;
  update public.project_parts set status = 'in_rounds' where id = p_part and status = 'open';
  perform app.part_grant_edit(p_part, v_me);
  perform app.part_log(p_part, 'claimed', v_me);
end $$;

-- Invite someone to this part only; they need not join the Room. People on the part, and the Room's owner or admins.
create or replace function public.part_invite(p_part uuid, p_creator uuid, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid := app.part_project(p_part); existing public.project_part_members;
begin
  if v_project is null then raise exception 'part not found' using errcode = 'P0002'; end if;
  if not (app.is_part_member(p_part) or app.manages_project(v_project)) then
    raise exception 'only people on this part, or the Room''s owner or admins, can invite' using errcode = '42501';
  end if;
  if p_creator = v_me then raise exception 'you''re already here' using errcode = '22023'; end if;
  if not app.can_view_creator(p_creator) or app.blocked_between(v_me, p_creator) then raise exception 'creator not found' using errcode = 'P0002'; end if;
  if (select status from public.project_parts where id = p_part) = 'final' then raise exception 'this part is final' using errcode = '55000'; end if;
  select * into existing from public.project_part_members where part_id = p_part and creator_id = p_creator for update;
  if existing.status in ('active', 'invited') then raise exception 'already invited or on this part' using errcode = '23505'; end if;
  insert into public.project_part_members(part_id, creator_id, status, invited_by, invite_note, invited_at, joined_at, ended_at)
  values (p_part, p_creator, 'invited', v_me, nullif(trim(p_note), ''), now(), null, null)
  on conflict (part_id, creator_id) do update set status = 'invited', invited_by = v_me, invite_note = excluded.invite_note, invited_at = now(), joined_at = null, ended_at = null;
  perform app.part_log(p_part, 'invited', p_creator);
end $$;

create or replace function public.part_respond(p_part uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  update public.project_part_members set status = case when p_accept then 'active' else 'declined' end,
    joined_at = case when p_accept then now() end, ended_at = case when p_accept then null else now() end
  where part_id = p_part and creator_id = v_me and status = 'invited';
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if p_accept then
    update public.project_parts set status = 'in_rounds' where id = p_part and status = 'open';
    perform app.part_grant_edit(p_part, v_me);
  end if;
  perform app.part_log(p_part, case when p_accept then 'joined' else 'declined' end, v_me);
end $$;

create or replace function public.part_leave(p_part uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  update public.project_part_members set status = 'left', ended_at = now() where part_id = p_part and creator_id = v_me and status = 'active';
  if not found then raise exception 'not on this part' using errcode = 'P0002'; end if;
  perform app.part_revoke_edit(p_part, v_me);
  perform app.part_settle(p_part);
  perform app.part_log(p_part, 'left', v_me);
end $$;

-- Take someone off a part, or cancel their invitation: the Room's owner or admins.
create or replace function public.part_remove(p_part uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid := app.part_project(p_part); target public.project_part_members;
begin
  if v_project is null then raise exception 'part not found' using errcode = 'P0002'; end if;
  if not app.manages_project(v_project) then raise exception 'only the Room''s owner or admins can remove someone from a part' using errcode = '42501'; end if;
  select * into target from public.project_part_members where part_id = p_part and creator_id = p_creator and status in ('active', 'invited') for update;
  if target.creator_id is null then raise exception 'not on this part' using errcode = 'P0002'; end if;
  if p_creator = v_me then raise exception 'use Leave instead' using errcode = '42501'; end if;
  update public.project_part_members set status = case when target.status = 'invited' then 'cancelled' else 'removed' end, ended_at = now()
  where part_id = p_part and creator_id = p_creator;
  perform app.part_revoke_edit(p_part, p_creator);
  perform app.part_settle(p_part);
  perform app.part_log(p_part, case when target.status = 'invited' then 'invite_cancelled' else 'removed' end, p_creator);
end $$;

-- Final, or back into rounds: the people on the part say so (the Room's owner or admins may too).
create or replace function public.part_set_final(p_part uuid, p_final boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid := app.part_project(p_part); v_artifact uuid; v_status text;
begin
  if v_project is null then raise exception 'part not found' using errcode = 'P0002'; end if;
  if not (app.is_part_member(p_part) or app.manages_project(v_project)) then
    raise exception 'only people on this part, or the Room''s owner or admins, can mark it final' using errcode = '42501';
  end if;
  select artifact_id, status into v_artifact, v_status from public.project_parts where id = p_part for update;
  if p_final and v_artifact is null then raise exception 'start the part''s Creation first' using errcode = '55000'; end if;
  if p_final = (v_status = 'final') then return; end if;
  update public.project_parts set status = case when p_final then 'final' else 'in_rounds' end,
    final_at = case when p_final then now() end, final_by = case when p_final then v_me end
  where id = p_part;
  perform app.part_log(p_part, case when p_final then 'final' else 'reopened' end);
end $$;

-- Name the Creation a part produces: the caller's own, made for it. Everyone else on the part becomes its editor, and
-- the Room's crew sees it as shared work.
create or replace function public.part_attach(p_part uuid, p_artifact uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_project uuid := app.part_project(p_part); v_current uuid; v_title text; m record;
begin
  if v_project is null then raise exception 'part not found' using errcode = 'P0002'; end if;
  if not app.is_part_member(p_part) then raise exception 'only people on this part can start its Creation' using errcode = '42501'; end if;
  if not app.owns_artifact(p_artifact) then raise exception 'only your own Creation can be a part' using errcode = '42501'; end if;
  select artifact_id, title into v_current, v_title from public.project_parts where id = p_part for update;
  if v_current is not null then raise exception 'this part already has a Creation' using errcode = '23505'; end if;
  update public.project_parts set artifact_id = p_artifact, status = case when status = 'open' then 'in_rounds' else status end where id = p_part;
  for m in select creator_id from public.project_part_members where part_id = p_part and status = 'active' and creator_id <> v_me loop
    perform app.part_grant_edit(p_part, m.creator_id);
  end loop;
  if not exists (select 1 from public.project_items where project_id = v_project and kind = 'artifact' and artifact_id = p_artifact) then
    insert into public.project_items(project_id, creator_id, kind, artifact_id, shared, shared_at, label)
    values (v_project, v_me, 'artifact', p_artifact, true, now(), v_title);
  end if;
  perform app.part_log(p_part, 'started', null, jsonb_build_object('artifact', p_artifact));
end $$;

revoke execute on function public.part_claim(uuid) from public, anon;
revoke execute on function public.part_invite(uuid, uuid, text) from public, anon;
revoke execute on function public.part_respond(uuid, boolean) from public, anon;
revoke execute on function public.part_leave(uuid) from public, anon;
revoke execute on function public.part_remove(uuid, uuid) from public, anon;
revoke execute on function public.part_set_final(uuid, boolean) from public, anon;
revoke execute on function public.part_attach(uuid, uuid) from public, anon;
grant execute on function public.part_claim(uuid), public.part_invite(uuid, uuid, text), public.part_respond(uuid, boolean),
  public.part_leave(uuid), public.part_remove(uuid, uuid), public.part_set_final(uuid, boolean), public.part_attach(uuid, uuid) to authenticated;
