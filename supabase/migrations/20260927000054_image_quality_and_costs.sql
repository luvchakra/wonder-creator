-- Contextual image generation phases 10–11 (docs/image-generation.md §49–50, §53, §62): a high-quality version of a
-- chosen image on request, and the records cost governance needs — without any creator content.

-- 1. "High quality version" (§62 upgrade path): an `upgrade` change re-creates one chosen image with the premium model,
--    using it as the reference. The old image stays in history (replaced_by), exactly like a creator's change.
alter table public.image_asset_revisions drop constraint image_asset_revisions_kind_check;
alter table public.image_asset_revisions add constraint image_asset_revisions_kind_check
  check (kind in ('replace', 'variation', 'add', 'fill', 'upgrade'));
alter table public.image_asset_revisions drop constraint image_asset_revisions_kind_shape;
alter table public.image_asset_revisions add constraint image_asset_revisions_kind_shape check (
  (kind in ('add', 'fill') and asset_id is null) or (kind in ('replace', 'variation', 'upgrade') and asset_id is not null)
);
-- What a change actually ran on (a change may use a different tier than its generation), and how long it took.
alter table public.image_asset_revisions
  add column quality_intent text check (quality_intent is null or quality_intent in ('preview', 'standard', 'premium')),
  add column model text check (model is null or char_length(model) <= 120),
  add column latency_ms int check (latency_ms is null or latency_ms >= 0);

-- An image's own tier when it differs from its generation's (an upgraded image is premium in a preview set).
alter table public.image_generation_assets
  add column quality_intent text check (quality_intent is null or quality_intent in ('preview', 'standard', 'premium'));

-- 2. Cache savings (§50): how often a stored generation was served instead of generating again.
alter table public.image_generations
  add column cache_hits int not null default 0 check (cache_hits >= 0),
  add column last_cache_hit_at timestamptz;

create or replace function public.image_generation_cache_hit(p_generation uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.image_generations set cache_hits = cache_hits + 1, last_cache_hit_at = now() where id = p_generation
$$;
revoke execute on function public.image_generation_cache_hit(uuid) from public, anon, authenticated;
grant execute on function public.image_generation_cache_hit(uuid) to service_role;

-- 3. Cost governance (§49): one row per day × provider × model × tier × purpose × source. Counts and timings only —
--    no prompts, context, instructions or creator ids. Lives in `app`, which the API doesn't expose; read it with the
--    service role or in the SQL editor (docs/image-generation.md "Cost telemetry").
create or replace view app.image_generation_daily_costs as
with gens as (
  select date_trunc('day', g.created_at)::date as day, g.provider, g.model, g.quality_intent, g.purpose, 'generation'::text as source,
         g.creator_id, g.status, g.variation, g.requested_count, g.latency_ms, g.cache_hits,
         (select count(*) from public.image_generation_assets a where a.generation_id = g.id and a.revision_of is null) as images
  from public.image_generations g
),
revs as (
  select date_trunc('day', r.created_at)::date as day, g.provider, coalesce(r.model, g.model) as model,
         coalesce(r.quality_intent, g.quality_intent) as quality_intent, g.purpose, 'change:' || r.kind as source,
         r.creator_id, r.status, 0 as variation, 1 as requested_count, r.latency_ms, 0 as cache_hits,
         (r.status = 'complete')::int as images
  from public.image_asset_revisions r join public.image_generations g on g.id = r.generation_id
)
select day, provider, model, quality_intent, purpose, source,
       count(*) as requests,
       count(*) filter (where variation > 0) as regenerations,
       sum(requested_count) as images_requested,
       sum(images) as images_made,
       count(*) filter (where status = 'failed') as failed,
       count(*) filter (where status = 'partial') as partial,
       sum(cache_hits) as cache_hits,
       round(avg(latency_ms))::int as avg_latency_ms,
       count(distinct creator_id) as creators
from (select * from gens union all select * from revs) x
group by day, provider, model, quality_intent, purpose, source;
revoke all on app.image_generation_daily_costs from public, anon, authenticated;
grant select on app.image_generation_daily_costs to service_role;
