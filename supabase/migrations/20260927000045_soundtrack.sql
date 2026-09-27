-- The Soundtrack (docs/ui-redesign/music-player.md): a small library of properly licensed tracks (the catalogue lives in
-- @wonder/creator-soundtrack with each track's license and credit). The server mirrors each file from its licensed
-- source into a public bucket — the music is openly licensed, so public, cacheable delivery is fine — and records it
-- here after checking its hash. Favourites are the creator's own.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soundtrack', 'soundtrack', true, 31457280, array['audio/mpeg'])
on conflict (id) do nothing;
-- No storage.objects policies for clients: only the server (service role) writes; reads are public by bucket.

create table public.soundtrack_files (
  track_id text primary key check (track_id ~ '^[a-z0-9-]{3,80}$'),
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  mirrored_at timestamptz not null default now()
);
alter table public.soundtrack_files enable row level security;
create policy soundtrack_files_read on public.soundtrack_files for select to authenticated using (true);

create table public.soundtrack_favourites (
  creator_id uuid not null references public.creators(id) on delete cascade,
  track_id text not null check (track_id ~ '^[a-z0-9-]{3,80}$'),
  created_at timestamptz not null default now(),
  primary key (creator_id, track_id)
);
alter table public.soundtrack_favourites enable row level security;
create policy soundtrack_favourites_own on public.soundtrack_favourites for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
