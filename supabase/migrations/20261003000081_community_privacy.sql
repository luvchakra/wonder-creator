-- Community privacy and members-only posting (owner, 3 Oct 2026: "make community privacy Public, Private and Unlisted"
-- and "do not allow someone to add anything in a community unless they have joined it"). This replaces 077's "always
-- public" rule (docs/communities.md).
--
--   projects.community_privacy  null for an ordinary Creative Room; otherwise the room is a community, and one of:
--     public    listed and searchable; anyone signed in can see it and join
--     unlisted  never listed or searched; anyone with the link can see it and join
--     private   seen only by its members (and people they invited); join by invitation only; its topics are members-only
--   Adding anything (a topic, a post, a shared Creation, a Huddle from a topic) needs membership, enforced here.
--   projects.visibility stays as a mirror ('discoverable' exactly when public) so nothing older reads a stale value.

alter table public.projects add column community_privacy text check (community_privacy in ('public', 'unlisted', 'private'));
update public.projects set community_privacy = 'public' where visibility = 'discoverable';
create index projects_community_idx on public.projects(updated_at desc) where community_privacy is not null;

drop trigger projects_community_stays_public on public.projects;
drop function app.community_stays_public();

-- A community stays a community (its owner can change its privacy, not dissolve it into a room), and the legacy
-- visibility column follows the privacy. An older client that sets visibility = 'discoverable' opens a public one.
create or replace function app.project_community_privacy()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.community_privacy is not null and new.community_privacy is null then
    raise exception 'A community stays a community; make it private instead' using errcode = '42501';
  end if;
  if new.community_privacy is null and new.visibility = 'discoverable' then
    new.community_privacy := 'public';
  end if;
  new.visibility := case when new.community_privacy = 'public' then 'discoverable' else 'private' end;
  return new;
end $$;
create trigger projects_community_privacy before insert or update of community_privacy, visibility on public.projects
  for each row execute function app.project_community_privacy();

create or replace function app.is_community(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.projects p where p.id = p_project and p.community_privacy is not null and p.status <> 'archived') $$;

-- Who may see a community at all: signed in, not blocked by its owner, and either it's public/unlisted or they belong
-- to it (or were invited to it).
create or replace function app.can_see_community(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and p.community_privacy is not null and p.status <> 'archived'
      and app.current_creator_id() is not null
      and not app.blocked_between(p.creator_id, app.current_creator_id())
      and (
        p.community_privacy in ('public', 'unlisted')
        or app.can_read_project(p.id)
        or exists (select 1 from public.crews c join public.crew_members m on m.crew_id = c.id
                   where c.project_id = p.id and m.creator_id = app.current_creator_id() and m.status = 'invited')
      )
  )
$$;
revoke execute on function app.can_see_community(uuid) from public, anon;
grant execute on function app.can_see_community(uuid) to authenticated;

-- Members only: if a conversation is a topic in one or more communities, the caller must belong to one of them.
create or replace function app.may_add_to_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.open_conversation_links l join public.projects p on p.id = l.project_id
    where l.conversation_id = p_conversation and l.kind = 'project' and p.community_privacy is not null
  ) or exists (
    select 1 from public.open_conversation_links l join public.projects p on p.id = l.project_id
    where l.conversation_id = p_conversation and l.kind = 'project' and p.community_privacy is not null and app.can_read_project(p.id)
  )
$$;
revoke execute on function app.may_add_to_conversation(uuid) from public, anon;
grant execute on function app.may_add_to_conversation(uuid) to authenticated;

-- A topic in a private community the caller doesn't belong to stays hidden from them.
create or replace function app.in_closed_community(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.open_conversation_links l join public.projects p on p.id = l.project_id
    where l.conversation_id = p_conversation and l.kind = 'project' and p.community_privacy = 'private' and not app.can_read_project(p.id)
  )
$$;
revoke execute on function app.in_closed_community(uuid) from public, anon;
grant execute on function app.in_closed_community(uuid) to authenticated;

