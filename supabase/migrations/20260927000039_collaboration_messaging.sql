-- P1-11 Collaboration Messaging: project-relevant communication.
-- - Crew chat messages can point at what they're about (a piece, task, change proposal or ownership claim in the
--   project) — that's how approvals get discussed — and at a Huddle started from the chat (handoff).
-- - Direct conversations between two creators, optionally about a project or a piece they can both open. You can
--   write to someone you already work with (crew, piece, Huddle) or who is open/selective about collaborating;
--   blocks stop it both ways. Messages are immutable (the author can remove their own).
-- - Read markers for crew chat and direct conversations feed notifications.
-- CreatorBrain may draft messages; only the creator sends them (sending is never automatic).

-- Crew chat context -------------------------------------------------------------------------------------------------
alter table public.crew_messages
  add column context_kind text check (context_kind in ('artifact', 'task', 'proposal', 'claim')),
  add column context_id uuid,
  add column huddle_id uuid references public.huddles(id) on delete set null,
  add column drafted_by_ai boolean not null default false,
  add constraint crew_messages_context_pair check ((context_kind is null) = (context_id is null));
create index crew_messages_huddle_id_fk_idx on public.crew_messages(huddle_id);

-- A context must belong to the crew's project; a Huddle link must be one the author is in.
create or replace function app.check_crew_message_context()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_project uuid;
begin
  select project_id into v_project from public.crews where id = new.crew_id;
  if new.context_kind = 'artifact' and not exists (select 1 from public.project_items i where i.project_id = v_project and i.artifact_id = new.context_id) then
    raise exception 'context not in project' using errcode = '22023';
  elsif new.context_kind = 'task' and not exists (select 1 from public.project_tasks t where t.project_id = v_project and t.id = new.context_id) then
    raise exception 'context not in project' using errcode = '22023';
  elsif new.context_kind = 'proposal' and not exists (select 1 from public.artifact_change_proposals p join public.project_items i on i.artifact_id = p.artifact_id
                                                     where i.project_id = v_project and p.id = new.context_id) then
    raise exception 'context not in project' using errcode = '22023';
  elsif new.context_kind = 'claim' and not exists (select 1 from public.ownership_assertions a where a.project_id = v_project and a.id = new.context_id) then
    raise exception 'context not in project' using errcode = '22023';
  end if;
  if new.huddle_id is not null and not exists (select 1 from public.huddle_participants hp where hp.huddle_id = new.huddle_id and hp.creator_id = new.creator_id) then
    raise exception 'not in huddle' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger crew_messages_context before insert on public.crew_messages
  for each row execute function app.check_crew_message_context();
revoke execute on function app.check_crew_message_context() from public, anon, authenticated;

create table public.crew_message_reads (
  crew_id uuid not null references public.crews(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (crew_id, creator_id)
);
create index crew_message_reads_creator_fk_idx on public.crew_message_reads(creator_id);
alter table public.crew_message_reads enable row level security;
create policy crew_message_reads_own on public.crew_message_reads for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.crew_access(crew_id) is not null);

-- Direct conversations ----------------------------------------------------------------------------------------------
create table public.direct_threads (
  id uuid primary key default gen_random_uuid(),
  creator_a uuid not null references public.creators(id) on delete cascade,
  creator_b uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (creator_a < creator_b),
  unique (creator_a, creator_b)
);
create index direct_threads_b_idx on public.direct_threads(creator_b, last_message_at desc);
create index direct_threads_a_idx on public.direct_threads(creator_a, last_message_at desc);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  creator_id uuid references public.creators(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  project_id uuid references public.projects(id) on delete set null,
  artifact_id uuid references public.artifacts(id) on delete set null,
  drafted_by_ai boolean not null default false,
  created_at timestamptz not null default now()
);
create index direct_messages_thread_idx on public.direct_messages(thread_id, created_at desc);
create index direct_messages_creator_fk_idx on public.direct_messages(creator_id);
create index direct_messages_project_fk_idx on public.direct_messages(project_id);
create index direct_messages_artifact_fk_idx on public.direct_messages(artifact_id);

create table public.direct_thread_reads (
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, creator_id)
);
create index direct_thread_reads_creator_fk_idx on public.direct_thread_reads(creator_id);

create or replace function app.in_thread(p_thread uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.direct_threads t where t.id = p_thread and app.current_creator_id() in (t.creator_a, t.creator_b)) $$;

