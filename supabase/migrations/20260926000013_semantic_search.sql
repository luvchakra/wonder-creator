-- Semantic search over a creator's own materials and artifacts.
-- Embeddings are pipeline-owned (written by the server with the service role), readable only by the owner,
-- and never cover other creators' content.

create extension if not exists vector with schema extensions;

create table public.search_embeddings (
  subject_type text not null check (subject_type in ('material', 'artifact')),
  subject_id uuid not null,
  creator_id uuid not null references public.creators(id) on delete cascade,
  model text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  embedding extensions.vector(768) not null,
  updated_at timestamptz not null default now(),
  primary key (subject_type, subject_id)
);
create index search_embeddings_creator_idx on public.search_embeddings(creator_id);
create index search_embeddings_hnsw_idx on public.search_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.search_embeddings enable row level security;
create policy search_embeddings_own_read on public.search_embeddings for select to authenticated
  using (creator_id = app.current_creator_id());
-- No insert/update/delete policies: only the server pipeline writes embeddings.

-- Embeddings follow their subject: removed when the material or artifact is deleted.
create or replace function app.drop_search_embedding()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.search_embeddings
  where subject_type = tg_argv[0] and subject_id = old.id;
  return old;
end $$;
create trigger materials_drop_embedding after delete on public.creative_materials
  for each row execute function app.drop_search_embedding('material');
create trigger artifacts_drop_embedding after delete on public.artifacts
  for each row execute function app.drop_search_embedding('artifact');

/**
 * The caller's own materials/artifacts nearest to a query embedding (cosine similarity).
 * Security invoker: RLS on search_embeddings limits rows to the caller.
 */
create or replace function public.semantic_search(p_query extensions.vector(768), p_limit int default 8, p_min_similarity float default 0.5)
returns table (subject_type text, subject_id uuid, similarity float)
language sql stable security invoker set search_path = ''
as $$
  select e.subject_type, e.subject_id, 1 - (e.embedding operator(extensions.<=>) p_query) as similarity
  from public.search_embeddings e
  where e.creator_id = app.current_creator_id()
    and 1 - (e.embedding operator(extensions.<=>) p_query) >= p_min_similarity
  order by e.embedding operator(extensions.<=>) p_query
  limit least(greatest(p_limit, 1), 50)
$$;
revoke execute on function public.semantic_search(extensions.vector, int, float) from public, anon;
grant execute on function public.semantic_search(extensions.vector, int, float) to authenticated;

/**
 * Subjects whose embedding is missing or older than the subject (pipeline use; service role only).
 * Only active, clean, non-restricted material and non-archived artifacts are indexed.
 */
create or replace function public.stale_search_subjects(p_creator uuid default null, p_limit int default 50)
returns table (subject_type text, subject_id uuid, creator_id uuid)
language sql stable security definer set search_path = ''
as $$
  (select 'material'::text, m.id, m.creator_id
   from public.creative_materials m
   left join public.search_embeddings e on e.subject_type = 'material' and e.subject_id = m.id
   where (p_creator is null or m.creator_id = p_creator)
     and m.status = 'active' and m.security_status = 'clean' and m.privacy <> 'system_restricted'
     and (e.subject_id is null or e.updated_at < m.updated_at)
   order by m.updated_at desc
   limit least(greatest(p_limit, 1), 500))
  union all
  (select 'artifact'::text, a.id, a.creator_id
   from public.artifacts a
   left join public.search_embeddings e on e.subject_type = 'artifact' and e.subject_id = a.id
   where (p_creator is null or a.creator_id = p_creator)
     and a.status <> 'archived' and a.privacy <> 'system_restricted' and a.current_version_id is not null
     and (e.subject_id is null or e.updated_at < a.updated_at)
   order by a.updated_at desc
   limit least(greatest(p_limit, 1), 500))
$$;
revoke execute on function public.stale_search_subjects(uuid, int) from public, anon, authenticated;
grant execute on function public.stale_search_subjects(uuid, int) to service_role;
