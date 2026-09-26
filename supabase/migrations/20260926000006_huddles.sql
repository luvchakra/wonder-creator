-- Creator Huddle: an ephemeral, spontaneous live connection between creators.
-- Control plane only. Audio/video travel over the media provider, never through app servers.
-- All state transitions happen in security-definer functions that authorize the caller; clients
-- have read-only table access (plus sending chat while joined).

create table public.huddles (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'live' check (status in ('live', 'dissolving', 'dissolved')),
  topic text check (topic is null or char_length(topic) <= 140),
  discoverability text not null default 'public' check (discoverability in ('public', 'invite_only')),
  media_room_id text,
  started_by_creator_id uuid references public.creators(id) on delete set null,
  started_at timestamptz not null default now(),
  dissolved_at timestamptz
);
create index huddles_live_idx on public.huddles(status, started_at desc) where status = 'live';

create table public.huddle_participants (
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  role text not null check (role in ('host', 'member')),
  status text not null check (status in ('joining', 'joined', 'left')),
  audio_on boolean not null default false,
  video_on boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  primary key (huddle_id, creator_id)
);
create index huddle_participants_creator_idx on public.huddle_participants(creator_id, status);

create table public.huddle_join_requests (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  requester_creator_id uuid not null references public.creators(id) on delete cascade,
  message text check (message is null or char_length(message) <= 280),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_creator_id uuid references public.creators(id) on delete set null
);
create unique index huddle_join_requests_one_pending on public.huddle_join_requests(huddle_id, requester_creator_id) where status = 'pending';

create table public.huddle_invitations (
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  invitee_creator_id uuid not null references public.creators(id) on delete cascade,
  invited_by_creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (huddle_id, invitee_creator_id)
);