create or replace function app.can_view_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.open_conversations c
    where c.id = p_conversation and (
      c.creator_id = app.current_creator_id()
      or app.is_moderator()
      or (
        c.removed_at is null
        and app.current_creator_id() is not null
        and not app.blocked_between(c.creator_id, app.current_creator_id())
        and (
          (c.visibility in ('community', 'public') and app.can_view_creator(c.creator_id))
          or (c.visibility = 'limited' and exists (select 1 from public.open_conversation_invites i where i.conversation_id = c.id and i.creator_id = app.current_creator_id()))
        )
        and not app.in_closed_community(c.id)
      )
    )
  )
$$;

-- Replies (posts, and Creations shared as attachments) go through this in the replies insert policy.
create or replace function app.can_reply_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.can_view_conversation(p_conversation)
    and exists (select 1 from public.open_conversations c where c.id = p_conversation and c.closed_at is null and c.removed_at is null)
    and app.may_add_to_conversation(p_conversation)
$$;

-- What the app asks before offering a reply box or "Start Huddle about this".
create or replace function public.open_conversation_can_add(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_view_conversation(p_conversation) and app.may_add_to_conversation(p_conversation) $$;
revoke execute on function public.open_conversation_can_add(uuid) from public, anon;
grant execute on function public.open_conversation_can_add(uuid) to authenticated;

-- Links: a Huddle from a community topic needs membership; a topic joins a community only through a member.
create or replace function public.open_conversation_link(p_conversation uuid, p_kind text, p_target uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_me uuid := app.current_creator_id();
begin
  if not app.can_view_conversation(p_conversation) then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_kind = 'huddle' and not exists (select 1 from public.huddles h where h.id = p_target and h.started_by_creator_id = v_me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind = 'huddle' and not app.may_add_to_conversation(p_conversation) then
    raise exception 'Join the community first' using errcode = '42501';
  end if;
  if p_kind = 'project' and not (
    exists (select 1 from public.projects p where p.id = p_target and p.creator_id = v_me)
    or (app.can_read_project(p_target) and exists (select 1 from public.open_conversations c where c.id = p_conversation and c.creator_id = v_me))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- A limited topic can't join a community: its audience is the community's.
  if p_kind = 'project' and app.is_community(p_target) and exists (select 1 from public.open_conversations c where c.id = p_conversation and c.visibility = 'limited') then
    raise exception 'A community topic is open to its community' using errcode = '22023';
  end if;
  if p_kind = 'project' then
    select id into v_id from public.open_conversation_links where conversation_id = p_conversation and project_id = p_target;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.open_conversation_links (conversation_id, kind, huddle_id, project_id, started_by)
  values (p_conversation, p_kind, case when p_kind = 'huddle' then p_target end, case when p_kind = 'project' then p_target end, v_me)
  returning id into v_id;
  perform app.record_audit('community.conversation_' || p_kind, 'open_conversation', p_conversation, jsonb_build_object('target', p_target), null);
  return v_id;
end
$$;

create or replace function app.community_topic_stays_public()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.visibility = 'limited' and old.visibility is distinct from 'limited' and exists (
    select 1 from public.open_conversation_links l join public.projects p on p.id = l.project_id
    where l.conversation_id = new.id and l.kind = 'project' and p.community_privacy is not null
  ) then
    raise exception 'A community topic is open to its community' using errcode = '42501';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------------------------------------ cards
-- Listing and search show public communities only. Return types change (privacy is added), so they're replaced.
drop function public.community_list(text, int);
create function public.community_list(p_query text default null, p_limit int default 30)
returns table (id uuid, title text, brief text, owner_id uuid, owner_name text, cover_material_id uuid, avatar_object_id uuid, privacy text, member_count int, topic_count int, last_activity_at timestamptz, is_member boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, left(p.brief, 400), p.creator_id, cr.display_name, p.cover_material_id, p.avatar_object_id, p.community_privacy,
         (select count(*)::int from public.crews c join public.crew_members m on m.crew_id = c.id where c.project_id = p.id and m.status = 'active'),
         (select count(*)::int from public.open_conversation_links l join public.open_conversations o on o.id = l.conversation_id
            where l.project_id = p.id and o.removed_at is null),
         greatest(p.updated_at, coalesce((select max(coalesce(o.last_reply_at, o.created_at)) from public.open_conversation_links l
            join public.open_conversations o on o.id = l.conversation_id where l.project_id = p.id and o.removed_at is null), p.updated_at)),
         app.can_read_project(p.id)
  from public.projects p join public.creators cr on cr.id = p.creator_id
  where p.community_privacy = 'public' and p.status <> 'archived'
    and app.current_creator_id() is not null
    and not app.blocked_between(p.creator_id, app.current_creator_id())
    and (p_query is null or btrim(p_query) = '' or p.title ilike '%' || left(btrim(p_query), 80) || '%' or p.brief ilike '%' || left(btrim(p_query), 80) || '%')
  order by 11 desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;
revoke execute on function public.community_list(text, int) from public, anon;
grant execute on function public.community_list(text, int) to authenticated;

-- The communities the caller belongs to (any privacy), latest activity first: Home's "Communities" strip.
create function public.community_mine(p_limit int default 12)
returns table (id uuid, title text, avatar_object_id uuid, cover_material_id uuid, privacy text, is_host boolean, last_activity_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.avatar_object_id, p.cover_material_id, p.community_privacy, app.community_host(p.id),
         greatest(p.updated_at, coalesce((select max(coalesce(o.last_reply_at, o.created_at)) from public.open_conversation_links l
            join public.open_conversations o on o.id = l.conversation_id where l.project_id = p.id and o.removed_at is null), p.updated_at))
  from public.projects p
  where p.community_privacy is not null and p.status <> 'archived' and app.can_read_project(p.id)
  order by 7 desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
$$;
revoke execute on function public.community_mine(int) from public, anon;
grant execute on function public.community_mine(int) to authenticated;

drop function public.community_card(uuid);
create function public.community_card(p_project uuid)
returns table (id uuid, title text, brief text, owner_id uuid, owner_name text, cover_material_id uuid, avatar_object_id uuid, privacy text, crew_id uuid, member_count int, is_member boolean, is_host boolean, is_owner boolean, invited boolean, status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.brief, p.creator_id, cr.display_name, p.cover_material_id, p.avatar_object_id, p.community_privacy, c.id,
         (select count(*)::int from public.crew_members m where m.crew_id = c.id and m.status = 'active'),
         app.can_read_project(p.id), app.community_host(p.id), p.creator_id = app.current_creator_id(),
         exists (select 1 from public.crew_members m where m.crew_id = c.id and m.creator_id = app.current_creator_id() and m.status = 'invited'),
         p.status
  from public.projects p join public.creators cr on cr.id = p.creator_id left join public.crews c on c.project_id = p.id
  where p.id = p_project and app.can_see_community(p.id)
$$;
revoke execute on function public.community_card(uuid) from public, anon;
grant execute on function public.community_card(uuid) to authenticated;

create or replace function public.community_members(p_project uuid)
returns table (creator_id uuid, display_name text, handle text, avatar_object_id uuid, access text, role_title text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.creator_id, cr.display_name, cr.handle::text, cr.avatar_object_id, m.access, m.role_title, m.joined_at
  from public.crews c join public.crew_members m on m.crew_id = c.id join public.creators cr on cr.id = m.creator_id
  where c.project_id = p_project and m.status = 'active'
    and (app.can_see_community(p_project) or app.can_read_project(p_project))
    and app.current_creator_id() is not null
    and not app.blocked_between(m.creator_id, app.current_creator_id())
  order by case m.access when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at
  limit 500
$$;

-- ------------------------------------------------------------------------------------------------ join
-- Public and unlisted: anyone who can see it joins with one call. Private: only someone its hosts invited (joining
-- accepts the invitation). Someone the hosts removed stays out; a block with the owner keeps them out too.
create or replace function public.community_join(p_project uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_owner uuid; v_crew uuid; v_title text; v_brief text; v_privacy text; v_status text;
begin
  select p.creator_id, p.title, p.brief, p.community_privacy into v_owner, v_title, v_brief, v_privacy from public.projects p
  where p.id = p_project and p.community_privacy is not null and p.status <> 'archived';
  if v_owner is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if app.blocked_between(v_owner, v_me) then raise exception 'not found' using errcode = 'P0002'; end if;
  select id into v_crew from public.crews where project_id = p_project;
  if v_crew is not null then
    select status into v_status from public.crew_members where crew_id = v_crew and creator_id = v_me;
  end if;
  if v_status = 'active' then return v_crew; end if;
  if v_privacy = 'private' and v_owner <> v_me and v_status is distinct from 'invited' then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if v_status = 'removed' then raise exception 'the hosts removed you from this community' using errcode = '42501'; end if;
  if v_crew is null then
    -- Creating the crew makes its owner an active owner member, so look again before adding the caller.
    insert into public.crews(project_id, creator_id, name, purpose, status) values (p_project, v_owner, left(v_title, 120), left(v_brief, 2000), 'active')
    on conflict (project_id) do nothing;
    select id into v_crew from public.crews where project_id = p_project;
    select status into v_status from public.crew_members where crew_id = v_crew and creator_id = v_me;
    if v_status = 'active' then return v_crew; end if;
  end if;
  insert into public.crew_members(crew_id, creator_id, access, status, joined_at)
  values (v_crew, v_me, 'member', 'active', now())
  on conflict (crew_id, creator_id) do update set status = 'active', joined_at = now(), ended_at = null,
    access = case when public.crew_members.status = 'invited' then public.crew_members.access else 'member' end;
  perform app.crew_log(v_crew, 'joined', v_me, jsonb_build_object('via', 'community'));
  perform app.record_audit('community.joined', 'project', p_project, '{}'::jsonb, null);
  return v_crew;
end $$;

-- ------------------------------------------------------------------------------------------------ privacy
-- Only the owner opens their room as a community or changes its privacy. Going private keeps every member and topic;
-- the topics simply become members-only.
create or replace function public.community_set_privacy(p_project uuid, p_privacy text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old text;
begin
  if p_privacy not in ('public', 'unlisted', 'private') then raise exception 'privacy must be public, unlisted or private' using errcode = '22023'; end if;
  if not app.owns_project(p_project) then raise exception 'not allowed' using errcode = '42501'; end if;
  select community_privacy into v_old from public.projects where id = p_project and status <> 'archived';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_old is not distinct from p_privacy then return; end if;
  -- Limited topics can't live in a community (their audience would be the community's).
  if v_old is null and exists (
    select 1 from public.open_conversation_links l join public.open_conversations o on o.id = l.conversation_id
    where l.project_id = p_project and l.kind = 'project' and o.visibility = 'limited'
  ) then
    raise exception 'This room has limited topics; open them up or take them out first' using errcode = '22023';
  end if;
  update public.projects set community_privacy = p_privacy where id = p_project;
  perform app.record_audit(case when v_old is null then 'community.opened' else 'community.privacy_changed' end, 'project', p_project,
    jsonb_build_object('from', v_old, 'to', p_privacy), null);
end $$;
revoke execute on function public.community_set_privacy(uuid, text) from public, anon;
grant execute on function public.community_set_privacy(uuid, text) to authenticated;

-- Topics the caller may open but that shouldn't be listed to them (in Pulse or on Home): topics of an unlisted
-- community they don't belong to. Private communities' topics are already invisible to non-members.
create or replace function public.open_conversations_unlisted_for_me(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select distinct l.conversation_id from public.open_conversation_links l join public.projects p on p.id = l.project_id
  where l.conversation_id = any(p_ids[1:200]) and l.kind = 'project' and p.community_privacy in ('unlisted', 'private')
    and not app.can_read_project(p.id)
$$;
revoke execute on function public.open_conversations_unlisted_for_me(uuid[]) from public, anon;
grant execute on function public.open_conversations_unlisted_for_me(uuid[]) to authenticated;
