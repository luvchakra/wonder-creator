-- The bell in one round trip (docs/performance.md, phase 3).
--
-- `listNotifications` asked the database ~20 separate questions on every page (each a request costing ~90 ms live, all
-- queued on the instance at once). This answers them together. It is SECURITY INVOKER: every read below runs as the
-- caller, under the same RLS as the separate queries did, and the functions it calls (live_huddle_cards,
-- shared_with_me, unread_messages, crew_overview) are the ones the app already called. Each part mirrors one of the
-- old queries — same filters, limits and order — and returns the shape the app maps (snake_case rows, embedded
-- relations as small objects, null when not visible). Nothing here writes.

create or replace function public.notifications_feed()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select app.current_creator_id() as id, now() - interval '7 days' as since, now() - interval '1 day' as run_since)
  select jsonb_build_object(
    -- CreativeMind proposals waiting for an OK.
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'action', p.action, 'understood', p.understood, 'conversation_id', p.conversation_id, 'created_at', p.created_at) order by p.created_at desc)
      from (select * from public.ai_proposals where status = 'pending' and expires_at > now() order by created_at desc limit 10) p
    ), '[]'::jsonb),
    -- Requests to join my Huddles.
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'huddle_id', r.huddle_id, 'created_at', r.created_at, 'requester_creator_id', r.requester_creator_id,
        'creators', case when c.id is null then null else jsonb_build_object('display_name', c.display_name) end) order by r.created_at desc)
      from (select * from public.huddle_join_requests where status = 'pending' and requester_creator_id <> (select id from me) order by created_at desc limit 10) r
      left join public.creators c on c.id = r.requester_creator_id
    ), '[]'::jsonb),
    -- Invitations to Huddles (the app keeps only the live ones I'm not in).
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('huddle_id', i.huddle_id, 'created_at', i.created_at, 'invited_by_creator_id', i.invited_by_creator_id,
        'creators', case when c.id is null then null else jsonb_build_object('display_name', c.display_name) end) order by i.created_at desc)
      from (select * from public.huddle_invitations where invitee_creator_id = (select id from me) and status = 'pending' order by created_at desc limit 10) i
      left join public.creators c on c.id = i.invited_by_creator_id
    ), '[]'::jsonb),
    'live', coalesce((
      select jsonb_agg(jsonb_build_object('huddle_id', l.huddle_id, 'topic', l.topic, 'viewer_state', l.viewer_state))
      from public.live_huddle_cards(100, null) l
    ), '[]'::jsonb),
    -- Things I sent that couldn't be processed, this week.
    'failed', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'input_kind', f.input_kind, 'error_message', f.error_message, 'updated_at', f.updated_at) order by f.updated_at desc)
      from (select * from public.intake_items where state = 'failed' and updated_at >= (select since from me) order by updated_at desc limit 5) f
    ), '[]'::jsonb),
    -- Creation runs still going, or unfinished and not retried.
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'started_at', r.started_at, 'completed_at', r.completed_at, 'artifact_id', r.artifact_id,
        'retries', coalesce((select jsonb_agg(jsonb_build_object('id', x.id)) from public.ai_runs x where x.retry_of = r.id), '[]'::jsonb)) order by r.started_at desc)
      from (select * from public.ai_runs where intent = 'create' and status in ('running', 'failed', 'cancelled') and started_at >= (select run_since from me) order by started_at desc limit 5) r
    ), '[]'::jsonb),
    -- License requests waiting on me; answers to mine this week.
    'license_asks', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'artifact_id', r.artifact_id, 'created_at', r.created_at, 'requester_creator_id', r.requester_creator_id,
        'artifacts', case when a.id is null then null else jsonb_build_object('title', a.title) end,
        'creators', case when c.id is null then null else jsonb_build_object('display_name', c.display_name) end) order by r.created_at desc)
      from (select * from public.license_requests where owner_creator_id = (select id from me) and status = 'pending' order by created_at desc limit 10) r
      left join public.artifacts a on a.id = r.artifact_id
      left join public.creators c on c.id = r.requester_creator_id
    ), '[]'::jsonb),
    'license_answers', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'artifact_id', r.artifact_id, 'status', r.status, 'responded_at', r.responded_at,
        'artifacts', case when a.id is null then null else jsonb_build_object('title', a.title) end) order by r.responded_at desc)
      from (select * from public.license_requests where requester_creator_id = (select id from me) and status in ('approved', 'declined', 'countered') and responded_at >= (select since from me) order by responded_at desc limit 10) r
      left join public.artifacts a on a.id = r.artifact_id
    ), '[]'::jsonb),
    -- Creations shared directly with me.
    'shared', coalesce((
      select jsonb_agg(jsonb_build_object('share_id', s.share_id, 'title', s.title, 'creator_name', s.creator_name, 'shared_at', s.shared_at) order by s.shared_at desc)
      from public.shared_with_me() s
    ), '[]'::jsonb),
    -- Crew invitations waiting on me (with the Room's title).
    'crew_invites', coalesce((
      select jsonb_agg(jsonb_build_object('crew_id', m.crew_id, 'access', m.access, 'role_title', m.role_title, 'invite_note', m.invite_note, 'invited_at', m.invited_at, 'expires_at', m.expires_at,
        'crew_name', cr.name, 'inviter', c.display_name, 'project_title', public.crew_overview(m.crew_id) ->> 'projectTitle') order by m.invited_at desc)
      from (select * from public.crew_members where creator_id = (select id from me) and status = 'invited' and (expires_at is null or expires_at > now()) order by invited_at desc limit 20) m
      left join public.crews cr on cr.id = m.crew_id
      left join public.creators c on c.id = m.invited_by
    ), '[]'::jsonb),
    -- Invitation threads waiting on me: an invitee's question (crews I manage) or an answer to mine, while it's open.
    'crew_threads', coalesce((
      with recent as (
        select * from public.crew_invite_messages where created_at >= now() - interval '30 days' order by created_at desc limit 200
      ), latest as (
        select distinct on (crew_id, invitee_creator_id) * from recent order by crew_id, invitee_creator_id, created_at desc
      )
      select jsonb_agg(jsonb_build_object('crew_id', l.crew_id, 'crew_name', cr.name, 'invitee_id', l.invitee_creator_id, 'author', c.display_name,
        'kind', case when l.invitee_creator_id = (select id from me) then 'answer' else 'question' end, 'at', l.created_at) order by l.created_at desc)
      from latest l
      left join public.crews cr on cr.id = l.crew_id
      left join public.creators c on c.id = l.author_creator_id
      where ((l.invitee_creator_id = (select id from me) and l.author_creator_id is distinct from (select id from me))
          or (l.invitee_creator_id <> (select id from me) and l.author_creator_id = l.invitee_creator_id))
        and exists (select 1 from public.crew_members cm where cm.crew_id = l.crew_id and cm.creator_id = l.invitee_creator_id and cm.status = 'invited' and (cm.expires_at is null or cm.expires_at > now()))
    ), '[]'::jsonb),
    -- Change proposals on my Creations; decisions on mine this week; pieces I was added to this week.
    'to_review', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'artifact_id', p.artifact_id, 'summary', p.summary, 'created_at', p.created_at, 'creator_id', p.creator_id,
        'artifacts', jsonb_build_object('title', p.title, 'creator_id', p.owner),
        'creators', case when c.id is null then null else jsonb_build_object('display_name', c.display_name) end) order by p.created_at desc)
      from (
        select x.*, a.title, a.creator_id as owner from public.artifact_change_proposals x join public.artifacts a on a.id = x.artifact_id
        where x.status = 'open' and a.creator_id = (select id from me) order by x.created_at desc limit 10
      ) p
      left join public.creators c on c.id = p.creator_id
    ), '[]'::jsonb),
    'decided', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'artifact_id', p.artifact_id, 'status', p.status, 'decided_at', p.decided_at,
        'artifacts', case when a.id is null then null else jsonb_build_object('title', a.title) end) order by p.decided_at desc)
      from (select * from public.artifact_change_proposals where creator_id = (select id from me) and status in ('accepted', 'declined') and decided_at >= (select since from me) order by decided_at desc limit 10) p
      left join public.artifacts a on a.id = p.artifact_id
    ), '[]'::jsonb),
    'added_as', coalesce((
      select jsonb_agg(jsonb_build_object('artifact_id', x.artifact_id, 'role', x.role, 'created_at', x.created_at,
        'artifacts', case when a.id is null then null else jsonb_build_object('title', a.title) end) order by x.created_at desc)
      from (select * from public.artifact_contributors where contributor_creator_id = (select id from me) and created_at >= (select since from me) order by created_at desc limit 10) x
      left join public.artifacts a on a.id = x.artifact_id
    ), '[]'::jsonb),
    -- Ownership claims on my pieces I haven't answered.
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'project_id', o.project_id, 'created_at', o.created_at, 'creator_id', o.creator_id,
        'artifacts', jsonb_build_object('title', o.title, 'creator_id', o.owner),
        'creators', case when c.id is null then null else jsonb_build_object('display_name', c.display_name) end) order by o.created_at desc)
      from (
        select x.*, a.title, a.creator_id as owner from public.ownership_assertions x join public.artifacts a on a.id = x.artifact_id
        where x.status = 'asserted' and a.creator_id = (select id from me) order by x.created_at desc limit 10
      ) o
      left join public.creators c on c.id = o.creator_id
    ), '[]'::jsonb),
    -- Unread messages, by crew chat and direct thread.
    'unread', coalesce((
      select jsonb_agg(jsonb_build_object('kind', u.kind, 'id', u.id, 'project_id', u.project_id, 'title', u.title, 'unread', u.unread, 'latest_at', u.latest_at, 'latest_author', u.latest_author))
      from public.unread_messages() u
    ), '[]'::jsonb),
    -- Testimonials waiting for my decision, and mine that were shown this week.
    'testimonials', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'from_creator_id', t.from_creator_id, 'to_creator_id', t.to_creator_id, 'status', t.status, 'created_at', t.created_at, 'decided_at', t.decided_at,
        'creators', case when w.id is null then null else jsonb_build_object('display_name', w.display_name) end,
        'receiver', case when r.id is null then null else jsonb_build_object('display_name', r.display_name, 'handle', r.handle) end) order by t.created_at desc)
      from (
        select * from public.creator_testimonials
        where (to_creator_id = (select id from me) and status = 'pending')
           or (from_creator_id = (select id from me) and status = 'shown' and decided_at >= (select since from me))
        order by created_at desc limit 10
      ) t
      left join public.creators w on w.id = t.from_creator_id
      left join public.creators r on r.id = t.to_creator_id
    ), '[]'::jsonb),
    -- Credits and shares waiting for my sign-off (with my own decision, if any).
    'songs', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'project_id', g.project_id, 'created_at', g.created_at,
        'projects', case when p.id is null then null else jsonb_build_object('title', p.title) end,
        'my_decision', (select s.decision from public.project_song_signoffs s where s.agreement_id = g.id and s.creator_id = (select id from me))))
      from (select * from public.project_song_agreements where status = 'open' and lines @> jsonb_build_array(jsonb_build_object('creatorId', (select id from me))) limit 10) g
      left join public.projects p on p.id = g.project_id
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.notifications_feed() from public, anon;
grant execute on function public.notifications_feed() to authenticated;
