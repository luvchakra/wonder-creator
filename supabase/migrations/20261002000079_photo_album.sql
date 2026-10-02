-- Photo album (owner, 2 Oct 2026): "create a photo album where user can upload their pictures which they want to show
-- to people, nicely displayed pictures". A creator's own pictures, chosen to be shown on their Profile. Anyone who can
-- see the profile sees the album (never across a block); only the creator adds, captions, orders or removes photos.
-- Files go through the normal upload checks; the server stores a resized master and a thumbnail (metadata stripped).

create table public.creator_album_photos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  object_id uuid not null references public.storage_objects(id) on delete cascade,
  thumb_object_id uuid not null references public.storage_objects(id) on delete cascade,
  width int not null check (width between 1 and 10000),
  height int not null check (height between 1 and 10000),
  caption text check (caption is null or char_length(caption) <= 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creator_album_photos_creator_idx on public.creator_album_photos(creator_id, position, created_at desc);
create trigger creator_album_photos_touch before update on public.creator_album_photos for each row execute function app.touch_updated_at();
alter table public.creator_album_photos enable row level security;

-- Both files must be the creator's own, already checked as clean.
create or replace function app.album_objects_ok(p_creator uuid, p_object uuid, p_thumb uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select count(*) from public.storage_objects o
          where o.id in (p_object, p_thumb) and o.creator_id = p_creator and o.security_status = 'clean'
            and o.mime_type like 'image/%') = case when p_object = p_thumb then 1 else 2 end
$$;
revoke execute on function app.album_objects_ok(uuid, uuid, uuid) from public, anon;
grant execute on function app.album_objects_ok(uuid, uuid, uuid) to authenticated;

create policy album_read on public.creator_album_photos for select to authenticated
  using (creator_id = app.current_creator_id() or (app.can_view_creator(creator_id) and not app.blocked_between(creator_id, app.current_creator_id())));
create policy album_insert on public.creator_album_photos for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.album_objects_ok(creator_id, object_id, thumb_object_id));
create policy album_update on public.creator_album_photos for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.album_objects_ok(creator_id, object_id, thumb_object_id));
create policy album_delete on public.creator_album_photos for delete to authenticated
  using (creator_id = app.current_creator_id());

-- An album, not a camera roll: at most 60 photos.
create or replace function app.album_limit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.creator_album_photos where creator_id = new.creator_id) >= 60 then
    raise exception 'An album holds up to 60 photos' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger creator_album_photos_limit before insert on public.creator_album_photos for each row execute function app.album_limit();

-- Files the album still points at are readable by the people who can see it (the app signs links only after this
-- RLS-checked read; storage itself stays private).
