-- P0.1-13 Huddle creation, invitation & post-Huddle.
-- - A Huddle can carry a short description and a related piece or material, and says up front whether chat
--   moments may be saved. Nothing is recorded or transcribed; saving someone else's chat message is possible
--   only for messages sent while the host allowed it (consent is never assumed or applied retroactively).
-- - Invitations have a status (pending / accepted / declined).
-- - Each participant keeps a durable, private history of the Huddle (topic, when, who they met), so there is
--   a post-Huddle summary after the ephemeral state is gone. Chat still disappears at dissolution.

-- 1. Huddle settings ---------------------------------------------------------------------------------------
alter table public.huddles
  add column description text check (description is null or char_length(description) <= 500),
  add column chat_saving_since timestamptz,
  add column related_artifact_id uuid references public.artifacts(id) on delete set null,
  add column related_material_id uuid references public.creative_materials(id) on delete set null;
create index huddles_related_artifact_id_fk_idx on public.huddles(related_artifact_id);
create index huddles_related_material_id_fk_idx on public.huddles(related_material_id);

-- Host-only, while live. Allowing chat saving applies from now on; turning it off applies immediately.
create or replace function public.huddle_configure(
  p_huddle uuid, p_description text default null, p_allow_saving_chat boolean default null,
  p_related_artifact uuid default null, p_related_material uuid default null, p_clear_related boolean default false
) returns public.huddles language plpgsql security definer set search_path = ''
as $$
declare h public.huddles;
begin
  perform app.require_creator();
  if app.huddle_role(p_huddle) is distinct from 'host' then raise exception 'only the host can do that' using errcode = '42501'; end if;
  if p_related_artifact is not null and not app.can_read_artifact(p_related_artifact) then raise exception 'invalid related item' using errcode = '22023'; end if;
  if p_related_material is not null and not app.owns_material(p_related_material) then raise exception 'invalid related item' using errcode = '22023'; end if;
  update public.huddles set
    description = case when p_description is null then description else nullif(trim(p_description), '') end,
    chat_saving_since = case
      when p_allow_saving_chat is null then chat_saving_since
      when p_allow_saving_chat then coalesce(chat_saving_since, now())
      else null end,
    related_artifact_id = case when p_clear_related then null else coalesce(p_related_artifact, related_artifact_id) end,
    related_material_id = case when p_clear_related then null else coalesce(p_related_material, related_material_id) end
  where id = p_huddle and status = 'live' returning * into h;
  if h.id is null then raise exception 'huddle is not live' using errcode = 'P0002'; end if;
  perform app.huddle_log(p_huddle, 'HuddleConfigured', jsonb_build_object('chatSaving', h.chat_saving_since is not null));
  return h;
end $$;
revoke execute on function public.huddle_configure(uuid, text, boolean, uuid, uuid, boolean) from public, anon;
grant execute on function public.huddle_configure(uuid, text, boolean, uuid, uuid, boolean) to authenticated;

