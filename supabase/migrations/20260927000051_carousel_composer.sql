-- Carousel Composer (docs/ui-redesign/carousel-composer.md §35–39). A Carousel Creation is a sequence of slides; each
-- slide is an editable composition: an image, the source words it came from, the words shown, an optional overlay on
-- the image, an image crop, and its place in the order. Lineage: the source version, the generation and the image.
--
-- Writes: people who may edit the Creation (owner, or collaborators with edit access) change words, overlay, crop and
-- order directly (autosave). Which image a slide shows, and adding/removing slides, go through the server, which
-- checks the image belongs to this Carousel's generations — so a slide can never point at someone else's image.

create table public.carousels (
  artifact_id uuid primary key references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  requested_count int not null check (requested_count between 1 and 12),
  aspect_ratio text not null default '4:5' check (aspect_ratio in ('1:1', '4:5', '16:9')),
  visual_style text not null default 'auto' check (visual_style in ('auto', 'editorial', 'atmospheric', 'minimal')),
  generation_id uuid references public.image_generations(id) on delete set null,
  source_version int,
  -- Set once, by whichever request first turns the finished generation into slides (no duplicate seeding).
  seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carousels_touch before update on public.carousels for each row execute function app.touch_updated_at();

create table public.carousel_slides (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.carousels(artifact_id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  order_index int not null check (order_index between 0 and 99),
  asset_id uuid references public.image_generation_assets(id) on delete set null,
  -- A regenerated image waiting for "Use new" / "Keep current" (§27). Never replaces the current one by itself.
  pending_asset_id uuid references public.image_generation_assets(id) on delete set null,
  source_text text not null default '' check (char_length(source_text) <= 2000),
  display_text text not null default '' check (char_length(display_text) <= 2000),
  overlay jsonb not null default '{"enabled": false}'::jsonb check (jsonb_typeof(overlay) = 'object' and pg_column_size(overlay) <= 4096),
  image_transform jsonb not null default '{}'::jsonb check (jsonb_typeof(image_transform) = 'object' and pg_column_size(image_transform) <= 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index carousel_slides_order_idx on public.carousel_slides(artifact_id, order_index);
create index carousel_slides_asset_idx on public.carousel_slides(asset_id);
create index carousel_slides_pending_idx on public.carousel_slides(pending_asset_id);
create trigger carousel_slides_touch before update on public.carousel_slides for each row execute function app.touch_updated_at();

alter table public.carousels enable row level security;
alter table public.carousel_slides enable row level security;

create policy carousels_read on public.carousels for select to authenticated using (app.can_read_artifact(artifact_id));
create policy carousel_slides_read on public.carousel_slides for select to authenticated using (app.can_read_artifact(artifact_id));
create policy carousel_slides_edit on public.carousel_slides for update to authenticated
  using (app.artifact_access(artifact_id) in ('owner', 'edit'))
  with check (app.artifact_access(artifact_id) in ('owner', 'edit'));
-- Only the composition columns are writable by people; images and membership change on the server.
revoke insert, update, delete on public.carousel_slides from authenticated;
grant update (order_index, source_text, display_text, overlay, image_transform) on public.carousel_slides to authenticated;
revoke insert, update, delete on public.carousels from authenticated;

-- Image generations: carousels ask for up to 12 slides; a change can add a slide or offer a variation.
alter table public.image_generations drop constraint if exists image_generations_requested_count_check;
alter table public.image_generations add constraint image_generations_requested_count_check check (requested_count between 1 and 12);

alter table public.image_asset_revisions
  add column kind text not null default 'replace' check (kind in ('replace', 'variation', 'add', 'fill')),
  add column slide_id uuid references public.carousel_slides(id) on delete cascade,
  add column slide_text text check (slide_text is null or char_length(slide_text) <= 2000),
  alter column asset_id drop not null,
  alter column instruction drop not null;
alter table public.image_asset_revisions drop constraint if exists image_asset_revisions_instruction_check;
alter table public.image_asset_revisions add constraint image_asset_revisions_instruction_check check (instruction is null or char_length(instruction) between 1 and 300);
alter table public.image_asset_revisions add constraint image_asset_revisions_kind_shape check (
  (kind in ('add', 'fill') and asset_id is null) or (kind in ('replace', 'variation') and asset_id is not null)
);
create index image_asset_revisions_slide_idx on public.image_asset_revisions(slide_id);

-- Seeding a finished set into slides happens once, atomically: a concurrent caller waits on the row lock, then sees
-- the slides already there. Server pipeline only.
create or replace function public.carousel_seed(p_artifact uuid, p_rows jsonb)
returns int language plpgsql security definer set search_path = ''
as $$
declare v_creator uuid; v_n int;
begin
  update public.carousels set seeded_at = now() where artifact_id = p_artifact and seeded_at is null returning creator_id into v_creator;
  if v_creator is null then return 0; end if;
  insert into public.carousel_slides (artifact_id, creator_id, order_index, asset_id, source_text, display_text)
  select p_artifact, v_creator, (r->>'order_index')::int, nullif(r->>'asset_id', '')::uuid, coalesce(r->>'text', ''), coalesce(r->>'text', '')
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.carousel_seed(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.carousel_seed(uuid, jsonb) to service_role;
