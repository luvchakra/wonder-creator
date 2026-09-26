-- P0.1-01 Creative Material Detail: creator-written description and rights/source notes, and "similar
-- materials" from the creator's own semantic index.

alter table public.creative_materials
  add column description text check (description is null or char_length(description) <= 2000),
  add column source_note text check (source_note is null or char_length(source_note) <= 1000);

/**
 * The caller's other materials closest in meaning to one of their materials (cosine similarity over
 * search_embeddings). Security invoker: RLS limits both the anchor and the candidates to the caller.
 */
create or replace function public.similar_materials(p_material uuid, p_limit int default 6, p_min_similarity float default 0.5)
returns table (material_id uuid, similarity float)
language sql stable security invoker set search_path = ''
as $$
  select e.subject_id, 1 - (e.embedding operator(extensions.<=>) a.embedding)
  from public.search_embeddings a
  join public.search_embeddings e on e.subject_type = 'material' and e.subject_id <> a.subject_id and e.creator_id = a.creator_id
  join public.creative_materials m on m.id = e.subject_id and m.status = 'active'
  where a.subject_type = 'material' and a.subject_id = p_material and a.creator_id = app.current_creator_id()
    and 1 - (e.embedding operator(extensions.<=>) a.embedding) >= p_min_similarity
  order by e.embedding operator(extensions.<=>) a.embedding
  limit least(greatest(p_limit, 1), 24)
$$;
revoke execute on function public.similar_materials(uuid, int, float) from public, anon;
grant execute on function public.similar_materials(uuid, int, float) to authenticated;
