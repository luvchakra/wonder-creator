-- Live Huddle cards count only participants seen recently (heartbeat every 25s; stale after 90s, matching
-- huddle_cleanup_stale). A crashed or abandoned Huddle stops showing as live everywhere (Home, Huddles,
-- profiles, search, notifications) even before the cleanup sweep dissolves it.
create or replace function public.live_huddle_cards(p_limit int default 24, p_creator uuid default null)
returns table (
  huddle_id uuid, topic text, participant_count int, participant_names text[],
  participant_ids uuid[], started_at timestamptz, viewer_state text
) language sql stable security definer set search_path = ''
as $$
  with fresh as (
    select p.huddle_id, p.creator_id, p.joined_at
    from public.huddle_participants p
    where p.status = 'joined' and p.last_seen_at > now() - interval '90 seconds'
  )
  select h.id, h.topic,
    (select count(*)::int from fresh f where f.huddle_id = h.id),
    array(select c.display_name from fresh f join public.creators c on c.id = f.creator_id
          where f.huddle_id = h.id and app.can_view_creator(c.id) order by f.joined_at limit 6),
    array(select c.id from fresh f join public.creators c on c.id = f.creator_id
          where f.huddle_id = h.id and app.can_view_creator(c.id) order by f.joined_at limit 6),
    h.started_at,
    case
      when exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.creator_id = app.current_creator_id() and p.status = 'joined') then 'joined'
      when exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.creator_id = app.current_creator_id() and p.status = 'joining') then 'approved'
      when exists (select 1 from public.huddle_join_requests r where r.huddle_id = h.id and r.requester_creator_id = app.current_creator_id() and r.status = 'pending') then 'requested'
      else 'none'
    end
  from public.huddles h
  where h.status = 'live'
    and exists (select 1 from fresh f where f.huddle_id = h.id)
    and (h.discoverability = 'public'
         or exists (select 1 from public.huddle_invitations i where i.huddle_id = h.id and i.invitee_creator_id = app.current_creator_id())
         or app.is_huddle_participant(h.id))
    and (p_creator is null or exists (select 1 from fresh f where f.huddle_id = h.id and f.creator_id = p_creator))
    -- Blocks count every joined participant (a late heartbeat must not reveal the room to someone blocked).
    and not exists (
      select 1 from public.huddle_participants p join public.creator_blocks b on b.blocker_creator_id = p.creator_id
      where p.huddle_id = h.id and p.status = 'joined' and b.blocked_creator_id = app.current_creator_id()
    )
  order by h.started_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
