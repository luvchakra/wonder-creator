-- Slide visuals the creator arranges and refines (docs/image-generation.md §61):
-- * `position` — the creator's order for the set (null = generated order).
-- * One image can be changed with the creator's own instruction. The result is a NEW asset that takes the old one's
--   place; the old asset is kept (`replaced_by`), never overwritten.
-- Rows stay pipeline-written (no client write policies); reads follow the generation's visibility.

alter table public.image_generation_assets
  add column position int check (position is null or position between 0 and 99),
  add column replaced_by uuid references public.image_generation_assets(id) on delete set null,
  add column revision_of uuid references public.image_generation_assets(id) on delete set null;

-- Revisions add assets to a generation, so a set can hold more than the first ten.
alter table public.image_generation_assets drop constraint if exists image_generation_assets_sequence_check;
alter table public.image_generation_assets add constraint image_generation_assets_sequence_check check (sequence between 0 and 99);

create table public.image_asset_revisions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  generation_id uuid not null references public.image_generations(id) on delete cascade,
  asset_id uuid not null references public.image_generation_assets(id) on delete cascade,
  -- The creator's own words for what should change. Private to them; never logged.
  instruction text not null check (char_length(instruction) between 1 and 300),
  status text not null default 'queued' check (status in ('queued', 'processing', 'complete', 'failed')),
  result_asset_id uuid references public.image_generation_assets(id) on delete set null,
  error_code text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (creator_id, idempotency_key)
);
create index image_asset_revisions_generation_idx on public.image_asset_revisions(generation_id, created_at desc);

alter table public.image_asset_revisions enable row level security;
-- Only the creator who asked sees their instructions (collaborators see the resulting image, not the words).
create policy image_asset_revisions_read on public.image_asset_revisions for select to authenticated
  using (creator_id = app.current_creator_id());
-- No insert/update/delete policies: the server pipeline writes these rows.
