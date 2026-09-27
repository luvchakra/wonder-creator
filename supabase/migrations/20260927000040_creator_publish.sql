-- P1-12 CreatorPublish v1: publishing as one coherent domain on top of P0.1-10.
-- - Platform-specific metadata per publication (tags, alt text, link, extra fields for webhooks), editable while a
--   draft like the copy (the existing guard already freezes everything once approved).
-- - Publishing preferences: default destinations, default tags, a preferred time of day and time zone, and notes
--   on caption style for CreatorBrain. Preferences prefill; they never approve or publish anything.
-- Nothing here changes who approves: publishing stays creator-approved, and "published" is still only written
-- after external confirmation.

alter table public.publications
  add column metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8000);

create table public.publishing_preferences (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  default_destinations jsonb not null default '[]'::jsonb check (jsonb_typeof(default_destinations) = 'array' and jsonb_array_length(default_destinations) <= 10),
  default_tags text[] not null default '{}' check (cardinality(default_tags) <= 10),
  preferred_time time,
  time_zone text check (time_zone is null or char_length(time_zone) <= 60),
  caption_style text check (caption_style is null or char_length(caption_style) <= 500),
  updated_at timestamptz not null default now()
);
create trigger publishing_preferences_touch before update on public.publishing_preferences
  for each row execute function app.touch_updated_at();
alter table public.publishing_preferences enable row level security;
create policy publishing_preferences_own on public.publishing_preferences for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