create or replace function app.thread_other(p_thread uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select case when t.creator_a = app.current_creator_id() then t.creator_b else t.creator_a end from public.direct_threads t where t.id = p_thread $$;

-- Can the caller start a conversation with this creator? Visible, not blocked either way, and either you already
-- work together (crew, piece, Huddle) or they're open or selective about collaborating.
create or replace function app.can_message(p_other uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_other <> app.current_creator_id()
    and app.can_view_creator(p_other)
    and not app.blocked_between(app.current_creator_id(), p_other)
    and (
      exists (select 1 from public.creators c where c.id = p_other and c.collaboration_availability in ('open', 'selective') and c.onboarding_step = 'complete')
      or exists (select 1 from public.crew_members mine join public.crew_members theirs on theirs.crew_id = mine.crew_id
                 where mine.creator_id = app.current_creator_id() and theirs.creator_id = p_other
                   and mine.status in ('active', 'invited', 'left') and theirs.status in ('active', 'invited', 'left'))
      or exists (select 1 from public.artifact_contributors ac join public.artifacts a on a.id = ac.artifact_id
                 where (a.creator_id = app.current_creator_id() and ac.contributor_creator_id = p_other)
                    or (a.creator_id = p_other and ac.contributor_creator_id = app.current_creator_id()))
      or exists (select 1 from public.creator_relationships r
                 where r.creator_a = least(app.current_creator_id(), p_other) and r.creator_b = greatest(app.current_creator_id(), p_other))
    )
$$;

alter table public.direct_threads enable row level security;
create policy direct_threads_read on public.direct_threads for select to authenticated
  using (app.current_creator_id() in (creator_a, creator_b));
revoke insert, update, delete on public.direct_threads from authenticated;

alter table public.direct_messages enable row level security;
create policy direct_messages_read on public.direct_messages for select to authenticated using (app.in_thread(thread_id));
create policy direct_messages_insert on public.direct_messages for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and app.in_thread(thread_id)
    and not app.blocked_between(creator_id, app.thread_other(thread_id))
    -- Context is only what both people can open.
    and (project_id is null or (app.can_read_project(project_id) and exists (
      select 1 from public.projects p where p.id = project_id and (p.creator_id = app.thread_other(thread_id) or exists (
        select 1 from public.crews c join public.crew_members m on m.crew_id = c.id where c.project_id = p.id and m.creator_id = app.thread_other(thread_id) and m.status = 'active')))))
    and (artifact_id is null or (app.artifact_access(artifact_id) is not null and exists (
      select 1 from public.artifacts a where a.id = artifact_id and (a.creator_id = app.thread_other(thread_id) or exists (
        select 1 from public.artifact_contributors ac where ac.artifact_id = a.id and ac.contributor_creator_id = app.thread_other(thread_id))))))
  );
create policy direct_messages_delete on public.direct_messages for delete to authenticated using (creator_id = app.current_creator_id());
revoke update on public.direct_messages from authenticated;

alter table public.direct_thread_reads enable row level security;
create policy direct_thread_reads_own on public.direct_thread_reads for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.in_thread(thread_id));

create or replace function app.touch_direct_thread()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.direct_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end $$;
create trigger direct_messages_touch after insert on public.direct_messages
  for each row execute function app.touch_direct_thread();
revoke execute on function app.touch_direct_thread() from public, anon, authenticated;

-- Open (or find) the conversation with another creator.
create or replace function public.open_direct_thread(p_other uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_a uuid := least(v_me, p_other); v_b uuid := greatest(v_me, p_other); v_id uuid;
begin
  select id into v_id from public.direct_threads where creator_a = v_a and creator_b = v_b;
  if v_id is not null then
    if app.blocked_between(v_me, p_other) then raise exception 'cannot message' using errcode = '42501'; end if;
    return v_id;
  end if;
  if not app.can_message(p_other) then raise exception 'cannot message' using errcode = '42501'; end if;
  insert into public.direct_threads(creator_a, creator_b) values (v_a, v_b) returning id into v_id;
  return v_id;
end $$;

-- Unread counts for the caller: crews and direct conversations with messages from others since they last read.
create or replace function public.unread_messages()
returns table (kind text, id uuid, project_id uuid, title text, unread int, latest_at timestamptz, latest_author text)
language sql stable security definer set search_path = ''
as $$
  select 'crew', c.id, c.project_id, c.name, count(*)::int, max(m.created_at),
    (array_agg(a.display_name order by m.created_at desc))[1]
  from public.crew_members me
  join public.crews c on c.id = me.crew_id
  join public.crew_messages m on m.crew_id = c.id and m.creator_id is distinct from me.creator_id
  left join public.creators a on a.id = m.creator_id
  left join public.crew_message_reads r on r.crew_id = c.id and r.creator_id = me.creator_id
  where me.creator_id = app.current_creator_id() and me.status = 'active'
    and m.created_at > greatest(coalesce(r.last_read_at, '-infinity'), coalesce(me.joined_at, '-infinity'))
  group by c.id, c.project_id, c.name
  union all
  select 'direct', t.id, null::uuid, o.display_name, count(*)::int, max(m.created_at), o.display_name
  from public.direct_threads t
  join public.creators o on o.id = case when t.creator_a = app.current_creator_id() then t.creator_b else t.creator_a end
  join public.direct_messages m on m.thread_id = t.id and m.creator_id is distinct from app.current_creator_id()
  left join public.direct_thread_reads r on r.thread_id = t.id and r.creator_id = app.current_creator_id()
  where app.current_creator_id() in (t.creator_a, t.creator_b)
    and m.created_at > coalesce(r.last_read_at, '-infinity')
    and not app.blocked_between(t.creator_a, t.creator_b)
  group by t.id, o.display_name
$$;

do $$
declare f text;
begin
  foreach f in array array['public.open_direct_thread(uuid)', 'public.unread_messages()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

create or replace function public.can_message_creator(p_other uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_message(p_other) $$;
revoke execute on function public.can_message_creator(uuid) from public, anon;
grant execute on function public.can_message_creator(uuid) to authenticated;
