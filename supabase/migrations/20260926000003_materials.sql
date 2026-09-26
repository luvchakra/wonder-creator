-- Creative Material, provenance, CreatorSend intake, collections and Reference Shelf.

create type public.material_type as enum (
  'idea', 'note', 'text', 'voice', 'image', 'sketch', 'document', 'pdf', 'audio', 'video',
  'url', 'reference', 'research', 'conversation', 'inspiration'
);
create type public.intake_state as enum (
  'received', 'validating', 'security_review', 'extracting', 'normalizing',
  'understood', 'ready', 'failed', 'quarantined'
);
create type public.security_status as enum ('pending', 'clean', 'quarantined', 'rejected');

-- Provenance is first-class and shared by materials and artifacts.
create table public.provenance_records (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  origin text not null check (origin in (
    'upload', 'camera', 'voice_recording', 'paste', 'typed', 'url', 'youtube',
    'huddle', 'conversation', 'ai_generated', 'derived', 'import'
  )),
  source_url text,
  original_filename text,
  sha256 text,
  huddle_id uuid,
  conversation_id uuid,
  ai_run_id uuid,
  details jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create index provenance_creator_idx on public.provenance_records(creator_id);

create table public.creative_materials (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  type public.material_type not null,
  title text check (title is null or char_length(title) <= 200),
  text_content text check (text_content is null or char_length(text_content) <= 200000),
  extracted_text text,
  storage_object_id uuid references public.storage_objects(id) on delete set null,
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  source_type text,
  metadata jsonb not null default '{}'::jsonb,
  understanding jsonb,
  provenance_id uuid not null references public.provenance_records(id),
  security_status public.security_status not null default 'pending',
  processing_state public.intake_state not null default 'received',
  privacy public.privacy_class not null default 'creator_private',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(text_content, '')), 'B') ||
    setweight(to_tsvector('simple', left(coalesce(extracted_text, ''), 50000)), 'C')
  ) stored
);
create index materials_creator_idx on public.creative_materials(creator_id, created_at desc);
create index materials_search_idx on public.creative_materials using gin(search);
create trigger materials_touch before update on public.creative_materials
  for each row execute function app.touch_updated_at();

create table public.creative_material_tags (
  material_id uuid not null references public.creative_materials(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 40),
  primary key (material_id, tag)
);

create table public.material_collections (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  privacy public.privacy_class not null default 'creator_private',
  created_at timestamptz not null default now(),
  unique (creator_id, name)
);
create table public.material_collection_items (
  collection_id uuid not null references public.material_collections(id) on delete cascade,
  material_id uuid not null references public.creative_materials(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, material_id)
);

-- CreatorSend intake: each external input moves through explicit states.
create table public.intake_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  batch_id uuid not null,
  input_kind text not null check (input_kind in (
    'text', 'voice', 'image', 'camera', 'document', 'pdf', 'audio', 'video', 'url', 'youtube'
  )),
  state public.intake_state not null default 'received',
  material_id uuid references public.creative_materials(id) on delete set null,
  storage_object_id uuid references public.storage_objects(id) on delete set null,
  source_url text,
  instruction text check (instruction is null or char_length(instruction) <= 2000),
  error_code text,
  error_message text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index intake_creator_idx on public.intake_items(creator_id, created_at desc);
create index intake_batch_idx on public.intake_items(batch_id);
create trigger intake_touch before update on public.intake_items
  for each row execute function app.touch_updated_at();

-- Reference Shelf: named sets of inspiration that point at materials.
create table public.reference_shelves (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (creator_id, name)
);
create table public.reference_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  shelf_id uuid references public.reference_shelves(id) on delete set null,
  material_id uuid not null references public.creative_materials(id) on delete cascade,
  note text check (note is null or char_length(note) <= 1000),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (shelf_id, material_id)
);
create index reference_items_creator_idx on public.reference_items(creator_id, created_at desc);

-- Cross-row ownership: a creator can only link rows they own.
create or replace function app.owns_material(p_material uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.creative_materials m where m.id = p_material and m.creator_id = app.current_creator_id()) $$;

-- RLS ------------------------------------------------------------------------
alter table public.provenance_records enable row level security;
alter table public.creative_materials enable row level security;
alter table public.creative_material_tags enable row level security;
alter table public.material_collections enable row level security;
alter table public.material_collection_items enable row level security;
alter table public.intake_items enable row level security;
alter table public.reference_shelves enable row level security;
alter table public.reference_items enable row level security;

create policy provenance_own on public.provenance_records for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy materials_own on public.creative_materials for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy material_tags_own on public.creative_material_tags for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.owns_material(material_id));

create policy collections_own on public.material_collections for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy collection_items_own on public.material_collection_items for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id() and app.owns_material(material_id)
    and exists (select 1 from public.material_collections c where c.id = collection_id and c.creator_id = app.current_creator_id())
  );

create policy intake_own on public.intake_items for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy shelves_own on public.reference_shelves for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy reference_items_own on public.reference_items for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id() and app.owns_material(material_id)
    and (shelf_id is null or exists (select 1 from public.reference_shelves s where s.id = shelf_id and s.creator_id = app.current_creator_id()))
  );

-- Private media bucket. Object keys are "<creator_id>/<uuid>" and never shown to clients.
insert into storage.buckets (id, name, public, file_size_limit)
values ('creator-media', 'creator-media', false, 104857600)
on conflict (id) do nothing;

create policy "creator media owner read" on storage.objects for select to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = app.current_creator_id()::text);
create policy "creator media owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-media' and (storage.foldername(name))[1] = app.current_creator_id()::text);
create policy "creator media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = app.current_creator_id()::text);
