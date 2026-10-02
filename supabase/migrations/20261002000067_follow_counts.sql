-- Followers and following on the in-app Profile (owner, 2 Oct 2026: "followers and following count on the profile
-- page"). Owner decision recorded in docs/decisions.md §12: counts appear on the Profile only — never on the public
-- Creator Page, never used to rank anything anywhere.
--
-- Follow rows are private to their two creators (follows_read), so a third person reaches them only through these
-- functions: counts are plain aggregates; lists show only creators the viewer may see (blocks and profile
-- visibility respected), and only when the viewer may see the profile itself.

create or replace function public.follow_counts(p_creator uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when app.can_view_creator(p_creator) then jsonb_build_object(
    'followers', (select count(*) from public.creator_follows f where f.followed_creator_id = p_creator),
    'following', (select count(*) from public.creator_follows f where f.follower_creator_id = p_creator),
    'followsMe', exists (select 1 from public.creator_follows f where f.follower_creator_id = p_creator and f.followed_creator_id = app.current_creator_id())
  ) end
$$;
revoke execute on function public.follow_counts(uuid) from public, anon;
grant execute on function public.follow_counts(uuid) to authenticated;

create or replace function public.follow_list(p_creator uuid, p_kind text, p_before timestamptz default null, p_limit int default 40)
returns table (creator_id uuid, handle text, display_name text, avatar_object_id uuid, followed_at timestamptz, i_follow boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.handle, c.display_name, c.avatar_object_id, f.created_at,
    exists (select 1 from public.creator_follows mine where mine.follower_creator_id = app.current_creator_id() and mine.followed_creator_id = c.id)
  from public.creator_follows f
  join public.creators c on c.id = case when p_kind = 'followers' then f.follower_creator_id else f.followed_creator_id end
  where app.can_view_creator(p_creator)
    and p_kind in ('followers', 'following')
    and (case when p_kind = 'followers' then f.followed_creator_id else f.follower_creator_id end) = p_creator
    and app.can_view_creator(c.id)
    and (p_before is null or f.created_at < p_before)
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
$$;
revoke execute on function public.follow_list(uuid, text, timestamptz, int) from public, anon;
grant execute on function public.follow_list(uuid, text, timestamptz, int) to authenticated;
