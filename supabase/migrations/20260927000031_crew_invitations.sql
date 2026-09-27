-- P1-03 Crew Invitations & Membership Lifecycle.
-- - An invitation is scoped and understandable: what they're asked to do (scope), the role, what they could do
--   (access), an optional compensation note and rights expectations, and when it expires.
-- - An expired invitation can't be accepted (checked in the database) and no longer shows the crew to the invitee;
--   the owner or an admin can invite them again.
-- - Before deciding, the invitee can ask questions; the owner and admins answer. The thread is visible only to the
--   invitee and the crew's owner and admins. "Question asked" is derived from the thread, not a stored status.
-- - When someone leaves or is removed, their row keeps its role, notes and dates (nothing is cleared).

alter table public.crew_members
  add column scope text check (scope is null or char_length(scope) <= 1000),
  add column compensation_note text check (compensation_note is null or char_length(compensation_note) <= 500),
  add column rights_note text check (rights_note is null or char_length(rights_note) <= 1000),
  add column expires_at timestamptz,
  add column decline_note text check (decline_note is null or char_length(decline_note) <= 500);

create table public.crew_invite_messages (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  invitee_creator_id uuid not null references public.creators(id) on delete cascade,
  author_creator_id uuid references public.creators(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index crew_invite_messages_thread_idx on public.crew_invite_messages(crew_id, invitee_creator_id, created_at);
create index crew_invite_messages_invitee_fk_idx on public.crew_invite_messages(invitee_creator_id);
create index crew_invite_messages_author_fk_idx on public.crew_invite_messages(author_creator_id);
alter table public.crew_invite_messages enable row level security;
create policy crew_invite_messages_read on public.crew_invite_messages for select to authenticated
  using (invitee_creator_id = app.current_creator_id() or app.crew_access(crew_id) in ('owner', 'admin'));
revoke insert, update, delete on public.crew_invite_messages from anon, authenticated;

alter table public.crew_activity drop constraint crew_activity_kind_check;
alter table public.crew_activity add constraint crew_activity_kind_check
  check (kind in ('crew_created', 'crew_updated', 'invited', 'invite_cancelled', 'joined', 'declined', 'role_changed', 'left', 'removed', 'asked', 'answered'));

-- An invitation is open while it's pending and not expired.
create or replace function app.invite_open(m public.crew_members)
returns boolean language sql stable set search_path = ''
as $$ select m.status = 'invited' and (m.expires_at is null or m.expires_at > now()) $$;

-- Active members, and people with an open invitation, can see the crew.
create or replace function app.can_see_crew(p_crew uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.crew_members m where m.crew_id = p_crew and m.creator_id = app.current_creator_id()
                 and (m.status = 'active' or (m.status = 'invited' and (m.expires_at is null or m.expires_at > now()))))
$$;

-- Invite (or invite again after a decline, expiry, cancellation, leaving or removal).
drop function public.crew_invite(uuid, uuid, text, text, text);
create or replace function public.crew_invite(
  p_crew uuid, p_creator uuid, p_access text default 'member', p_role_title text default null, p_note text default null,
  p_scope text default null, p_compensation text default null, p_rights text default null, p_expires_in_days int default 14
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_access text := app.crew_access(p_crew); existing public.crew_members;
begin
  if v_access is null or v_access not in ('owner', 'admin') then raise exception 'only the crew''s owner or admins can invite' using errcode = '42501'; end if;
  if p_access not in ('admin', 'member') then raise exception 'invalid access' using errcode = '22023'; end if;
  if p_access = 'admin' and v_access <> 'owner' then raise exception 'only the owner can invite admins' using errcode = '42501'; end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 60 then raise exception 'invalid expiry' using errcode = '22023'; end if;
  if p_creator = v_me then raise exception 'you''re already in this crew' using errcode = '22023'; end if;
  if not app.can_view_creator(p_creator) or app.blocked_between(v_me, p_creator) then raise exception 'creator not found' using errcode = 'P0002'; end if;
  if (select status from public.crews where id = p_crew) = 'completed' then raise exception 'this crew has completed its work' using errcode = '55000'; end if;
  select * into existing from public.crew_members where crew_id = p_crew and creator_id = p_creator for update;
  if existing.status = 'active' or (existing.creator_id is not null and app.invite_open(existing)) then
    raise exception 'already invited or in the crew' using errcode = '23505';
  end if;
  insert into public.crew_members(crew_id, creator_id, access, role_title, status, invited_by, invite_note, invited_at, joined_at, ended_at,
                                  scope, compensation_note, rights_note, expires_at, decline_note)
  values (p_crew, p_creator, p_access, nullif(trim(p_role_title), ''), 'invited', v_me, nullif(trim(p_note), ''), now(), null, null,
          nullif(trim(p_scope), ''), nullif(trim(p_compensation), ''), nullif(trim(p_rights), ''), now() + make_interval(days => p_expires_in_days), null)
  on conflict (crew_id, creator_id) do update set access = excluded.access, role_title = excluded.role_title, status = 'invited', invited_by = v_me,
    invite_note = excluded.invite_note, invited_at = now(), joined_at = null, ended_at = null, scope = excluded.scope,
    compensation_note = excluded.compensation_note, rights_note = excluded.rights_note, expires_at = excluded.expires_at, decline_note = null;
  perform app.crew_log(p_crew, 'invited', p_creator, jsonb_strip_nulls(jsonb_build_object('access', p_access, 'role', nullif(trim(p_role_title), ''), 'days', p_expires_in_days)));
end $$;

-- Accept or decline an open invitation. Expired ones can't be accepted.
drop function public.crew_respond(uuid, boolean);
create or replace function public.crew_respond(p_crew uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); m public.crew_members;
begin
  select * into m from public.crew_members where crew_id = p_crew and creator_id = v_me for update;
  if m.creator_id is null or m.status <> 'invited' then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if not app.invite_open(m) then raise exception 'invitation expired' using errcode = '55000'; end if;
  update public.crew_members set status = case when p_accept then 'active' else 'declined' end,
    joined_at = case when p_accept then now() end, ended_at = case when p_accept then null else now() end,
    decline_note = case when p_accept then null else nullif(trim(p_note), '') end
  where crew_id = p_crew and creator_id = v_me;
  perform app.crew_log(p_crew, case when p_accept then 'joined' else 'declined' end, v_me);
  if p_accept then update public.crews set status = 'active' where id = p_crew and status = 'forming'; end if;
end $$;

-- The invitee asks about an open invitation; the owner or an admin answers.
create or replace function public.crew_invite_ask(p_crew uuid, p_body text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); m public.crew_members;
begin
  select * into m from public.crew_members where crew_id = p_crew and creator_id = v_me;
  if m.creator_id is null or m.status <> 'invited' then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if not app.invite_open(m) then raise exception 'invitation expired' using errcode = '55000'; end if;
  insert into public.crew_invite_messages(crew_id, invitee_creator_id, author_creator_id, body) values (p_crew, v_me, v_me, trim(p_body));
  perform app.crew_log(p_crew, 'asked', v_me);
end $$;

create or replace function public.crew_invite_answer(p_crew uuid, p_invitee uuid, p_body text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); m public.crew_members;
begin
  if app.crew_access(p_crew) is null or app.crew_access(p_crew) not in ('owner', 'admin') then raise exception 'only the crew''s owner or admins can answer' using errcode = '42501'; end if;
  select * into m from public.crew_members where crew_id = p_crew and creator_id = p_invitee;
  if m.creator_id is null or not app.invite_open(m) then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  insert into public.crew_invite_messages(crew_id, invitee_creator_id, author_creator_id, body) values (p_crew, p_invitee, v_me, trim(p_body));
  perform app.crew_log(p_crew, 'answered', p_invitee);
end $$;

-- What someone sees of an invitation that's no longer open to them (expired, declined, cancelled): enough to
-- understand what happened, nothing about the crew's people or project.
create or replace function public.crew_my_invitation(p_crew uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('crewName', c.name, 'status', case when m.status = 'invited' and not app.invite_open(m) then 'expired' else m.status end,
                            'roleTitle', m.role_title, 'expiresAt', m.expires_at, 'endedAt', m.ended_at)
  from public.crew_members m join public.crews c on c.id = m.crew_id
  where m.crew_id = p_crew and m.creator_id = app.current_creator_id()
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.crew_invite(uuid, uuid, text, text, text, text, text, text, int)', 'public.crew_respond(uuid, boolean, text)',
    'public.crew_invite_ask(uuid, text)', 'public.crew_invite_answer(uuid, uuid, text)', 'public.crew_my_invitation(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
