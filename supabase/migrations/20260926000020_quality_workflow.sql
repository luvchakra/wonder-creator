-- P0.1-05 Quality review & selective refinement: the creator's decisions on each finding.
-- Keys identify findings within one report ("s0" = first suggestion, "c:pacing" = an attention check).
-- - dismissed: findings the creator chose not to act on (rights/provenance findings can't be dismissed;
--   the app never offers it and recomputes them from provenance on every review).
-- - applied: findings the creator applied through an approved revision.
alter table public.quality_reports
  add column dismissed jsonb not null default '[]'::jsonb check (jsonb_typeof(dismissed) = 'array' and jsonb_array_length(dismissed) <= 50),
  add column applied jsonb not null default '[]'::jsonb check (jsonb_typeof(applied) = 'array' and jsonb_array_length(applied) <= 50);
