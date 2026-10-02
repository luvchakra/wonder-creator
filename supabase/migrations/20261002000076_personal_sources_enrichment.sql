-- Personal Sources › CreativeMind (phase E, docs/personal-sources.md): one concise creative possibility per shortlisted
-- candidate, written by the server from a governed model call on already-redacted context. Never by the creator's
-- client (no grant), never for more than the shortlist, and recomputed only when the group's content changes.
alter table public.context_candidates
  add column suggestion text check (suggestion is null or char_length(suggestion) <= 200),
  add column suggested_format text check (suggested_format is null or suggested_format in ('writing', 'carousel', 'image', 'video', 'audio', 'presentation')),
  add column enrichment_hash text check (enrichment_hash is null or char_length(enrichment_hash) <= 64),
  add column enriched_at timestamptz;

-- Targeted search ("Look further back for …", spec §6): a sync job may carry the creator's query; it's bounded like any
-- other job and never turns into an unlimited historical scan.
alter table public.source_sync_jobs
  add column query text check (query is null or char_length(query) between 2 and 80);