-- Ephemeral chat. Deleted when the Huddle dissolves unless explicitly preserved.
create table public.huddle_messages (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index huddle_messages_huddle_idx on public.huddle_messages(huddle_id, created_at);

-- Durable: explicitly preserved creative outcomes (no FK to the ephemeral huddle).
create table public.huddle_preserved_items (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null,
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('idea', 'material', 'artifact', 'reference')),
  material_id uuid references public.creative_materials(id) on delete set null,
  artifact_id uuid references public.artifacts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Durable: moderation survives dissolution by design.
create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_creator_id uuid not null references public.creators(id) on delete cascade,
  reported_creator_id uuid references public.creators(id) on delete set null,
  context_type text not null check (context_type in ('huddle', 'profile', 'artifact', 'message')),
  context_id uuid,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'impersonation', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Minimal technical audit of huddle lifecycle (no content).
create table public.huddle_events (
  id bigint generated always as identity primary key,
  huddle_id uuid not null,
  creator_id uuid,
  event text not null,
  created_at timestamptz not null default now()
);
create trigger huddle_events_immutable before update or delete on public.huddle_events
  for each row execute function app.prevent_mutation();

-- Helpers --------------------------------------------------------------------
create or replace function app.huddle_role(p_huddle uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select p.role from public.huddle_participants p
  where p.huddle_id = p_huddle and p.creator_id = app.current_creator_id() and p.status = 'joined'
$$;

create or replace function app.is_huddle_participant(p_huddle uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.huddle_role(p_huddle) is not null $$;

create or replace function app.huddle_log(p_huddle uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.huddle_events(huddle_id, creator_id, event) values (p_huddle, app.current_creator_id(), p_event);
  perform app.record_event(p_event, 'huddle', p_huddle, p_payload);
end $$;

create or replace function app.require_creator()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare v uuid := app.current_creator_id();
begin
  if v is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return v;
end $$;

-- Dissolve: end the live session and remove ephemeral state. Keeps relationship signals.
create or replace function app.dissolve_huddle(p_huddle uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  update public.huddles set status = 'dissolving' where id = p_huddle and status = 'live';
  if not found then return; end if;
  perform app.huddle_log(p_huddle, 'HuddleDissolving');

  -- Relationship signals for every pair that was ever joined together.
  for r in
    select least(a.creator_id, b.creator_id) as ca, greatest(a.creator_id, b.creator_id) as cb
    from public.huddle_participants a
    join public.huddle_participants b on a.huddle_id = b.huddle_id and a.creator_id < b.creator_id
    where a.huddle_id = p_huddle and a.joined_at is not null and b.joined_at is not null
  loop
    insert into public.creator_relationships(creator_a, creator_b, met_in_huddle_count, last_met_at)
    values (r.ca, r.cb, 1, now())
    on conflict (creator_a, creator_b)
    do update set met_in_huddle_count = public.creator_relationships.met_in_huddle_count + 1, last_met_at = now();
  end loop;

  update public.huddle_join_requests set status = 'expired', resolved_at = now()
    where huddle_id = p_huddle and status = 'pending';
  delete from public.huddle_messages where huddle_id = p_huddle;
  delete from public.huddle_invitations where huddle_id = p_huddle;
  delete from public.huddle_join_requests where huddle_id = p_huddle;
  delete from public.huddle_participants where huddle_id = p_huddle;
  update public.huddles
    set status = 'dissolved', dissolved_at = now(), topic = null, media_room_id = null
    where id = p_huddle;
  perform app.huddle_log(p_huddle, 'HuddleDissolved');
end $$;

create or replace function app.dissolve_if_empty(p_huddle uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.huddle_participants where huddle_id = p_huddle and status = 'joined') then
    perform app.dissolve_huddle(p_huddle);
    return true;
  end if;
  return false;
end $$;

-- Public RPCs ----------------------------------------------------------------
create or replace function public.huddle_start(p_topic text, p_discoverability text default 'public')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_id uuid;
begin
  if p_discoverability not in ('public', 'invite_only') then
    raise exception 'invalid discoverability' using errcode = '22023';
  end if;
  if exists (select 1 from public.huddle_participants p join public.huddles h on h.id = p.huddle_id
             where p.creator_id = v_me and p.status = 'joined' and h.status = 'live') then
    raise exception 'already in a live huddle' using errcode = '23505';
  end if;
  insert into public.huddles(topic, discoverability, started_by_creator_id)
  values (nullif(trim(p_topic), ''), p_discoverability, v_me) returning id into v_id;
  insert into public.huddle_participants(huddle_id, creator_id, role, status, joined_at)
  values (v_id, v_me, 'host', 'joined', now());
  perform app.huddle_log(v_id, 'HuddleStarted', jsonb_build_object('discoverability', p_discoverability));
  perform app.huddle_log(v_id, 'HuddleParticipantJoined');
  return v_id;
end $$;

create or replace function public.huddle_invite(p_huddle uuid, p_invitee uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  if not app.is_huddle_participant(p_huddle) then raise exception 'not a participant' using errcode = '42501'; end if;
  if not app.can_view_creator(p_invitee) or p_invitee = v_me then raise exception 'invalid invitee' using errcode = '22023'; end if;
  if exists (select 1 from public.creator_blocks where blocker_creator_id = p_invitee and blocked_creator_id = v_me) then
    raise exception 'invalid invitee' using errcode = '22023';
  end if;
  insert into public.huddle_invitations(huddle_id, invitee_creator_id, invited_by_creator_id)
  values (p_huddle, p_invitee, v_me) on conflict do nothing;
  perform app.huddle_log(p_huddle, 'HuddleCreatorInvited', jsonb_build_object('invitee', p_invitee));
end $$;

create or replace function public.huddle_request_join(p_huddle uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_h public.huddles; v_id uuid;
begin
  select * into v_h from public.huddles where id = p_huddle;
  if not found or v_h.status <> 'live' then raise exception 'huddle is not live' using errcode = 'P0002'; end if;
  if v_h.discoverability = 'invite_only'
     and not exists (select 1 from public.huddle_invitations where huddle_id = p_huddle and invitee_creator_id = v_me) then
    raise exception 'huddle is not live' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.huddle_participants where huddle_id = p_huddle and creator_id = v_me and status in ('joined', 'joining')) then
    raise exception 'already a participant' using errcode = '23505';
  end if;
  -- Blocked by any current participant: not allowed.
  if exists (select 1 from public.huddle_participants p join public.creator_blocks b on b.blocker_creator_id = p.creator_id
             where p.huddle_id = p_huddle and p.status = 'joined' and b.blocked_creator_id = v_me) then
    raise exception 'huddle is not live' using errcode = 'P0002';
  end if;
  insert into public.huddle_join_requests(huddle_id, requester_creator_id, message)
  values (p_huddle, v_me, nullif(trim(p_message), '')) returning id into v_id;
  perform app.huddle_log(p_huddle, 'HuddleJoinRequested', jsonb_build_object('requestId', v_id));
  return v_id;
end $$;

create or replace function public.huddle_cancel_request(p_request uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  update public.huddle_join_requests set status = 'cancelled', resolved_at = now()
    where id = p_request and requester_creator_id = v_me and status = 'pending';
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
end $$;

-- Only a joined participant (never the requester) can resolve a request.
create or replace function public.huddle_resolve_request(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_r public.huddle_join_requests;
begin
  select * into v_r from public.huddle_join_requests where id = p_request for update;
  if not found or not app.is_huddle_participant(v_r.huddle_id) then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if v_r.requester_creator_id = v_me then raise exception 'cannot resolve own request' using errcode = '42501'; end if;
  if v_r.status <> 'pending' then raise exception 'request already resolved' using errcode = '22023'; end if;

  update public.huddle_join_requests
    set status = case when p_approve then 'approved' else 'declined' end, resolved_at = now(), resolved_by_creator_id = v_me
    where id = p_request;
  if p_approve then
    insert into public.huddle_participants(huddle_id, creator_id, role, status)
    values (v_r.huddle_id, v_r.requester_creator_id, 'member', 'joining')
    on conflict (huddle_id, creator_id) do update set status = 'joining', left_at = null;
    perform app.huddle_log(v_r.huddle_id, 'HuddleJoinApproved', jsonb_build_object('requestId', p_request));
  else
    perform app.huddle_log(v_r.huddle_id, 'HuddleJoinDeclined', jsonb_build_object('requestId', p_request));
  end if;
end $$;

-- Enter after approval (or rejoin after a brief disconnect while still live).
create or replace function public.huddle_enter(p_huddle uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  if not exists (select 1 from public.huddles where id = p_huddle and status = 'live') then
    raise exception 'huddle is not live' using errcode = 'P0002';
  end if;
  update public.huddle_participants
    set status = 'joined', joined_at = coalesce(joined_at, now()), left_at = null, last_seen_at = now()
    where huddle_id = p_huddle and creator_id = v_me
      and (status = 'joining' or (status = 'left' and left_at > now() - interval '10 minutes'));
  if not found then raise exception 'not admitted' using errcode = '42501'; end if;
  perform app.huddle_log(p_huddle, 'HuddleParticipantJoined');
end $$;

create or replace function public.huddle_leave(p_huddle uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_role text; v_next uuid;
begin
  select role into v_role from public.huddle_participants
    where huddle_id = p_huddle and creator_id = v_me and status in ('joined', 'joining') for update;
  if not found then raise exception 'not a participant' using errcode = '42501'; end if;
  update public.huddle_participants set status = 'left', left_at = now(), audio_on = false, video_on = false
    where huddle_id = p_huddle and creator_id = v_me;
  perform app.huddle_log(p_huddle, 'HuddleParticipantLeft');
  -- Host hand-off keeps the Huddle going; the host never permanently owns it.
  if v_role = 'host' then
    select creator_id into v_next from public.huddle_participants
      where huddle_id = p_huddle and status = 'joined' order by joined_at limit 1;
    if v_next is not null then
      update public.huddle_participants set role = 'member' where huddle_id = p_huddle and creator_id = v_me;
      update public.huddle_participants set role = 'host' where huddle_id = p_huddle and creator_id = v_next;
    end if;
  end if;
  return app.dissolve_if_empty(p_huddle);
end $$;

create or replace function public.huddle_heartbeat(p_huddle uuid, p_audio boolean default null, p_video boolean default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_status text;
begin
  select status into v_status from public.huddles where id = p_huddle;
  if v_status is null or v_status <> 'live' then return 'dissolved'; end if;
  update public.huddle_participants
    set last_seen_at = now(), audio_on = coalesce(p_audio, audio_on), video_on = coalesce(p_video, video_on)
    where huddle_id = p_huddle and creator_id = v_me and status = 'joined';
  if not found then return 'not_joined'; end if;
  return 'live';
end $$;

-- Host (or any member when policy allows) can remove a participant; they must request again to return.
create or replace function public.huddle_remove_participant(p_huddle uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  if app.huddle_role(p_huddle) <> 'host' then raise exception 'only the host can remove participants' using errcode = '42501'; end if;
  if p_creator = v_me then raise exception 'use leave instead' using errcode = '22023'; end if;
  update public.huddle_participants set status = 'left', left_at = now() - interval '1 day'
    where huddle_id = p_huddle and creator_id = p_creator and status in ('joined', 'joining');
  if not found then raise exception 'participant not found' using errcode = 'P0002'; end if;
  perform app.huddle_log(p_huddle, 'HuddleParticipantRemoved');
  perform app.dissolve_if_empty(p_huddle);
end $$;

-- Emergency termination by the host.
create or replace function public.huddle_end(p_huddle uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform app.require_creator();
  if app.huddle_role(p_huddle) <> 'host' then raise exception 'only the host can end the huddle' using errcode = '42501'; end if;
  perform app.dissolve_huddle(p_huddle);
end $$;

-- Stale presence cleanup (called by the background worker and opportunistically).
create or replace function public.huddle_cleanup_stale(p_timeout_seconds int default 90)
returns int language plpgsql security definer set search_path = ''
as $$
declare r record; v_count int := 0;
begin
  for r in
    update public.huddle_participants set status = 'left', left_at = now()
    where status = 'joined' and last_seen_at < now() - make_interval(secs => p_timeout_seconds)
    returning huddle_id
  loop
    v_count := v_count + 1;
  end loop;
  -- Approved-but-never-entered participants also lapse.
  update public.huddle_participants set status = 'left', left_at = now()
    where status = 'joining' and last_seen_at < now() - interval '10 minutes';
  for r in select id from public.huddles h where h.status = 'live'
           and not exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.status = 'joined') loop
    perform app.dissolve_huddle(r.id);
  end loop;
  return v_count;
end $$;
revoke execute on function public.huddle_cleanup_stale(int) from anon, authenticated, public;

-- Public live cards: only safe metadata. Participant names only for creators whose profile is viewable.
create or replace function public.live_huddle_cards(p_limit int default 24, p_creator uuid default null)
returns table (
  huddle_id uuid, topic text, participant_count int, participant_names text[],
  participant_ids uuid[], started_at timestamptz, viewer_state text
) language sql stable security definer set search_path = ''
as $$
  select h.id, h.topic,
    (select count(*)::int from public.huddle_participants p where p.huddle_id = h.id and p.status = 'joined'),
    array(select c.display_name from public.huddle_participants p join public.creators c on c.id = p.creator_id
          where p.huddle_id = h.id and p.status = 'joined' and app.can_view_creator(c.id) order by p.joined_at limit 6),
    array(select c.id from public.huddle_participants p join public.creators c on c.id = p.creator_id
          where p.huddle_id = h.id and p.status = 'joined' and app.can_view_creator(c.id) order by p.joined_at limit 6),
    h.started_at,
    case
      when exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.creator_id = app.current_creator_id() and p.status = 'joined') then 'joined'
      when exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.creator_id = app.current_creator_id() and p.status = 'joining') then 'approved'
      when exists (select 1 from public.huddle_join_requests r where r.huddle_id = h.id and r.requester_creator_id = app.current_creator_id() and r.status = 'pending') then 'requested'
      else 'none'
    end
  from public.huddles h
  where h.status = 'live'
    and (h.discoverability = 'public'
         or exists (select 1 from public.huddle_invitations i where i.huddle_id = h.id and i.invitee_creator_id = app.current_creator_id())
         or app.is_huddle_participant(h.id))
    and (p_creator is null or exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.creator_id = p_creator and p.status = 'joined'))
    and not exists (
      select 1 from public.huddle_participants p join public.creator_blocks b on b.blocker_creator_id = p.creator_id
      where p.huddle_id = h.id and p.status = 'joined' and b.blocked_creator_id = app.current_creator_id()
    )
  order by h.started_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'huddle_start(text, text)', 'huddle_invite(uuid, uuid)', 'huddle_request_join(uuid, text)',
    'huddle_cancel_request(uuid)', 'huddle_resolve_request(uuid, boolean)', 'huddle_enter(uuid)',
    'huddle_leave(uuid)', 'huddle_heartbeat(uuid, boolean, boolean)', 'huddle_remove_participant(uuid, uuid)',
    'huddle_end(uuid)', 'live_huddle_cards(int, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- RLS: read-only to clients except chat; writes go through the functions above.
alter table public.huddles enable row level security;
alter table public.huddle_participants enable row level security;
alter table public.huddle_join_requests enable row level security;
alter table public.huddle_invitations enable row level security;
alter table public.huddle_messages enable row level security;
alter table public.huddle_preserved_items enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.huddle_events enable row level security;

create policy huddles_participant_read on public.huddles for select to authenticated
  using (app.is_huddle_participant(id)
         or exists (select 1 from public.huddle_participants p where p.huddle_id = id and p.creator_id = app.current_creator_id() and p.status = 'joining'));

create policy participants_read on public.huddle_participants for select to authenticated
  using (app.is_huddle_participant(huddle_id) or creator_id = app.current_creator_id());

create policy join_requests_read on public.huddle_join_requests for select to authenticated
  using (requester_creator_id = app.current_creator_id() or app.is_huddle_participant(huddle_id));

create policy invitations_read on public.huddle_invitations for select to authenticated
  using (invitee_creator_id = app.current_creator_id() or app.is_huddle_participant(huddle_id));

create policy huddle_messages_read on public.huddle_messages for select to authenticated
  using (app.is_huddle_participant(huddle_id));
create policy huddle_messages_send on public.huddle_messages for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.is_huddle_participant(huddle_id));

create policy preserved_own on public.huddle_preserved_items for select to authenticated
  using (creator_id = app.current_creator_id());
create policy preserved_insert on public.huddle_preserved_items for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.is_huddle_participant(huddle_id)
              and (material_id is null or app.owns_material(material_id))
              and (artifact_id is null or app.owns_artifact(artifact_id)));

create policy reports_own_read on public.moderation_reports for select to authenticated
  using (reporter_creator_id = app.current_creator_id());
create policy reports_insert on public.moderation_reports for insert to authenticated
  with check (reporter_creator_id = app.current_creator_id());

-- Realtime for live UI (RLS still applies to change feeds).
alter publication supabase_realtime add table public.huddle_participants, public.huddle_join_requests, public.huddle_messages, public.huddles;

-- Tighten conversation attachment artifact ownership.
drop policy attachments_own on public.conversation_attachments;
create policy attachments_own on public.conversation_attachments for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id()
              and (material_id is null or app.owns_material(material_id))
              and (artifact_id is null or app.can_read_artifact(artifact_id)));
