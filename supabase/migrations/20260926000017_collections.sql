-- P0.1-02 Material Collections: archive, cover, manual order, and collection usage in provenance.
-- Collections only reference materials (never copy them) and stay private to their owner.

create or replace function app.owns_collection(p_collection uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.material_collections c where c.id = p_collection and c.creator_id = app.current_creator_id()) $$;
revoke execute on function app.owns_collection(uuid) from public, anon;
grant execute on function app.owns_collection(uuid) to authenticated;

alter table public.material_collections
  add column status text not null default 'active' check (status in ('active', 'archived')),
  add column cover_material_id uuid references public.creative_materials(id) on delete set null,
  add column updated_at timestamptz not null default now();
create index material_collections_cover_material_id_fk_idx on public.material_collections(cover_material_id);
create trigger material_collections_touch before update on public.material_collections
  for each row execute function app.touch_updated_at();

-- A collection is never shared by itself: sharing it must not widen access to private material.
alter table public.material_collections drop constraint if exists material_collections_privacy_private;
alter table public.material_collections add constraint material_collections_privacy_private check (privacy = 'creator_private');

-- The cover must be one of the owner's own materials.
drop policy collections_own on public.material_collections;
create policy collections_read on public.material_collections for select to authenticated
  using (creator_id = app.current_creator_id());
create policy collections_insert on public.material_collections for insert to authenticated
  with check (creator_id = app.current_creator_id() and (cover_material_id is null or app.owns_material(cover_material_id)));
create policy collections_update on public.material_collections for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and (cover_material_id is null or app.owns_material(cover_material_id)));
create policy collections_delete on public.material_collections for delete to authenticated
  using (creator_id = app.current_creator_id());

-- Manual order; null sorts after ordered items, newest first.
alter table public.material_collection_items add column position int check (position is null or position >= 0);
create index material_collection_items_order_idx on public.material_collection_items(collection_id, position);

-- A conversation started from a collection remembers it, so what's created there records the collection.
alter table public.conversations add column collection_id uuid references public.material_collections(id) on delete set null;
create index conversations_collection_id_fk_idx on public.conversations(collection_id);
drop policy conversations_own on public.conversations;
create policy conversations_read on public.conversations for select to authenticated
  using (creator_id = app.current_creator_id());
create policy conversations_insert on public.conversations for insert to authenticated
  with check (creator_id = app.current_creator_id() and (collection_id is null or app.owns_collection(collection_id)));
create policy conversations_update on public.conversations for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and (collection_id is null or app.owns_collection(collection_id)));
create policy conversations_delete on public.conversations for delete to authenticated
  using (creator_id = app.current_creator_id());

-- Lineage may name a collection as a source (ownership-checked like every other source).
alter table public.lineage_edges drop constraint lineage_edges_source_type_check;
alter table public.lineage_edges add constraint lineage_edges_source_type_check
  check (source_type in ('material', 'artifact', 'artifact_version', 'reference', 'conversation', 'huddle', 'collection'));
drop policy lineage_write on public.lineage_edges;
create policy lineage_write on public.lineage_edges for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and case target_type
      when 'artifact' then app.owns_artifact(target_id)
      when 'material' then app.owns_material(target_id)
      else exists (select 1 from public.artifact_versions v where v.id = target_id and app.owns_artifact(v.artifact_id))
    end
    and case source_type
      when 'artifact' then app.can_read_artifact(source_id)
      when 'material' then app.owns_material(source_id)
      when 'artifact_version' then exists (select 1 from public.artifact_versions v where v.id = source_id and app.can_read_artifact(v.artifact_id))
      when 'conversation' then app.owns_conversation(source_id)
      when 'reference' then exists (select 1 from public.reference_items r where r.id = source_id and r.creator_id = app.current_creator_id())
      when 'huddle' then app.is_huddle_participant(source_id)
        or exists (select 1 from public.huddle_preserved_items p where p.huddle_id = source_id and p.creator_id = app.current_creator_id())
      when 'collection' then app.owns_collection(source_id)
      else false
    end
  );