-- What participants see of the related item: its title, and whether they can open it.
create or replace function public.huddle_related(p_huddle uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare h public.huddles; t text; k text; i uuid; can boolean := false;
begin
  if not app.is_huddle_participant(p_huddle) then return null; end if;
  select * into h from public.huddles where id = p_huddle;
  if h.related_artifact_id is not null then
    select title into t from public.artifacts where id = h.related_artifact_id;
    k := 'artifact'; i := h.related_artifact_id; can := app.can_read_artifact(i);
  elsif h.related_material_id is not null then
    select coalesce(title, 'Material') into t from public.creative_materials where id = h.related_material_id;
    k := 'material'; i := h.related_material_id; can := app.owns_material(i);
  else
    return null;
  end if;
  return jsonb_build_object('kind', k, 'id', case when can then i end, 'title', t, 'canOpen', can);
end $$;
revoke execute on function public.huddle_related(uuid) from public, anon;
grant execute on function public.huddle_related(uuid) to authenticated;

-- 2. Invitation status -------------------------------------------------------------------------------------
alter table public.huddle_invitations
  add column status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  add column responded_at timestamptz;

create or replace function public.huddle_decline_invite(p_huddle uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  update public.huddle_invitations set status = 'declined', responded_at = now()
  where huddle_id = p_huddle and invitee_creator_id = v_me and status = 'pending';
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  perform app.huddle_log(p_huddle, 'HuddleInviteDeclined');
end $$;
revoke execute on function public.huddle_decline_invite(uuid) from public, anon;
grant execute on function public.huddle_decline_invite(uuid) to authenticated;

-- 3. Per-participant history (durable, private to each participant) ------------------------------------------
create table public.huddle_history (
  huddle_id uuid not null,
  creator_id uuid not null references public.creators(id) on delete cascade,
  topic text,
  role text not null check (role in ('host', 'member')),
  started_at timestamptz not null,
  joined_at timestamptz not null,
  left_at timestamptz,
  ended_at timestamptz,
  met jsonb not null default '[]'::jsonb,
  primary key (huddle_id, creator_id)
);
create index huddle_history_creator_idx on public.huddle_history(creator_id, joined_at desc);
alter table public.huddle_history enable row level security;
create policy huddle_history_own on public.huddle_history for select to authenticated
  using (creator_id = app.current_creator_id());
-- No write policies: maintained by the triggers below.

create or replace function app.was_huddle_participant(p_huddle uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.huddle_history where huddle_id = p_huddle and creator_id = app.current_creator_id()) $$;

-- Joining writes the history row and accepts any invitation; leaving stamps it.
create or replace function app.track_huddle_participant()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare h public.huddles;
begin
  if new.status = 'joined' and (tg_op = 'INSERT' or old.status is distinct from 'joined') then
    select * into h from public.huddles where id = new.huddle_id;
    insert into public.huddle_history(huddle_id, creator_id, topic, role, started_at, joined_at)
    values (new.huddle_id, new.creator_id, h.topic, new.role, h.started_at, coalesce(new.joined_at, now()))
    on conflict (huddle_id, creator_id) do update set left_at = null, role = excluded.role;
    update public.huddle_invitations set status = 'accepted', responded_at = now()
    where huddle_id = new.huddle_id and invitee_creator_id = new.creator_id and status <> 'accepted';
  elsif tg_op = 'UPDATE' and new.status = 'left' and old.status = 'joined' then
    update public.huddle_history set left_at = now() where huddle_id = new.huddle_id and creator_id = new.creator_id;
  end if;
  return new;
end $$;
create trigger huddle_participants_history after insert or update of status on public.huddle_participants
  for each row execute function app.track_huddle_participant();
revoke execute on function app.track_huddle_participant() from public, anon, authenticated;

-- When a Huddle ends (still with its participants), each participant's history gets who they met and when it ended.
create or replace function app.close_huddle_history()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'dissolving' and old.status = 'live' then
    update public.huddle_history hh set
      ended_at = now(),
      left_at = coalesce(hh.left_at, now()),
      met = coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.display_name, 'handle', c.handle) order by o.joined_at)
        from public.huddle_history o join public.creators c on c.id = o.creator_id
        where o.huddle_id = hh.huddle_id and o.creator_id <> hh.creator_id
      ), '[]'::jsonb)
    where hh.huddle_id = new.id;
  end if;
  return new;
end $$;
create trigger huddles_close_history after update of status on public.huddles
  for each row execute function app.close_huddle_history();
revoke execute on function app.close_huddle_history() from public, anon, authenticated;

-- 4. Saving moments and post-Huddle notes ---------------------------------------------------------------------
-- A chat message can be saved by its author, or by another participant only if it was sent while the host
-- allowed saving. Returns what to save (never anything else from the chat).
create or replace function public.huddle_moment(p_huddle uuid, p_message uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare m public.huddle_messages; h public.huddles; author text;
begin
  if not app.is_huddle_participant(p_huddle) then raise exception 'not a participant' using errcode = '42501'; end if;
  select * into m from public.huddle_messages where id = p_message and huddle_id = p_huddle;
  if m.id is null then raise exception 'message not found' using errcode = 'P0002'; end if;
  select * into h from public.huddles where id = p_huddle;
  if m.creator_id <> app.current_creator_id() and (h.chat_saving_since is null or m.created_at < h.chat_saving_since) then
    raise exception 'saving not allowed' using errcode = '42501';
  end if;
  select display_name into author from public.creators where id = m.creator_id;
  return jsonb_build_object('body', m.body, 'author', author, 'own', m.creator_id = app.current_creator_id(), 'at', m.created_at);
end $$;
revoke execute on function public.huddle_moment(uuid, uuid) from public, anon;
grant execute on function public.huddle_moment(uuid, uuid) to authenticated;

-- Participants can still add notes after the Huddle ends (their own words, as their own material).
drop policy preserved_insert on public.huddle_preserved_items;
create policy preserved_insert on public.huddle_preserved_items for insert to authenticated
  with check (creator_id = app.current_creator_id()
              and (app.is_huddle_participant(huddle_id) or app.was_huddle_participant(huddle_id))
              and (material_id is null or app.owns_material(material_id))
              and (artifact_id is null or app.owns_artifact(artifact_id)));

drop policy provenance_own on public.provenance_records;
create policy provenance_own on public.provenance_records for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and (conversation_id is null or app.owns_conversation(conversation_id))
    and (ai_run_id is null or app.owns_ai_run(ai_run_id))
    and (huddle_id is null or app.is_huddle_participant(huddle_id) or app.was_huddle_participant(huddle_id)
         or exists (select 1 from public.huddle_preserved_items p where p.huddle_id = provenance_records.huddle_id and p.creator_id = app.current_creator_id()))
  );
