-- Communities (owner, 2 Oct 2026: Orkut-style communities "which anyone can join", built from what exists —
-- docs/communities.md). A Community is a Creative Room its owner makes discoverable. Nothing new is stored beyond one
-- column: members are the room's crew, topics are Open Conversations linked to the room, posts are their replies.
--
--   projects.visibility       'private' (default; every existing room) or 'discoverable'
--   community_list / _card    what anyone signed in may see of a discoverable room: never budget, rights note or goals
--   community_members         its active members (blocked pairs never see each other)
--   community_join            open join → active crew member (the crew is created on first join)
--   open_conversation_link    members may attach their own topic to their community
--   community_remove_topic    the owner and moderators (crew admins) take a topic out of the community
--   open_conversation_remove_reply  …and may remove a post in one of its topics

-- ------------------------------------------------------------------------------------------------ visibility
alter table public.projects add column visibility text not null default 'private' check (visibility in ('private', 'discoverable'));
create index projects_discoverable_idx on public.projects(updated_at desc) where visibility = 'discoverable';
create index open_conversation_links_project_idx on public.open_conversation_links(project_id, created_at desc) where project_id is not null;

create or replace function app.is_community(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.projects p where p.id = p_project and p.visibility = 'discoverable' and p.status <> 'archived') $$;
revoke execute on function app.is_community(uuid) from public, anon;
grant execute on function app.is_community(uuid) to authenticated;

