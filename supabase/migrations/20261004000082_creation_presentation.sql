-- Creation pages (docs/ui-redesign/creation-pages.md): how a Creation is set on its own page — for writing, the words
-- over the cover, over it softly blurred, or on paper. A small object of choices; access is the Creation's own
-- (artifacts_update: only the creator).
alter table public.artifacts
  add column presentation jsonb not null default '{}'::jsonb;

alter table public.artifacts
  add constraint artifacts_presentation_shape check (jsonb_typeof(presentation) = 'object' and pg_column_size(presentation) <= 2048);
