-- Contextual image generation §64–65: a generated image the creator keeps becomes a Creative Material (origin
-- ai_generated, with generation provenance and lineage). The asset remembers it so saving twice returns the same one.
alter table public.image_generation_assets
  add column saved_material_id uuid references public.creative_materials(id) on delete set null;
