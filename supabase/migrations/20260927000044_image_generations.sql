-- Contextual image generation (docs/image-generation.md): cache-first generations of visual concepts from a creator's
-- own context. Rows are pipeline state written by the server (service role, scoped by a server-resolved creator id), so
-- status, provider and assets can't be forged; creators and the collaborators of the parent Creation only read them.
-- Images live in private storage (storage_objects) and are served through short-lived signed URLs.

create table public.image_generations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  material_id uuid references public.creative_materials(id) on delete cascade,
  purpose text not null check (purpose in ('carousel', 'explore', 'creation', 'transform-preview', 'moodboard', 'hero', 'final')),
  aspect_ratio text not null check (aspect_ratio in ('1:1', '4:5', '3:2', '16:9', '9:16')),
  quality_intent text not null check (quality_intent in ('preview', 'standard', 'premium')),
  -- SHA-256 of the meaningful context (Creation/version, Material versions, purpose, aspect, quality, prompt + routing versions).
  context_hash text not null check (context_hash ~ '^[0-9a-f]{64}$'),
  -- 0 for the first generation of a context; "Regenerate" makes a new row with the next variation, never overwrites.
  variation int not null default 0 check (variation >= 0),
  -- The minimised context the prompt was built from (summaries, ids) — lineage, and what a retry rebuilds from.
  context jsonb not null default '{}'::jsonb,
  source_material_ids uuid[] not null default '{}',
  source_version int,
  provider text not null,
  model text not null,
  prompt_version text not null,
  routing_version text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'complete', 'partial', 'failed', 'cancelled')),
  requested_count int not null check (requested_count between 1 and 5),
  error_code text,
  idempotency_key text,
  latency_ms int,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (creator_id, context_hash, variation),
  unique (creator_id, idempotency_key)
);
create index image_generations_artifact_idx on public.image_generations(artifact_id, created_at desc) where artifact_id is not null;
create index image_generations_material_idx on public.image_generations(material_id, created_at desc) where material_id is not null;

create table public.image_generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.image_generations(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  storage_object_id uuid not null references public.storage_objects(id) on delete cascade,
  thumbnail_object_id uuid references public.storage_objects(id) on delete set null,
  width int,
  height int,
  sequence int not null check (sequence between 0 and 9),
  direction_label text check (direction_label is null or char_length(direction_label) <= 60),
  rationale text check (rationale is null or char_length(rationale) <= 160),
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (generation_id, sequence)
);

alter table public.image_generations enable row level security;
alter table public.image_generation_assets enable row level security;

-- Who may see a generation: its creator, and — for a Creation's generations — the Creation's collaborators, through the
-- same access that lets them open the Creation. Public viewers never see previews.
create or replace function app.can_see_image_generation(p_generation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.image_generations g
    where g.id = p_generation and (
      g.creator_id = app.current_creator_id()
      or (g.artifact_id is not null and app.artifact_access(g.artifact_id) is not null)
    )
  )
$$;
revoke execute on function app.can_see_image_generation(uuid) from public, anon;
grant execute on function app.can_see_image_generation(uuid) to authenticated;

create policy image_generations_read on public.image_generations for select to authenticated
  using (creator_id = app.current_creator_id() or (artifact_id is not null and app.artifact_access(artifact_id) is not null));
create policy image_generation_assets_read on public.image_generation_assets for select to authenticated
  using (app.can_see_image_generation(generation_id));
-- No insert/update/delete policies: the server pipeline writes these rows.