-- The owner and crew admins of a community: its owner and moderators.
create or replace function app.community_host(p_project uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.owns_project(p_project) or exists (
    select 1 from public.crews c join public.crew_members m on m.crew_id = c.id
    where c.project_id = p_project and m.creator_id = app.current_creator_id() and m.status = 'active' and m.access in ('owner', 'admin'))
$$;
revoke execute on function app.community_host(uuid) from public, anon;
grant execute on function app.community_host(uuid) to authenticated;

-- ------------------------------------------------------------------------------------------------ cards
-- What anyone signed in may see of a community. Rooms stay private by RLS; these definer functions expose only the
-- safe columns, only for discoverable rooms, and never across a block with the owner.
create or replace function public.community_list(p_query text default null, p_limit int default 30)
returns table (id uuid, title text, brief text, owner_id uuid, owner_name text, cover_material_id uuid, member_count int, topic_count int, last_activity_at timestamptz, is_member boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, left(p.brief, 400), p.creator_id, cr.display_name, p.cover_material_id,
         (select count(*)::int from public.crews c join public.crew_members m on m.crew_id = c.id where c.project_id = p.id and m.status = 'active'),
         (select count(*)::int from public.open_conversation_links l join public.open_conversations o on o.id = l.conversation_id
            where l.project_id = p.id and o.removed_at is null),
         greatest(p.updated_at, coalesce((select max(coalesce(o.last_reply_at, o.created_at)) from public.open_conversation_links l
            join public.open_conversations o on o.id = l.conversation_id where l.project_id = p.id and o.removed_at is null), p.updated_at)),
         app.can_read_project(p.id)
  from public.projects p join public.creators cr on cr.id = p.creator_id
  where p.visibility = 'discoverable' and p.status <> 'archived'
    and app.current_creator_id() is not null
    and not app.blocked_between(p.creator_id, app.current_creator_id())
    and (p_query is null or btrim(p_query) = '' or p.title ilike '%' || left(btrim(p_query), 80) || '%' or p.brief ilike '%' || left(btrim(p_query), 80) || '%')
  order by 9 desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;
revoke execute on function public.community_list(text, int) from public, anon;
grant execute on function public.community_list(text, int) to authenticated;

create or replace function public.community_card(p_project uuid)
returns table (id uuid, title text, brief text, owner_id uuid, owner_name text, cover_material_id uuid, crew_id uuid, member_count int, is_member boolean, is_host boolean, status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.brief, p.creator_id, cr.display_name, p.cover_material_id, c.id,
         (select count(*)::int from public.crew_members m where m.crew_id = c.id and m.status = 'active'),
         app.can_read_project(p.id), app.community_host(p.id), p.status
  from public.projects p join public.creators cr on cr.id = p.creator_id left join public.crews c on c.project_id = p.id
  where p.id = p_project and p.visibility = 'discoverable' and p.status <> 'archived'
    and app.current_creator_id() is not null and not app.blocked_between(p.creator_id, app.current_creator_id())
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
    and (app.is_community(p_project) or app.can_read_project(p_project))
    and app.current_creator_id() is not null
    and not app.blocked_between(m.creator_id, app.current_creator_id())
  order by case m.access when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at
  limit 500
$$;
revoke execute on function public.community_members(uuid) from public, anon;
grant execute on function public.community_members(uuid) to authenticated;

-- ------------------------------------------------------------------------------------------------ join
-- Anyone signed in may join a discoverable community (owner: "which anyone can join"). Someone the hosts removed stays
-- out; a block with the owner keeps them out too. The crew is created on the first join, owned by the room's owner.
create or replace function public.community_join(p_project uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_owner uuid; v_crew uuid; v_title text; v_brief text; v_status text;
begin
  select p.creator_id, p.title, p.brief into v_owner, v_title, v_brief from public.projects p
  where p.id = p_project and p.visibility = 'discoverable' and p.status <> 'archived';
  if v_owner is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if app.blocked_between(v_owner, v_me) then raise exception 'not found' using errcode = 'P0002'; end if;
  select id into v_crew from public.crews where project_id = p_project;
  if v_crew is null then
    insert into public.crews(project_id, creator_id, name, purpose, status) values (p_project, v_owner, left(v_title, 120), left(v_brief, 2000), 'active')
    on conflict (project_id) do nothing;
    select id into v_crew from public.crews where project_id = p_project;
  end if;
  select status into v_status from public.crew_members where crew_id = v_crew and creator_id = v_me;
  if v_status = 'active' then return v_crew; end if;
  if v_status = 'removed' then raise exception 'the hosts removed you from this community' using errcode = '42501'; end if;
  insert into public.crew_members(crew_id, creator_id, access, status, joined_at)
  values (v_crew, v_me, 'member', 'active', now())
  on conflict (crew_id, creator_id) do update set status = 'active', access = 'member', joined_at = now(), ended_at = null;
  perform app.crew_log(v_crew, 'joined', v_me, jsonb_build_object('via', 'community'));
  perform app.record_audit('community.joined', 'project', p_project, '{}'::jsonb, null);
  return v_crew;
end $$;
revoke execute on function public.community_join(uuid) from public, anon;
grant execute on function public.community_join(uuid) to authenticated;

-- ------------------------------------------------------------------------------------------------ topics
-- Members attach their own topic to their community; the owner may attach any topic they can see (as before).
create or replace function public.open_conversation_link(p_conversation uuid, p_kind text, p_target uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_me uuid := app.current_creator_id();
begin
  if not app.can_view_conversation(p_conversation) then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_kind = 'huddle' and not exists (select 1 from public.huddles h where h.id = p_target and h.started_by_creator_id = v_me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind = 'project' and not (
    exists (select 1 from public.projects p where p.id = p_target and p.creator_id = v_me)
    or (app.can_read_project(p_target) and exists (select 1 from public.open_conversations c where c.id = p_conversation and c.creator_id = v_me))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Communities are always public (owner, 2 Oct 2026): a limited topic can't join one.
  if p_kind = 'project' and app.is_community(p_target) and exists (select 1 from public.open_conversations c where c.id = p_conversation and c.visibility = 'limited') then
    raise exception 'A community topic is public' using errcode = '22023';
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

-- Communities are always public (owner, 2 Oct 2026): once a room is opened as a community it can't be made private,
-- and a topic in a community can't be narrowed to "limited" while it's there.
create or replace function app.community_stays_public()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.visibility = 'discoverable' and new.visibility is distinct from 'discoverable' then
    raise exception 'A community is always public' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger projects_community_stays_public before update of visibility on public.projects
  for each row execute function app.community_stays_public();

create or replace function app.community_topic_stays_public()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.visibility = 'limited' and old.visibility is distinct from 'limited' and exists (
    select 1 from public.open_conversation_links l join public.projects p on p.id = l.project_id
    where l.conversation_id = new.id and l.kind = 'project' and p.visibility = 'discoverable'
  ) then
    raise exception 'A community topic is public' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger open_conversations_community_topic_public before update of visibility on public.open_conversations
  for each row execute function app.community_topic_stays_public();

-- The owner and moderators take a topic out of their community (the topic itself stays with its author).
create or replace function public.community_remove_topic(p_project uuid, p_conversation uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.community_host(p_project) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.open_conversation_links where project_id = p_project and conversation_id = p_conversation and kind = 'project';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform app.record_audit('community.topic_removed', 'open_conversation', p_conversation, jsonb_build_object('project', p_project, 'reason', left(p_reason, 300)), null);
end $$;
revoke execute on function public.community_remove_topic(uuid, uuid, text) from public, anon;
grant execute on function public.community_remove_topic(uuid, uuid, text) to authenticated;

-- A post can also be removed by the owner or a moderator of a community the topic belongs to.
create or replace function public.open_conversation_remove_reply(p_reply uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_conv uuid; v_owner uuid; v_author uuid; v_host boolean;
begin
  select r.conversation_id, c.creator_id, r.creator_id into v_conv, v_owner, v_author
  from public.open_conversation_replies r join public.open_conversations c on c.id = r.conversation_id where r.id = p_reply;
  if v_conv is null then raise exception 'not found' using errcode = 'P0002'; end if;
  v_host := exists (select 1 from public.open_conversation_links l where l.conversation_id = v_conv and l.kind = 'project' and app.community_host(l.project_id));
  if v_owner <> app.current_creator_id() and not app.is_moderator() and not v_host then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.open_conversation_replies set removed_at = now() where id = p_reply and removed_at is null;
  perform app.record_audit('community.reply_removed', 'open_conversation_reply', p_reply,
    jsonb_build_object('conversation', v_conv, 'by', case when v_owner = app.current_creator_id() then 'owner' when v_host then 'community_host' else 'moderator' end, 'reason', left(p_reason, 300)), null);
end
$$;
