-- Community profile pictures (owner, 2 Oct 2026: "each community should have a profile picture"). The owner and
-- moderators set it from an image they uploaded; anyone who can see the community sees it. Communities without one
-- show a painted monogram in the app.

alter table public.projects add column avatar_object_id uuid references public.storage_objects(id) on delete set null;

-- Whoever sets the picture, it must be their own clean image (a direct owner update included).
create or replace function app.project_avatar_ok()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.avatar_object_id is not null and new.avatar_object_id is distinct from old.avatar_object_id and not exists (
    select 1 from public.storage_objects o
    where o.id = new.avatar_object_id and o.creator_id = app.current_creator_id() and o.security_status = 'clean' and o.mime_type like 'image/%'
  ) then
    raise exception 'The picture must be an image you uploaded' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger projects_avatar_ok before update of avatar_object_id on public.projects for each row execute function app.project_avatar_ok();

-- Owner and moderators set (or clear) the community's picture.
create or replace function public.community_set_avatar(p_project uuid, p_object uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_community(p_project) then raise exception 'not found' using errcode = 'P0002'; end if;
  if not app.community_host(p_project) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.projects set avatar_object_id = p_object where id = p_project;
  perform app.record_audit('community.avatar_' || case when p_object is null then 'cleared' else 'set' end, 'project', p_project, '{}'::jsonb, null);
end $$;
revoke execute on function public.community_set_avatar(uuid, uuid) from public, anon;
grant execute on function public.community_set_avatar(uuid, uuid) to authenticated;

-- The list and card now carry the picture (return types change, so they're replaced).
drop function public.community_list(text, int);
create function public.community_list(p_query text default null, p_limit int default 30)
returns table (id uuid, title text, brief text, owner_id uuid, owner_name text, cover_material_id uuid, avatar_object_id uuid, member_count int, topic_count int, last_activity_at timestamptz, is_member boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, left(p.brief, 400), p.creator_id, cr.display_name, p.cover_material_id, p.avatar_object_id,
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
  order by 10 desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60)
$$;
revoke execute on function public.community_list(text, int) from public, anon;
grant execute on function public.community_list(text, int) to authenticated;

drop function public.community_card(uuid);
create function public.community_card(p_project uuid)
returns table (id uuid, title text, brief text, owner_id uuid, owner_name text, cover_material_id uuid, avatar_object_id uuid, crew_id uuid, member_count int, is_member boolean, is_host boolean, status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.title, p.brief, p.creator_id, cr.display_name, p.cover_material_id, p.avatar_object_id, c.id,
         (select count(*)::int from public.crew_members m where m.crew_id = c.id and m.status = 'active'),
         app.can_read_project(p.id), app.community_host(p.id), p.status
  from public.projects p join public.creators cr on cr.id = p.creator_id left join public.crews c on c.project_id = p.id
  where p.id = p_project and p.visibility = 'discoverable' and p.status <> 'archived'
    and app.current_creator_id() is not null and not app.blocked_between(p.creator_id, app.current_creator_id())
$$;
revoke execute on function public.community_card(uuid) from public, anon;
grant execute on function public.community_card(uuid) to authenticated;
