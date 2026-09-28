-- Home "You were last here yesterday" and "While you were away" (owner's Home board, 28 Sep 2026). A visit is a
-- session of activity on Home: a gap of 30 minutes or more starts a new one, and the end of the previous one is what
-- "last here" and "since you were away" mean. Private to the creator: other creators can read profiles, so visit times
-- live in their own owner-only table, never on `creators`.
create table public.creator_visits (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  previous_seen_at timestamptz
);
alter table public.creator_visits enable row level security;
create policy creator_visits_read on public.creator_visits for select to authenticated using (creator_id = app.current_creator_id());
-- No write policies: visits are marked only through mark_home_visit().

-- Marks a visit and returns the end of the previous one (null on the first visit).
create or replace function public.mark_home_visit()
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := app.current_creator_id(); v_prev timestamptz;
begin
  if v_id is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.creator_visits as v (creator_id) values (v_id)
  on conflict (creator_id) do update
     set previous_seen_at = case when v.last_seen_at < now() - interval '30 minutes' then v.last_seen_at else v.previous_seen_at end,
         last_seen_at = now()
  returning v.previous_seen_at into v_prev;
  return v_prev;
end $$;
revoke execute on function public.mark_home_visit() from public, anon;
grant execute on function public.mark_home_visit() to authenticated;
