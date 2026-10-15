-- Made from, per slide (docs/ui-redesign/creative-studio-working-set.md §39; carousel-composer.md): when a creator puts
-- one of their Materials on a Carousel slide, the copy in the Carousel's image set now remembers which Material it came
-- from, so the Slide Editor can say "Made from: Station photograph" instead of guessing. Written only by the server
-- (the pipeline that copies the photo); read like the rest of the asset row. A deleted Material leaves the image and
-- clears the link.
alter table public.image_generation_assets
  add column source_material_id uuid references public.creative_materials(id) on delete set null;
create index image_generation_assets_source_material_idx on public.image_generation_assets(source_material_id) where source_material_id is not null;

-- Earlier photos: the audit trail recorded each placement (audit_logs: carousel.slide_photo · slideId → materialId). The newest
-- placement on a slide whose current image is "Your photo" is that image's Material, when the Material still exists.
update public.image_generation_assets a
set source_material_id = m.id
from public.carousel_slides s
join lateral (
  select (l.metadata->>'materialId')::uuid as material_id
  from public.audit_logs l
  where l.action = 'carousel.slide_photo' and l.metadata->>'slideId' = s.id::text and l.metadata->>'materialId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by l.created_at desc
  limit 1
) placed on true
join public.creative_materials m on m.id = placed.material_id
where s.asset_id = a.id and m.creator_id = a.creator_id and a.direction_label = 'Your photo' and a.source_material_id is null;
