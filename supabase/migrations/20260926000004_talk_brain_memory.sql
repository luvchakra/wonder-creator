-- CreatorTalk conversations, CreatorBrain run tracking/governance, Creative Memory.

create type public.memory_category as enum (
  'creative_preference', 'creative_voice', 'style_preference', 'creative_fact',
  'creative_history', 'relationship_context', 'project_context', 'recurring_theme'
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 160),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_creator_idx on public.conversations(creator_id, updated_at desc);
create trigger conversations_touch before update on public.conversations
  for each row execute function app.touch_updated_at();

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  role text not null check (role in ('creator', 'brain')),
  kind text not null default 'text' check (kind in ('text', 'understanding', 'directions', 'artifact', 'question', 'proposal', 'error')),
  content text not null default '' check (char_length(content) <= 100000),
  payload jsonb not null default '{}'::jsonb,
  input_mode text not null default 'text' check (input_mode in ('text', 'voice')),
  ai_run_id uuid,
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', left(content, 20000))) stored
);
create index conversation_messages_conv_idx on public.conversation_messages(conversation_id, created_at);
create index conversation_messages_search_idx on public.conversation_messages using gin(search);

create table public.conversation_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  material_id uuid references public.creative_materials(id) on delete set null,
  artifact_id uuid,
  created_at timestamptz not null default now(),
  check (material_id is not null or artifact_id is not null)
);

-- AI observability: no raw private prompts are stored here.
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  intent text not null,
  provider text not null,
  model text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  input_category text,
  output_category text,
  latency_ms int,
  input_tokens int,
  output_tokens int,
  estimated_cost_usd numeric(12, 6),
  failure_code text,
  conversation_id uuid references public.conversations(id) on delete set null,
  artifact_id uuid,
  correlation_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_runs_creator_idx on public.ai_runs(creator_id, started_at desc);

create table public.ai_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_runs(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  step text not null check (step in ('understand', 'research', 'plan', 'generate', 'critique', 'refine', 'validate', 'render')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_run_steps_run_idx on public.ai_run_steps(run_id, started_at);

create table public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ai_runs(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  tool text not null,
  autonomy_domain public.autonomy_domain not null,
  decision text not null check (decision in ('allowed', 'denied', 'needs_approval')),
  decision_reason text,
  outcome text check (outcome in ('executed', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  run_id uuid references public.ai_runs(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  domain public.autonomy_domain not null,
  action text not null,
  understood text not null,
  plan text not null,
  impact text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index ai_proposals_creator_idx on public.ai_proposals(creator_id, status, created_at desc);

-- Creative Memory: editable, removable, explainable.
create table public.creative_memories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  category public.memory_category not null,
  statement text not null check (char_length(statement) between 1 and 500),
  source_kind text not null check (source_kind in ('onboarding', 'conversation', 'artifact', 'material', 'creator', 'huddle')),
  source_id uuid,
  source_label text check (source_label is null or char_length(source_label) <= 200),
  confidence numeric(3, 2) not null default 0.70 check (confidence between 0 and 1),
  privacy public.privacy_class not null default 'creator_private',
  status text not null default 'active' check (status in ('active', 'removed')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', statement)) stored
);
create index memories_creator_idx on public.creative_memories(creator_id, status, category);
create index memories_search_idx on public.creative_memories using gin(search);
create trigger memories_touch before update on public.creative_memories
  for each row execute function app.touch_updated_at();

create table public.creative_memory_feedback (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.creative_memories(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('confirm', 'correct', 'remove')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- RLS ------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_attachments enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_run_steps enable row level security;
alter table public.ai_tool_calls enable row level security;
alter table public.ai_proposals enable row level security;
alter table public.creative_memories enable row level security;
alter table public.creative_memory_feedback enable row level security;

create policy conversations_own on public.conversations for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy messages_own on public.conversation_messages for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.creator_id = app.current_creator_id())
  );

create policy attachments_own on public.conversation_attachments for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and (material_id is null or app.owns_material(material_id)));

create policy ai_runs_own on public.ai_runs for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy ai_run_steps_own on public.ai_run_steps for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy ai_tool_calls_own on public.ai_tool_calls for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy ai_proposals_own on public.ai_proposals for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

create policy memories_own on public.creative_memories for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy memory_feedback_own on public.creative_memory_feedback for all to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
