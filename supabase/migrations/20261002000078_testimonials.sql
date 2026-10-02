-- Testimonials (owner, 2 Oct 2026): as Orkut had them. Someone who knows your work writes a short note about you; it
-- appears on your Profile only after you choose to show it, and you can hide it any time. Written by others, approved
-- by you, shown in date order. No counts, no ranking. Nothing here is written by AI.
--
--   creators.testimonials_from   who may write one: anyone who can see your profile, only people you worked with, or off
--   creator_testimonials         one per writer → receiver; status pending | shown | hidden | withdrawn
--   app.worked_together          a shared crew, a Creation one contributed to, or a Huddle both were in (derived, never typed)
--   testimonial_write / testimonial_withdraw / testimonial_decide   the only ways to change one (audited)
--   testimonials_of              what the viewer may see of someone's testimonials
--   public_creator_page_testimonials   the ones a creator chose to also show on their public Creator Page

alter table public.creators add column testimonials_from text not null default 'anyone'
  check (testimonials_from in ('anyone', 'worked_with', 'off'));

create table public.creator_testimonials (
  id uuid primary key default gen_random_uuid(),
  from_creator_id uuid not null references public.creators(id) on delete cascade,
  to_creator_id uuid not null references public.creators(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 10 and 600),
  status text not null default 'pending' check (status in ('pending', 'shown', 'hidden', 'withdrawn')),
  on_creator_page boolean not null default false,
  -- Something the two share, chosen by the writer and checked by the server; its title is read when shown.
  context_type text check (context_type is null or context_type in ('project', 'artifact', 'huddle')),
  context_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_creator_id <> to_creator_id),
  check ((context_type is null) = (context_id is null)),
  unique (from_creator_id, to_creator_id)
);
create index creator_testimonials_to_idx on public.creator_testimonials(to_creator_id, status, created_at desc);
create trigger creator_testimonials_touch before update on public.creator_testimonials for each row execute function app.touch_updated_at();
alter table public.creator_testimonials enable row level security;

-- Reads: the writer and the receiver always see their row; everyone else sees only shown ones on a profile they can
-- view, never across a block with either side. All writes go through the functions below (no insert/update policies).
create policy testimonials_read on public.creator_testimonials for select to authenticated
  using (
    from_creator_id = app.current_creator_id()
    or to_creator_id = app.current_creator_id()
    or (
      status = 'shown'
      and app.can_view_creator(to_creator_id)
      and not app.blocked_between(from_creator_id, app.current_creator_id())
      and not app.blocked_between(to_creator_id, app.current_creator_id())
    )
  );

