-- Phase 05 — CreativeMind orchestration (docs/creativemind-orchestration.md, docs/phases/05-creativemind-orchestration-rollout.md).
--
-- Two kinds of derived, suggestion-only data. Both are written by the pipeline (service role, always scoped to a
-- server-resolved creator) and are never business truth: a connection is a suggestion the creator can open, use or
-- dismiss; a summary is presentation over replies anyone who can read the conversation already sees.

-- ------------------------------------------------------------------------------------ "Your world is connecting"
create table public.moment_connections (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  moment_ids uuid[] not null check (cardinality(moment_ids) between 2 and 4),
  connection_type text not null check (connection_type in ('shared_theme', 'shared_person', 'shared_place', 'same_memory', 'creative_opportunity', 'unused_pairing')),
  short_explanation text not null check (char_length(btrim(short_explanation)) between 8 and 200),
  -- "Why am I seeing this?": plain sentences about recorded facts (a shared tag, the same day) — never embeddings or
  -- model reasoning.
  evidence jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array' and pg_column_size(evidence) <= 4096),
  -- Internal ranking only; never shown (column not readable by creators).
  confidence_internal real not null default 0.5 check (confidence_internal >= 0 and confidence_internal <= 1),
  -- The same Moments connected the same way are one connection: a dismissed one never comes back.
  signature text not null check (char_length(signature) <= 400),
  status text not null default 'new' check (status in ('new', 'opened', 'dismissed', 'used')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  unique (creator_id, signature)
);
create index moment_connections_creator_idx on public.moment_connections(creator_id, status, created_at desc);

alter table public.moment_connections enable row level security;
create policy moment_connections_read on public.moment_connections for select to authenticated using (creator_id = app.current_creator_id());
create policy moment_connections_resolve on public.moment_connections for update to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and status in ('opened', 'dismissed', 'used'));
revoke insert, update, delete on public.moment_connections from authenticated;
revoke select on public.moment_connections from authenticated;
grant select (id, creator_id, moment_ids, connection_type, short_explanation, evidence, signature, status, created_at, expires_at, resolved_at) on public.moment_connections to authenticated;
grant update (status, resolved_at) on public.moment_connections to authenticated;

-- ------------------------------------------------------------------------------------ Conversation so far
create table public.open_conversation_summaries (
  conversation_id uuid primary key references public.open_conversations(id) on delete cascade,
  -- [{ text, replyIds }]: each point links back to the replies it comes from.
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 1 and 4 and pg_column_size(points) <= 8192),
  -- How many replies there were when it was written (a summary well behind the conversation reads as "earlier").
  reply_count_at int not null check (reply_count_at >= 0),
  generated_at timestamptz not null default now()
);
alter table public.open_conversation_summaries enable row level security;
-- Whoever can read the conversation can read its summary.
create policy open_conversation_summaries_read on public.open_conversation_summaries for select to authenticated using (app.can_view_conversation(conversation_id));
revoke insert, update, delete on public.open_conversation_summaries from authenticated;

-- ------------------------------------------------------------------------------------ Made from (committed provenance)
-- When a version is saved in the Studio, the sources actually in use (or pinned) are recorded against that version —
-- including other people's Community words applied as feedback or direction (Phase 05 §10, Scenario C), which lineage
-- edges can't hold. Immutable, like the version itself; the Working Set's experiments never land here.
create table public.artifact_version_sources (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_id uuid not null references public.artifact_versions(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  source_type text not null check (source_type in ('material', 'creation', 'collection', 'comment', 'huddle_moment', 'conversation', 'conversation_reply', 'scrapbook_entry')),
  source_id uuid not null,
  fragment jsonb check (fragment is null or (jsonb_typeof(fragment) = 'object' and pg_column_size(fragment) <= 4096)),
  roles text[] not null default '{}' check (cardinality(roles) <= 4),
  usage_intent text check (usage_intent is null or char_length(usage_intent) <= 40),
  -- Deterministic, as computed when committed (never inferred): what the source allowed, and the credit it needs.
  rights_state text not null check (rights_state in ('reuse_permitted', 'attribution_required', 'reference_only', 'unknown', 'restricted')),
  attribution text check (attribution is null or char_length(attribution) <= 300),
  created_at timestamptz not null default now(),
  unique (version_id, source_type, source_id)
);
create index artifact_version_sources_artifact_idx on public.artifact_version_sources(artifact_id, created_at desc);
alter table public.artifact_version_sources enable row level security;
create policy artifact_version_sources_read on public.artifact_version_sources for select to authenticated using (app.can_read_artifact(artifact_id));
create policy artifact_version_sources_insert on public.artifact_version_sources for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and app.owns_artifact(artifact_id)
    and exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = artifact_version_sources.artifact_id)
    and app.can_see_studio_source(source_type, source_id)
  );
revoke update, delete on public.artifact_version_sources from authenticated;