-- ------------------------------------------------------------------------------------------------ worked together
-- Derived from what the platform knows: a shared active crew, a Creation one contributed to for the other, or a
-- Huddle both joined. Never claimed by hand.
create or replace function app.worked_together(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_a is not null and p_b is not null and p_a <> p_b and (
    exists (select 1 from public.crew_members x join public.crew_members y on y.crew_id = x.crew_id
            where x.creator_id = p_a and y.creator_id = p_b and x.status = 'active' and y.status = 'active')
    or exists (select 1 from public.artifact_contributors c join public.artifacts a on a.id = c.artifact_id
               where (c.contributor_creator_id = p_a and a.creator_id = p_b) or (c.contributor_creator_id = p_b and a.creator_id = p_a))
    or exists (select 1 from public.huddle_participants x join public.huddle_participants y on y.huddle_id = x.huddle_id
               where x.creator_id = p_a and y.creator_id = p_b and x.status in ('joined', 'left') and y.status in ('joined', 'left')
                 and x.joined_at is not null and y.joined_at is not null)
  )
$$;
revoke execute on function app.worked_together(uuid, uuid) from public, anon;
grant execute on function app.worked_together(uuid, uuid) to authenticated;

-- May the caller write a testimonial for p_to? Their setting, their profile's visibility to the caller, and no block.
create or replace function app.can_write_testimonial(p_to uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.current_creator_id() is not null and p_to <> app.current_creator_id()
    and app.can_view_creator(p_to)
    and not app.blocked_between(p_to, app.current_creator_id())
    and exists (select 1 from public.creators c where c.id = p_to and (
      c.testimonials_from = 'anyone' or (c.testimonials_from = 'worked_with' and app.worked_together(app.current_creator_id(), p_to))))
$$;
revoke execute on function app.can_write_testimonial(uuid) from public, anon;
grant execute on function app.can_write_testimonial(uuid) to authenticated;

-- The shared thing a testimonial may point at: both must be part of it.
create or replace function app.shared_context_ok(p_a uuid, p_b uuid, p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'project' then exists (
      select 1 from public.crews c join public.crew_members x on x.crew_id = c.id join public.crew_members y on y.crew_id = c.id
      where c.project_id = p_id and x.creator_id = p_a and y.creator_id = p_b and x.status = 'active' and y.status = 'active')
    when 'artifact' then exists (
      select 1 from public.artifacts a join public.artifact_contributors k on k.artifact_id = a.id
      where a.id = p_id and ((a.creator_id = p_a and k.contributor_creator_id = p_b) or (a.creator_id = p_b and k.contributor_creator_id = p_a)))
    when 'huddle' then exists (
      select 1 from public.huddle_participants x join public.huddle_participants y on y.huddle_id = x.huddle_id
      where x.huddle_id = p_id and x.creator_id = p_a and y.creator_id = p_b and x.joined_at is not null and y.joined_at is not null)
    else false end
$$;
revoke execute on function app.shared_context_ok(uuid, uuid, text, uuid) from public, anon;

-- ------------------------------------------------------------------------------------------------ writing
-- Write (or rewrite) your testimonial for someone. A rewrite goes back to pending: they decide again.
create or replace function public.testimonial_write(p_to uuid, p_body text, p_context_type text default null, p_context_id uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.current_creator_id(); v_id uuid; v_prev text;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not app.can_write_testimonial(p_to) then raise exception 'not allowed' using errcode = '42501'; end if;
  if (p_context_type is null) <> (p_context_id is null) then raise exception 'context needs a type and an id' using errcode = '22023'; end if;
  if p_context_type is not null and not app.shared_context_ok(v_me, p_to, p_context_type, p_context_id) then
    raise exception 'that is not something you both share' using errcode = '22023';
  end if;
  select id, status into v_id, v_prev from public.creator_testimonials where from_creator_id = v_me and to_creator_id = p_to;
  if v_id is null then
    insert into public.creator_testimonials (from_creator_id, to_creator_id, body, context_type, context_id)
    values (v_me, p_to, btrim(p_body), p_context_type, p_context_id) returning id into v_id;
    perform app.record_audit('testimonial.written', 'creator_testimonial', v_id, jsonb_build_object('to', p_to), null);
  else
    update public.creator_testimonials
      set body = btrim(p_body), context_type = p_context_type, context_id = p_context_id, status = 'pending', on_creator_page = false, decided_at = null
      where id = v_id;
    perform app.record_audit('testimonial.rewritten', 'creator_testimonial', v_id, jsonb_build_object('to', p_to, 'was', v_prev), null);
  end if;
  return v_id;
end $$;
revoke execute on function public.testimonial_write(uuid, text, text, uuid) from public, anon;
grant execute on function public.testimonial_write(uuid, text, text, uuid) to authenticated;

-- Take back what you wrote. It leaves their profile at once.
create or replace function public.testimonial_withdraw(p_to uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  update public.creator_testimonials set status = 'withdrawn', on_creator_page = false
    where from_creator_id = app.current_creator_id() and to_creator_id = p_to and status <> 'withdrawn'
    returning id into v_id;
  if v_id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform app.record_audit('testimonial.withdrawn', 'creator_testimonial', v_id, jsonb_build_object('to', p_to), null);
end $$;
revoke execute on function public.testimonial_withdraw(uuid) from public, anon;
grant execute on function public.testimonial_withdraw(uuid) to authenticated;

-- The receiver decides: show it on their Profile, keep it private (hide), and whether it also goes on their public
-- Creator Page. A withdrawn testimonial can't be shown.
create or replace function public.testimonial_decide(p_id uuid, p_action text, p_on_creator_page boolean default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.current_creator_id(); v_status text;
begin
  if p_action not in ('show', 'hide') then raise exception 'unknown action' using errcode = '22023'; end if;
  select status into v_status from public.creator_testimonials where id = p_id and to_creator_id = v_me;
  if v_status is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_status = 'withdrawn' then raise exception 'withdrawn by its writer' using errcode = '42501'; end if;
  update public.creator_testimonials
    set status = case p_action when 'show' then 'shown' else 'hidden' end,
        on_creator_page = case when p_action = 'show' then coalesce(p_on_creator_page, on_creator_page) else false end,
        decided_at = now()
    where id = p_id;
  perform app.record_audit('testimonial.' || case p_action when 'show' then 'shown' else 'hidden' end, 'creator_testimonial', p_id,
    jsonb_build_object('on_creator_page', p_action = 'show' and coalesce(p_on_creator_page, false)), null);
end $$;
revoke execute on function public.testimonial_decide(uuid, text, boolean) from public, anon;
grant execute on function public.testimonial_decide(uuid, text, boolean) to authenticated;

-- Who may write for you.
create or replace function public.testimonials_setting(p_from text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_from not in ('anyone', 'worked_with', 'off') then raise exception 'unknown setting' using errcode = '22023'; end if;
  update public.creators set testimonials_from = p_from where id = app.current_creator_id();
  if not found then raise exception 'not signed in' using errcode = '42501'; end if;
  perform app.record_audit('testimonial.setting', 'creator', app.current_creator_id(), jsonb_build_object('from', p_from), null);
end $$;
revoke execute on function public.testimonials_setting(text) from public, anon;
grant execute on function public.testimonials_setting(text) to authenticated;

-- ------------------------------------------------------------------------------------------------ reading
-- Someone's testimonials as the caller may see them: shown ones (profile visible, no block); the receiver also sees
-- pending and hidden ones; the writer sees their own whatever its status. Newest first — nothing is ranked.
create or replace function public.testimonials_of(p_creator uuid)
returns table (
  id uuid, from_id uuid, from_name text, from_handle text, from_avatar_object_id uuid, body text, status text, on_creator_page boolean,
  created_at timestamptz, decided_at timestamptz, context_type text, context_id uuid, context_label text, worked_together boolean
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.from_creator_id, cr.display_name, cr.handle::text, cr.avatar_object_id, t.body, t.status, t.on_creator_page,
         t.created_at, t.decided_at, t.context_type, t.context_id,
         case t.context_type
           when 'project' then (select p.title from public.projects p where p.id = t.context_id)
           when 'artifact' then (select a.title from public.artifacts a where a.id = t.context_id)
           when 'huddle' then (select h.topic from public.huddles h where h.id = t.context_id)
         end,
         app.worked_together(t.from_creator_id, t.to_creator_id)
  from public.creator_testimonials t join public.creators cr on cr.id = t.from_creator_id
  where t.to_creator_id = p_creator
    and app.current_creator_id() is not null
    and not app.blocked_between(t.from_creator_id, app.current_creator_id())
    and (
      t.to_creator_id = app.current_creator_id() and t.status <> 'withdrawn'
      or t.from_creator_id = app.current_creator_id()
      or (t.status = 'shown' and app.can_view_creator(t.to_creator_id) and not app.blocked_between(t.to_creator_id, app.current_creator_id()))
    )
  order by t.created_at desc
$$;
revoke execute on function public.testimonials_of(uuid) from public, anon;
grant execute on function public.testimonials_of(uuid) to authenticated;

-- The public Creator Page (anyone, signed in or not): only shown testimonials the creator also chose for the page.
create or replace function public.public_creator_page_testimonials(p_handle text)
returns table (id uuid, from_name text, from_handle text, body text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.id, w.display_name, w.handle::text, t.body, t.created_at
  from public.creator_testimonials t
  join public.creators c on c.id = t.to_creator_id
  join public.creators w on w.id = t.from_creator_id
  join public.creator_pages pg on pg.creator_id = c.id and pg.is_published
  where c.handle = p_handle and c.visibility = 'public' and t.status = 'shown' and t.on_creator_page
  order by t.created_at desc
  limit 12
$$;
grant execute on function public.public_creator_page_testimonials(text) to anon, authenticated;

-- For the app to offer "Write a testimonial" only when it would be accepted (the function above still decides).
create or replace function public.can_write_testimonial_for(p_creator uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_write_testimonial(p_creator) $$;
revoke execute on function public.can_write_testimonial_for(uuid) from public, anon;
grant execute on function public.can_write_testimonial_for(uuid) to authenticated;
